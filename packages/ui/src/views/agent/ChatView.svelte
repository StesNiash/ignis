<script>
  import { renderResponse, renderFromBackend, parseMarkdown } from "./chat-renderer.js";

  export let linkHandler = null;
  export let loadingHtml = null;

  const API = "/api/ext/agent";
  const PLACEHOLDER = "Ask a question about materials, experiments, properties...";

  let messages = [];
  let input = "";
  let loading = false;
  let messagesEl;
  let currentSessionId = null;
  let sessionTitle = "New Chat";
  let sessions = [];
  let showSessions = false;
  let sessionLoaded = false;
  let saveTimer = null;

  $: if (messagesEl && messages.length > 0) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  $: if (sessionLoaded && currentSessionId && messages) {
    scheduleSave();
  }

  async function initSessions() {
    try {
      const res = await fetch(`${API}/sessions`);
      if (!res.ok) return;
      sessions = await res.json();

      if (sessions.length > 0) {
        await loadSession(sessions[0].id);
      } else {
        await createSession();
      }
    } catch {
      await createSession();
    }
  }

  async function createSession() {
    try {
      const res = await fetch(`${API}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!res.ok) return;
      const s = await res.json();
      currentSessionId = s.id;
      sessionTitle = s.title;
      messages = [];
      sessionLoaded = true;
    } catch { /* offline */ }
  }

  async function loadSession(id) {
    try {
      const res = await fetch(`${API}/sessions/${id}`);
      if (!res.ok) return;
      const s = await res.json();
      currentSessionId = s.id;
      sessionTitle = s.title || "Untitled";
      messages = s.messages || [];
      sessionLoaded = true;
      showSessions = false;
    } catch { /* offline */ }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSession, 500);
  }

  async function saveSession() {
    if (!currentSessionId) return;
    try {
      await fetch(`${API}/sessions/${currentSessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, title: sessionTitle }),
      });
    } catch { /* offline */ }
  }

  async function deleteSession(id, e) {
    e.stopPropagation();
    try {
      await fetch(`${API}/sessions/${id}`, { method: "DELETE" });
      sessions = sessions.filter((s) => s.id !== id);
      if (id === currentSessionId) {
        if (sessions.length > 0) {
          await loadSession(sessions[0].id);
        } else {
          await createSession();
        }
      }
    } catch { /* offline */ }
  }

  async function newChat() {
    await createSession();
    await fetchSessions();
    showSessions = false;
  }

  async function fetchSessions() {
    try {
      const res = await fetch(`${API}/sessions`);
      if (res.ok) sessions = await res.json();
    } catch { /* offline */ }
  }

  function toggleSessions() {
    showSessions = !showSessions;
    if (showSessions) fetchSessions();
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  function openLink(path, quote) {
    if (linkHandler) {
      linkHandler(path, quote || null);
    } else if (window.__ignis?.obsidian?.app?.workspace?.openLinkText) {
      window.__ignis.obsidian.app.workspace.openLinkText(path, quote || "", false);
    }
  }

  function handleLinkClick(e) {
    const target = e.target;
    if (target.classList.contains("agent-link")) {
      const path = target.getAttribute("data-path");
      if (path) {
        e.preventDefault();
        openLink(path, target.getAttribute("data-quote"));
      }
    }
  }

  function buildHistory(maxPairs = 5) {
    const pairs = [];
    for (let i = messages.length - 1; i >= 0 && pairs.length < maxPairs; i--) {
      if (messages[i].role === "agent") {
        const userMsg = i > 0 && messages[i - 1].role === "user" ? messages[i - 1] : null;
        if (userMsg) {
          pairs.unshift({ user: userMsg.content, agent: messages[i].content });
          i--;
        }
      }
    }

    if (pairs.length === 0) return "";

    let ctx = "";
    for (const p of pairs) {
      ctx += `Q: ${p.user}\nA: ${p.agent}\n\n`;
    }
    return ctx.trimEnd();
  }

  async function sendMessage() {
    const query = input.trim();
    if (!query || loading) return;

    if (messages.length === 0 && sessionTitle === "New Chat") {
      sessionTitle = query.slice(0, 40) + (query.length > 40 ? "..." : "");
    }

    messages = [...messages, { role: "user", content: query }];
    input = "";
    loading = true;

    const history = buildHistory();
    const enhancedQuery = history ? `${history}\nCurrent: ${query}` : query;

    try {
      const res = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: enhancedQuery }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        await handleSSE(res);
      } else {
        const data = await res.json();
        const html = renderResponse(data);
        messages = [...messages, { role: "agent", content: data.answer, html }];
      }
    } catch (err) {
      messages = [...messages, { role: "error", content: err.message || "Unknown error" }];
    } finally {
      loading = false;
    }
  }

  async function handleSSE(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventType = "";
    let answerText = "";
    let citations = [];
    let subgraph = { nodes: [], edges: [] };
    let hasError = false;

    messages = [...messages, { role: "agent", content: "", html: "" }];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6));
            switch (eventType) {
              case "token": {
                const text = typeof payload === "string" ? payload : String(payload);
                answerText += text;
                const html = `<div class="agent-block agent-block--answer">${parseMarkdown(answerText)}<span class="agent-cursor">|</span></div>`;
                const rest = messages.slice(0, -1);
                messages = [...rest, { role: "agent", content: answerText, html }];
                break;
              }
              case "citations":
                citations = Array.isArray(payload) ? payload : [];
                break;
              case "subgraph":
                subgraph = payload && payload.nodes ? payload : { nodes: [], edges: [] };
                break;
              case "error":
                hasError = true;
                const errText = typeof payload === "string" ? payload : (payload?.message || "Backend error");
                const restErr = messages.slice(0, -1);
                messages = [...restErr, { role: "error", content: errText }];
                break;
            }
          } catch { /* skip malformed events */ }
        }
      }
    }

    if (!hasError) {
      const html = renderFromBackend(answerText, subgraph, citations);
      const rest = messages.slice(0, -1);
      messages = [...rest, { role: "agent", content: answerText, html }];
    }
  }

  function onKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  initSessions();
</script>

<div class="agent-chat-container">
  <div class="agent-chat-header">
    <div class="agent-chat-header-left">
      <button class="agent-chat-sessions-btn" on:click={toggleSessions} title="Sessions">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
      </button>
      <button class="agent-chat-new-btn" on:click={newChat} title="New Chat">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <h3>{sessionTitle}</h3>
    </div>
  </div>

  <div class="agent-chat-body">
    {#if showSessions}
      <div class="agent-sessions-panel">
        <div class="agent-sessions-panel-header">
          <span>Sessions</span>
          <button class="agent-chat-new-btn" on:click={newChat} title="New Chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div class="agent-sessions-list">
          {#each sessions as s (s.id)}
            <div
              class="agent-session-item"
              class:active={s.id === currentSessionId}
              role="button"
              tabindex="0"
              on:click={() => loadSession(s.id)}
              on:keydown={(e) => { if (e.key === 'Enter') loadSession(s.id); }}
            >
              <div class="agent-session-item-title">{s.title || "Untitled"}</div>
              <div class="agent-session-item-meta">
                <span>{s.messageCount} msg</span>
                <span>{formatDate(s.updatedAt)}</span>
              </div>
              <button
                class="agent-session-delete"
                on:click={(e) => deleteSession(s.id, e)}
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div
      class="agent-chat-messages"
      bind:this={messagesEl}
      role="log"
      tabindex="0"
      on:click={handleLinkClick}
      on:keydown={() => {}}
    >
      {#if messages.length === 0}
        <div class="agent-chat-placeholder">{PLACEHOLDER}</div>
      {/if}

      {#each messages as msg (msg === messages[messages.length - 1] ? null : Math.random())}
        {#if msg.role === "user"}
          <div class="agent-chat-message agent-chat-message--user">
            <div class="agent-chat-message-body">{msg.content}</div>
          </div>
        {:else if msg.role === "agent"}
          <div class="agent-chat-message agent-chat-message--agent">
            <div class="agent-chat-message-header">
              <span class="agent-chat-message-role">Agent</span>
            </div>
            <div class="agent-chat-message-body">{@html msg.html}</div>
          </div>
        {:else if msg.role === "error"}
          <div class="agent-chat-message agent-chat-message--error">
            <div class="agent-chat-message-body">{msg.content}</div>
          </div>
        {/if}
      {/each}

      {#if loading}
        {#if loadingHtml}
          {@html loadingHtml}
        {:else}
          <div class="agent-chat-loading">Agent is thinking...</div>
        {/if}
      {/if}
    </div>
  </div>

  <div class="agent-chat-input-area">
    <textarea
      class="agent-chat-input"
      rows="3"
      bind:value={input}
      on:keydown={onKeydown}
      placeholder={PLACEHOLDER}
    ></textarea>
    <button class="agent-chat-send-button" on:click={sendMessage} disabled={loading}>
      Send
    </button>
  </div>
</div>

<style>
  :global(.agent-chat-container) {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  :global(.agent-chat-header) {
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  :global(.agent-chat-header-left) {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  :global(.agent-chat-header h3) {
    margin: 0;
    font-size: 0.95em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.agent-chat-sessions-btn) {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  :global(.agent-chat-sessions-btn:hover) {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  :global(.agent-chat-new-btn) {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  :global(.agent-chat-new-btn:hover) {
    color: var(--text-accent);
    background: var(--background-modifier-hover);
  }

  :global(.agent-chat-body) {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  :global(.agent-sessions-panel) {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :global(.agent-sessions-panel-header) {
    padding: 8px 12px;
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  :global(.agent-sessions-list) {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  :global(.agent-session-item) {
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
  }

  :global(.agent-session-item:hover) {
    background: var(--background-modifier-hover);
  }

  :global(.agent-session-item.active) {
    background: var(--background-modifier-hover);
  }

  :global(.agent-session-item-title) {
    font-size: 0.85em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 20px;
  }

  :global(.agent-session-item-meta) {
    font-size: 0.72em;
    color: var(--text-muted);
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }

  :global(.agent-session-delete) {
    position: absolute;
    top: 8px;
    right: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: none;
  }

  :global(.agent-session-item:hover .agent-session-delete) {
    display: flex;
  }

  :global(.agent-session-delete:hover) {
    color: var(--text-error);
    background: var(--background-modifier-error);
  }

  :global(.agent-chat-messages) {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    user-select: text;
    -webkit-user-select: text;
  }

  :global(.agent-chat-placeholder) {
    color: var(--text-muted);
    text-align: center;
    padding: 24px 0;
    font-style: italic;
  }

  :global(.agent-chat-message) {
    border-radius: 8px;
    padding: 8px 12px;
    max-width: 90%;
  }

  :global(.agent-chat-message--user) {
    align-self: flex-end;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  :global(.agent-chat-message--agent) {
    align-self: flex-start;
    background-color: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    max-width: 95%;
  }

  :global(.agent-chat-message--error) {
    align-self: center;
    background-color: var(--background-modifier-error);
    color: var(--text-error);
    font-size: 0.85em;
  }

  :global(.agent-chat-message-header) {
    font-size: 0.75em;
    opacity: 0.7;
    margin-bottom: 4px;
  }

  :global(.agent-chat-message-role) {
    font-weight: 600;
  }

  :global(.agent-chat-message-body) {
    font-size: 0.9em;
    line-height: 1.5;
    word-break: break-word;
  }

  :global(.agent-chat-message-body a) {
    color: var(--link-color);
    text-decoration: none;
  }

  :global(.agent-chat-message-body a:hover) {
    text-decoration: underline;
  }

  :global(.agent-chat-loading) {
    align-self: flex-start;
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.85em;
    padding: 8px 12px;
  }

  :global(.agent-block) {
    margin-top: 10px;
  }

  :global(.agent-block--answer) {
    margin-top: 0;
  }

  :global(.agent-block--answer h2),
  :global(.agent-block--answer h3),
  :global(.agent-block--answer h4) {
    margin: 10px 0 4px;
    font-size: 1em;
  }

  :global(.agent-block--answer h3) { font-weight: 700; }
  :global(.agent-block--answer h4) { font-weight: 600; }

  :global(.agent-block--answer p) { margin: 4px 0; }
  :global(.agent-block--answer ul),
  :global(.agent-block--answer ol) { margin: 4px 0; padding-left: 20px; }
  :global(.agent-block--answer li) { margin: 2px 0; }
  :global(.agent-block--answer code) {
    background: var(--background-modifier-border);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
  }
  :global(.agent-block--answer strong) { font-weight: 700; }
  :global(.agent-block--answer em) { font-style: italic; }
  :global(.agent-block--answer hr) {
    border: none;
    border-top: 1px solid var(--background-modifier-border);
    margin: 8px 0;
  }
  :global(.agent-block--answer a) {
    color: var(--link-color);
    text-decoration: underline;
  }

  :global(.agent-block-label) {
    font-weight: 600;
    font-size: 0.8em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
    letter-spacing: 0.05em;
  }

  :global(.agent-entity-list) {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  :global(.agent-entity) {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.82em;
    font-weight: 500;
  }

  :global(.agent-entity--material) { background: rgba(78, 121, 167, 0.15); color: var(--text-accent); }
  :global(.agent-entity--experiment) { background: rgba(89, 161, 79, 0.15); color: #59a14f; }
  :global(.agent-entity--property) { background: rgba(237, 201, 72, 0.15); color: #c9a90e; }
  :global(.agent-entity--regime) { background: rgba(225, 87, 89, 0.15); color: #e15759; }
  :global(.agent-entity--equipment) { background: rgba(178, 126, 197, 0.15); color: #b07cc5; }
  :global(.agent-entity--team) { background: rgba(242, 142, 44, 0.15); color: #f28e2c; }
  :global(.agent-entity--topic) { background: rgba(118, 183, 178, 0.15); color: #76b7b2; }

  :global(.agent-relation-list) { font-size: 0.85em; }
  :global(.agent-relation) { padding: 2px 0; }
  :global(.agent-relation-type) { color: var(--text-accent); font-style: italic; }

  :global(.agent-source-list) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.agent-source) {
    padding: 6px 8px;
    border-left: 3px solid var(--interactive-accent);
    background: var(--background-primary);
    border-radius: 0 4px 4px 0;
  }

  :global(.agent-source-link) { margin-bottom: 2px; }
  :global(.agent-link) { color: var(--link-color); cursor: pointer; text-decoration: underline; font-weight: 500; }
  :global(.agent-link:hover) { color: var(--link-color-hover); }
  :global(.agent-source-excerpt) { font-size: 0.82em; color: var(--text-muted); font-style: italic; }

  :global(.agent-gap-list) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.agent-gap) { display: flex; gap: 6px; padding: 4px 0; font-size: 0.85em; }
  :global(.agent-gap-icon) { flex-shrink: 0; color: var(--text-warning); }
  :global(.agent-gap-text) { color: var(--text-muted); }

  :global(.agent-chat-input-area) {
    padding: 8px 12px;
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  :global(.agent-chat-input) {
    flex: 1;
    resize: none;
    border-radius: 6px;
    padding: 8px;
    font-size: 0.9em;
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    font-family: inherit;
  }

  :global(.agent-chat-input:focus) { outline: none; border-color: var(--interactive-accent); }

  :global(.agent-chat-send-button) {
    align-self: flex-end;
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9em;
  }

  :global(.agent-chat-send-button:hover) { opacity: 0.85; }

  :global(.agent-loading-dot) {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
    margin-right: 3px;
    animation: agent-dot-pulse 1.4s ease-in-out infinite both;
  }

  :global(.agent-loading-dot:nth-child(1)) { animation-delay: 0s; }
  :global(.agent-loading-dot:nth-child(2)) { animation-delay: 0.2s; }
  :global(.agent-loading-dot:nth-child(3)) { animation-delay: 0.4s; }

  @keyframes agent-dot-pulse {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1.1); }
  }

  :global(.agent-cursor) {
    animation: agent-blink 1s step-end infinite;
    color: var(--interactive-accent);
    font-weight: 700;
  }

  @keyframes agent-blink {
    50% { opacity: 0; }
  }
</style>

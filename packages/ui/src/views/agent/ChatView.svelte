<script>
  import { renderResponse } from "./chat-renderer.js";

  export let linkHandler = null;

  let messages = [];
  let input = "";
  let loading = false;
  let errorMessage = "";
  let messagesEl;

  const PLACEHOLDER = "Ask a question about materials, experiments, properties...";

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

  $: if (messagesEl && messages.length > 0) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const query = input.trim();
    if (!query || loading) return;

    messages = [...messages, { role: "user", content: query }];
    input = "";
    loading = true;
    errorMessage = "";

    try {
      const res = await fetch("/api/ext/agent/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const html = renderResponse(data);
      messages = [...messages, { role: "agent", content: data.answer, html }];
    } catch (err) {
      errorMessage = err.message || "Unknown error";
      messages = [...messages, { role: "error", content: errorMessage }];
    } finally {
      loading = false;
    }
  }

  function onKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="agent-chat-container">
  <div class="agent-chat-header">
    <h3>Agent Chat</h3>
  </div>

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
          <div class="agent-chat-message-header">
            <span class="agent-chat-message-role">You</span>
          </div>
          <div class="agent-chat-message-body">{msg.content}</div>
        </div>
      {:else if msg.role === "agent"}
        <div class="agent-chat-message agent-chat-message--agent">
          <div class="agent-chat-message-header">
            <span class="agent-chat-message-role">Agent</span>
          </div>
          <div class="agent-chat-message-body">
            {@html msg.html}
          </div>
        </div>
      {:else if msg.role === "error"}
        <div class="agent-chat-message agent-chat-message--error">
          <div class="agent-chat-message-body">{msg.content}</div>
        </div>
      {/if}
    {/each}

    {#if loading}
      <div class="agent-chat-loading">Agent is thinking...</div>
    {/if}
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
    padding: 12px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  :global(.agent-chat-header h3) {
    margin: 0;
    font-size: 1.1em;
  }

  :global(.agent-chat-messages) {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    white-space: pre-wrap;
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

  :global(.agent-entity--material) {
    background: rgba(78, 121, 167, 0.15);
    color: var(--text-accent);
  }

  :global(.agent-entity--experiment) {
    background: rgba(89, 161, 79, 0.15);
    color: #59a14f;
  }

  :global(.agent-entity--property) {
    background: rgba(237, 201, 72, 0.15);
    color: #c9a90e;
  }

  :global(.agent-entity--regime) {
    background: rgba(225, 87, 89, 0.15);
    color: #e15759;
  }

  :global(.agent-entity--equipment) {
    background: rgba(178, 126, 197, 0.15);
    color: #b07cc5;
  }

  :global(.agent-entity--team) {
    background: rgba(242, 142, 44, 0.15);
    color: #f28e2c;
  }

  :global(.agent-entity--topic) {
    background: rgba(118, 183, 178, 0.15);
    color: #76b7b2;
  }

  :global(.agent-relation-list) {
    font-size: 0.85em;
  }

  :global(.agent-relation) {
    padding: 2px 0;
  }

  :global(.agent-relation-type) {
    color: var(--text-accent);
    font-style: italic;
  }

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

  :global(.agent-source-link) {
    margin-bottom: 2px;
  }

  :global(.agent-link) {
    color: var(--link-color);
    cursor: pointer;
    text-decoration: underline;
    font-weight: 500;
  }

  :global(.agent-link:hover) {
    color: var(--link-color-hover);
  }

  :global(.agent-source-excerpt) {
    font-size: 0.82em;
    color: var(--text-muted);
    font-style: italic;
  }

  :global(.agent-gap-list) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.agent-gap) {
    display: flex;
    gap: 6px;
    padding: 4px 0;
    font-size: 0.85em;
  }

  :global(.agent-gap-icon) {
    flex-shrink: 0;
    color: var(--text-warning);
  }

  :global(.agent-gap-text) {
    color: var(--text-muted);
  }

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

  :global(.agent-chat-input:focus) {
    outline: none;
    border-color: var(--interactive-accent);
  }

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

  :global(.agent-chat-send-button:hover) {
    opacity: 0.85;
  }
</style>

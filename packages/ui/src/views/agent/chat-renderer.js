function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function parseMarkdown(text) {
  if (!text) return "";

  let html = escapeHtml(text);

  // Headers (must be before bold/italic to not match # inside text)
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");

  // Bold + italic (bold must be before italic to not conflict)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, "<em>$1</em>");
  html = html.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`\n]+?)`/g, "<code>$1</code>");

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
  });

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr>");

  // Unordered lists (lines starting with - or *)
  html = html.replace(/^([*-]) (.+)$/gm, "<li>$2</li>");

  // Ordered lists (lines starting with 1. 2. etc.)
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$2</li>");

  // Wrap consecutive <li> in <ul> or <ol>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, (block) => {
    const isOrdered = block.match(/^<li>(\d+)\./) !== null;
    return `\n<${isOrdered ? "ol" : "ul"}>\n${block.trim()}\n</${isOrdered ? "ol" : "ul"}>\n`;
  });

  // Paragraphs: split by double newline, wrap in <p>
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((b) => {
      const trimmed = b.trim();
      if (!trimmed) return "";
      if (/^<(h[234]|ul|ol|hr|li)/.test(trimmed)) return trimmed;
      // Single newlines become <br>
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

export function resolveSourceLink(source) {
  const title = source.title || source.doc_id;
  const displayText = escapeHtml(title);

  let extra = "";
  if (source.page !== undefined && source.page !== null) {
    extra += ` (стр. ${source.page})`;
  }
  if (source.section) {
    extra += ` (раздел ${source.section})`;
  }

  let quoteAttr = "";
  if (source.quote) {
    quoteAttr = ` data-quote="${escapeAttr(source.quote)}"`;
  }

  return `<a class="agent-link" data-path="${escapeAttr(source.path)}"${quoteAttr} title="${displayText}">${displayText}</a>${extra}`;
}

export function renderResponse(response) {
  let html = "";

  html += `<div class="agent-block agent-block--answer">${parseMarkdown(response.answer)}</div>`;

  if (response.entities && response.entities.length > 0) {
    const items = response.entities
      .map(
        (e) =>
          `<span class="agent-entity agent-entity--${e.type}">${escapeHtml(e.name)}</span>`,
      )
      .join("");

    html += `<div class="agent-block agent-block--entities">
      <div class="agent-block-label">Сущности (${response.entities.length})</div>
      <div class="agent-entity-list">${items}</div>
    </div>`;
  }

  if (response.relations && response.relations.length > 0) {
    const items = response.relations
      .map(
        (r) =>
          `<div class="agent-relation">${escapeHtml(r.from)} <span class="agent-relation-type">${escapeHtml(r.type)}</span> ${escapeHtml(r.to)}</div>`,
      )
      .join("");

    html += `<div class="agent-block agent-block--relations">
      <div class="agent-block-label">Связи (${response.relations.length})</div>
      <div class="agent-relation-list">${items}</div>
    </div>`;
  }

  if (response.sources && response.sources.length > 0) {
    const items = response.sources
      .map((s) => {
        const link = resolveSourceLink(s);
        const excerpt = escapeHtml(s.excerpt);
        return `<div class="agent-source">
          <div class="agent-source-link">${link}</div>
          <div class="agent-source-excerpt">${excerpt}</div>
        </div>`;
      })
      .join("");

    html += `<div class="agent-block agent-block--sources">
      <div class="agent-block-label">Источники (${response.sources.length})</div>
      <div class="agent-source-list">${items}</div>
    </div>`;
  }

  if (response.gaps && response.gaps.length > 0) {
    const items = response.gaps
      .map(
        (g) =>
          `<div class="agent-gap">
            <div class="agent-gap-icon">&#9888;</div>
            <div class="agent-gap-text">${escapeHtml(g.description)}</div>
          </div>`,
      )
      .join("");

    html += `<div class="agent-block agent-block--gaps">
      <div class="agent-block-label">Пробелы в данных (${response.gaps.length})</div>
      <div class="agent-gap-list">${items}</div>
    </div>`;
  }

  return html;
}

const LABEL_TO_TYPE = {
  Material: "material",
  Process: "experiment",
  Equipment: "equipment",
  Experiment: "experiment",
  Parameter: "property",
  Expert: "team",
  Claim: "topic",
  Facility: "equipment",
  Document: "topic",
};

export function renderFromBackend(answerText, subgraph, citations) {
  let html = "";

  if (answerText) {
    html += `<div class="agent-block agent-block--answer">${parseMarkdown(answerText)}</div>`;
  }

  const nodes = subgraph?.nodes || [];
  const edges = subgraph?.edges || [];

  // Entities from non-Document/non-Chunk nodes
  const entityNodes = nodes.filter(
    (n) => n.label !== "Document" && n.label !== "Chunk",
  );
  if (entityNodes.length > 0) {
    const items = entityNodes
      .map((n) => {
        const type = LABEL_TO_TYPE[n.label] || "topic";
        return `<span class="agent-entity agent-entity--${type}">${escapeHtml(n.name || n.key)}</span>`;
      })
      .join("");

    html += `<div class="agent-block agent-block--entities">
      <div class="agent-block-label">Сущности (${entityNodes.length})</div>
      <div class="agent-entity-list">${items}</div>
    </div>`;
  }

  // Relations from edges
  if (edges.length > 0) {
    const items = edges
      .map((e) => {
        const fromName = escapeHtml(e.from);
        const toName = escapeHtml(e.to);
        return `<div class="agent-relation">${fromName} <span class="agent-relation-type">${escapeHtml(e.type)}</span> ${toName}</div>`;
      })
      .join("");

    html += `<div class="agent-block agent-block--relations">
      <div class="agent-block-label">Связи (${edges.length})</div>
      <div class="agent-relation-list">${items}</div>
    </div>`;
  }

  // Sources from edge provenance + citations
  const sourceMap = new Map();
  for (const e of edges) {
    const p = e.props || {};
    if (p.source_doc_id && !sourceMap.has(p.source_doc_id)) {
      sourceMap.set(p.source_doc_id, {
        doc_id: p.source_doc_id,
        path: p.document_path || "",
        excerpt: p.quote || "",
        quote: p.quote || "",
        title: p.document_title || p.source_doc_id,
      });
    }
  }

  if (citations && citations.length > 0) {
    for (const cite of citations) {
      if (!sourceMap.has(cite)) {
        sourceMap.set(cite, {
          doc_id: cite,
          path: "",
          excerpt: "",
          quote: "",
          title: cite,
        });
      }
    }
  }

  const sources = Array.from(sourceMap.values());
  if (sources.length > 0) {
    const items = sources
      .map((s) => {
        const link = resolveSourceLink(s);
        const excerpt = escapeHtml(s.excerpt || "");
        return `<div class="agent-source">
          <div class="agent-source-link">${link}</div>
          ${excerpt ? `<div class="agent-source-excerpt">${excerpt}</div>` : ""}
        </div>`;
      })
      .join("");

    html += `<div class="agent-block agent-block--sources">
      <div class="agent-block-label">Источники (${sources.length})</div>
      <div class="agent-source-list">${items}</div>
    </div>`;
  }

  // Gaps from nodes with is_gap=true
  const gapNodes = nodes.filter((n) => n.is_gap);
  if (gapNodes.length > 0) {
    const items = gapNodes
      .map(
        (n) =>
          `<div class="agent-gap">
            <div class="agent-gap-icon">&#9888;</div>
            <div class="agent-gap-text">${escapeHtml(n.name || n.key)}: ${escapeHtml(n.props?.description || "Нет данных")}</div>
          </div>`,
      )
      .join("");

    html += `<div class="agent-block agent-block--gaps">
      <div class="agent-block-label">Пробелы в данных (${gapNodes.length})</div>
      <div class="agent-gap-list">${items}</div>
    </div>`;
  }

  return html;
}

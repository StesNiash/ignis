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

  html += `<div class="agent-block agent-block--answer">${escapeHtml(response.answer)}</div>`;

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

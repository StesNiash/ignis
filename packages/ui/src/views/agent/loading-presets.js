const LOADER = `<span class="agent-loading-dot"></span><span class="agent-loading-dot"></span><span class="agent-loading-dot"></span>`;

export const LOADING_THINKING = `<div class="agent-chat-loading">${LOADER} Thinking...</div>`;

export const LOADING_SEARCH = `<div class="agent-chat-loading">${LOADER} Searching knowledge graph...</div>`;

export const LOADING_ANALYZE = `<div class="agent-chat-loading">${LOADER} Analyzing query...</div>`;

export const LOADING_GENERATE = `<div class="agent-chat-loading">${LOADER} Generating response...</div>`;

export const LOADING_FETCH = `<div class="agent-chat-loading">${LOADER} Fetching documents...</div>`;

export function loadingWithText(text) {
  return `<div class="agent-chat-loading">${LOADER} ${text}</div>`;
}

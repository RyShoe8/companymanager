import type { WebSearchHit } from '@/lib/ai/tools/webSearch';

const LOOKUP_HINT =
  /\b(who|what|when|where|which|how many|top\s+\d+|all[- ]time|current|latest|score|scorer|ranking|standings|stats?|record|winner|champion)\b/i;
const CODE_OR_IMAGE =
  /\b(image|generate|draw|screenshot|refactor|typescript|javascript|python|bugfix|stack\s*trace|compile)\b/i;

/** Lightweight heuristic: open-ended factual asks that benefit from web_search. */
export function looksLikeWebLookupQuery(text: string): boolean {
  const q = text.trim();
  if (q.length < 8 || q.length > 500) return false;
  if (CODE_OR_IMAGE.test(q) && !LOOKUP_HINT.test(q)) return false;
  return LOOKUP_HINT.test(q) || /\?/.test(q);
}

export function formatWebSearchContext(input: {
  query: string;
  hits: WebSearchHit[];
  note: string;
}): string {
  const lines = [
    'Web search results (use these; do not invent facts beyond them):',
    `Query: ${input.query}`,
    input.note ? `Note: ${input.note}` : '',
  ].filter(Boolean);
  if (!input.hits.length) {
    lines.push('No hits returned.');
  } else {
    for (const [index, hit] of input.hits.entries()) {
      lines.push(`${index + 1}. ${hit.title}`);
      lines.push(`   ${hit.url}`);
      if (hit.snippet) lines.push(`   ${hit.snippet}`);
    }
  }
  return lines.join('\n').slice(0, 6000);
}

/** User message for plain retry after Nucleas-side search. */
export function userTextWithBrowseContext(userText: string, searchBlock: string): string {
  return `${userText.trim().slice(0, 4000)}\n\n${searchBlock}`.slice(0, 6000);
}

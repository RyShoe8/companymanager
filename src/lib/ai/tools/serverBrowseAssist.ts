import type { ImageSearchResult, ResearchSearchResult, WebSearchHit } from '@/lib/ai/tools/webSearch';

const LOOKUP_HINT =
  /\b(who|what|when|where|which|how many|top\s+\d+|all[- ]time|current|latest|score|scorer|ranking|standings|stats?|record|winner|champion|research|look\s*up|find\s+out|tell\s+me\s+about|information\s+about|details\s+(on|about)|background\s+on)\b/i;
const CODE_HEAVY =
  /\b(refactor|typescript|javascript|python|bugfix|stack\s*trace|compile)\b/i;
const IMAGE_GENERATE =
  /\b(generate|draw|create|make)\b.*\b(image|picture|photo|illustration|art)\b|\b(image|picture|photo)\b.*\b(generate|draw|create|make)\b/i;
const IMAGE_FIND =
  /\b((find|show|search|get|look\s*up|look\s*for)\s+(me\s+)?(an?\s+)?(images?|photos?|pictures?|pics?|thumbnails?)|(images?|photos?|pictures?|pics?)\s+(of|for)|visual\s+examples?\s+of)\b/i;

/** Lightweight heuristic: open-ended factual / research asks that benefit from web_search. */
export function looksLikeWebLookupQuery(text: string): boolean {
  const q = text.trim();
  if (q.length < 8 || q.length > 500) return false;
  if (looksLikeImageSearchQuery(q) || IMAGE_GENERATE.test(q)) return false;
  if (CODE_HEAVY.test(q) && !LOOKUP_HINT.test(q)) return false;
  return LOOKUP_HINT.test(q) || /\?/.test(q);
}

/** Find existing web images (not AI image generation). */
export function looksLikeImageSearchQuery(text: string): boolean {
  const q = text.trim();
  if (q.length < 6 || q.length > 500) return false;
  if (IMAGE_GENERATE.test(q)) return false;
  return IMAGE_FIND.test(q);
}

export function formatWebSearchContext(input: {
  query: string;
  hits: WebSearchHit[];
  note: string;
  providersTried?: string[];
  fetchCount?: number;
}): string {
  const lines = [
    'Web search results (use these; do not invent facts beyond them):',
    'Prefer club/team “records and statistics” pages over UEFA/competition-wide top-scorer lists when the question is about a specific club.',
    `Query: ${input.query}`,
    input.note ? `Note: ${input.note}` : '',
    input.providersTried?.length ? `Providers tried: ${input.providersTried.join(', ')}` : '',
    typeof input.fetchCount === 'number' ? `Pages fetched: ${input.fetchCount}` : '',
  ].filter(Boolean);
  if (!input.hits.length) {
    lines.push(
      'No hits returned from search backends. Do not invent facts, rankings, or statistics. Say that search returned nothing and suggest a concrete official URL if helpful.'
    );
  } else {
    for (const [index, hit] of input.hits.entries()) {
      lines.push(`${index + 1}. ${hit.title}${hit.provider ? ` [${hit.provider}]` : ''}`);
      lines.push(`   ${hit.url}`);
      if (hit.snippet) lines.push(`   ${hit.snippet}`);
      if (hit.extract?.trim()) {
        lines.push(`   Extract: ${hit.extract.trim().slice(0, 1800)}`);
      }
    }
  }
  return lines.join('\n').slice(0, 10000);
}

export function formatResearchResultContext(result: ResearchSearchResult): string {
  return formatWebSearchContext({
    query: result.query,
    hits: result.hits,
    note: result.note,
    providersTried: result.providersTried,
    fetchCount: result.fetchCount,
  });
}

export function formatImageSearchContext(result: ImageSearchResult): string {
  const lines = [
    'Image search results (cite these image URLs; do not invent image links):',
    `Query: ${result.query}`,
    result.note ? `Note: ${result.note}` : '',
    result.providersTried?.length ? `Providers tried: ${result.providersTried.join(', ')}` : '',
  ].filter(Boolean);
  if (!result.hits.length) {
    lines.push(
      'No image hits. Say search returned nothing. Do not invent image URLs. Suggest refining the query or enabling CSE Image search if misconfigured.'
    );
  } else {
    for (const [index, hit] of result.hits.entries()) {
      lines.push(`${index + 1}. ${hit.title}${hit.provider ? ` [${hit.provider}]` : ''}`);
      lines.push(`   Image: ${hit.imageUrl}`);
      if (hit.thumbnailUrl) lines.push(`   Thumbnail: ${hit.thumbnailUrl}`);
      if (hit.contextUrl) lines.push(`   Page: ${hit.contextUrl}`);
      if (hit.snippet) lines.push(`   ${hit.snippet}`);
    }
  }
  return lines.join('\n').slice(0, 10000);
}

/** User message for plain retry after Nucleas-side search. */
export function userTextWithBrowseContext(userText: string, searchBlock: string): string {
  return `${userText.trim().slice(0, 4000)}\n\n${searchBlock}`.slice(0, 12000);
}

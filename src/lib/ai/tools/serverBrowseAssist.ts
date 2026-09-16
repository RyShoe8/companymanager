import type { ImageSearchResult, ResearchSearchResult, WebSearchHit } from '@/lib/ai/tools/webSearch';

const LOOKUP_HINT =
  /\b(who|what|when|where|which|how many|top\s+\d+|all[- ]time|current|latest|score|scorer|ranking|standings|stats?|record|winner|champion|research|look\s*up|find\s+out|tell\s+me\s+about|information\s+about|details\s+(on|about)|background\s+on)\b/i;
/** Open-ended digs that miss the tighter LOOKUP_HINT (e.g. "information as possible about"). */
const LOOKUP_EXTRA =
  /\b(find\s+(me\s+)?(as\s+much\s+)?(info|information|details)|information\b[\s\S]{0,40}\babout\b|about\s+the\s+(game|movie|show|band|book|album|title)|see\s+if\s+you\s+can\s+find|does\s+(it|this)\s+exist)\b/i;
const ANAPHORIC_LOOKUP =
  /\b(see\s+if\s+you\s+can\s+find(\s+it)?|find\s+it|does\s+(it|this)\s+exist|it\s+does\s+exist|fan\s+remake)\b/i;
const LOOKUP_MEDIA =
  /\b(screenshots?|images?|photos?|pictures?)\b/i;
const CODE_HEAVY =
  /\b(refactor|typescript|javascript|python|bugfix|stack\s*trace|compile)\b/i;
/** Project / codebase questions should use repo tools, not proactive web_search. */
const PROJECT_INTERNAL =
  /\b(rules?\s+system|task\s+rules?|codebase|architecture|\.cursor|nucleas|repo(?:sitory)?|our\s+rules|this\s+(?:project|repo|codebase))\b/i;
const IMAGE_GENERATE =
  /\b(generate|draw|create|make)\b.*\b(image|picture|photo|illustration|art)\b|\b(image|picture|photo)\b.*\b(generate|draw|create|make)\b/i;
const IMAGE_FIND =
  /\b((find|show|search|get|look\s*up|look\s*for)\s+(me\s+)?(an?\s+)?(images?|photos?|pictures?|pics?|thumbnails?)|(images?|photos?|pictures?|pics?)\s+(of|for)|(?:a\s+)?(?:picture|photo)\s+of|visual\s+examples?\s+of)\b/i;

/**
 * Orchestra Worker/Reviewer wraps the real ask under "User request:" plus a long briefing.
 * Heuristics must score the ask, not the whole blob (which often exceeds 500 chars).
 */
export function extractChatHeuristicText(text: string): string {
  const raw = text.trim();
  const userBlock = /^User request:\s*\r?\n([\s\S]*?)(?:\r?\n\r?\n(?:Planner|Worker)\b|$)/i.exec(raw);
  const focus = (userBlock?.[1] ?? raw).trim();
  return focus.slice(0, 500);
}

/** Nucleas/project-internal asks that should use repo_tree/repo_read, not plain-first or web assist. */
export function looksLikeProjectInternalQuery(text: string): boolean {
  const q = extractChatHeuristicText(text);
  if (q.length < 8) return false;
  return PROJECT_INTERNAL.test(q);
}

/** Lightweight heuristic: open-ended factual / research asks that benefit from web_search. */
export function looksLikeWebLookupQuery(text: string): boolean {
  const q = extractChatHeuristicText(text);
  if (q.length < 8) return false;
  if (looksLikeImageSearchQuery(q) || IMAGE_GENERATE.test(q)) return false;
  if (looksLikeProjectInternalQuery(q)) return false;
  if (CODE_HEAVY.test(q) && !LOOKUP_HINT.test(q) && !LOOKUP_EXTRA.test(q)) return false;
  return LOOKUP_HINT.test(q) || LOOKUP_EXTRA.test(q) || ANAPHORIC_LOOKUP.test(q) || /\?/.test(q);
}

/** Find existing web images (not AI image generation). */
export function looksLikeImageSearchQuery(text: string): boolean {
  const q = extractChatHeuristicText(text);
  if (q.length < 6) return false;
  if (IMAGE_GENERATE.test(q)) return false;
  return IMAGE_FIND.test(q);
}

/** Follow-ups that omit the subject ("find it", "fan remake") and need prior user turns. */
export function looksLikeAnaphoricLookup(text: string): boolean {
  const q = extractChatHeuristicText(text);
  if (q.length < 6) return false;
  if (looksLikeImageSearchQuery(q) || IMAGE_GENERATE.test(q)) return false;
  return ANAPHORIC_LOOKUP.test(q);
}

/**
 * Build a search query for free assist. Anaphoric follow-ups pull recent user turns
 * so "see if you can find it" still includes the prior subject (e.g. Castlevania Revamped).
 */
export function resolveAssistSearchQuery(userText: string, priorUserTexts: string[] = []): string {
  const current = extractChatHeuristicText(userText);
  if (!looksLikeAnaphoricLookup(current)) return current.slice(0, 400);
  const recent = priorUserTexts
    .map((t) => extractChatHeuristicText(t))
    .filter(Boolean)
    .slice(-2)
    .join(' ');
  return `${recent}\n${current}`.trim().slice(0, 400) || current.slice(0, 400);
}

/** Web lookup that also wants screenshots / photos cited. */
export function wantsLookupScreenshots(text: string): boolean {
  return LOOKUP_MEDIA.test(extractChatHeuristicText(text));
}

export function formatWebSearchContext(input: {
  query: string;
  hits: WebSearchHit[];
  note: string;
  providersTried?: string[];
  fetchCount?: number;
}): string {
  const lines = [
    'Web search results (Nucleas already searched and fetched these; summarize them—do not claim you cannot browse or that tools were unavailable):',
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
    'Image search results (Nucleas already found these; cite them. Screenshots may also appear as attached thumbnails in the UI—do not say no images were found if this list is non-empty):',
    `Query: ${result.query}`,
    result.note ? `Note: ${result.note}` : '',
    result.providersTried?.length ? `Providers tried: ${result.providersTried.join(', ')}` : '',
  ].filter(Boolean);
  if (!result.hits.length) {
    lines.push(
      'No image hits from image backends. Do not invent image URLs. You may still summarize web sources if present above.'
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

/**
 * User message after a Nucleas repo dig. Much larger than web browse so file
 * bodies survive (plainInvoke allows 48k free / 24k paid).
 */
export function userTextWithRepoContext(
  userText: string,
  digBlock: string,
  options?: { maxChars?: number }
): string {
  const maxChars = options?.maxChars ?? 48_000;
  return `${userText.trim().slice(0, 6000)}\n\n${digBlock}`.slice(0, maxChars);
}

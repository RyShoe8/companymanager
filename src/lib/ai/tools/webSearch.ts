import { assertSafePublicHttpsUrl } from '@/lib/ai/tools/ssrf';
import { browserNavigate } from '@/lib/ai/tools/browserClient';
import { isBrowserWorkerConfigured } from '@/lib/ai/tools/browseRouter';
import { webFetch } from '@/lib/ai/tools/webFetch';
import { recordSearchApiQuery } from '@/lib/ai/tools/searchApiMeter';

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
  provider?: string;
  extract?: string;
};

export type ImageSearchHit = {
  title: string;
  imageUrl: string;
  contextUrl?: string;
  thumbnailUrl?: string;
  snippet: string;
  provider?: string;
};

export type ResearchDepth = 'lite' | 'standard' | 'deep';

export type ResearchSearchResult = {
  query: string;
  hits: WebSearchHit[];
  note: string;
  providersTried: string[];
  toolsUsed: string[];
  hitCount: number;
  fetchCount: number;
  /** Images scraped from Playwright-rendered pages during deep/standard enrich. */
  pageImages: ImageSearchHit[];
};

export type ImageSearchResult = {
  query: string;
  hits: ImageSearchHit[];
  note: string;
  providersTried: string[];
  toolsUsed: string[];
  hitCount: number;
};

type InstantAnswerTopic = {
  Text?: string;
  FirstURL?: string;
  Topics?: InstantAnswerTopic[];
};

type FetchOpts = {
  fetcher: typeof fetch;
  signal: AbortSignal;
};

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.hostname.toLowerCase()}${path}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function mergeHits(target: WebSearchHit[], incoming: WebSearchHit[], limit: number): void {
  const seen = new Set(target.map((hit) => normalizeUrlKey(hit.url)));
  const ranked = [...incoming].sort((a, b) => (b.snippet?.length ?? 0) - (a.snippet?.length ?? 0));
  for (const hit of ranked) {
    if (target.length >= limit) return;
    const key = normalizeUrlKey(hit.url);
    if (!hit.url.trim() || seen.has(key)) continue;
    seen.add(key);
    target.push(hit);
  }
}

const QUERY_NOISE =
  /\b(who|what|when|where|which|whom|whose|are|is|was|were|do|does|did|the|a|an|me|please|tell|about|for|of|in|on|to|my|our|their|give|list|show)\b/gi;

/** Turn chatty questions into search-friendly primary + Wikipedia queries. */
export function buildResearchQueries(raw: string): { primary: string; wikipedia: string } {
  const trimmed = raw.trim().slice(0, 200);
  const clubScorers = trimmed.match(
    /\b([A-Za-z][A-Za-z0-9.&'-]{1,40})(?:'s)?\s+(?:all[- ]?time\s+)?(?:top\s+)?(?:\d+\s+)?(?:goal\s*)?scorers?\b/i
  );
  if (clubScorers?.[1]) {
    const club = clubScorers[1].replace(/'s$/i, '').replace(/\.$/, '').trim();
    if (club.length >= 3 && !/^(goal|top|all)$/i.test(club)) {
      return {
        primary: `${club} all-time top goalscorers`,
        wikipedia: `List of ${club} F.C. records and statistics`,
      };
    }
  }
  const shortClubScorers = trimmed.match(
    /\b([A-Za-z][A-Za-z0-9.&'-]{2,40})\b[\s\S]{0,40}\b(?:goal\s*)?scorers?\b/i
  );
  if (shortClubScorers?.[1]) {
    const club = shortClubScorers[1].replace(/'s$/i, '').replace(/\.$/, '').trim();
    if (club.length >= 3 && !/^(goal|top|all|who|what|the)$/i.test(club)) {
      return {
        primary: `${club} all-time top goalscorers`,
        wikipedia: `List of ${club} F.C. records and statistics`,
      };
    }
  }
  const cleaned = trimmed
    .replace(/[?¿!.,;:]+/g, ' ')
    .replace(QUERY_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const primary = cleaned || trimmed;
  if (/\b(all[- ]?time|top\s+\d+|ranking|standings|records?|statistics)\b/i.test(trimmed)) {
    return {
      primary,
      wikipedia: `${primary} records and statistics`,
    };
  }
  return { primary, wikipedia: primary };
}

function queryTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^(the|and|for|are|was|who|what|all|time|top)$/.test(t));
}

/** Prefer club-record pages over UEFA/season noise for ranking-style questions. */
export function scoreResearchHit(hit: WebSearchHit, originalQuery: string): number {
  const hay = `${hit.title} ${hit.snippet} ${hit.url}`.toLowerCase();
  const tokens = queryTokens(originalQuery);
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 3;
  }
  if (/records and statistics/i.test(hit.title) || /records_and_statistics/i.test(hit.url)) score += 12;
  if (/goalscorer|top scorers|all[- ]?time/i.test(hay)) score += 4;
  if (/transfermarkt/i.test(hay)) score += 8;
  if (/list of uefa|champions league top scorers|europa league top scorers/i.test(hay)) score -= 18;
  if (/\/\d{4}[–-]\d{2,4}[ _]/.test(hit.url) || /\b20\d{2}[–-]\d{2}\b.*season/i.test(hit.title)) {
    score -= 10;
  }
  if (hit.provider === 'brave' || hit.provider === 'google_cse') score += 2;
  if (hit.provider === 'wikipedia' && /records and statistics/i.test(hit.title)) score += 4;
  if (hit.extract && /goalscorer|goals\b/i.test(hit.extract)) score += 6;
  score += Math.min((hit.snippet?.length ?? 0) / 80, 3);
  return score;
}

function rankResearchHits(hits: WebSearchHit[], originalQuery: string, limit: number): WebSearchHit[] {
  return [...hits]
    .map((hit) => ({ hit, score: scoreResearchHit(hit, originalQuery) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.hit);
}

function collectInstantAnswerTopics(
  topics: InstantAnswerTopic[] | undefined,
  hits: WebSearchHit[],
  limit: number
): void {
  for (const topic of topics ?? []) {
    if (hits.length >= limit) return;
    if (topic.FirstURL && topic.Text) {
      hits.push({
        title: topic.Text.slice(0, 120),
        url: topic.FirstURL,
        snippet: topic.Text.slice(0, 400),
        provider: 'duckduckgo_ia',
      });
    }
    if (Array.isArray(topic.Topics) && topic.Topics.length) {
      collectInstantAnswerTopics(topic.Topics, hits, limit);
    }
  }
}

async function duckDuckGoInstantAnswer(
  q: string,
  limit: number,
  opts: FetchOpts
): Promise<WebSearchHit[]> {
  const endpoint = assertSafePublicHttpsUrl(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
  );
  const response = await opts.fetcher(endpoint, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return [];
  }
  let body: {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: InstantAnswerTopic[];
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return [];
  }
  const hits: WebSearchHit[] = [];
  if (body.AbstractURL && body.AbstractText) {
    hits.push({
      title: (body.Heading || 'Result').slice(0, 200),
      url: body.AbstractURL,
      snippet: body.AbstractText.slice(0, 400),
      provider: 'duckduckgo_ia',
    });
  }
  collectInstantAnswerTopics(body.RelatedTopics, hits, limit);
  return hits.slice(0, limit);
}

async function wikipediaPageSummary(title: string, opts: FetchOpts): Promise<WebSearchHit | null> {
  const endpoint = assertSafePublicHttpsUrl(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
  );
  const response = await opts.fetcher(endpoint, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  let body: {
    title?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return null;
  }
  const url = body.content_urls?.desktop?.page?.trim();
  const extract = body.extract?.trim();
  if (!url || !extract) return null;
  return {
    title: (body.title || title).slice(0, 200),
    url: url.slice(0, 4000),
    snippet: extract.slice(0, 400),
    provider: 'wikipedia',
  };
}

async function wikipediaSearch(q: string, limit: number, opts: FetchOpts): Promise<WebSearchHit[]> {
  const searchUrl = assertSafePublicHttpsUrl(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json&origin=*`
  );
  const response = await opts.fetcher(searchUrl, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return [];
  }
  let body: {
    query?: { search?: Array<{ title?: string; snippet?: string }> };
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return [];
  }
  const rows = (body.query?.search ?? []).filter((row) => typeof row.title === 'string' && row.title.trim());
  const hits: WebSearchHit[] = [];
  for (const row of rows.slice(0, limit)) {
    const title = row.title!.trim();
    try {
      const summary = await wikipediaPageSummary(title, opts);
      if (summary) {
        hits.push(summary);
        continue;
      }
    } catch {
      /* snippet-only */
    }
    const wikiPath = encodeURIComponent(title.replace(/ /g, '_'));
    hits.push({
      title: title.slice(0, 200),
      url: `https://en.wikipedia.org/wiki/${wikiPath}`,
      snippet: (row.snippet ?? title).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
      provider: 'wikipedia',
    });
  }
  return hits.slice(0, limit);
}

function stripWikiHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const SCORER_SECTION =
  /goal.?scor|player records|appearances and goals|top scorers|leading goalscorers|club records/i;

/** Pull goalscorer / player-records section text from a Wikipedia page. */
export async function wikipediaSectionExtract(
  pageTitle: string,
  opts: FetchOpts
): Promise<string | null> {
  const sectionsUrl = assertSafePublicHttpsUrl(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=sections&format=json&origin=*`
  );
  const sectionsRes = await opts.fetcher(sectionsUrl, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!sectionsRes.ok) {
    await sectionsRes.body?.cancel();
    return null;
  }
  let sectionsBody: {
    parse?: { sections?: Array<{ index?: string; line?: string; anchor?: string }> };
  };
  try {
    sectionsBody = (await sectionsRes.json()) as typeof sectionsBody;
  } catch {
    return null;
  }
  const sections = sectionsBody.parse?.sections ?? [];
  const match =
    sections.find((s) => SCORER_SECTION.test(`${s.line ?? ''} ${s.anchor ?? ''}`)) ??
    sections.find((s) => /records/i.test(s.line ?? ''));
  if (!match?.index) return null;
  const parseUrl = assertSafePublicHttpsUrl(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&section=${encodeURIComponent(match.index)}&prop=text&format=json&origin=*`
  );
  const parseRes = await opts.fetcher(parseUrl, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!parseRes.ok) {
    await parseRes.body?.cancel();
    return null;
  }
  let parseBody: { parse?: { text?: { '*'?: string } } };
  try {
    parseBody = (await parseRes.json()) as typeof parseBody;
  } catch {
    return null;
  }
  const html = parseBody.parse?.text?.['*'] ?? '';
  const text = stripWikiHtml(html);
  return text.length >= 40 ? text.slice(0, 3200) : null;
}

async function enrichWikipediaRecordsExtract(hit: WebSearchHit, opts: FetchOpts): Promise<boolean> {
  if (hit.provider !== 'wikipedia') return false;
  if (!/records and statistics|goalscorer|top scorers/i.test(`${hit.title} ${hit.url}`)) return false;
  try {
    const section = await wikipediaSectionExtract(hit.title, opts);
    if (!section) return false;
    hit.extract = section;
    if (section.length > (hit.snippet?.length ?? 0)) {
      hit.snippet = section.slice(0, 400);
    }
    return true;
  } catch {
    return false;
  }
}

export function isBraveSearchConfigured(): boolean {
  return Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());
}

export function isGoogleCseConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_ID?.trim());
}

export function isSearxngConfigured(): boolean {
  const base = process.env.SEARXNG_BASE_URL?.trim() ?? '';
  return /^https:\/\//i.test(base);
}

async function braveWebSearch(
  q: string,
  limit: number,
  opts: FetchOpts,
  organizationId?: string
): Promise<WebSearchHit[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return [];
  const endpoint = assertSafePublicHttpsUrl(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${limit}`
  );
  const response = await opts.fetcher(endpoint, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key,
    },
  });
  if (organizationId) void recordSearchApiQuery({ organizationId, provider: 'brave' });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`brave_http_${response.status}`);
  }
  let body: {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new Error('brave_invalid_json');
  }
  const hits: WebSearchHit[] = [];
  for (const row of body.web?.results ?? []) {
    if (!row.url?.trim() || !row.title?.trim()) continue;
    hits.push({
      title: row.title.slice(0, 200),
      url: row.url.slice(0, 4000),
      snippet: (row.description ?? row.title).slice(0, 400),
      provider: 'brave',
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

async function googleCseRequest(
  q: string,
  limit: number,
  opts: FetchOpts,
  searchType?: 'image',
  organizationId?: string
): Promise<{
  items?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    displayLink?: string;
    image?: { contextLink?: string; thumbnailLink?: string };
  }>;
} | null> {
  const key = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!key || !cx) return null;
  const params = new URLSearchParams({
    key,
    cx,
    q,
    num: String(Math.min(limit, 10)),
  });
  if (searchType) params.set('searchType', searchType);
  const endpoint = assertSafePublicHttpsUrl(
    `https://www.googleapis.com/customsearch/v1?${params.toString()}`
  );
  const response = await opts.fetcher(endpoint, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (organizationId) {
    void recordSearchApiQuery({
      organizationId,
      provider: searchType === 'image' ? 'google_cse_image' : 'google_cse_web',
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`google_cse_http_${response.status}`);
  }
  try {
    return (await response.json()) as {
      items?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
        displayLink?: string;
        image?: { contextLink?: string; thumbnailLink?: string };
      }>;
    };
  } catch {
    throw new Error('google_cse_invalid_json');
  }
}

async function googleCseSearch(
  q: string,
  limit: number,
  opts: FetchOpts,
  organizationId?: string
): Promise<WebSearchHit[]> {
  const body = await googleCseRequest(q, limit, opts, undefined, organizationId);
  if (!body) return [];
  const hits: WebSearchHit[] = [];
  for (const row of body.items ?? []) {
    if (!row.link?.trim() || !row.title?.trim()) continue;
    hits.push({
      title: row.title.slice(0, 200),
      url: row.link.slice(0, 4000),
      snippet: (row.snippet ?? row.title).slice(0, 400),
      provider: 'google_cse',
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

async function googleCseImageSearch(
  q: string,
  limit: number,
  opts: FetchOpts,
  organizationId?: string
): Promise<ImageSearchHit[]> {
  const body = await googleCseRequest(q, limit, opts, 'image', organizationId);
  if (!body) return [];
  const hits: ImageSearchHit[] = [];
  for (const row of body.items ?? []) {
    const imageUrl = row.link?.trim();
    if (!imageUrl || !row.title?.trim()) continue;
    if (!/^https:\/\//i.test(imageUrl)) continue;
    hits.push({
      title: row.title.slice(0, 200),
      imageUrl: imageUrl.slice(0, 4000),
      contextUrl: row.image?.contextLink?.trim()?.slice(0, 4000),
      thumbnailUrl: row.image?.thumbnailLink?.trim()?.slice(0, 4000),
      snippet: (row.snippet ?? row.displayLink ?? row.title).slice(0, 400),
      provider: 'google_cse',
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

async function searxngSearch(q: string, limit: number, opts: FetchOpts): Promise<WebSearchHit[]> {
  const base = process.env.SEARXNG_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base || !/^https:\/\//i.test(base)) return [];
  const endpoint = assertSafePublicHttpsUrl(
    `${base}/search?q=${encodeURIComponent(q)}&format=json&language=en`
  );
  const response = await opts.fetcher(endpoint, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return [];
  }
  let body: {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return [];
  }
  const hits: WebSearchHit[] = [];
  for (const row of body.results ?? []) {
    if (!row.url?.trim() || !row.title?.trim()) continue;
    hits.push({
      title: row.title.slice(0, 200),
      url: row.url.slice(0, 4000),
      snippet: (row.content ?? row.title).slice(0, 400),
      provider: 'searxng',
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

function queryTokensForImageRank(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 8);
}

async function searxngImageSearch(q: string, limit: number, opts: FetchOpts): Promise<ImageSearchHit[]> {
  const base = process.env.SEARXNG_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base || !/^https:\/\//i.test(base)) return [];
  const endpoint = assertSafePublicHttpsUrl(
    `${base}/search?q=${encodeURIComponent(q)}&format=json&language=en&categories=images`
  );
  const response = await opts.fetcher(endpoint, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return [];
  }
  let body: {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      img_src?: string;
      thumbnail_src?: string;
    }>;
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return [];
  }
  const tokens = queryTokensForImageRank(q);
  const scored: Array<{ hit: ImageSearchHit; score: number }> = [];
  for (const row of body.results ?? []) {
    const imageUrl = row.img_src?.trim() || row.thumbnail_src?.trim();
    if (!imageUrl || !/^https:\/\//i.test(imageUrl)) continue;
    const hay = `${row.title ?? ''} ${row.url ?? ''} ${imageUrl}`.toLowerCase();
    const score =
      tokens.length === 0 ? 1 : tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    if (tokens.length && score === 0) continue;
    scored.push({
      score,
      hit: {
        title: (row.title ?? 'Image').slice(0, 200),
        imageUrl: imageUrl.slice(0, 4000),
        thumbnailUrl: row.thumbnail_src?.slice(0, 4000),
        contextUrl: row.url?.slice(0, 4000),
        snippet: (row.content ?? row.title ?? '').slice(0, 400),
        provider: 'searxng',
      },
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.hit);
}

async function runProvider(
  name: string,
  work: () => Promise<WebSearchHit[]>,
  signal: AbortSignal
): Promise<{ hits: WebSearchHit[]; error?: string }> {
  try {
    return { hits: await work() };
  } catch (error) {
    if (signal.aborted) throw error;
    const message = error instanceof Error ? error.message : 'provider_error';
    return { hits: [], error: `${name}:${message}` };
  }
}

function buildNote(
  providersTried: string[],
  providersWithHits: string[],
  hitCount: number,
  providerErrors: string[]
): string {
  const err =
    providerErrors.length > 0 ? ` Provider issues: ${providerErrors.join('; ')}.` : '';
  if (!hitCount) {
    return `No hits from: ${providersTried.join(', ') || 'none'}.${err} Ask for a concrete URL or try a more specific query.`;
  }
  return `Results from ${providersWithHits.join(', ')} (tried ${providersTried.join(', ')}). Prefer web_fetch on concrete URLs for more detail.${err}`;
}

/**
 * Multi-provider research search. Collects from all enabled providers, then ranks.
 * Never throws except when the caller signal is already aborted / cancelled.
 */
export async function researchSearch(
  query: string,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    limit?: number;
    depth?: ResearchDepth;
    organizationId?: string;
  } = {}
): Promise<ResearchSearchResult> {
  const q = query.trim().slice(0, 200);
  if (!q) {
    return {
      query: '',
      hits: [],
      note: 'Empty query.',
      providersTried: [],
      toolsUsed: [],
      hitCount: 0,
      fetchCount: 0,
      pageImages: [],
    };
  }
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 8);
  const depth = options.depth ?? 'standard';
  const queries = buildResearchQueries(q);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new Error('Search cancelled.');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeoutMs = depth === 'deep' ? 90000 : depth === 'standard' ? 60000 : 20000;
  const timeout = setTimeout(cancel, timeoutMs);
  const fetcher = options.fetcher ?? fetch;
  const opts: FetchOpts = { fetcher, signal: controller.signal };
  const providersTried: string[] = [];
  const providersWithHits: string[] = [];
  const providerErrors: string[] = [];
  const toolsUsed: string[] = ['web_search'];
  const pool: WebSearchHit[] = [];
  const poolCap = Math.max(limit * 3, 12);
  const organizationId = options.organizationId?.trim() || undefined;
  const pageImages: ImageSearchHit[] = [];
  const pageImageSeen = new Set<string>();

  const pushPageImages = (pageUrl: string, pageTitle: string | null | undefined, urls: string[]) => {
    for (const imageUrl of urls) {
      const key = imageUrl.toLowerCase();
      if (pageImageSeen.has(key)) continue;
      pageImageSeen.add(key);
      pageImages.push({
        title: (pageTitle || 'Page image').slice(0, 200),
        imageUrl: imageUrl.slice(0, 4000),
        contextUrl: pageUrl.slice(0, 4000),
        snippet: 'From Playwright page render.',
        provider: 'browser_navigate',
      });
      if (pageImages.length >= 12) break;
    }
  };

  try {
    const floorCap = Math.min(2, limit);
    const providers: Array<{
      name: string;
      enabled: boolean;
      run: () => Promise<WebSearchHit[]>;
    }> = [
      {
        name: 'duckduckgo_ia',
        enabled: true,
        run: () => duckDuckGoInstantAnswer(queries.primary, floorCap, opts),
      },
      {
        name: 'wikipedia',
        enabled: true,
        run: () => wikipediaSearch(queries.wikipedia, floorCap, opts),
      },
      {
        name: 'brave',
        enabled: isBraveSearchConfigured(),
        run: () => braveWebSearch(queries.primary, limit, opts, organizationId),
      },
      {
        name: 'google_cse',
        enabled: isGoogleCseConfigured(),
        run: () => googleCseSearch(queries.primary, limit, opts, organizationId),
      },
      {
        name: 'searxng',
        enabled: isSearxngConfigured(),
        run: () => searxngSearch(queries.primary, limit, opts),
      },
    ];

    const enabledProviders = providers.filter((provider) => provider.enabled);
    providersTried.push(...enabledProviders.map((provider) => provider.name));
    const settled = await Promise.all(
      enabledProviders.map(async (provider) => {
        const result = await runProvider(provider.name, provider.run, controller.signal);
        return { name: provider.name, ...result };
      })
    );
    for (const result of settled) {
      if (result.error) providerErrors.push(result.error);
      const before = pool.length;
      mergeHits(pool, result.hits, poolCap);
      if (pool.length > before) providersWithHits.push(result.name);
    }

    let hits = rankResearchHits(pool, q, limit);

    for (const hit of hits) {
      const enriched = await enrichWikipediaRecordsExtract(hit, opts);
      if (enriched && !toolsUsed.includes('wikipedia_section')) toolsUsed.push('wikipedia_section');
    }
    hits = rankResearchHits(hits, q, limit);

    let fetchCount = 0;
    if ((depth === 'standard' || depth === 'deep') && hits.length) {
      const fetchCap = Math.min(5, hits.length);
      const fetchTargets = hits.slice(0, fetchCap);
      const playwrightBudget = depth === 'deep' ? 3 : 2;
      let playwrightUsed = 0;

      for (const hit of fetchTargets) {
        if (hit.extract && /goalscorer|goals\b|\d{2,3}\s+goals/i.test(hit.extract)) {
          continue;
        }
        let fetchFailed = false;
        let thin = false;
        try {
          const page = await webFetch(hit.url, { fetcher, signal: controller.signal });
          fetchCount += 1;
          if (!toolsUsed.includes('web_fetch')) toolsUsed.push('web_fetch');
          const text = page.text.slice(0, 5000);
          if (!hit.extract || text.length > hit.extract.length) hit.extract = text;
          if (page.title && (!hit.title || hit.title.length < 8)) hit.title = page.title.slice(0, 200);
          thin = Boolean(page.thin || page.escalateHint) || (hit.extract?.length ?? 0) < 400;
        } catch {
          fetchFailed = true;
        }

        const shouldPlaywright =
          isBrowserWorkerConfigured() &&
          playwrightUsed < playwrightBudget &&
          (depth === 'deep' || fetchFailed || thin || (hit.extract?.length ?? 0) < 400);

        if (shouldPlaywright) {
          try {
            const rendered = await browserNavigate(hit.url, { fetcher, signal: controller.signal });
            playwrightUsed += 1;
            if (!toolsUsed.includes('browser_navigate')) toolsUsed.push('browser_navigate');
            if (rendered.text.trim().length > (hit.extract?.length ?? 0)) {
              hit.extract = rendered.text.slice(0, 5000);
              if (rendered.title) hit.title = rendered.title.slice(0, 200);
            }
            if (rendered.images.length) {
              pushPageImages(rendered.url || hit.url, rendered.title || hit.title, rendered.images);
            }
          } catch {
            /* keep fetch */
          }
        }
      }
    }

    const noteParts = [
      buildNote(providersTried, providersWithHits, hits.length, providerErrors),
      queries.wikipedia !== q ? `Wiki query: ${queries.wikipedia}.` : '',
      queries.primary !== q ? `Web query: ${queries.primary}.` : '',
      pageImages.length ? `Page images: ${pageImages.length}.` : '',
    ].filter(Boolean);

    return {
      query: q,
      hits,
      note: noteParts.join(' '),
      providersTried,
      toolsUsed,
      hitCount: hits.length,
      fetchCount,
      pageImages,
    };
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.message === 'Search cancelled.')) {
      throw error instanceof Error ? error : new Error('Search cancelled.');
    }
    return {
      query: q,
      hits: [],
      note: 'Search unavailable.',
      providersTried,
      toolsUsed,
      hitCount: 0,
      fetchCount: 0,
      pageImages,
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

/**
 * Multi-provider web search. Defaults to standard depth (fetch top pages).
 * Pass depth: 'lite' for snippets only; 'deep' for aggressive Playwright enrich.
 */
export async function webSearch(
  query: string,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    limit?: number;
    depth?: ResearchDepth;
    organizationId?: string;
  } = {}
): Promise<ResearchSearchResult> {
  return researchSearch(query, { ...options, depth: options.depth ?? 'standard' });
}

/** Strip chatty wrappers before image backends. */
export function rewriteImageSearchQuery(raw: string): string {
  const trimmed = raw.trim().slice(0, 200);
  const stripped = trimmed
    .replace(
      /^(please\s+)?(find|show|get|search\s+for|look\s+up|look\s+for)\s+(me\s+)?(an?\s+)?(images?|photos?|pictures?|pics?|photo|picture)\s+(of|for)\s+/i,
      ''
    )
    .replace(/^(images?|photos?|pictures?|pics?)\s+(of|for)\s+/i, '')
    .replace(/[?¿!]+$/g, '')
    .trim();
  return stripped || trimmed;
}

async function wikipediaSummaryImage(q: string, opts: FetchOpts): Promise<ImageSearchHit[]> {
  const searchUrl = assertSafePublicHttpsUrl(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`
  );
  const searchRes = await opts.fetcher(searchUrl, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!searchRes.ok) {
    await searchRes.body?.cancel();
    return [];
  }
  let searchBody: { query?: { search?: Array<{ title?: string }> } };
  try {
    searchBody = (await searchRes.json()) as typeof searchBody;
  } catch {
    return [];
  }
  const hits: ImageSearchHit[] = [];
  for (const row of searchBody.query?.search ?? []) {
    const title = row.title?.trim();
    if (!title) continue;
    const summaryUrl = assertSafePublicHttpsUrl(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
    );
    try {
      const summaryRes = await opts.fetcher(summaryUrl, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        signal: opts.signal,
        headers: { Accept: 'application/json' },
      });
      if (!summaryRes.ok) {
        await summaryRes.body?.cancel();
        continue;
      }
      const body = (await summaryRes.json()) as {
        title?: string;
        extract?: string;
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
        content_urls?: { desktop?: { page?: string } };
      };
      const imageUrl = body.originalimage?.source?.trim() || body.thumbnail?.source?.trim();
      if (!imageUrl || !/^https:\/\//i.test(imageUrl)) continue;
      hits.push({
        title: (body.title || title).slice(0, 200),
        imageUrl: imageUrl.slice(0, 4000),
        thumbnailUrl: body.thumbnail?.source?.slice(0, 4000),
        contextUrl: body.content_urls?.desktop?.page?.slice(0, 4000),
        snippet: (body.extract ?? title).slice(0, 400),
        provider: 'wikipedia',
      });
    } catch {
      /* next */
    }
    if (hits.length >= 4) break;
  }
  return hits;
}

async function commonsImageSearch(q: string, limit: number, opts: FetchOpts): Promise<ImageSearchHit[]> {
  const searchUrl = assertSafePublicHttpsUrl(
    `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json&origin=*`
  );
  const searchRes = await opts.fetcher(searchUrl, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!searchRes.ok) {
    await searchRes.body?.cancel();
    return [];
  }
  let searchBody: { query?: { search?: Array<{ title?: string }> } };
  try {
    searchBody = (await searchRes.json()) as typeof searchBody;
  } catch {
    return [];
  }
  const titles = (searchBody.query?.search ?? [])
    .map((row) => row.title?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, limit);
  if (!titles.length) return [];
  const infoUrl = assertSafePublicHttpsUrl(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${titles.map(encodeURIComponent).join('|')}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`
  );
  const infoRes = await opts.fetcher(infoUrl, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  });
  if (!infoRes.ok) {
    await infoRes.body?.cancel();
    return [];
  }
  let infoBody: {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{ url?: string; descriptionurl?: string; thumburl?: string }>;
        }
      >;
    };
  };
  try {
    infoBody = (await infoRes.json()) as typeof infoBody;
  } catch {
    return [];
  }
  const hits: ImageSearchHit[] = [];
  for (const page of Object.values(infoBody.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const imageUrl = info?.url?.trim();
    if (!info || !imageUrl || !/^https:\/\//i.test(imageUrl)) continue;
    hits.push({
      title: (page.title ?? 'Commons image').replace(/^File:/i, '').slice(0, 200),
      imageUrl: imageUrl.slice(0, 4000),
      thumbnailUrl: info.thumburl?.slice(0, 4000),
      contextUrl: info.descriptionurl?.slice(0, 4000),
      snippet: page.title ?? '',
      provider: 'wikimedia_commons',
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

/**
 * Image discovery: Google CSE when configured, then Wikipedia/Commons floor.
 */
export async function imageSearch(
  query: string,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    limit?: number;
    organizationId?: string;
  } = {}
): Promise<ImageSearchResult> {
  const raw = query.trim().slice(0, 200);
  if (!raw) {
    return {
      query: '',
      hits: [],
      note: 'Empty query.',
      providersTried: [],
      toolsUsed: [],
      hitCount: 0,
    };
  }
  const q = rewriteImageSearchQuery(raw);
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 10);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new Error('Search cancelled.');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 20000);
  const fetcher = options.fetcher ?? fetch;
  const opts: FetchOpts = { fetcher, signal: controller.signal };
  const providersTried: string[] = [];
  const toolsUsed: string[] = ['image_search'];
  const organizationId = options.organizationId?.trim() || undefined;
  const notes: string[] = [];
  if (q !== raw) notes.push(`Image query: ${q}.`);

  try {
    let hits: ImageSearchHit[] = [];
    if (isGoogleCseConfigured()) {
      providersTried.push('google_cse');
      try {
        hits = await googleCseImageSearch(q, limit, opts, organizationId);
      } catch (error) {
        notes.push(
          `google_cse: ${error instanceof Error ? error.message : 'failed'}. Confirm Image search is enabled on the CSE engine.`
        );
      }
    } else {
      notes.push('GOOGLE_CSE not configured; using SearXNG/Wikipedia/Commons fallback.');
    }

    if (!hits.length && isSearxngConfigured()) {
      providersTried.push('searxng');
      try {
        hits = await searxngImageSearch(q, limit, opts);
      } catch {
        notes.push('searxng image fallback failed.');
      }
    }

    if (!hits.length) {
      providersTried.push('wikipedia');
      try {
        hits = await wikipediaSummaryImage(q, opts);
      } catch {
        notes.push('wikipedia image fallback failed.');
      }
    }
    if (!hits.length) {
      providersTried.push('wikimedia_commons');
      try {
        hits = await commonsImageSearch(q, limit, opts);
      } catch {
        notes.push('commons image fallback failed.');
      }
    }

    return {
      query: raw,
      hits,
      note: hits.length
        ? `Found ${hits.length} image(s) via ${hits[0]?.provider}.${notes.length ? ` ${notes.join(' ')}` : ''}`
        : `No image hits.${notes.length ? ` ${notes.join(' ')}` : ' Try a more specific person/place name.'}`,
      providersTried,
      toolsUsed,
      hitCount: hits.length,
    };
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.message === 'Search cancelled.')) {
      throw error instanceof Error ? error : new Error('Search cancelled.');
    }
    return {
      query: raw,
      hits: [],
      note: 'Image search unavailable.',
      providersTried,
      toolsUsed,
      hitCount: 0,
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

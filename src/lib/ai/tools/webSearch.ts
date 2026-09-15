import { assertSafePublicHttpsUrl } from '@/lib/ai/tools/ssrf';
import { browserNavigate } from '@/lib/ai/tools/browserClient';
import { isBrowserWorkerConfigured } from '@/lib/ai/tools/browseRouter';
import { webFetch } from '@/lib/ai/tools/webFetch';

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
  provider?: string;
  extract?: string;
};

export type ResearchDepth = 'lite' | 'standard';

export type ResearchSearchResult = {
  query: string;
  hits: WebSearchHit[];
  note: string;
  providersTried: string[];
  toolsUsed: string[];
  hitCount: number;
  fetchCount: number;
};

export type ImageSearchHit = {
  title: string;
  imageUrl: string;
  contextUrl?: string;
  thumbnailUrl?: string;
  snippet: string;
  provider?: string;
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
    if (club.length >= 3) {
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
  if (/list of uefa|champions league top scorers|europa league top scorers/i.test(hay)) score -= 18;
  if (/\/\d{4}[–-]\d{2,4}[ _]/.test(hit.url) || /\b20\d{2}[–-]\d{2}\b.*season/i.test(hit.title)) {
    score -= 10;
  }
  if (hit.provider === 'brave' || hit.provider === 'google_cse') score += 2;
  if (hit.provider === 'wikipedia' && /records and statistics/i.test(hit.title)) score += 4;
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

async function braveWebSearch(q: string, limit: number, opts: FetchOpts): Promise<WebSearchHit[]> {
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
  if (!response.ok) {
    await response.body?.cancel();
    return [];
  }
  let body: {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return [];
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
  searchType?: 'image'
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
  if (!response.ok) {
    await response.body?.cancel();
    return null;
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
    return null;
  }
}

async function googleCseSearch(q: string, limit: number, opts: FetchOpts): Promise<WebSearchHit[]> {
  const body = await googleCseRequest(q, limit, opts);
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
  opts: FetchOpts
): Promise<ImageSearchHit[]> {
  const body = await googleCseRequest(q, limit, opts, 'image');
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

async function runProvider(
  name: string,
  work: () => Promise<WebSearchHit[]>,
  signal: AbortSignal
): Promise<WebSearchHit[]> {
  try {
    return await work();
  } catch (error) {
    if (signal.aborted) throw error;
    return [];
  }
}

function buildNote(providersTried: string[], providersWithHits: string[], hitCount: number): string {
  if (!hitCount) {
    return `No hits from: ${providersTried.join(', ') || 'none'}. Ask for a concrete URL or try a more specific query.`;
  }
  return `Results from ${providersWithHits.join(', ')} (tried ${providersTried.join(', ')}). Prefer web_fetch on concrete URLs for more detail.`;
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
    };
  }
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 8);
  const depth = options.depth ?? 'lite';
  const queries = buildResearchQueries(q);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new Error('Search cancelled.');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, depth === 'standard' ? 45000 : 20000);
  const fetcher = options.fetcher ?? fetch;
  const opts: FetchOpts = { fetcher, signal: controller.signal };
  const providersTried: string[] = [];
  const providersWithHits: string[] = [];
  const toolsUsed: string[] = ['web_search'];
  const pool: WebSearchHit[] = [];
  const poolCap = Math.max(limit * 3, 12);

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
        run: () => braveWebSearch(queries.primary, limit, opts),
      },
      {
        name: 'google_cse',
        enabled: isGoogleCseConfigured(),
        run: () => googleCseSearch(queries.primary, limit, opts),
      },
      {
        name: 'searxng',
        enabled: isSearxngConfigured(),
        run: () => searxngSearch(queries.primary, limit, opts),
      },
    ];

    for (const provider of providers) {
      if (!provider.enabled) continue;
      providersTried.push(provider.name);
      const found = await runProvider(provider.name, provider.run, controller.signal);
      const before = pool.length;
      mergeHits(pool, found, poolCap);
      if (pool.length > before) providersWithHits.push(provider.name);
    }

    const hits = rankResearchHits(pool, q, limit);

    let fetchCount = 0;
    if (depth === 'standard' && hits.length) {
      const fetchTargets = hits.slice(0, Math.min(3, hits.length));
      for (const hit of fetchTargets) {
        try {
          const page = await webFetch(hit.url, { fetcher, signal: controller.signal });
          fetchCount += 1;
          if (!toolsUsed.includes('web_fetch')) toolsUsed.push('web_fetch');
          hit.extract = page.text.slice(0, 2500);
          if (page.title && (!hit.title || hit.title.length < 8)) hit.title = page.title.slice(0, 200);
          if ((page.thin || page.escalateHint) && isBrowserWorkerConfigured() && !hit.extract?.trim()) {
            try {
              const rendered = await browserNavigate(hit.url, { fetcher, signal: controller.signal });
              if (!toolsUsed.includes('browser_navigate')) toolsUsed.push('browser_navigate');
              hit.extract = rendered.text.slice(0, 2500);
              if (rendered.title) hit.title = rendered.title.slice(0, 200);
            } catch {
              /* keep fetch extract if any */
            }
          } else if (
            (page.thin || page.escalateHint) &&
            isBrowserWorkerConfigured() &&
            (hit.extract?.length ?? 0) < 280
          ) {
            try {
              const rendered = await browserNavigate(hit.url, { fetcher, signal: controller.signal });
              if (rendered.text.trim().length > (hit.extract?.length ?? 0)) {
                if (!toolsUsed.includes('browser_navigate')) toolsUsed.push('browser_navigate');
                hit.extract = rendered.text.slice(0, 2500);
                if (rendered.title) hit.title = rendered.title.slice(0, 200);
              }
            } catch {
              /* keep fetch */
            }
          }
        } catch {
          /* skip failed fetch */
        }
      }
    }

    const noteParts = [
      buildNote(providersTried, providersWithHits, hits.length),
      queries.wikipedia !== q ? `Wiki query: ${queries.wikipedia}.` : '',
      queries.primary !== q ? `Web query: ${queries.primary}.` : '',
    ].filter(Boolean);

    return {
      query: q,
      hits,
      note: noteParts.join(' '),
      providersTried,
      toolsUsed,
      hitCount: hits.length,
      fetchCount,
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
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

/**
 * Bounded web search (lite depth). Cascade: Instant Answer → Wikipedia → optional Brave/CSE/SearXNG.
 */
export async function webSearch(
  query: string,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    limit?: number;
    depth?: ResearchDepth;
  } = {}
): Promise<ResearchSearchResult> {
  return researchSearch(query, { ...options, depth: options.depth ?? 'lite' });
}

/**
 * Image discovery via Google Programmable Search (`searchType=image`).
 * Requires GOOGLE_CSE_* and Image search enabled on the engine.
 */
export async function imageSearch(
  query: string,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    limit?: number;
  } = {}
): Promise<ImageSearchResult> {
  const q = query.trim().slice(0, 200);
  if (!q) {
    return {
      query: '',
      hits: [],
      note: 'Empty query.',
      providersTried: [],
      toolsUsed: [],
      hitCount: 0,
    };
  }
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

  try {
    if (!isGoogleCseConfigured()) {
      return {
        query: q,
        hits: [],
        note: 'Image search needs GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID, with Image search enabled on the Programmable Search Engine.',
        providersTried,
        toolsUsed,
        hitCount: 0,
      };
    }
    providersTried.push('google_cse');
    const hits = await googleCseImageSearch(q, limit, opts);
    return {
      query: q,
      hits,
      note: hits.length
        ? `Found ${hits.length} image(s) via google_cse.`
        : 'No image hits from google_cse. Confirm Image search is enabled on the CSE engine and the query is specific.',
      providersTried,
      toolsUsed,
      hitCount: hits.length,
    };
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.message === 'Search cancelled.')) {
      throw error instanceof Error ? error : new Error('Search cancelled.');
    }
    return {
      query: q,
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

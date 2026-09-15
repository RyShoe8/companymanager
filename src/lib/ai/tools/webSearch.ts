import { assertSafePublicHttpsUrl } from '@/lib/ai/tools/ssrf';

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * Bounded web search. Uses DuckDuckGo Instant Answer (no key) when available;
 * returns empty hits rather than inventing results.
 * Never throws except when the caller signal is already aborted / cancelled.
 */
export async function webSearch(
  query: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; limit?: number } = {}
): Promise<{ query: string; hits: WebSearchHit[]; note: string }> {
  const q = query.trim().slice(0, 200);
  if (!q) return { query: '', hits: [], note: 'Empty query.' };
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 8);
  const endpoint = assertSafePublicHttpsUrl(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
  );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new Error('Search cancelled.');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 10000);
  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { query: q, hits: [], note: 'Search provider returned an error.' };
    }
    let body: {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: unknown }>;
    };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      return { query: q, hits: [], note: 'Search unavailable.' };
    }
    const hits: WebSearchHit[] = [];
    if (body.AbstractURL && body.AbstractText) {
      hits.push({
        title: (body.Heading || 'Result').slice(0, 200),
        url: body.AbstractURL,
        snippet: body.AbstractText.slice(0, 400),
      });
    }
    for (const topic of body.RelatedTopics ?? []) {
      if (hits.length >= limit) break;
      if (topic.FirstURL && topic.Text) {
        hits.push({
          title: topic.Text.slice(0, 120),
          url: topic.FirstURL,
          snippet: topic.Text.slice(0, 400),
        });
      }
    }
    return {
      query: q,
      hits: hits.slice(0, limit),
      note: hits.length
        ? 'Results from DuckDuckGo Instant Answer (may be sparse). Prefer web_fetch on concrete URLs.'
        : 'No Instant Answer hits. Ask for a concrete URL or try a more specific query.',
    };
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.message === 'Search cancelled.')) {
      throw error instanceof Error ? error : new Error('Search cancelled.');
    }
    return { query: q, hits: [], note: 'Search unavailable.' };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

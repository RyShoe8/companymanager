import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageSearch, researchSearch, webSearch } from '@/lib/ai/tools/webSearch';

const emptyInstantAnswer = {
  AbstractText: '',
  AbstractURL: '',
  Heading: '',
  RelatedTopics: [] as unknown[],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('webSearch / researchSearch', () => {
  it('returns empty when Instant Answer and Wikipedia fail', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('<html>blocked</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      )
      .mockRejectedValueOnce(new Error('wiki down'));
    const result = await webSearch('arsenal scorers', { fetcher });
    expect(result.hits).toEqual([]);
    expect(result.providersTried).toEqual(['duckduckgo_ia', 'wikipedia']);
    expect(result.note).toMatch(/No hits/);
  });

  it('returns empty hits on network failure instead of throwing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNRESET'));
    await expect(webSearch('arsenal scorers', { fetcher })).resolves.toMatchObject({
      hits: [],
      providersTried: ['duckduckgo_ia', 'wikipedia'],
    });
  });

  it('rethrows when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(webSearch('arsenal', { signal: controller.signal })).rejects.toThrow(/cancelled/i);
  });

  it('uses Wikipedia when Instant Answer is empty', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(emptyInstantAnswer))
      .mockResolvedValueOnce(
        Response.json({
          query: {
            search: [
              {
                title: 'List of Arsenal F.C. records and statistics',
                snippet: 'Thierry Henry is the club&#039;s record goalscorer',
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          title: 'List of Arsenal F.C. records and statistics',
          extract:
            "Thierry Henry is Arsenal's record goalscorer with 228 goals in all competitions.",
          content_urls: {
            desktop: {
              page: 'https://en.wikipedia.org/wiki/List_of_Arsenal_F.C._records_and_statistics',
            },
          },
        })
      );

    const result = await webSearch('top 5 Arsenal all time goal scorers', { fetcher });
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
    expect(result.hits[0]?.url).toMatch(/wikipedia\.org\/wiki\/List_of_Arsenal/i);
    expect(result.hits[0]?.snippet).toMatch(/Thierry Henry/i);
    expect(result.providersTried).toContain('wikipedia');
    expect(result.note).toMatch(/wikipedia/i);
  });

  it('flattens nested Instant Answer RelatedTopics', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          AbstractText: '',
          AbstractURL: '',
          RelatedTopics: [
            {
              Name: 'Topics',
              Topics: [
                {
                  Text: 'Thierry Henry - French footballer',
                  FirstURL: 'https://duckduckgo.com/Thierry_Henry',
                },
              ],
            },
          ],
        })
      )
      .mockRejectedValue(new Error('skip further providers'));

    const result = await webSearch('Thierry Henry', { fetcher, limit: 1 });
    expect(result.hits).toEqual([
      expect.objectContaining({
        url: 'https://duckduckgo.com/Thierry_Henry',
        title: expect.stringContaining('Thierry Henry'),
        provider: 'duckduckgo_ia',
      }),
    ]);
    expect(result.note).toMatch(/duckduckgo_ia/i);
  });

  it('calls Brave when configured and earlier providers are sparse', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'brave-test-key');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(emptyInstantAnswer))
      .mockRejectedValueOnce(new Error('wiki down'))
      .mockResolvedValueOnce(
        Response.json({
          web: {
            results: [
              {
                title: 'Arsenal scorers',
                url: 'https://example.com/arsenal',
                description: 'All-time list',
              },
            ],
          },
        })
      );

    const result = await webSearch('arsenal scorers', { fetcher });
    expect(result.hits[0]?.provider).toBe('brave');
    expect(result.hits[0]?.url).toBe('https://example.com/arsenal');
    expect(result.providersTried).toContain('brave');
    const braveCall = fetcher.mock.calls.find((call) => String(call[0]).includes('api.search.brave.com'));
    expect(braveCall?.[1]?.headers).toMatchObject({ 'X-Subscription-Token': 'brave-test-key' });
  });

  it('standard depth fetches page extracts', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(emptyInstantAnswer))
      .mockResolvedValueOnce(
        Response.json({
          query: {
            search: [{ title: 'Arsenal F.C.', snippet: 'Football club' }],
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          title: 'Arsenal F.C.',
          extract: 'Arsenal Football Club based in London.',
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Arsenal_F.C.' } },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          '<html><title>Arsenal F.C.</title><body>' +
            'Thierry Henry scored many goals for Arsenal across his career at the club. '.repeat(20) +
            '</body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        )
      );

    const result = await researchSearch('Arsenal F.C.', { fetcher, depth: 'standard', limit: 1 });
    expect(result.fetchCount).toBeGreaterThanOrEqual(1);
    expect(result.toolsUsed).toEqual(expect.arrayContaining(['web_search', 'web_fetch']));
    expect(result.hits[0]?.extract).toMatch(/Thierry Henry/i);
  });
});

describe('imageSearch', () => {
  it('explains when Google CSE is not configured', async () => {
    const result = await imageSearch('Emirates Stadium');
    expect(result.hits).toEqual([]);
    expect(result.note).toMatch(/GOOGLE_CSE/i);
    expect(result.toolsUsed).toEqual(['image_search']);
  });

  it('calls Google CSE with searchType=image', async () => {
    vi.stubEnv('GOOGLE_CSE_API_KEY', 'cse-key');
    vi.stubEnv('GOOGLE_CSE_ID', 'engine-cx');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        items: [
          {
            title: 'Emirates Stadium',
            link: 'https://cdn.example.com/emirates.jpg',
            snippet: 'Aerial view',
            displayLink: 'example.com',
            image: {
              contextLink: 'https://example.com/stadium',
              thumbnailLink: 'https://cdn.example.com/emirates-thumb.jpg',
            },
          },
        ],
      })
    );

    const result = await imageSearch('Emirates Stadium', { fetcher });
    expect(result.hits).toEqual([
      expect.objectContaining({
        title: 'Emirates Stadium',
        imageUrl: 'https://cdn.example.com/emirates.jpg',
        contextUrl: 'https://example.com/stadium',
        thumbnailUrl: 'https://cdn.example.com/emirates-thumb.jpg',
        provider: 'google_cse',
      }),
    ]);
    expect(result.providersTried).toEqual(['google_cse']);
    const callUrl = String(fetcher.mock.calls[0]?.[0]);
    expect(callUrl).toContain('customsearch/v1');
    expect(callUrl).toContain('searchType=image');
    expect(callUrl).toContain('cx=engine-cx');
  });
});

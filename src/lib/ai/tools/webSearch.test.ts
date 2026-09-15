import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/tools/searchApiMeter', () => ({
  recordSearchApiQuery: vi.fn(async () => undefined),
}));

import {
  buildResearchQueries,
  imageSearch,
  researchSearch,
  rewriteImageSearchQuery,
  scoreResearchHit,
  webSearch,
} from '@/lib/ai/tools/webSearch';

const emptyInstantAnswer = {
  AbstractText: '',
  AbstractURL: '',
  Heading: '',
  RelatedTopics: [] as unknown[],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildResearchQueries', () => {
  it('rewrites club all-time scorers questions for Wikipedia', () => {
    expect(buildResearchQueries("who are Arsenal's all time top scorers?")).toEqual({
      primary: 'Arsenal all-time top goalscorers',
      wikipedia: 'List of Arsenal F.C. records and statistics',
    });
  });

  it('rewrites short club scorers queries', () => {
    expect(buildResearchQueries('arsenal scorers')).toEqual({
      primary: 'arsenal all-time top goalscorers',
      wikipedia: 'List of arsenal F.C. records and statistics',
    });
  });
});

describe('rewriteImageSearchQuery', () => {
  it('strips find-me-a-picture wrappers', () => {
    expect(rewriteImageSearchQuery('find me a picture of mikel arteta')).toBe('mikel arteta');
  });
});

describe('scoreResearchHit', () => {
  it('prefers club records pages over UEFA top-scorer lists', () => {
    const query = "who are Arsenal's all time top scorers?";
    const records = scoreResearchHit(
      {
        title: 'List of Arsenal F.C. records and statistics',
        url: 'https://en.wikipedia.org/wiki/List_of_Arsenal_F.C._records_and_statistics',
        snippet: 'Thierry Henry is the club record goalscorer',
        provider: 'wikipedia',
      },
      query
    );
    const uefa = scoreResearchHit(
      {
        title: 'List of UEFA Champions League top scorers',
        url: 'https://en.wikipedia.org/wiki/List_of_UEFA_Champions_League_top_scorers',
        snippet: 'Champions League all-time top scorers',
        provider: 'wikipedia',
      },
      query
    );
    expect(records).toBeGreaterThan(uefa);
  });
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
    const result = await webSearch('hello world news today', { fetcher });
    expect(result.hits).toEqual([]);
    expect(result.providersTried).toEqual(['duckduckgo_ia', 'wikipedia']);
    expect(result.note).toMatch(/No hits/);
  });

  it('returns empty hits on network failure instead of throwing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNRESET'));
    await expect(webSearch('hello world news today', { fetcher })).resolves.toMatchObject({
      hits: [],
      providersTried: ['duckduckgo_ia', 'wikipedia'],
    });
  });

  it('rethrows when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(webSearch('arsenal', { signal: controller.signal })).rejects.toThrow(/cancelled/i);
  });

  it('uses Wikipedia records page for Arsenal all-time scorers', async () => {
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
              {
                title: 'List of UEFA Champions League top scorers',
                snippet: 'Champions League all-time top scorers',
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
      )
      .mockResolvedValueOnce(
        Response.json({
          title: 'List of UEFA Champions League top scorers',
          extract: 'UEFA Champions League all-time top scorers.',
          content_urls: {
            desktop: {
              page: 'https://en.wikipedia.org/wiki/List_of_UEFA_Champions_League_top_scorers',
            },
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          parse: {
            sections: [{ index: '7', line: 'Goalscorers', anchor: 'Goalscorers' }],
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          parse: {
            text: {
              '*': '<p>Thierry Henry is the club record goalscorer with 228 goals. Ian Wright scored 185 goals.</p>',
            },
          },
        })
      )
      .mockResolvedValueOnce(Response.json({ parse: { sections: [] } }));

    const result = await webSearch("who are Arsenal's all time top scorers?", { fetcher });
    expect(result.hits[0]?.url).toMatch(/List_of_Arsenal_F\.C\._records_and_statistics/i);
    expect(result.hits[0]?.extract).toMatch(/Thierry Henry/i);
    expect(result.hits[0]?.extract).toMatch(/228/);
    expect(result.toolsUsed).toEqual(expect.arrayContaining(['wikipedia_section']));
    expect(result.providersTried).toContain('wikipedia');
    const wikiSearchCall = fetcher.mock.calls.find((call) =>
      String(call[0]).includes('action=query&list=search')
    );
    expect(String(wikiSearchCall?.[0])).toMatch(
      /List%20of%20Arsenal%20F\.C\.%20records%20and%20statistics/i
    );
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

  it('still calls Brave after Wikipedia returns hits', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'brave-test-key');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(emptyInstantAnswer))
      .mockResolvedValueOnce(
        Response.json({
          query: {
            search: [{ title: 'Noise season', snippet: 'season page' }],
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          title: 'Noise season',
          extract: 'A season article.',
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Noise_season' } },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          web: {
            results: [
              {
                title: 'Arsenal scorers',
                url: 'https://www.transfermarkt.com/arsenal/topscorer',
                description: 'All-time list',
              },
            ],
          },
        })
      );

    const result = await webSearch('arsenal scorers', { fetcher, limit: 2 });
    expect(result.providersTried).toEqual(expect.arrayContaining(['wikipedia', 'brave']));
    expect(result.hits.some((hit) => hit.provider === 'brave')).toBe(true);
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
  it('falls back to Wikipedia summary image when CSE is not configured', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          query: { search: [{ title: 'Mikel Arteta' }] },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          title: 'Mikel Arteta',
          extract: 'Spanish football manager',
          thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a.jpg' },
          originalimage: { source: 'https://upload.wikimedia.org/wikipedia/commons/a.jpg' },
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Mikel_Arteta' } },
        })
      );

    const result = await imageSearch('find me a picture of mikel arteta', { fetcher });
    expect(result.hits[0]?.imageUrl).toMatch(/upload\.wikimedia\.org/);
    expect(result.providersTried).toContain('wikipedia');
    expect(result.note).toMatch(/Image query: mikel arteta/i);
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

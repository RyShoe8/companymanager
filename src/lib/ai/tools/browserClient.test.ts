import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/tools/browseRouter', () => ({
  isBrowserWorkerConfigured: () => true,
}));

vi.mock('@/lib/ai/tools/ssrf', () => ({
  assertSafePublicHttpsUrl: (url: string) => new URL(url),
}));

import { browserNavigate } from '@/lib/ai/tools/browserClient';

describe('browserNavigate', () => {
  it('parses images from the worker JSON body', async () => {
    vi.stubEnv('NUCLEAS_BROWSER_WORKER_URL', 'https://browser.example.com');
    vi.stubEnv('NUCLEAS_BROWSER_WORKER_SECRET', 'x'.repeat(24));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        url: 'https://example.com/game',
        title: 'Game',
        text: 'Gameplay page',
        images: [
          'https://cdn.example.com/shot.png',
          'data:image/png;base64,abc',
          'https://cdn.example.com/shot.png',
        ],
      })
    );

    const result = await browserNavigate('https://example.com/game', { fetcher });
    expect(result.text).toMatch(/Gameplay/);
    expect(result.images).toEqual(['https://cdn.example.com/shot.png']);
    expect(result.note).toMatch(/Playwright/i);
  });
});

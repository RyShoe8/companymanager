import { describe, expect, it, vi } from 'vitest';
import { webSearch } from '@/lib/ai/tools/webSearch';

describe('webSearch', () => {
  it('returns empty hits when the provider returns non-JSON', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>blocked</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );
    await expect(webSearch('arsenal scorers', { fetcher })).resolves.toMatchObject({
      query: 'arsenal scorers',
      hits: [],
      note: 'Search unavailable.',
    });
  });

  it('returns empty hits on network failure instead of throwing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNRESET'));
    await expect(webSearch('arsenal scorers', { fetcher })).resolves.toMatchObject({
      hits: [],
      note: 'Search unavailable.',
    });
  });

  it('rethrows when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(webSearch('arsenal', { signal: controller.signal })).rejects.toThrow(/cancelled/i);
  });
});

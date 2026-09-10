import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
import { sendConnectionProbe } from './executionProbe';
describe('fixed connection diagnostics', () => {
  it.each(['chat', 'responses'] as const)('bounds %s and sends no tools', async kind => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('private output'));
    const result = await sendConnectionProbe('synthetic', kind, transport);
    expect(result).toMatchObject({ outcome: 'http_success', httpStatus: 200 });
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe(`https://llm.rogly.net/v1/${kind === 'chat' ? 'chat/completions' : 'responses'}`);
    expect(options?.redirect).toBe('error');
    const body = JSON.parse(String(options?.body));
    expect(body.tools).toBeUndefined();
    expect(body.max_tokens ?? body.max_output_tokens).toBe(16);
    expect(JSON.stringify(result)).not.toMatch(/synthetic|private output/);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('only returns header classifications and never retries rejection', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('private rejection', { status: 403,
      headers: { server: 'cloudflare', 'www-authenticate': 'private challenge', 'set-cookie': 'private cookie' } }));
    expect(await sendConnectionProbe('synthetic', 'responses', transport)).toEqual({ outcome: 'http_error', httpStatus: 403, cloudflareReported: true, authenticationChallengePresent: true });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('sanitizes transport failures without retrying', async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('private error'));
    expect(await sendConnectionProbe('synthetic', 'chat', transport)).toEqual({ outcome: 'transport_failure' });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

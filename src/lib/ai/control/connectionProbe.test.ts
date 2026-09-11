import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
import { executionProbeId, sendConnectionProbe } from './executionProbe';
describe('fixed connection diagnostics', () => {
  it('preserves HTTP status when discarding the body fails', async () => {
    const response = new Response('private body', { status: 502 });
    vi.spyOn(response.body!, 'cancel').mockRejectedValue(new Error('private cleanup failure'));
    const result = await sendConnectionProbe('synthetic', 'chat', vi.fn<typeof fetch>().mockResolvedValue(response));
    expect(result).toMatchObject({ outcome: 'http_error', httpStatus: 502 });
  });
  it('reports safe DNS details and elapsed time, not runtime messages or credentials', async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret token and host', { cause: { code: 'ENOTFOUND' } }));
    const result = await sendConnectionProbe('synthetic-secret', 'chat', transport);
    expect(result).toMatchObject({ outcome: 'transport_failure', failureCategory: 'dns', failurePhase: 'awaiting_response', timeoutMs: 45000 });
    expect('elapsedMs' in result ? result.elapsedMs : undefined).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(result)).not.toMatch(/secret|ENOTFOUND|host/);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each(['chat', 'responses', 'chat-recheck', 'chat-detailed', 'chat-recovery', 'chat-recovery-2'] as const)('bounds %s and sends no tools', async kind => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('private output'));
    const result = await sendConnectionProbe('synthetic', kind, transport);
    expect(result).toMatchObject({ outcome: 'http_success', httpStatus: 200 });
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe(`https://llm.rogly.net/v1/${kind !== 'responses' ? 'chat/completions' : 'responses'}`);
    expect(options?.redirect).toBe('error');
    const body = JSON.parse(String(options?.body));
    expect(body.tools).toBeUndefined();
    expect(body.max_tokens ?? body.max_output_tokens).toBe(16);
    expect(JSON.stringify(result)).not.toMatch(/synthetic|private output/);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('keeps the new attempt separate without resetting historical markers', () => {
    expect(executionProbeId()).toBe('remote-execution-probe-v1');
    expect(executionProbeId('chat')).toBe('remote-connection-chat-v1');
    expect(executionProbeId('responses')).toBe('remote-connection-responses-v1');
    expect(executionProbeId('chat-recheck')).toBe('remote-connection-chat-recheck-v1');
    expect(executionProbeId('chat-detailed')).toBe('remote-connection-chat-detailed-v1');
    expect(executionProbeId('chat-recovery')).toBe('remote-connection-chat-recovery-v1');
    expect(executionProbeId('chat-recovery-2')).toBe('remote-connection-chat-recovery-2-v1');
  });
  it('only returns header classifications and never retries rejection', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('private rejection', { status: 403,
      headers: { server: 'cloudflare', 'www-authenticate': 'private challenge', 'set-cookie': 'private cookie' } }));
    expect(await sendConnectionProbe('synthetic', 'responses', transport)).toEqual({ outcome: 'http_error', httpStatus: 403, cloudflareReported: true, authenticationChallengePresent: true });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('sanitizes transport failures without retrying', async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('private error'));
    expect(await sendConnectionProbe('synthetic', 'chat', transport)).toMatchObject({ outcome: 'transport_failure', failureCategory: 'unknown', failurePhase: 'awaiting_response', timeoutMs: 45000 });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

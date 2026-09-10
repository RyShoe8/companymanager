import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
import { sendExecutionProbe } from './executionProbe';
afterEach(() => vi.useRealTimers());
describe('bounded execution probe transport', () => {
  it('distinguishes parsing failure from network failure while preserving HTTP status', async () => {
    const result = await sendExecutionProbe('synthetic', vi.fn<typeof fetch>().mockResolvedValue(new Response('private non-json body')));
    expect(result).toMatchObject({ httpStatus: 200, failureCategory: 'invalid_response', failurePhase: 'parsing_response', timeoutMs: 45000 });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('sends only the fixed request and keeps credentials out of results', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ output: [{ type: 'code_interpreter_call', status: 'completed', code: 'print(17 * 19)', outputs: [{ type: 'logs', logs: '323\n' }] }] })));
    expect(await sendExecutionProbe('synthetic-token', transport)).toEqual({ outcome: 'tool_execution_reported', httpStatus: 200, toolResultReported: true });
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('https://llm.rogly.net/v1/responses'); expect(options?.redirect).toBe('error');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer synthetic-token' });
    expect(JSON.parse(String(options?.body))).toMatchObject({ max_output_tokens: 128, store: false, stream: false });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('does not treat model prose as execution evidence', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ output: [{ type: 'message', content: 'I executed it: 323' }] })));
    expect(await sendExecutionProbe('synthetic', transport)).toMatchObject({ outcome: 'execution_not_confirmed', toolResultReported: false });
  });
  it('never returns provider errors or retries HTTP failures', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret provider error', { status: 401 }));
    expect(await sendExecutionProbe('synthetic', transport)).toEqual({ outcome: 'http_error', httpStatus: 401, toolResultReported: false });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('caps provider response bytes', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(65537)));
    expect(await sendExecutionProbe('synthetic', transport)).toMatchObject({ outcome: 'response_too_large' });
  });
  it('sanitizes transport errors', async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret header'));
    expect(await sendExecutionProbe('synthetic', transport)).toMatchObject({ outcome: 'transport_or_parse_failure', toolResultReported: false, failureCategory: 'unknown', failurePhase: 'awaiting_response' });
  });
});

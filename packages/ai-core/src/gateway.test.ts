import { describe, expect, it, vi } from 'vitest';
import {
  completionLimitBody,
  invokeModel,
  usesMaxCompletionTokens,
  validateGatewayConfiguration,
  type GatewayConfiguration,
} from './gateway';

const config: GatewayConfiguration = { endpoint: 'https://llm.rogly.net/v1/chat/completions', bearerToken: 'test-secret', model: 'test-model', protocol: 'openai-chat' };
const request = { role: 'architect' as const, messages: [{ role: 'user' as const, content: 'Plan a synthetic task.' }], maxOutputTokens: 100 };
const output = { choices: [{ message: { content: 'A plan' }, finish_reason: 'stop' }] };
describe('remote inference gateway', () => {
  it('sends a server-side bearer token without redirects, cache, or tools', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(output));
    const result = await invokeModel(config, request, { fetcher });
    const options = fetcher.mock.calls[0][1]!;
    expect(options.redirect).toBe('error'); expect(options.cache).toBe('no-store');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer test-secret' });
    const body = JSON.parse(String(options.body));
    expect(body).not.toHaveProperty('tools');
    expect(body).toMatchObject({ max_tokens: 100 });
    expect(body).not.toHaveProperty('max_completion_tokens');
    expect(result).toMatchObject({ content: 'A plan', inputTokens: null, outputTokens: null });
    expect(JSON.stringify(result)).not.toContain('test-secret');
  });

  it('sends max_completion_tokens for o4-mini and omits max_tokens', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(output));
    await invokeModel({ ...config, model: 'o4-mini' }, request, { fetcher });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]!.body));
    expect(body).toMatchObject({ model: 'o4-mini', max_completion_tokens: 100 });
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('keeps max_tokens for gpt-4o-mini', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(output));
    await invokeModel({ ...config, model: 'gpt-4o-mini' }, request, { fetcher });
    const body = JSON.parse(String(fetcher.mock.calls[0][1]!.body));
    expect(body).toMatchObject({ model: 'gpt-4o-mini', max_tokens: 100 });
    expect(body).not.toHaveProperty('max_completion_tokens');
  });

  it('detects reasoning token-limit models including provider prefixes', () => {
    expect(usesMaxCompletionTokens('o4-mini')).toBe(true);
    expect(usesMaxCompletionTokens('openai/gpt-5.6-sol')).toBe(true);
    expect(usesMaxCompletionTokens('gpt-4o-mini')).toBe(false);
    expect(completionLimitBody('o3', 256)).toEqual({ max_completion_tokens: 256 });
    expect(completionLimitBody('gpt-4.1', 256)).toEqual({ max_tokens: 256 });
  });
  it.each(['http://llm.rogly.net/v1', 'https://user:secret@llm.rogly.net/v1', 'https://llm.rogly.net/v1?token=secret'])('rejects unsafe endpoint configuration', endpoint => {
    expect(() => validateGatewayConfiguration({ ...config, endpoint })).toThrow();
  });
  it('fails closed without a token or explicit protocol', () => {
    expect(() => validateGatewayConfiguration({ ...config, bearerToken: '' })).toThrow();
  });
  it.each([[401, 'credentials'], [403, 'credentials'], [429, 'rate_limit'], [500, 'unavailable']])('normalizes HTTP %s without leaking response details', async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('test-secret', { status: Number(status) }));
    await expect(invokeModel(config, request, { fetcher })).rejects.toMatchObject({ code, message: `Model gateway: ${code}` });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized responses', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(512001)));
    await expect(invokeModel(config, request, { fetcher })).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('accepts truncated or unexpected tool_calls when content is present', async () => {
    for (const choice of [
      { message: { content: 'run shell', tool_calls: [{}] }, finish_reason: 'tool_calls' },
      { message: { content: 'partial' }, finish_reason: 'length' },
    ]) {
      const result = await invokeModel(config, request, {
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [choice] })),
      });
      expect(result.content.trim().length).toBeGreaterThan(0);
    }
  });

  it('rejects empty plain content even with tool_calls', async () => {
    await expect(
      invokeModel(config, request, {
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            Response.json({ choices: [{ message: { content: '', tool_calls: [{}] }, finish_reason: 'tool_calls' }] })
          ),
      })
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('does not dispatch an already cancelled request', async () => {
    const controller = new AbortController(); controller.abort(); const fetcher = vi.fn<typeof fetch>();
    await expect(invokeModel(config, request, { fetcher, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves reported zero usage, separately from unknown', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...output, usage: { prompt_tokens: 0, completion_tokens: 3 } }));
    expect(await invokeModel(config, request, { fetcher })).toMatchObject({ inputTokens: 0, outputTokens: 3 });
  });
});

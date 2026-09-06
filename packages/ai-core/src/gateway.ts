import { modelRequestSchema, type ModelRequest, type ModelResult } from '@nucleas/ai-contracts';
import { z } from 'zod';

export class GatewayError extends Error {
  constructor(public readonly code: 'configuration' | 'credentials' | 'rate_limit' | 'unavailable' | 'invalid_response' | 'cancelled') {
    super(`Model gateway: ${code}`);
  }
}

export type GatewayConfiguration = {
  endpoint: string;
  bearerToken: string;
  model: string;
  protocol: 'openai-chat';
  timeoutMs?: number;
};

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({
    message: z.object({ content: z.string().max(128000), tool_calls: z.array(z.unknown()).optional() }),
    finish_reason: z.string().nullable().optional(),
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

export function validateGatewayConfiguration(config: GatewayConfiguration): URL {
  let endpoint: URL;
  try { endpoint = new URL(config.endpoint); } catch { throw new GatewayError('configuration'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    !config.bearerToken.trim() || /[\r\n]/.test(config.bearerToken) || !config.model.trim() ||
    config.protocol !== 'openai-chat' ||
    (config.timeoutMs !== undefined && (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 120000))) {
    throw new GatewayError('configuration');
  }
  return endpoint;
}

/** Called only by a server-side, budget-authorized dispatcher; never directly by a browser route. */
export async function invokeModel(
  config: GatewayConfiguration, request: ModelRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<ModelResult> {
  const endpoint = validateGatewayConfiguration(config);
  const input = modelRequestSchema.parse(request);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new GatewayError('cancelled');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, config.timeoutMs ?? 60000);
  const started = Date.now();
  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.bearerToken}` },
      body: JSON.stringify({ model: config.model, messages: input.messages, max_tokens: input.maxOutputTokens, stream: false }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new GatewayError('credentials');
      if (response.status === 429) throw new GatewayError('rate_limit');
      throw new GatewayError('unavailable');
    }
    // Bound the actual response, including chunked responses without Content-Length.
    const reader = response.body?.getReader();
    if (!reader) throw new GatewayError('invalid_response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512000) { await reader.cancel(); throw new GatewayError('invalid_response'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed: z.infer<typeof responseSchema>;
    try { parsed = responseSchema.parse(JSON.parse(new TextDecoder().decode(bytes))); }
    catch { throw new GatewayError('invalid_response'); }
    const choice = parsed.choices[0];
    if (choice.message.tool_calls?.length || choice.finish_reason === 'length' || !choice.message.content.trim()) {
      throw new GatewayError('invalid_response');
    }
    return {
      content: choice.message.content, model: config.model,
      inputTokens: parsed.usage?.prompt_tokens ?? null,
      outputTokens: parsed.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - started, finishReason: choice.finish_reason ?? null,
    };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (options.signal?.aborted) throw new GatewayError('cancelled');
    // Never propagate provider bodies, URLs with secrets, or authorization headers.
    throw new GatewayError('unavailable');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

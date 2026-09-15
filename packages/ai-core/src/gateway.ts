import {
  modelRequestSchema,
  modelToolRequestSchema,
  toolCallSchema,
  type ModelRequest,
  type ModelResult,
  type ModelToolRequest,
  type ModelToolResult,
  type ToolCall,
} from '@nucleas/ai-contracts';
import { z } from 'zod';

export class GatewayError extends Error {
  constructor(
    public readonly code:
      | 'configuration'
      | 'credentials'
      | 'rate_limit'
      | 'unavailable'
      | 'invalid_response'
      | 'cancelled'
  ) {
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
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().max(128000).nullable().optional(),
          tool_calls: z.array(z.unknown()).optional(),
        }),
        finish_reason: z.string().nullable().optional(),
      })
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const imageResponseSchema = z.object({
  data: z
    .array(
      z.object({
        b64_json: z.string().max(8_000_000).optional(),
        url: z.string().url().max(4000).optional(),
      })
    )
    .min(1)
    .max(4),
});

export function validateGatewayConfiguration(config: GatewayConfiguration): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    throw new GatewayError('configuration');
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !config.bearerToken.trim() ||
    /[\r\n]/.test(config.bearerToken) ||
    !config.model.trim() ||
    config.protocol !== 'openai-chat' ||
    (config.timeoutMs !== undefined &&
      (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 120000))
  ) {
    throw new GatewayError('configuration');
  }
  return endpoint;
}

/** Strip provider prefixes (e.g. openai/o4-mini → o4-mini). */
function modelIdBase(model: string): string {
  const slash = model.lastIndexOf('/');
  return (slash >= 0 ? model.slice(slash + 1) : model).trim().toLowerCase();
}

/**
 * o-series and GPT-5/6 reject `max_tokens` on Chat Completions; they require
 * `max_completion_tokens` (which also covers reasoning tokens).
 */
export function usesMaxCompletionTokens(model: string): boolean {
  const id = modelIdBase(model);
  return /^o[1-9]/.test(id) || /^gpt-[56]/.test(id);
}

/** Token-limit fields for an OpenAI-compatible chat completions body. */
export function completionLimitBody(
  model: string,
  maxOutputTokens: number
): { max_completion_tokens: number } | { max_tokens: number } {
  return usesMaxCompletionTokens(model)
    ? { max_completion_tokens: maxOutputTokens }
    : { max_tokens: maxOutputTokens };
}

/** Derive OpenAI-compatible images generations URL from a chat-completions endpoint. */
export function imagesUrlFromChatEndpoint(endpoint: string): URL {
  const url = validateGatewayConfiguration({
    endpoint,
    bearerToken: 'x',
    model: 'x',
    protocol: 'openai-chat',
  });
  let path = url.pathname.replace(/\/+$/, '') || '';
  if (path.endsWith('/chat/completions')) {
    path = `${path.slice(0, -'/chat/completions'.length)}/images/generations`;
  } else if (path.endsWith('/completions')) {
    path = `${path.slice(0, -'/completions'.length)}/images/generations`;
  } else if (path.endsWith('/v1')) {
    path = `${path}/images/generations`;
  } else if (!path || path === '/') {
    path = '/v1/images/generations';
  } else {
    path = `${path}/images/generations`;
  }
  url.pathname = path;
  return url;
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new GatewayError('invalid_response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new GatewayError('invalid_response');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new GatewayError('invalid_response');
  }
}

function parseToolCalls(raw: unknown[] | undefined): ToolCall[] {
  if (!raw?.length) return [];
  const calls: ToolCall[] = [];
  for (const item of raw.slice(0, 8)) {
    const parsed = toolCallSchema.safeParse(item);
    if (parsed.success) calls.push(parsed.data);
  }
  return calls;
}

function parseOrInvalidResponse<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new GatewayError('invalid_response');
  }
}

/** Called only by a server-side, budget-authorized dispatcher; never directly by a browser route. */
export async function invokeModel(
  config: GatewayConfiguration,
  request: ModelRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}
): Promise<ModelResult> {
  const endpoint = validateGatewayConfiguration(config);
  const input = parseOrInvalidResponse(() => modelRequestSchema.parse(request));
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new GatewayError('cancelled');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, config.timeoutMs ?? 60000);
  const started = Date.now();
  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.bearerToken}` },
      body: JSON.stringify({
        model: config.model,
        messages: input.messages,
        ...completionLimitBody(config.model, input.maxOutputTokens),
        stream: false,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new GatewayError('credentials');
      if (response.status === 429) throw new GatewayError('rate_limit');
      throw new GatewayError('unavailable');
    }
    const parsed = responseSchema.parse(await readBoundedJson(response, 512000));
    const choice = parsed.choices[0]!;
    const content = choice.message.content?.trim() ?? '';
    // Plain chat: accept truncated replies when there is visible text. Ignore unexpected
    // tool_calls when content exists (local hosts often emit them without a tools request).
    if (!content) {
      throw new GatewayError('invalid_response');
    }
    return {
      content: choice.message.content!,
      model: config.model,
      inputTokens: parsed.usage?.prompt_tokens ?? null,
      outputTokens: parsed.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - started,
      finishReason: choice.finish_reason ?? null,
    };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (options.signal?.aborted) throw new GatewayError('cancelled');
    throw new GatewayError('unavailable');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

/**
 * Tool-capable chat completions. Returns assistant text and/or tool_calls.
 * Callers must execute tools server-side; never trust model-claimed side effects alone.
 */
export async function invokeModelWithTools(
  config: GatewayConfiguration,
  request: ModelToolRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}
): Promise<ModelToolResult> {
  const endpoint = validateGatewayConfiguration(config);
  const input = parseOrInvalidResponse(() => modelToolRequestSchema.parse(request));
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new GatewayError('cancelled');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, config.timeoutMs ?? 60000);
  const started = Date.now();
  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.bearerToken}` },
      body: JSON.stringify({
        model: config.model,
        messages: input.messages,
        ...completionLimitBody(config.model, input.maxOutputTokens),
        tools: input.tools,
        stream: false,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new GatewayError('credentials');
      if (response.status === 429) throw new GatewayError('rate_limit');
      throw new GatewayError('unavailable');
    }
    const parsed = responseSchema.parse(await readBoundedJson(response, 512000));
    const choice = parsed.choices[0]!;
    const toolCalls = parseToolCalls(choice.message.tool_calls);
    const content = (choice.message.content ?? '').trim();
    if (!toolCalls.length && !content) throw new GatewayError('invalid_response');
    if (choice.finish_reason === 'length' && !toolCalls.length) {
      throw new GatewayError('invalid_response');
    }
    return {
      content,
      toolCalls,
      model: config.model,
      inputTokens: parsed.usage?.prompt_tokens ?? null,
      outputTokens: parsed.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - started,
      finishReason: choice.finish_reason ?? null,
    };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (options.signal?.aborted) throw new GatewayError('cancelled');
    throw new GatewayError('unavailable');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export type ImageGenerationResult = {
  mimeType: string;
  /** Raw base64 without data: prefix, when returned by the host. */
  b64: string | null;
  /** HTTPS image URL when the host returns a URL instead of b64. */
  url: string | null;
};

/** OpenAI-compatible image generation via company or local images endpoint. */
export async function generateImage(
  config: GatewayConfiguration,
  input: { prompt: string; size?: '1024x1024' | '512x512' | '256x256'; signal?: AbortSignal; fetcher?: typeof fetch }
): Promise<ImageGenerationResult> {
  validateGatewayConfiguration(config);
  const prompt = input.prompt.trim().slice(0, 4000);
  if (!prompt) throw new GatewayError('configuration');
  const endpoint = imagesUrlFromChatEndpoint(config.endpoint);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (input.signal?.aborted) throw new GatewayError('cancelled');
  input.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, config.timeoutMs ?? 90000);
  try {
    const response = await (input.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.bearerToken}` },
      body: JSON.stringify({
        model: config.model,
        prompt,
        n: 1,
        size: input.size ?? '1024x1024',
        response_format: 'b64_json',
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new GatewayError('credentials');
      if (response.status === 429) throw new GatewayError('rate_limit');
      throw new GatewayError('unavailable');
    }
    const parsed = imageResponseSchema.parse(await readBoundedJson(response, 8_000_000));
    const first = parsed.data[0]!;
    if (first.b64_json?.trim()) {
      return { mimeType: 'image/png', b64: first.b64_json.trim(), url: null };
    }
    if (first.url?.startsWith('https:')) {
      return { mimeType: 'image/png', b64: null, url: first.url };
    }
    throw new GatewayError('invalid_response');
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (input.signal?.aborted) throw new GatewayError('cancelled');
    throw new GatewayError('unavailable');
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', cancel);
  }
}

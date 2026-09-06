import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AiHttpError } from './access';

export function aiResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function readAiBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AiHttpError(415, 'JSON required.');
  const reader = request.body?.getReader();
  if (!reader) throw new AiHttpError(400, 'Request body required.');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 196608) { await reader.cancel(); throw new AiHttpError(413, 'Request too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AiHttpError(400, 'Invalid JSON.'); }
}

export function aiError(error: unknown) {
  if (error instanceof AiHttpError) return aiResponse({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return aiResponse({ error: 'Invalid input. Check lengths, criteria, and dependencies.' }, 400);
  // Duplicate-key races are safe conflicts; never return raw Mongo/provider errors.
  if (typeof error === 'object' && error && 'code' in error && error.code === 11000) {
    return aiResponse({ error: 'Request already exists. Refresh before retrying.' }, 409);
  }
  return aiResponse({ error: 'AI operation unavailable. Check server configuration and transaction support.' }, 503);
}

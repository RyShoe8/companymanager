import 'server-only';
import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { AiDispatchLock } from '@/lib/models/AiControl';
import { isPlatformAdmin } from '@/lib/auth/platformAdmin';
import { AiHttpError } from './access';
import { readPlatformSettings } from './settings';
import { reserveDispatch } from './dispatchLimits';
import { aiTransaction } from './transaction';
import { classifyProbeFailure } from '@/lib/ai/probeDiagnostics';

const ID = 'remote-execution-probe-v1';
const schema = new Schema({ _id: String, actorId: { type: Schema.Types.ObjectId, required: true },
  startedAt: { type: Date, required: true }, completedAt: Date,
  outcome: { type: String, required: true }, httpStatus: Number, toolResultReported: Boolean,
  cloudflareReported: Boolean, authenticationChallengePresent: Boolean,
  failureCategory: String, failurePhase: String, elapsedMs: Number, timeoutMs: Number });
export const AiExecutionProbe = mongoose.models.AiExecutionProbe ?? mongoose.model('AiExecutionProbe', schema);
const Probe = AiExecutionProbe;
const endpoint = 'https://llm.rogly.net/v1/responses';
const model = 'Qwen/Qwen2.5-Coder-14B-Instruct-AWQ';

export type ConnectionProbeKind = 'chat' | 'responses' | 'chat-recheck' | 'chat-detailed' | 'chat-recovery' | 'chat-recovery-2';
export function executionProbeId(kind?: ConnectionProbeKind) {
  return kind ? `remote-connection-${kind}-v1` : ID;
}
export async function readExecutionProbe(kind?: ConnectionProbeKind) {
  await connectDB();
  const row = await Probe.findById(executionProbeId(kind)).select('startedAt completedAt outcome httpStatus toolResultReported cloudflareReported authenticationChallengePresent failureCategory failurePhase elapsedMs timeoutMs').lean();
  return row ?? { outcome: 'not_started' };
}

/** Never return provider text, errors, headers, code or identifiers to the browser/logs. */
export async function sendExecutionProbe(token: string, transport: typeof fetch = fetch) {
  const started = performance.now();
  const signal = AbortSignal.timeout(45000);
  let failurePhase = 'awaiting_response';
  let httpStatus: number | undefined;
  try {
    const response = await transport(endpoint, { method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, store: false, stream: false, max_output_tokens: 128,
        input: 'Use a server-side Python code interpreter, if available, to execute exactly print(17 * 19). Do not read files, environment variables or secrets, access the network, install packages, or execute any other code. If execution is unavailable, say unavailable. Do not simulate tool execution.',
        tools: [{ type: 'code_interpreter', container: { type: 'auto' } }] }) });
    httpStatus = response.status;
    failurePhase = 'reading_response';
    if (!response.ok) { await response.body?.cancel().catch(() => {}); return { outcome: 'http_error', httpStatus: response.status, toolResultReported: false }; }
    const reader = response.body?.getReader();
    if (!reader) return { outcome: 'invalid_response', httpStatus: response.status, toolResultReported: false };
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 65536) { await reader.cancel(); return { outcome: 'response_too_large', httpStatus: response.status, toolResultReported: false }; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    failurePhase = 'parsing_response';
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const output = typeof data === 'object' && data !== null && 'output' in data ? data.output : null;
    const toolResultReported = Array.isArray(output) && output.some(item => item?.type === 'code_interpreter_call' &&
      item.status === 'completed' && item.code?.trim() === 'print(17 * 19)' && Array.isArray(item.outputs) &&
      item.outputs.some((result: { type?: string; logs?: unknown }) => result?.type === 'logs' && typeof result.logs === 'string' && result.logs.trim() === '323'));
    return { outcome: toolResultReported ? 'tool_execution_reported' : 'execution_not_confirmed', httpStatus: response.status, toolResultReported };
  } catch (error) { return { outcome: 'transport_or_parse_failure', toolResultReported: false, httpStatus,
    failureCategory: failurePhase === 'parsing_response' ? 'invalid_response' : classifyProbeFailure(error, signal.aborted),
    failurePhase, elapsedMs: Math.round(performance.now() - started), timeoutMs: 45000 }; }
}

/** Fixed plain-text requests; discard response text and expose only header classifications. */
export async function sendConnectionProbe(token: string, kind: ConnectionProbeKind, transport: typeof fetch = fetch) {
  const started = performance.now();
  const signal = AbortSignal.timeout(45000);
  try {
    const response = await transport(`https://llm.rogly.net/v1/${kind !== 'responses' ? 'chat/completions' : 'responses'}`, {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, stream: false, ...(kind !== 'responses'
        ? { max_tokens: 16, messages: [{ role: 'user', content: 'Reply with OK only.' }] }
        : { store: false, max_output_tokens: 16, input: 'Reply with OK only.' }) }),
    });
    const result = { outcome: response.ok ? 'http_success' : 'http_error', httpStatus: response.status,
      cloudflareReported: response.headers.get('server')?.toLowerCase() === 'cloudflare',
      authenticationChallengePresent: response.headers.has('www-authenticate') };
    // Cleanup errors must not erase an HTTP response already received.
    await response.body?.cancel().catch(() => {});
    return result;
  } catch (error) { return { outcome: 'transport_failure', failureCategory: classifyProbeFailure(error, signal.aborted),
    failurePhase: 'awaiting_response', elapsedMs: Math.round(performance.now() - started), timeoutMs: 45000 }; }
}

export async function runExecutionProbe(actorId: string, kind?: ConnectionProbeKind) {
  const probeId = executionProbeId(kind);
  await connectDB();
  const token = process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN?.trim();
  if (!token) throw new AiHttpError(503, 'Provider credential is not configured.');
  const lockToken = randomUUID();
  await aiTransaction(async session => {
    const actor = await User.findById(actorId).session(session);
    if (!actor || !isPlatformAdmin(actor)) throw new AiHttpError(403, 'Current administrator required.');
    await User.updateOne({ _id: actor._id }, { $inc: { __v: 1 } }, { session });
    if (await Probe.exists({ _id: probeId }).session(session)) throw new AiHttpError(409, 'This one-time probe has already been attempted. Refresh its result.');
    const { value } = await readPlatformSettings(session);
    if (value.endpoint !== 'https://llm.rogly.net/v1/chat/completions' || value.model !== model) throw new AiHttpError(409, 'Saved endpoint/model differs from the specifically authorized probe.');
    const now = new Date();
    // Same lock as planning. Retain for fifteen minutes even after ambiguous completion.
    const lock = await AiDispatchLock.findById('remote-planning-v1').session(session);
    if (lock && lock.expiresAt > now) throw new AiHttpError(409, 'Shared inference is busy. No probe was sent.');
    await AiDispatchLock.updateOne({ _id: 'remote-planning-v1' }, { $set: { token: lockToken, expiresAt: new Date(now.getTime() + 900000) } }, { upsert: true, session });
    if (!await reserveDispatch({ dailyRequestLimit: value.dailyRequestLimit, minimumIntervalSeconds: Math.max(300, value.minimumIntervalSeconds) }, now, session)) throw new AiHttpError(429, 'Shared inference limit reached. No probe was sent.');
    await Probe.create([{ _id: probeId, actorId, startedAt: now, outcome: 'attempted_result_unknown' }], { session });
  });
  // Never send inside a retried transaction. A crash leaves an irrevocable attempted marker.
  const result = kind ? await sendConnectionProbe(token, kind) : await sendExecutionProbe(token);
  await Probe.updateOne({ _id: probeId }, { $set: { ...result, completedAt: new Date() } });
  return result;
}

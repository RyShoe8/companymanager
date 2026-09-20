import { z } from 'zod';

const githubName = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);
const gitRef = z.string().min(1).max(200).regex(/^[A-Za-z0-9._/-]+$/);

export const executionWorkerRequestSchema = z.object({
  protocolVersion: z.literal(1),
  requestId: z.string().uuid(),
  repository: z.object({
    owner: githubName,
    repo: githubName,
    ref: gitRef,
    accessToken: z.string().min(1).max(4096),
  }).strict(),
  task: z.string().trim().min(1).max(12_000),
  maxRounds: z.number().int().min(1).max(40).default(24),
  commandTimeoutMs: z.number().int().min(1_000).max(300_000).default(120_000),
}).strict();

export const executionEvidenceSchema = z.object({
  command: z.array(z.string().max(500)).min(1).max(33),
  exitCode: z.number().int().nullable(),
  timedOut: z.boolean(),
  output: z.string().max(16_000),
}).strict();

export const executionWorkerResponseSchema = z.object({
  protocolVersion: z.literal(1),
  requestId: z.string().uuid(),
  status: z.enum(['completed', 'blocked', 'failed']),
  summary: z.string().trim().min(1).max(4000),
  baseCommit: z.string().regex(/^[a-f0-9]{40}$/),
  patch: z.string().max(1_048_576),
  changedFiles: z.array(z.string().min(1).max(500)).max(200),
  evidence: z.array(executionEvidenceSchema).max(30),
  limitations: z.array(z.string().min(1).max(1000)).max(20),
}).strict();

export type ExecutionWorkerRequest = z.infer<typeof executionWorkerRequestSchema>;
export type ExecutionWorkerResponse = z.infer<typeof executionWorkerResponseSchema>;

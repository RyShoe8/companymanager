import { z } from 'zod';

export const aiEmployeeSchema = z.enum(['marketing', 'product', 'support', 'engineering', 'researcher']);
export type AiEmployeeKey = z.infer<typeof aiEmployeeSchema>;

export const teamMessageRoleSchema = z.enum(['user', 'assistant', 'status']);
export type TeamMessageRole = z.infer<typeof teamMessageRoleSchema>;

export const teamHistorySchema = z.object({
  employee: aiEmployeeSchema.optional(),
  kind: z.enum(['message', 'task']).optional(),
  status: z.enum(['saved', 'cancelled']).optional(),
  recurring: z.literal('true').optional(),
  cursor: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
}).strict();

export function teamHistoryFilter(input: z.infer<typeof teamHistorySchema>) {
  return {
    ...(input.employee ? { employee: input.employee } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.recurring ? { cadence: { $in: ['daily', 'weekly'] } } : {}),
  };
}

export const aiEmployees = [
  { id: 'marketing', name: 'Marketing AI', initials: 'MA', description: 'Campaigns, content briefs, positioning and launch communications.' },
  { id: 'product', name: 'Product Manager AI', initials: 'PM', description: 'Requirements, priorities, acceptance criteria and project planning.' },
  { id: 'support', name: 'Support AI', initials: 'SU', description: 'Support drafts, issue triage, documentation and customer questions.' },
  { id: 'engineering', name: 'Engineering AI', initials: 'EN', description: 'Technical investigation, implementation plans and code review preparation.' },
  {
    id: 'researcher',
    name: 'Researcher AI',
    initials: 'RE',
    description:
      'Research briefs, competitive scans, source notes and structured summaries. Use web_search/web_fetch (and browser_navigate only when needed) via provided tools—never invent live listings without tool results.',
  },
] as const;

export const teamRequestSchema = z.object({
  requestId: z.string().uuid(),
  employee: aiEmployeeSchema,
  kind: z.enum(['message', 'task']),
  text: z.string().trim().min(1).max(6000),
  cadence: z.enum(['once', 'daily', 'weekly']).default('once'),
}).strict().refine(value => value.kind === 'task' || value.cadence === 'once', 'Only tasks can recur.');

export type TeamRequest = z.infer<typeof teamRequestSchema>;

export type TeamItem = {
  id: string;
  employee: AiEmployeeKey;
  kind: 'message' | 'task';
  role: TeamMessageRole;
  text: string;
  cadence: 'once' | 'daily' | 'weekly';
  status: 'saved' | 'cancelled';
  createdAt: string;
  failureCategory?: string;
  parentRequestId?: string;
  runId?: string;
};

export type TeamContextSummary = {
  projectName: string;
  inferenceReady: boolean;
  remoteEnabled: boolean;
  planningEnabled: boolean;
  unavailableReason: string | null;
  included: string[];
  recentObjectiveCount: number;
  recentRunCount: number;
};

export type TeamSnapshot = {
  project: { id: string; name: string };
  context: TeamContextSummary;
  items: TeamItem[];
  nextCursor: string | null;
};

export function normalizeTeamRole(role: unknown): TeamMessageRole {
  if (role === 'assistant' || role === 'status') return role;
  return 'user';
}

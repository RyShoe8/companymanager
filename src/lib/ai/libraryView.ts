import type { PlanDraft } from '@nucleas/ai-contracts';

export type LibraryKind = 'objectives' | 'plans';
export type LibraryPage = { kind: LibraryKind; items: { id: string; title: string; createdAt: string;
  status: string | null; source: string | null; expiresAt: string | null }[]; nextCursor: string | null };
export type ObjectiveDetail = { id: string; title: string; outcome: string; constraints: string;
  acceptanceCriteria: string[]; createdAt: string };
export type PlanDetail = PlanDraft & { id: string; objectiveId: string; runId: string | null;
  status: string; source: string; digest: string; createdAt: string; expiresAt: string;
  approvedAt: string | null; materializedTaskIds: string[]; expired: boolean; stale: boolean };
export type LibraryDetail = ({ kind: 'objectives'; objective: ObjectiveDetail } | { kind: 'plans'; plan: PlanDetail }) & {
  canManage: boolean; planningEnabled: boolean;
};

import type { RunState } from '@nucleas/ai-contracts';

const transitions: Record<RunState, readonly RunState[]> = {
  queued: ['running', 'blocked', 'cancelled'],
  running: ['waiting_for_approval', 'review_required', 'blocked', 'failed', 'cancellation_requested'],
  waiting_for_approval: ['queued', 'blocked', 'cancelled'],
  review_required: ['reviewing', 'cancelled', 'blocked'],
  reviewing: ['revision_required', 'awaiting_acceptance', 'blocked', 'failed', 'cancellation_requested'],
  revision_required: ['queued', 'blocked', 'cancelled'],
  awaiting_acceptance: ['completed', 'revision_required', 'cancelled', 'blocked'],
  blocked: ['queued', 'cancelled'],
  failed: [], completed: [], cancelled: [],
  cancellation_requested: ['cancelled', 'blocked'],
};

export function assertRunTransition(from: RunState, to: RunState, evidence?: {
  acceptedByHuman?: boolean; reviewPassed?: boolean; artifactMatches?: boolean;
  executionStoppedOrFenced?: boolean;
}) {
  if (!transitions[from].includes(to)) throw new Error('Illegal run transition.');
  if (to === 'completed' && !(evidence?.acceptedByHuman && evidence.reviewPassed && evidence.artifactMatches)) {
    throw new Error('Completion requires human acceptance of the reviewed artifact.');
  }
  if (from === 'cancellation_requested' && to === 'cancelled' && !evidence?.executionStoppedOrFenced) {
    throw new Error('Execution must stop or be fenced before cancellation is confirmed.');
  }
}

export function assertApprovalBinding(approval: {
  organizationId: string; projectId: string; digest: string; expiresAt: Date; consumed: boolean;
}, action: { organizationId: string; projectId: string; digest: string }, now = new Date()) {
  if (approval.consumed || !Number.isFinite(approval.expiresAt.getTime()) || approval.expiresAt <= now ||
    approval.organizationId !== action.organizationId || approval.projectId !== action.projectId ||
    approval.digest !== action.digest) throw new Error('Approval is expired, consumed, or does not match.');
}

/** Integer micro-USD accounting; storage must reserve atomically, not read then write. */
export function assertBudgetReservation(limit: number, spent: number, reserved: number, requested: number) {
  if (![limit, spent, reserved, requested].every(n => Number.isSafeInteger(n) && n >= 0) ||
    !Number.isSafeInteger(spent + reserved + requested) || spent + reserved + requested > limit) {
    throw new Error('Budget unavailable.');
  }
}

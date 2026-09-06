export type AiRunSummary = {
  id: string; role: string; status: string; model: string | null; createdAt: string;
  startedAt: string | null; completedAt: string | null; failureCode: string | null;
  inputTokens: number | null; outputTokens: number | null; latencyMs: number | null; costMicros: number | null;
};
export type AiRunPage = { runs: AiRunSummary[]; nextCursor: string | null };
export type AiEventPage = { events: { sequence: number; type: string; summary: string; createdAt: string }[]; nextAfter: number | null };
export type AiRunDetail = {
  run: AiRunSummary & { revision: number; objectiveId: string | null; taskId: string | null;
    inputDigest: string; policyDigest: string };
  job: { status: string; cancelRequested: boolean; dispatchedAt: string | null; projectUpdatedAt: string;
    reservationMicros: number; leaseExpiresAt: string | null } | null;
  plan: { id: string; status: string; digest: string; expiresAt: string; approvedAt: string | null;
    taskCount: number; materializedTaskIds: string[] } | null;
  reservations: { scope: 'organization' | 'project' | 'unknown'; period: string | null;
    amountMicros: number; state: string; actualMicros: number | null }[];
};

/** Application-owned guidance, never provider error bodies or hidden model reasoning. */
export function runFailureGuidance(code: string | null): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    credentials: 'Ask a platform administrator to check or rotate the inference bearer token. Do not paste it into this page.',
    configuration: 'Ask an administrator to check AI Settings, server secrets and available budget before submitting a new request.',
    rate_limit: 'The endpoint rejected the request because of a rate limit. Confirm its limits before submitting again.',
    unavailable: 'The endpoint was unavailable or the connection failed. Remote completion and charges may be unknown; check availability before resubmitting.',
    cancelled: 'The gateway request was interrupted or reached its deadline. This is not proof of provider-side cancellation; review any retained reservation.',
    timeout: 'The request timed out. Remote inference may still have run; review the retained reservation before retrying.',
    network: 'The inference connection failed. Check endpoint availability; completion and charges may be unknown.',
    invalid_response: 'The endpoint returned an unsupported response. Ask an administrator to verify model/API compatibility.',
    response_too_large: 'The response exceeded the size limit. Reduce the objective or adjust the model configuration.',
    invalid_plan: 'The model output did not pass plan validation. No draft was accepted; refine the objective before resubmitting.',
    stale_input_or_policy: 'The project, objective, permissions or settings changed. Review current inputs and explicitly submit a new request.',
    lease_expired: 'The worker lease expired. This attempt will not be replayed automatically; remote completion and cost may be unknown.',
    cancelled_before_dispatch: 'Cancellation was observed before inference dispatch. No model call was started by this attempt.',
    internal_error: 'The worker could not complete this attempt. Ask an administrator to investigate using the run ID.',
  };
  return messages[code] ?? 'This attempt was blocked. Ask an administrator to investigate using the run ID before submitting again.';
}

const FENCE_RE = /```nucleas-gate\s*([\s\S]*?)```/i;

export type ReviewerGateAccept = {
  status: 'accept';
  /** User-facing answer (fence stripped). */
  answer: string;
};

export type ReviewerGateNeedsMore = {
  status: 'needs_more';
  /** Concrete dig/verify jobs for the Worker (paths, symbols, checks). */
  jobs: string[];
  reason?: string;
};

export type ReviewerGate = ReviewerGateAccept | ReviewerGateNeedsMore;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

/**
 * Parse a nucleas-gate fence from Reviewer output.
 * Fail-closed: Only explicit status === "accept" with valid structure is accepted.
 * Missing, malformed, or unknown statuses fall through to needs_more.
 */
export function parseReviewerGate(raw: string): ReviewerGate {
  const text = raw.trim();
  if (!text) {
    return { status: 'needs_more', jobs: ['Continue digging; prior Reviewer output was empty.'], reason: 'empty' };
  }

  const match = text.match(FENCE_RE);
  if (!match?.[1]) {
    return {
      status: 'needs_more',
      jobs: [
        'Missing ```nucleas-gate decision block. Synthesize evidence and provide explicit {"status":"accept"} or {"status":"needs_more","jobs":[...]} gate.',
      ],
      reason: 'missing_gate_fence',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    return {
      status: 'needs_more',
      jobs: [
        'Invalid JSON in ```nucleas-gate fence. Provide valid JSON: {"status":"accept"} or {"status":"needs_more","jobs":[...]}',
      ],
      reason: 'malformed_gate_json',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      status: 'needs_more',
      jobs: ['Invalid format in ```nucleas-gate. Expected JSON object with status field.'],
      reason: 'invalid_gate_object',
    };
  }

  const record = parsed as Record<string, unknown>;
  const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : '';

  if (status === 'accept') {
    const withoutFence = text.replace(FENCE_RE, '').trim();
    if (!withoutFence) {
      return {
        status: 'needs_more',
        jobs: ['Accepted gate provided but user-facing answer is empty. Provide the complete verified answer.'],
        reason: 'empty_accepted_answer',
      };
    }
    return {
      status: 'accept',
      answer: withoutFence.slice(0, 24_000),
    };
  }

  if (status === 'needs_more') {
    const jobs = asStringArray(record.jobs);
    const reason = typeof record.reason === 'string' ? record.reason.trim().slice(0, 500) : undefined;
    if (jobs.length === 0) {
      return {
        status: 'needs_more',
        jobs: [
          reason ||
            'Re-read the key files for this ask with repo_read and return quoted evidence for every unanswered part.',
        ],
        reason,
      };
    }
    return { status: 'needs_more', jobs, reason };
  }

  // Unknown or reject status: treat strictly as needs_more
  return {
    status: 'needs_more',
    jobs: [
      `Reviewer returned non-accept gate status "${status || 'unknown'}". Complete the remaining verification tasks.`,
    ],
    reason: `status_${status || 'unknown'}`,
  };
}

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
 * Missing/invalid fence → treat entire text as an accepted final answer (compat).
 */
export function parseReviewerGate(raw: string): ReviewerGate {
  const text = raw.trim();
  if (!text) {
    return { status: 'needs_more', jobs: ['Continue digging; prior Reviewer output was empty.'], reason: 'empty' };
  }

  const match = text.match(FENCE_RE);
  if (!match?.[1]) {
    return { status: 'accept', answer: text.slice(0, 24_000) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    return { status: 'accept', answer: text.replace(FENCE_RE, '').trim().slice(0, 24_000) || text.slice(0, 24_000) };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { status: 'accept', answer: text.replace(FENCE_RE, '').trim().slice(0, 24_000) };
  }

  const record = parsed as Record<string, unknown>;
  const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : '';

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

  const withoutFence = text.replace(FENCE_RE, '').trim();
  return {
    status: 'accept',
    answer: (withoutFence || text.replace(FENCE_RE, '').trim() || text).slice(0, 24_000),
  };
}

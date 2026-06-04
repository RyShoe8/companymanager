export type CommentSummary = {
  count: number;
  latestActivityMs: number;
};

export type CommentTimestampDoc = {
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export function activityMsFromComment(doc: CommentTimestampDoc): number {
  const created = doc.createdAt ? new Date(doc.createdAt).getTime() : 0;
  const updated = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
  return Math.max(created, updated);
}

export function mergeCommentSummary(
  existing: CommentSummary | undefined,
  doc: CommentTimestampDoc
): CommentSummary {
  const activityMs = activityMsFromComment(doc);
  if (!existing) {
    return { count: 1, latestActivityMs: activityMs };
  }
  return {
    count: existing.count + 1,
    latestActivityMs: Math.max(existing.latestActivityMs, activityMs),
  };
}

export function emptyCommentSummary(): CommentSummary {
  return { count: 0, latestActivityMs: 0 };
}

export interface CommentTreeNode {
  createdAt?: Date | string;
  updatedAt?: Date | string;
  replies?: CommentTreeNode[];
}

export function getCommentTreeMeta(comments: CommentTreeNode[]): CommentSummary {
  let count = 0;
  let latestActivityMs = 0;

  const walk = (list: CommentTreeNode[]) => {
    for (const comment of list) {
      count += 1;
      latestActivityMs = Math.max(latestActivityMs, activityMsFromComment(comment));
      if (comment.replies?.length) walk(comment.replies);
    }
  };

  walk(comments);
  return { count, latestActivityMs };
}

export function taskCommentSummaryKey(taskId?: string | null, taskIndex?: number): string {
  if (taskId) return taskId;
  if (taskIndex !== undefined && taskIndex !== null) return `index:${taskIndex}`;
  return 'unknown';
}

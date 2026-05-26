import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';

function toMs(d: Date | string | undefined): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function getProjectLatestActivityMs(
  project: IProject,
  contentItemsForProject: IContentItem[] = [],
  latestCommentMs?: number
): number {
  let max = toMs((project as { updatedAt?: Date }).updatedAt ?? project.createdAt);

  for (const item of contentItemsForProject) {
    const itemMs = toMs(item.updatedAt ?? item.createdAt);
    if (itemMs > max) max = itemMs;
  }

  if (latestCommentMs !== undefined && latestCommentMs > max) {
    max = latestCommentMs;
  }

  return max;
}

export function buildContentItemsByProjectId(contentItems: IContentItem[]): Map<string, IContentItem[]> {
  const map = new Map<string, IContentItem[]>();
  for (const item of contentItems) {
    const pid = item.projectId?.toString();
    if (!pid) continue;
    const list = map.get(pid) ?? [];
    list.push(item);
    map.set(pid, list);
  }
  return map;
}

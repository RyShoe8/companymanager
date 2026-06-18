import { Types } from 'mongoose';

export function validateAssetLinkExclusivity(links: {
  linkedClientId?: unknown;
  linkedProjectId?: unknown;
  linkedProjectTaskId?: unknown;
  linkedProjectTaskIndex?: unknown;
  linkedContentItemId?: unknown;
}): string | null {
  const hasClient = !!links.linkedClientId && String(links.linkedClientId).trim() !== '';
  const hasProject = !!links.linkedProjectId && String(links.linkedProjectId).trim() !== '';
  const hasTask =
    (!!links.linkedProjectTaskId && String(links.linkedProjectTaskId).trim() !== '') ||
    (links.linkedProjectTaskIndex != null && links.linkedProjectTaskIndex !== '');
  const hasContent =
    !!links.linkedContentItemId && String(links.linkedContentItemId).trim() !== '';

  if (hasClient && (hasProject || hasTask || hasContent)) {
    return 'Client-linked assets cannot also link to projects, tasks, or content';
  }
  if (hasClient && !Types.ObjectId.isValid(String(links.linkedClientId))) {
    return 'Invalid client ID';
  }
  return null;
}

import type { Types } from 'mongoose';

/** Stable unique slug for an organization (one org admin per userId). */
export function organizationSlugFromUserId(userId: string | Types.ObjectId): string {
  const id = typeof userId === 'string' ? userId : userId.toString();
  return `org-${id}`.toLowerCase();
}

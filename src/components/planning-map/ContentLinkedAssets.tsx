'use client';

import { IProject } from '@/lib/models/Project';
import ContentItemAssetsSection from '@/components/planning-map/ContentItemAssetsSection';

interface ContentLinkedAssetsProps {
  project: IProject;
  contentItemId: string;
  isManagerOrAdmin: boolean;
  currentUserId?: string;
  currentUserEmployeeId?: string | null;
  assignedToEmployeeId?: string;
  refreshToken?: number;
}

/** Compact assets row under a content item in the project inspector. */
export default function ContentLinkedAssets({
  project,
  contentItemId,
  isManagerOrAdmin,
  currentUserId,
  currentUserEmployeeId,
  assignedToEmployeeId,
  refreshToken,
}: ContentLinkedAssetsProps) {
  return (
    <ContentItemAssetsSection
      project={project}
      contentItemId={contentItemId}
      isManagerOrAdmin={isManagerOrAdmin}
      currentUserId={currentUserId}
      currentUserEmployeeId={currentUserEmployeeId}
      assignedToEmployeeId={assignedToEmployeeId}
      mode="live"
      compact
      refreshToken={refreshToken}
    />
  );
}

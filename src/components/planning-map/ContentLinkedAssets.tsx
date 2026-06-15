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
  onAssetsChanged?: () => void;
  showAddHintText?: boolean;
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
  onAssetsChanged,
  showAddHintText = true,
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
      onAssetsChanged={onAssetsChanged}
      showAddHintText={showAddHintText}
    />
  );
}

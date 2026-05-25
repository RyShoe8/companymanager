'use client';

import { useState } from 'react';
import { IProject } from '@/lib/models/Project';
import AddButton from '@/components/checklist/AddButton';
import ScreenshotGallery from '@/components/shared/ScreenshotGallery';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

interface ContentLinkedAssetsProps {
  project: IProject;
  contentItemId: string;
  isManagerOrAdmin: boolean;
}

export default function ContentLinkedAssets({
  project,
  contentItemId,
  isManagerOrAdmin,
}: ContentLinkedAssetsProps) {
  const light = useInspectorLight();
  const [refreshToken, setRefreshToken] = useState(0);

  if (!isManagerOrAdmin) return null;

  const projectId = project._id.toString();
  const phase = mapStatusToStage(project.status);
  const projectType = project.projectType || 'generic';

  return (
    <div className={lightSurface('mt-2 pt-2 border-t border-gray-100', 'dark:border-gray-700', light)}>
      <div className="flex flex-wrap items-center gap-2">
        <ScreenshotGallery
          compact
          entityType="contentItem"
          entityId={contentItemId}
          isManagerOrAdmin={isManagerOrAdmin}
          refreshToken={refreshToken}
        />
        <AddButton
          projectId={projectId}
          phase={phase}
          projectType={projectType}
          isManagerOrAdmin={isManagerOrAdmin}
          label="Add"
          linkContext={{
            linkedProjectId: projectId,
            linkedContentItemId: contentItemId,
          }}
          onDocumentCreated={() => setRefreshToken((n) => n + 1)}
          onAddButton={async () => {}}
        />
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { IProject } from '@/lib/models/Project';
import AddButton from '@/components/checklist/AddButton';
import ScreenshotGallery from '@/components/shared/ScreenshotGallery';
import { mapStatusToStage } from '@/lib/utils/statusMapping';

interface TaskLinkedAssetsProps {
  project: IProject;
  taskId?: string;
  isManagerOrAdmin: boolean;
}

export default function TaskLinkedAssets({ project, taskId, isManagerOrAdmin }: TaskLinkedAssetsProps) {
  const [refreshToken, setRefreshToken] = useState(0);

  if (!isManagerOrAdmin) return null;

  const projectId = project._id.toString();
  const phase = mapStatusToStage(project.status);
  const projectType = project.projectType || 'generic';

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      {taskId ? (
        <div className="flex flex-wrap items-center gap-2">
          <ScreenshotGallery
            compact
            entityType="projectTask"
            entityId={projectId}
            taskId={taskId}
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
              linkedProjectTaskId: taskId,
            }}
            onDocumentCreated={() => setRefreshToken((n) => n + 1)}
            onAddButton={async () => {}}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-1">Save the task to attach assets.</p>
      )}
    </div>
  );
}

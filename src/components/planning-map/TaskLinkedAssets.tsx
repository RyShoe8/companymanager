'use client';

import { useCallback, useEffect, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import AddButton from '@/components/checklist/AddButton';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import { linkedAssetHref, normalizeLinkedAssetChip, type LinkedAssetChip } from '@/lib/utils/linkedAssets';

interface TaskLinkedAssetsProps {
  project: IProject;
  taskId?: string;
  isManagerOrAdmin: boolean;
}

export default function TaskLinkedAssets({ project, taskId, isManagerOrAdmin }: TaskLinkedAssetsProps) {
  const [linkedAssets, setLinkedAssets] = useState<LinkedAssetChip[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const projectId = project._id.toString();
  const phase = mapStatusToStage(project.status);
  const projectType = project.projectType || 'generic';

  const loadLinkedAssets = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/assets?linkedProjectTaskId=${taskId}`);
      if (!res.ok) {
        setLinkedAssets([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setLinkedAssets([]);
        return;
      }
      setLinkedAssets(data.map(normalizeLinkedAssetChip).filter((x): x is LinkedAssetChip => x != null));
    } catch {
      setLinkedAssets([]);
    }
  }, [taskId]);

  useEffect(() => {
    void loadLinkedAssets();
  }, [loadLinkedAssets]);

  if (!isManagerOrAdmin && linkedAssets.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      <LinkedAssetsHeader />
      {isManagerOrAdmin && taskId && (
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
          onDocumentCreated={() => void loadLinkedAssets()}
          onAddButton={async () => {}}
        />
      )}
      {!taskId && isManagerOrAdmin && (
        <p className="text-xs text-gray-500 mt-1">Save the task to attach assets.</p>
      )}
      {linkedAssets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {linkedAssets.map((asset) => {
            if (asset.type === 'screenshot' && asset.fileUrl) {
              return (
                <button
                  key={asset._id}
                  type="button"
                  onClick={() => setPreviewImage({ src: asset.fileUrl!, title: asset.name })}
                  className="text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:underline"
                >
                  {asset.name}
                </button>
              );
            }

            const href = linkedAssetHref(asset);
            return href ? (
              <a
                key={asset._id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:underline"
              >
                {asset.name}
              </a>
            ) : (
              <span
                key={asset._id}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              >
                {asset.name}
              </span>
            );
          })}
        </div>
      )}
      <ImagePreviewModal
        isOpen={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src ?? null}
        title={previewImage?.title}
      />
    </div>
  );
}

function LinkedAssetsHeader() {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
      Assets
    </p>
  );
}

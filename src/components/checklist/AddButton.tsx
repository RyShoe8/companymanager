'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import CategoryModal, {
  type AddSmartButtonPayload,
  type AssetLinkContext,
  type PendingAssetPayload,
} from './CategoryModal';

export type { AddSmartButtonPayload, AssetLinkContext, PendingAssetPayload };

interface AddButtonProps {
  projectId: string;
  phase: 'Plan' | 'Build' | 'Run';
  projectType: string;
  isManagerOrAdmin: boolean;
  onAddButton: (payload: AddSmartButtonPayload) => Promise<void>;
  onDocumentCreated?: () => void;
  linkContext?: AssetLinkContext;
  mode?: 'live' | 'draft';
  onPendingAsset?: (asset: PendingAssetPayload) => void;
  label?: string;
}

export default function AddButton({
  projectId,
  phase,
  projectType,
  isManagerOrAdmin,
  onAddButton,
  onDocumentCreated,
  linkContext,
  mode = 'live',
  onPendingAsset,
  label = 'Add',
}: AddButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
        {label}
      </Button>
      {showModal && (
        <CategoryModal
          projectId={projectId}
          phase={phase}
          projectType={projectType}
          isManagerOrAdmin={isManagerOrAdmin}
          onClose={() => setShowModal(false)}
          onAddButton={onAddButton}
          onDocumentCreated={onDocumentCreated}
          linkContext={linkContext}
          mode={mode}
          onPendingAsset={onPendingAsset}
        />
      )}
    </>
  );
}

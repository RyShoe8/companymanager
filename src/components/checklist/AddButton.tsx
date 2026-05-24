'use client';

import { useState, useEffect, useRef } from 'react';
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
  socialsToolbarHidden?: boolean;
  onAddSocial?: (url: string) => Promise<void>;
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
  socialsToolbarHidden = false,
  onAddSocial,
}: AddButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => setShowModal(false);
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const onPointerDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (panel && !panel.contains(e.target as Node)) {
        setShowModal(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [showModal]);

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
          socialsToolbarHidden={socialsToolbarHidden}
          onAddSocial={onAddSocial}
          panelRef={panelRef}
        />
      )}
    </>
  );
}

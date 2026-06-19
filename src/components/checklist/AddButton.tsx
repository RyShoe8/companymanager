'use client';

import { useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import type { ControlSurface } from '@/lib/ui/surfaceStyles';
import { WORKSPACE_TOOLBAR_BUTTON_CLASS } from '@/lib/ui/surfaceStyles';
import CategoryModal, {
  type AddSmartButtonPayload,
  type AssetLinkContext,
  type PendingAssetPayload,
} from './CategoryModal';

export type { AddSmartButtonPayload, AssetLinkContext, PendingAssetPayload };

interface AddButtonProps {
  projectId?: string;
  clientId?: string;
  onAddButton: (payload: AddSmartButtonPayload) => Promise<void>;
  onDocumentCreated?: (asset?: unknown) => void;
  linkContext?: AssetLinkContext;
  mode?: 'live' | 'draft';
  onPendingAsset?: (asset: PendingAssetPayload) => void;
  label?: string;
  socialsToolbarHidden?: boolean;
  onAddSocial?: (url: string) => Promise<void>;
  stackAboveLightbox?: boolean;
  surface?: ControlSurface;
  triggerVariant?: 'primary' | 'secondary';
}

export default function AddButton({
  projectId,
  clientId,
  onAddButton,
  onDocumentCreated,
  linkContext,
  mode = 'live',
  onPendingAsset,
  label = 'Add',
  socialsToolbarHidden = false,
  onAddSocial,
  stackAboveLightbox = false,
  surface = 'inspector',
  triggerVariant = 'secondary',
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
      {surface === 'workspace' ? (
        <button type="button" className={WORKSPACE_TOOLBAR_BUTTON_CLASS} onClick={() => setShowModal(true)}>
          {label}
        </button>
      ) : (
        <Button variant={triggerVariant} size="sm" onClick={() => setShowModal(true)}>
          {label}
        </Button>
      )}
      {showModal && (
        <CategoryModal
          projectId={projectId}
          clientId={clientId}
          onClose={() => setShowModal(false)}
          onAddButton={onAddButton}
          onDocumentCreated={onDocumentCreated}
          linkContext={linkContext}
          mode={mode}
          onPendingAsset={onPendingAsset}
          socialsToolbarHidden={socialsToolbarHidden}
          onAddSocial={onAddSocial}
          panelRef={panelRef}
          stackAboveLightbox={stackAboveLightbox}
        />
      )}
    </>
  );
}

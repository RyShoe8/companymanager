'use client';

import { useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import type { ControlSurface } from '@/lib/ui/surfaceStyles';
import { WORKSPACE_TOOLBAR_BUTTON_CLASS } from '@/lib/ui/surfaceStyles';
import CategoryModal from './CategoryModal';
import type {
  AddSmartButtonPayload,
  AssetLinkContext,
  PendingAssetPayload,
} from './categoryModalTypes';
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
  disabled?: boolean;
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
  disabled = false,
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
      const target = e.target as Node;
      if (panel && panel.contains(target)) return;
      // Nested dialogs (screenshot/recording naming, save, region-select, preview) render
      // through their own document.body portal, so they're siblings of `panel`, not
      // descendants. Ignore clicks inside those too, or interacting with them would
      // incorrectly look like an "outside click" and close this modal from under them.
      if (target instanceof Element && target.closest('[data-portal-overlay]')) return;
      setShowModal(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [showModal]);

  return (
    <>
      {surface === 'workspace' ? (
        <button
          type="button"
          className={WORKSPACE_TOOLBAR_BUTTON_CLASS}
          onClick={() => setShowModal(true)}
          disabled={disabled}
        >
          {label}
        </button>
      ) : (
        <Button variant={triggerVariant} size="sm" onClick={() => setShowModal(true)} disabled={disabled}>
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

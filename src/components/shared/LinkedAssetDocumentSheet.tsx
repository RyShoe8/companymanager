'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';

const inspectorInputClass =
  'block w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

export type LinkedAssetDocument = {
  _id: string;
  name: string;
  textContent?: string;
};

interface LinkedAssetDocumentSheetProps {
  asset: LinkedAssetDocument | null;
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onSaved: (updated: { name: string; textContent: string }) => void;
  stackAboveLightbox?: boolean;
}

export default function LinkedAssetDocumentSheet({
  asset,
  isOpen,
  onClose,
  projectId,
  onSaved,
  stackAboveLightbox = false,
}: LinkedAssetDocumentSheetProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!asset) {
      setMode('view');
      setEditName('');
      setEditContent('');
      return;
    }
    setMode('view');
    setEditName(asset.name);
    setEditContent(asset.textContent ?? '');
  }, [asset?._id]);

  const handleClose = () => {
    setMode('view');
    onClose();
  };

  const handleSave = async () => {
    if (!asset || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          textContent: editContent,
        }),
      });
      if (!res.ok) {
        let msg = 'Could not save asset.';
        try {
          const data = await res.json();
          if (data && typeof data.error === 'string') msg = data.error;
        } catch {
          // ignore
        }
        alert(msg);
        return;
      }
      const data = await res.json();
      const name = typeof data.name === 'string' ? data.name : editName.trim();
      const textContent = typeof data.textContent === 'string' ? data.textContent : editContent;
      onSaved({ name, textContent });
      setMode('view');
    } catch {
      alert('Could not save asset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'edit' ? 'Edit asset' : (asset?.name ?? 'Document')}
      maxWidth="lg"
      elevated={!stackAboveLightbox}
      stackAboveLightbox={stackAboveLightbox}
      stackAboveOverlays={!stackAboveLightbox}
    >
      <div className="space-y-4">
        {mode === 'view' ? (
          <>
            <pre className="text-sm whitespace-pre-wrap text-gray-800 font-sans bg-gray-50 rounded-lg p-3 max-h-[50vh] overflow-y-auto border border-gray-200">
              {asset?.textContent?.trim() ? asset.textContent : 'No content yet.'}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!asset) return;
                  setEditName(asset.name);
                  setEditContent(asset.textContent ?? '');
                  setMode('edit');
                }}
              >
                Edit
              </Button>
              {projectId ? (
                <Link
                  href={`/assets?projectId=${projectId}`}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  More options on Assets
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inspectorInputClass}
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Content</label>
              <AutoGrowTextarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                minRows={4}
                disabled={saving}
                className={`${inspectorInputClass} whitespace-pre-wrap max-h-[50vh]`}
                placeholder="Document body…"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={saving || !editName.trim()} onClick={() => void handleSave()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => {
                  if (!asset) return;
                  setEditName(asset.name);
                  setEditContent(asset.textContent ?? '');
                  setMode('view');
                }}
              >
                Cancel
              </Button>
            </div>
            {projectId ? (
              <Link
                href={`/assets?projectId=${projectId}`}
                className="inline-block text-xs text-gray-500 hover:text-gray-700 underline"
              >
                More options on Assets
              </Link>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

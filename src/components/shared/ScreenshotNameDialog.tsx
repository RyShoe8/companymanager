'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface ScreenshotNameDialogProps {
  isOpen: boolean;
  defaultName: string;
  submitLabel?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export default function ScreenshotNameDialog({
  isOpen,
  defaultName,
  submitLabel = 'Upload',
  onConfirm,
  onCancel,
}: ScreenshotNameDialogProps) {
  const [name, setName] = useState(defaultName);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
    }
  }, [isOpen, defaultName]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <Modal isOpen={isOpen} onClose={onCancel} title="Name screenshot" maxWidth="sm" stackAboveLightbox>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Screenshot"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>,
    document.body
  );
}

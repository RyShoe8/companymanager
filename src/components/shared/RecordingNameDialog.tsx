'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface RecordingNameDialogProps {
  isOpen: boolean;
  defaultName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  saving?: boolean;
  processing?: boolean;
}

export default function RecordingNameDialog({
  isOpen,
  defaultName,
  onConfirm,
  onCancel,
  saving = false,
  processing = false,
}: RecordingNameDialogProps) {
  const [name, setName] = useState(defaultName);
  const [mounted, setMounted] = useState(false);
  const busy = saving || processing;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) setName(defaultName);
  }, [isOpen, defaultName]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onCancel} title="Name recording" maxWidth="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed) onConfirm(trimmed);
        }}
        className="space-y-4"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={busy}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || busy}>
            {processing ? 'Processing…' : saving ? 'Uploading…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>,
    document.body
  );
}

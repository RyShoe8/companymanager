'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { IProject } from '@/lib/models/Project';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';

interface RecordingSaveDialogProps {
  isOpen: boolean;
  defaultName: string;
  previewUrl: string | null;
  projects: IProject[];
  micWarning?: string | null;
  transcodeDebug?: string | null;
  onSave: (name: string, target: MediaUploadTarget | null) => void;
  onDownload: (name: string) => void;
  onCancel: () => void;
  saving?: boolean;
  processing?: boolean;
  statusMessage?: string | null;
}

export default function RecordingSaveDialog({
  isOpen,
  defaultName,
  previewUrl,
  projects,
  micWarning,
  transcodeDebug,
  onSave,
  onDownload,
  onCancel,
  saving = false,
  processing = false,
  statusMessage,
}: RecordingSaveDialogProps) {
  const [name, setName] = useState(defaultName);
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [mounted, setMounted] = useState(false);
  const busy = saving || processing;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setProjectId('');
      setTaskId('');
    }
  }, [isOpen, defaultName]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel, busy]);

  const selectedProject = useMemo(
    () => projects.find((p) => p._id.toString() === projectId),
    [projects, projectId]
  );

  const taskOptions = useMemo(() => {
    const tasks = selectedProject?.tasks ?? [];
    return [
      { value: '', label: 'No task' },
      ...tasks.map((task, index) => ({
        value: task._id?.toString() ?? String(index),
        label: task.name || `Task ${index + 1}`,
      })),
    ];
  }, [selectedProject]);

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'No project' },
      ...projects.map((p) => ({ value: p._id.toString(), label: p.name })),
    ],
    [projects]
  );

  const buildTarget = (): MediaUploadTarget | null => {
    if (!projectId) return null;
    if (taskId) {
      return { entityType: 'projectTask', entityId: projectId, taskId };
    }
    return { entityType: 'project', entityId: projectId };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed, buildTarget());
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onCancel}
      title="Save recording"
      maxWidth="sm"
      stackAboveLightbox
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {previewUrl && (
          <div className="rounded-lg border border-border overflow-hidden bg-background-elevated">
            <video src={previewUrl} controls className="w-full max-h-48 bg-black" />
          </div>
        )}
        {micWarning && (
          <p className="text-xs text-warning">{micWarning}</p>
        )}
        {transcodeDebug && process.env.NODE_ENV === 'development' && (
          <button
            type="button"
            className="text-xs text-text-muted underline hover:text-text-secondary"
            onClick={() => {
              void navigator.clipboard.writeText(transcodeDebug);
            }}
          >
            Copy transcode debug info
          </button>
        )}
        {statusMessage && busy && (
          <p className="text-xs text-text-muted">{statusMessage}</p>
        )}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Recording"
          autoFocus
          disabled={busy}
        />
        <Select
          label="Project (optional)"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId('');
          }}
          options={projectOptions}
          disabled={busy}
        />
        {projectId && (
          <Select
            label="Task (optional)"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            options={taskOptions}
            disabled={busy}
          />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!name.trim() || !previewUrl || busy}
            onClick={() => {
              const trimmed = name.trim();
              if (trimmed) onDownload(trimmed);
            }}
          >
            Download
          </Button>
          <Button type="submit" disabled={!name.trim() || busy}>
            {processing ? 'Processing…' : saving ? 'Uploading…' : 'Save to Nucleas'}
          </Button>
        </div>
      </form>
    </Modal>,
    document.body
  );
}

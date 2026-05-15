'use client';

import { useEffect, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: IProject[];
  onSuccess?: () => void;
}

export default function CreateMeetingModal({
  isOpen,
  onClose,
  projects,
  onSuccess,
}: CreateMeetingModalProps) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setStart('');
    setEnd('');
    setLinkedProjectIds([]);
    setError(null);
  }, [isOpen]);

  const toggleProject = (id: string) => {
    setLinkedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleClose = () => {
    if (creating) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !start || !end) {
      setError('Title, start, and end are required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduling/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          linkedProjectIds,
          syncToGoogle: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to create meeting.');
        return;
      }
      onSuccess?.();
      onClose();
    } catch {
      setError('Failed to create meeting.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New meeting" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-lg border border-error/30 bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
        <Input
          label="Meeting title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
          required
        />
        <div className="flex flex-wrap gap-4">
          <label className="text-sm text-text-primary">
            Start
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
              className="block mt-1 w-full rounded-lg border border-border bg-background-card text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-sm text-text-primary">
            End
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
              className="block mt-1 w-full rounded-lg border border-border bg-background-card text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Link projects (optional)</p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-lg border border-border p-3 bg-background-card">
            {projects.length === 0 ? (
              <p className="text-sm text-text-secondary">No projects available.</p>
            ) : (
              projects.map((p) => (
                <label
                  key={p._id.toString()}
                  className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={linkedProjectIds.includes(p._id.toString())}
                    onChange={() => toggleProject(p._id.toString())}
                  />
                  {p.name}
                </label>
              ))
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating || !title.trim() || !start || !end}>
            {creating ? 'Creating…' : 'Create meeting'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

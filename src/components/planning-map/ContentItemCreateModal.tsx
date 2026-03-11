'use client';

import { useState } from 'react';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { ContentChannel, ContentStatus } from '@/lib/models/ContentItem';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CHANNELS: ContentChannel[] = ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Email', 'Article', 'Video', 'Reddit', 'Bluesky', 'Other'];
const STATUSES: ContentStatus[] = ['idea', 'planned', 'in_progress', 'ready', 'published'];

interface ContentItemCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: IProject | null;
  defaultPublishDate?: Date;
  employees: IEmployee[];
  onSuccess: () => void;
}

export default function ContentItemCreateModal({
  isOpen,
  onClose,
  project,
  defaultPublishDate,
  employees,
  onSuccess,
}: ContentItemCreateModalProps) {
  const defaultDate = defaultPublishDate || new Date();
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<ContentChannel>('Other');
  const [publishDate, setPublishDate] = useState(toInputDate(defaultDate));
  const [status, setStatus] = useState<ContentStatus>('planned');
  const [notes, setNotes] = useState('');
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState<string>('');
  const [keywords, setKeywords] = useState('');
  const [internalLinks, setInternalLinks] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        projectId: project._id.toString(),
        title: title.trim(),
        channel,
        status,
        notes: notes.trim() || undefined,
        assignedToEmployeeId: assignedToEmployeeId || undefined,
        keywords: keywords.trim() ? keywords.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        internalLinks: internalLinks.trim() ? internalLinks.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        externalUrl: externalUrl.trim() || undefined,
        estimatedHours: estimatedHours.trim() ? Number(estimatedHours) : undefined,
      };
      if (publishDate) {
        const d = new Date(publishDate);
        if (!isNaN(d.getTime())) body.publishDate = d.toISOString();
      }
      const res = await fetch('/api/content-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create content');
      }
      onSuccess();
      onClose();
      setTitle('');
      setChannel('Other');
      setPublishDate(toInputDate(new Date()));
      setStatus('planned');
      setNotes('');
      setAssignedToEmployeeId('');
      setKeywords('');
      setInternalLinks('');
      setExternalUrl('');
      setEstimatedHours('');
      setShowAdvanced(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create content');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!project) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Content" maxWidth="md" elevated>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">Project: {project.name}</p>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Content title"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Channel *</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ContentChannel)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Publish date</label>
          <input
            type="date"
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContentStatus)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            rows={2}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Assignee</label>
          <select
            value={assignedToEmployeeId}
            onChange={(e) => setAssignedToEmployeeId(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
          >
            <option value="">Unassigned</option>
            {employees.map((emp) => (
              <option key={emp._id.toString()} value={emp._id.toString()}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Estimated hours</label>
          <input
            type="number"
            step="0.5"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
          />
        </div>

        <div className="pt-2 border-t border-gray-700">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full focus:outline-none"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced settings
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 animate-in slide-in-from-top-2">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Target keywords (comma-separated)</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. keyword1, keyword2"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Internal links (comma-separated URLs or slugs)</label>
              <input
                type="text"
                value={internalLinks}
                onChange={(e) => setInternalLinks(e.target.value)}
                placeholder="e.g. /page1, https://..."
                className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">External link (OneUp, Google Doc, etc.)</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
              />
            </div>
          </div>
        )}
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Creating...' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}

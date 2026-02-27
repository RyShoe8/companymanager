'use client';

import { useState, useEffect } from 'react';
import { IContentItem, ContentChannel, ContentStatus } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const CHANNELS: ContentChannel[] = ['SEO', 'X', 'LinkedIn', 'Instagram', 'TikTok', 'Email', 'Other'];
const STATUSES: ContentStatus[] = ['idea', 'planned', 'in_progress', 'ready', 'published'];

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ContentItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentItemId: string | null;
  employees: IEmployee[];
  onSaved: () => void;
  onDeleted?: () => void;
}

export default function ContentItemDetailModal({
  isOpen,
  onClose,
  contentItemId,
  employees,
  onSaved,
  onDeleted,
}: ContentItemDetailModalProps) {
  const [item, setItem] = useState<IContentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<ContentChannel>('Other');
  const [status, setStatus] = useState<ContentStatus>('planned');
  const [publishDate, setPublishDate] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState('');
  const [keywords, setKeywords] = useState('');
  const [internalLinks, setInternalLinks] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  useEffect(() => {
    if (!isOpen || !contentItemId) {
      setItem(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/content-items/${contentItemId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        setItem(data);
        setTitle(data.title ?? '');
        setChannel(CHANNELS.includes(data.channel) ? data.channel : 'Other');
        setStatus(STATUSES.includes(data.status) ? data.status : 'planned');
        setPublishDate(data.publishDate ? toInputDate(new Date(data.publishDate)) : '');
        setNotes(data.notes ?? '');
        setAssignedToEmployeeId(data.assignedToEmployeeId?.toString() ?? '');
        setKeywords(Array.isArray(data.keywords) ? data.keywords.join(', ') : (data.keywords ?? ''));
        setInternalLinks(Array.isArray(data.internalLinks) ? data.internalLinks.join(', ') : (data.internalLinks ?? ''));
        setExternalUrl(data.externalUrl ?? '');
      })
      .catch(() => setError('Failed to load content item'))
      .finally(() => setLoading(false));
  }, [isOpen, contentItemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentItemId) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        channel,
        status,
        notes: notes.trim() || undefined,
        assignedToEmployeeId: assignedToEmployeeId || undefined,
        keywords: keywords.trim() ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
        internalLinks: internalLinks.trim() ? internalLinks.split(',').map((l) => l.trim()).filter(Boolean) : undefined,
        externalUrl: externalUrl.trim() || undefined,
      };
      if (publishDate) {
        const d = new Date(publishDate);
        if (!isNaN(d.getTime())) body.publishDate = d.toISOString();
      } else {
        body.publishDate = null;
      }
      const res = await fetch(`/api/content-items/${contentItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const updated = await res.json();
      setItem(updated);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contentItemId || !confirm('Delete this content item? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-items/${contentItemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onDeleted?.();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Content Item" maxWidth="md">
      {loading ? (
        <div className="text-text-secondary py-4">Loading...</div>
      ) : !item ? (
        <div className="text-text-secondary py-4">{error || 'Content not found'}</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
              required
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
            <label className="block text-sm font-medium text-text-primary mb-1">Status *</label>
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
            <label className="block text-sm font-medium text-text-primary mb-1">Publish date</label>
            <input
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            <label className="block text-sm font-medium text-text-primary mb-1">Keywords (comma-separated)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="keyword1, keyword2"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Internal links (comma-separated)</label>
            <input
              type="text"
              value={internalLinks}
              onChange={(e) => setInternalLinks(e.target.value)}
              placeholder="/page1, /page2"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">External URL</label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
            />
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <div className="flex gap-2 pt-2 flex-wrap">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 min-w-0">Close</Button>
            <Button type="submit" disabled={saving} className="flex-1 min-w-0">{saving ? 'Saving...' : 'Save'}</Button>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1 min-w-0">{deleting ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

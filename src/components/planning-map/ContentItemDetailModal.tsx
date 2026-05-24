'use client';

import { useState, useEffect } from 'react';
import { IContentItem, ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import { IProject } from '@/lib/models/Project';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import ContentTargetingSection, { parseKeywordsInput } from '@/components/planning-map/ContentTargetingSection';
import { filterEmployeesForTaskAssignment } from '@/lib/utils/projectTeam';
import { DISTRIBUTION_METHODS } from '@/lib/constants/contentDistribution';

const CHANNELS: ContentChannel[] = ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Email', 'Article', 'Video', 'Reddit', 'Bluesky', 'Other'];
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
  project?: IProject | null;
  isManagerOrAdmin?: boolean;
  onSaved: () => void;
  onDeleted?: () => void;
  isInline?: boolean;
}

export default function ContentItemDetailModal({
  isOpen,
  onClose,
  contentItemId,
  employees,
  project: projectProp,
  isManagerOrAdmin = true,
  onSaved,
  onDeleted,
  isInline = false,
}: ContentItemDetailModalProps) {
  const [item, setItem] = useState<IContentItem | null>(null);
  const [project, setProject] = useState<IProject | null>(projectProp ?? null);
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
  const [internalLinks, setInternalLinks] = useState<string[]>([]);
  const [externalUrl, setExternalUrl] = useState('');
  const [distributionMethods, setDistributionMethods] = useState<DistributionMethod[]>([]);
  const [estimatedHours, setEstimatedHours] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (projectProp) setProject(projectProp);
  }, [projectProp]);

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
      .then(async (data) => {
        setItem(data);
        setTitle(data.title ?? '');
        setChannel(CHANNELS.includes(data.channel) ? data.channel : 'Other');
        setStatus(STATUSES.includes(data.status) ? data.status : 'planned');
        setPublishDate(data.publishDate ? toInputDate(new Date(data.publishDate)) : '');
        setNotes(data.notes ?? '');
        setAssignedToEmployeeId(data.assignedToEmployeeId?.toString() ?? '');
        setKeywords(Array.isArray(data.keywords) ? data.keywords.join(', ') : (data.keywords ?? ''));
        setInternalLinks(Array.isArray(data.internalLinks) ? data.internalLinks : []);
        setExternalUrl(data.externalUrl ?? '');
        setDistributionMethods(Array.isArray(data.distributionMethods) ? data.distributionMethods : []);
        setEstimatedHours(data.estimatedHours?.toString() ?? '');

        if (!projectProp && data.projectId) {
          const pid = typeof data.projectId === 'string' ? data.projectId : data.projectId.toString();
          const pres = await fetch(`/api/projects/${pid}`);
          if (pres.ok) {
            const pdata = await pres.json();
            setProject(pdata);
          }
        }
      })
      .catch(() => setError('Failed to load content item'))
      .finally(() => setLoading(false));
  }, [isOpen, contentItemId, projectProp]);

  const assigneeOptions = project
    ? filterEmployeesForTaskAssignment(employees, project, { includeEmployeeIds: assignedToEmployeeId ? [assignedToEmployeeId] : [] })
    : employees;

  const toggleDistribution = (method: DistributionMethod) => {
    setDistributionMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentItemId) return;
    setSaving(true);
    setError(null);
    try {
      const filteredLinks = internalLinks.map((s) => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        title: title.trim(),
        channel,
        status,
        notes: notes.trim() || undefined,
        assignedToEmployeeId: assignedToEmployeeId || undefined,
        keywords: keywords.trim() ? parseKeywordsInput(keywords) : undefined,
        internalLinks: filteredLinks,
        externalUrl: externalUrl.trim() || undefined,
        distributionMethods,
        estimatedHours: estimatedHours.trim() ? Number(estimatedHours) : undefined,
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

  const formContent = loading ? (
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
        <label className="block text-sm font-medium text-text-primary mb-2">Distribution methods</label>
        <div className="flex flex-wrap gap-2">
          {DISTRIBUTION_METHODS.map((method) => {
            const checked = distributionMethods.includes(method);
            return (
              <label
                key={method}
                className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                  checked
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600 text-indigo-900 dark:text-indigo-100'
                    : 'border-border text-text-secondary hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleDistribution(method)} className="sr-only" />
                {method}
              </label>
            );
          })}
        </div>
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
        <AutoGrowTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <motionlessAssignee assigneeOptions={assigneeOptions} value={assignedToEmployeeId} onChange={setAssignedToEmployeeId} />
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

      {project && (
        <ContentTargetingSection
          project={project}
          isManagerOrAdmin={isManagerOrAdmin}
          expanded={showAdvanced}
          onToggle={() => setShowAdvanced(!showAdvanced)}
          keywords={keywords}
          onKeywordsChange={setKeywords}
          internalLinks={internalLinks}
          onInternalLinksChange={setInternalLinks}
          externalUrl={externalUrl}
          onExternalUrlChange={setExternalUrl}
          contentItemId={contentItemId ?? undefined}
          mode="live"
        />
      )}

      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="flex gap-2 pt-2 flex-wrap">
        {!isInline && (
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 min-w-0">Close</Button>
        )}
        <Button type="submit" disabled={saving} className="flex-1 min-w-0">{saving ? 'Saving...' : 'Save'}</Button>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1 min-w-0">{deleting ? 'Deleting...' : 'Delete'}</Button>
      </div>
    </form>
  );

  if (isInline) {
    if (!isOpen) return null;
    return <div className="h-full overflow-y-auto p-4">{formContent}</div>;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Content Item" maxWidth="md" elevated>
      {formContent}
    </Modal>
  );
}

function motionlessAssignee({
  assigneeOptions,
  value,
  onChange,
}: {
  assigneeOptions: IEmployee[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1">Assignee</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary"
      >
        <option value="">Unassigned</option>
        {assigneeOptions.map((emp) => (
          <option key={emp._id.toString()} value={emp._id.toString()}>{emp.name}</option>
        ))}
      </select>
    </div>
  );
}

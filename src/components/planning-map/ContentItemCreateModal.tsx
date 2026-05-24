'use client';

import { useState, useEffect } from 'react';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem, ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import ContentTargetingSection, { parseKeywordsInput } from '@/components/planning-map/ContentTargetingSection';
import type { PendingAssetPayload } from '@/components/checklist/CategoryModal';
import { filterEmployeesForTaskAssignment } from '@/lib/utils/projectTeam';
import { DISTRIBUTION_METHODS } from '@/lib/constants/contentDistribution';
import { createPendingAssets } from '@/lib/utils/linkedAssets';

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CHANNELS: ContentChannel[] = ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Email', 'Article', 'Video', 'Reddit', 'Bluesky', 'Other'];
const STATUSES: ContentStatus[] = ['idea', 'planned', 'in_progress', 'ready', 'published'];

function matchContentChannel(raw: string | undefined): ContentChannel | null {
  if (!raw?.trim()) return null;
  const n = raw.trim().toLowerCase();
  const hit = CHANNELS.find((c) => c.toLowerCase() === n);
  return hit ?? null;
}

interface ContentItemCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: IProject | null;
  defaultPublishDate?: Date;
  initialTitle?: string;
  initialChannel?: string;
  initialNotes?: string;
  employees: IEmployee[];
  isManagerOrAdmin?: boolean;
  onSuccess: () => void;
}

export default function ContentItemCreateModal({
  isOpen,
  onClose,
  project,
  defaultPublishDate,
  initialTitle,
  initialChannel,
  initialNotes,
  employees,
  isManagerOrAdmin = true,
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
  const [internalLinks, setInternalLinks] = useState<string[]>([]);
  const [externalUrl, setExternalUrl] = useState('');
  const [distributionMethods, setDistributionMethods] = useState<DistributionMethod[]>([]);
  const [estimatedHours, setEstimatedHours] = useState('');
  const [pendingAssets, setPendingAssets] = useState<PendingAssetPayload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const assigneeOptions = project ? filterEmployeesForTaskAssignment(employees, project) : employees;

  useEffect(() => {
    if (!isOpen || !project) return;
    setTitle(initialTitle?.trim() ?? '');
    const ch = matchContentChannel(initialChannel);
    setChannel(ch ?? 'Other');
    setNotes(initialNotes?.trim() ?? '');
    const base = defaultPublishDate || new Date();
    setPublishDate(toInputDate(base));
    setError(null);
  }, [isOpen, project?._id, initialTitle, initialChannel, initialNotes, defaultPublishDate]);

  const toggleDistribution = (method: DistributionMethod) => {
    setDistributionMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const resetForm = () => {
    setTitle('');
    setChannel('Other');
    setPublishDate(toInputDate(new Date()));
    setStatus('planned');
    setNotes('');
    setAssignedToEmployeeId('');
    setKeywords('');
    setInternalLinks([]);
    setExternalUrl('');
    setDistributionMethods([]);
    setEstimatedHours('');
    setPendingAssets([]);
    setShowAdvanced(false);
  };

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
      const filteredLinks = internalLinks.map((s) => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        projectId: project._id.toString(),
        title: title.trim(),
        channel,
        status,
        notes: notes.trim() || undefined,
        assignedToEmployeeId: assignedToEmployeeId || undefined,
        keywords: keywords.trim() ? parseKeywordsInput(keywords) : undefined,
        internalLinks: filteredLinks.length > 0 ? filteredLinks : undefined,
        externalUrl: externalUrl.trim() || undefined,
        distributionMethods: distributionMethods.length > 0 ? distributionMethods : undefined,
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
      const created = (await res.json()) as IContentItem;
      const contentId = created._id?.toString?.() ?? (created._id as unknown as string);
      if (contentId && pendingAssets.length > 0) {
        await createPendingAssets(contentId, pendingAssets);
      }
      onSuccess();
      onClose();
      resetForm();
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
        <DistributionSection distributionMethods={distributionMethods} onToggle={toggleDistribution} />
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
          <AutoGrowTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
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
            {assigneeOptions.map((emp) => (
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
          mode="draft"
          pendingAssets={pendingAssets}
          onPendingAsset={(asset) => setPendingAssets((prev) => [...prev, asset])}
          onRemovePendingAsset={(index) => setPendingAssets((prev) => prev.filter((_, i) => i !== index))}
        />

        {error && <ErrorMessage message={error} />}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Creating...' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DistributionSection({
  distributionMethods,
  onToggle,
}: {
  distributionMethods: DistributionMethod[];
  onToggle: (method: DistributionMethod) => void;
}) {
  return (
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
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(method)}
                className="sr-only"
              />
              {method}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="text-red-500 text-sm">{message}</div>;
}

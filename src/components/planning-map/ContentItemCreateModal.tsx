'use client';

import { useState, useEffect } from 'react';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem, ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ContentTargetingSection, { parseKeywordsInput } from '@/components/planning-map/ContentTargetingSection';
import ContentItemFormFields, { ContentFormErrorMessage } from '@/components/planning-map/ContentItemFormFields';
import ContentItemAssetsSection from '@/components/planning-map/ContentItemAssetsSection';
import type { PendingAssetPayload } from '@/components/checklist/CategoryModal';
import { filterEmployeesForTaskAssignment } from '@/lib/utils/projectTeam';
import { createPendingAssets } from '@/lib/utils/linkedAssets';
import { fetchEstimatedHours } from '@/lib/ai/clientEstimateHours';
import RecurrenceFields from '@/components/shared/RecurrenceFields';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { formInputClass } from '@/components/ui/formClasses';
import { toContentInputDate } from '@/components/planning-map/contentItemFormConstants';

function matchContentChannel(raw: string | undefined): ContentChannel | null {
  if (!raw?.trim()) return null;
  const n = raw.trim().toLowerCase();
  const channels: ContentChannel[] = [
    'X',
    'LinkedIn',
    'Instagram',
    'TikTok',
    'Email',
    'Article',
    'Video',
    'Reddit',
    'Bluesky',
    'Other',
  ];
  const hit = channels.find((c) => c.toLowerCase() === n);
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
  const [publishDate, setPublishDate] = useState(toContentInputDate(defaultDate));
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
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [repeatPreset, setRepeatPreset] = useState<RecurrencePreset>('none');

  const assigneeOptions = project ? filterEmployeesForTaskAssignment(employees, project) : employees;

  useEffect(() => {
    if (!isOpen || !project) return;
    setTitle(initialTitle?.trim() ?? '');
    const ch = matchContentChannel(initialChannel);
    setChannel(ch ?? 'Other');
    setNotes(initialNotes?.trim() ?? '');
    const base = defaultPublishDate || new Date();
    setPublishDate(toContentInputDate(base));
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
    setPublishDate(toContentInputDate(new Date()));
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
    setRepeatPreset('none');
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
      let hours: number | undefined = estimatedHours.trim() ? Number(estimatedHours) : undefined;
      if (hours === undefined) {
        setIsEstimating(true);
        const aiHours = await fetchEstimatedHours({
          kind: 'content',
          title: title.trim(),
          channel,
          description: notes.trim() || undefined,
          projectName: project.name,
        });
        setIsEstimating(false);
        if (aiHours != null) hours = aiHours;
      }

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
        estimatedHours: hours,
      };
      if (publishDate) {
        const d = new Date(publishDate);
        if (!isNaN(d.getTime())) body.publishDate = d.toISOString();
      }
      if (repeatPreset !== 'none') {
        body.recurrence = { preset: repeatPreset };
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
      const payload = await res.json();
      const created = (Array.isArray((payload as { items?: IContentItem[] }).items)
        ? (payload as { items: IContentItem[] }).items[0]
        : payload) as IContentItem;
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
      setIsEstimating(false);
      setIsSubmitting(false);
    }
  };

  if (!project) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Content" maxWidth="4xl" elevated>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">Project: {project.name}</p>
        <ContentItemFormFields
          title={title}
          onTitleChange={setTitle}
          titleAutoFocus
          distributionMethods={distributionMethods}
          onToggleDistribution={toggleDistribution}
          channel={channel}
          onChannelChange={setChannel}
          status={status}
          onStatusChange={setStatus}
          publishDate={publishDate}
          onPublishDateChange={setPublishDate}
          notes={notes}
          onNotesChange={setNotes}
          assignedToEmployeeId={assignedToEmployeeId}
          onAssignedToEmployeeIdChange={setAssignedToEmployeeId}
          assigneeOptions={assigneeOptions}
          estimatedHours={estimatedHours}
          onEstimatedHoursChange={setEstimatedHours}
        />
        <RecurrenceFields
          repeatPreset={repeatPreset}
          onRepeatPresetChange={setRepeatPreset}
          inputClass={formInputClass}
          anchorDate={publishDate ? new Date(publishDate) : new Date()}
          occurrenceLabel="content items"
        />

        <ContentItemAssetsSection
          project={project}
          isManagerOrAdmin={isManagerOrAdmin}
          assignedToEmployeeId={assignedToEmployeeId}
          mode="draft"
          pendingAssets={pendingAssets}
          onPendingAsset={(asset) => setPendingAssets((prev) => [...prev, asset])}
          onRemovePendingAsset={(index) => setPendingAssets((prev) => prev.filter((_, i) => i !== index))}
          nestedInModal
        />

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
          mode="live"
        />

        {error && <ContentFormErrorMessage message={error} />}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || isEstimating} className="flex-1">
            {isEstimating ? 'Estimating…' : isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem, ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import Button from '@/components/ui/Button';
import CollapsibleInspectorSection from '@/components/ui/CollapsibleInspectorSection';
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
import { matchContentChannel } from '@/components/planning-map/contentItemCreateUtils';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

export interface ContentItemCreateFormProps {
  project: IProject;
  clients?: IClient[];
  employees: IEmployee[];
  isManagerOrAdmin?: boolean;
  defaultPublishDate?: Date;
  initialTitle?: string;
  initialChannel?: string;
  initialNotes?: string;
  /** When false, form resets (panel closed / modal closed). */
  active?: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onTitleDraftChange?: (title: string) => void;
  nestedInModal?: boolean;
}

export default function ContentItemCreateForm({
  project,
  clients = [],
  employees,
  isManagerOrAdmin = true,
  defaultPublishDate,
  initialTitle,
  initialChannel,
  initialNotes,
  active = true,
  onCancel,
  onSuccess,
  onTitleDraftChange,
  nestedInModal = false,
}: ContentItemCreateFormProps) {
  const light = useInspectorLight();
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<ContentChannel>('Other');
  const [publishDate, setPublishDate] = useState(toContentInputDate(new Date()));
  const [status, setStatus] = useState<ContentStatus>('planned');
  const [notes, setNotes] = useState('');
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState('');
  const [keywords, setKeywords] = useState('');
  const [internalLinks, setInternalLinks] = useState<string[]>([]);
  const [externalUrl, setExternalUrl] = useState('');
  const [distributionMethods, setDistributionMethods] = useState<DistributionMethod[]>([]);
  const [estimatedHours, setEstimatedHours] = useState('');
  const [pendingAssets, setPendingAssets] = useState<PendingAssetPayload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [recurrenceExpanded, setRecurrenceExpanded] = useState(false);
  const [assetsExpanded, setAssetsExpanded] = useState(false);
  const [targetingExpanded, setTargetingExpanded] = useState(false);
  const [repeatPreset, setRepeatPreset] = useState<RecurrencePreset>('none');

  const assigneeOptions = filterEmployeesForTaskAssignment(employees, project);

  const clientName =
    project.clientId != null
      ? clients.find((c) => c._id?.toString() === project.clientId?.toString())?.name
      : undefined;

  const metaClass = lightSurface('text-sm text-gray-500', 'dark:text-gray-400', light);

  useEffect(() => {
    if (!active) {
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
      setDetailsExpanded(true);
      setRecurrenceExpanded(false);
      setAssetsExpanded(false);
      setTargetingExpanded(false);
      setRepeatPreset('none');
      setError(null);
      return;
    }
    setTitle(initialTitle?.trim() ?? '');
    const ch = matchContentChannel(initialChannel);
    setChannel(ch ?? 'Other');
    setNotes(initialNotes?.trim() ?? '');
    const base = defaultPublishDate || new Date();
    setPublishDate(toContentInputDate(base));
    setError(null);
  }, [active, project._id, initialTitle, initialChannel, initialNotes, defaultPublishDate]);

  useEffect(() => {
    onTitleDraftChange?.(title);
  }, [title, onTitleDraftChange]);

  const handleTitleChange = (value: string) => setTitle(value);

  const toggleDistribution = (method: DistributionMethod) => {
    setDistributionMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create content');
    } finally {
      setIsEstimating(false);
      setIsSubmitting(false);
    }
  };

  const recurrenceSummary =
    repeatPreset === 'none' ? 'Does not repeat' : repeatPreset.replace(/_/g, ' ');
  const assetsSummary =
    pendingAssets.length === 0
      ? 'No assets'
      : `${pendingAssets.length} ${pendingAssets.length === 1 ? 'asset' : 'assets'}`;
  const targetingSummary =
    keywords.trim() || internalLinks.some(Boolean) || externalUrl.trim() ? 'Configured' : 'None';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {clientName ? <p className={metaClass}>Client: {clientName}</p> : null}
      <p className={metaClass}>Project: {project.name}</p>

      <CollapsibleInspectorSection
        variant="nested"
        title="Details"
        expanded={detailsExpanded}
        onToggle={() => setDetailsExpanded((v) => !v)}
        className={`pt-2 border-t ${lightSurface('border-gray-200', 'dark:border-gray-700', light)}`}
      >
        <ContentItemFormFields
          title={title}
          onTitleChange={handleTitleChange}
          titleAutoFocus={active}
          inspectorStyled
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
      </CollapsibleInspectorSection>

      <CollapsibleInspectorSection
        variant="nested"
        title="Recurrence"
        expanded={recurrenceExpanded}
        onToggle={() => setRecurrenceExpanded((v) => !v)}
        collapsedSummary={recurrenceSummary}
        className={`pt-2 border-t ${lightSurface('border-gray-200', 'dark:border-gray-700', light)}`}
      >
        <RecurrenceFields
          repeatPreset={repeatPreset}
          onRepeatPresetChange={setRepeatPreset}
          inputClass={formInputClass}
          anchorDate={publishDate ? new Date(publishDate) : new Date()}
          occurrenceLabel="content items"
        />
      </CollapsibleInspectorSection>

      <CollapsibleInspectorSection
        variant="nested"
        title="Assets"
        expanded={assetsExpanded}
        onToggle={() => setAssetsExpanded((v) => !v)}
        collapsedSummary={assetsSummary}
        className={`pt-2 border-t ${lightSurface('border-gray-200', 'dark:border-gray-700', light)}`}
      >
        <ContentItemAssetsSection
          project={project}
          isManagerOrAdmin={isManagerOrAdmin}
          assignedToEmployeeId={assignedToEmployeeId}
          mode="draft"
          pendingAssets={pendingAssets}
          onPendingAsset={(asset) => setPendingAssets((prev) => [...prev, asset])}
          onRemovePendingAsset={(index) => setPendingAssets((prev) => prev.filter((_, i) => i !== index))}
          nestedInModal={nestedInModal}
          compact
        />
      </CollapsibleInspectorSection>

      <CollapsibleInspectorSection
        variant="nested"
        title="Targeting and links"
        expanded={targetingExpanded}
        onToggle={() => setTargetingExpanded((v) => !v)}
        collapsedSummary={targetingSummary}
        className={`pt-2 border-t ${lightSurface('border-gray-200', 'dark:border-gray-700', light)}`}
      >
        <ContentTargetingSection
          project={project}
          isManagerOrAdmin={isManagerOrAdmin}
          expanded
          embedded
          keywords={keywords}
          onKeywordsChange={setKeywords}
          internalLinks={internalLinks}
          onInternalLinksChange={setInternalLinks}
          externalUrl={externalUrl}
          onExternalUrlChange={setExternalUrl}
          mode="live"
        />
      </CollapsibleInspectorSection>

      {error && <ContentFormErrorMessage message={error} />}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || isEstimating} className="flex-1">
          {isEstimating ? 'Estimating…' : isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

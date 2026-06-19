'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem, ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import Button from '@/components/ui/Button';
import ContentTargetingSection, { parseKeywordsInput } from '@/components/planning-map/ContentTargetingSection';
import ContentItemFormFields, { ContentFormErrorMessage } from '@/components/planning-map/ContentItemFormFields';
import ContentItemAssetsSection from '@/components/planning-map/ContentItemAssetsSection';
import type { PendingAssetPayload } from '@/components/checklist/CategoryModal';
import { filterEmployeesForTaskAssignment } from '@/lib/utils/projectTeam';
import { createPendingAssets } from '@/lib/utils/linkedAssets';
import { fetchEstimatedHours } from '@/lib/ai/clientEstimateHours';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { toContentInputDate } from '@/components/planning-map/contentItemFormConstants';
import { matchContentChannel } from '@/components/planning-map/contentItemCreateUtils';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

const HOURS_ESTIMATE_DEBOUNCE_MS = 600;

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
  const [repeatPreset, setRepeatPreset] = useState<RecurrencePreset>('none');
  const hoursManuallyEditedRef = useRef(false);
  const estimatedHoursRef = useRef(estimatedHours);
  estimatedHoursRef.current = estimatedHours;
  const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estimateRequestIdRef = useRef(0);

  const assigneeOptions = filterEmployeesForTaskAssignment(employees, project);

  const clientName =
    project.clientId != null
      ? clients.find((c) => c._id?.toString() === project.clientId?.toString())?.name
      : undefined;

  const metaClass = lightSurface('text-sm text-gray-500', 'dark:text-gray-400', light);
  const sectionBorder = lightSurface('border-gray-200', 'dark:border-gray-700', light);
  const sectionHeading = lightSurface('text-sm font-semibold text-gray-900', 'dark:text-white', light);

  const scheduleHourEstimate = useCallback(() => {
    if (estimateTimerRef.current) {
      clearTimeout(estimateTimerRef.current);
    }
    estimateTimerRef.current = setTimeout(() => {
      estimateTimerRef.current = null;
      const trimmedTitle = title.trim();
      if (!trimmedTitle || !active) return;
      if (hoursManuallyEditedRef.current) return;
      if (estimatedHoursRef.current.trim()) return;

      const requestId = ++estimateRequestIdRef.current;
      setIsEstimating(true);
      void fetchEstimatedHours({
        kind: 'content',
        title: trimmedTitle,
        channel,
        description: notes.trim() || undefined,
        projectName: project.name,
      })
        .then((hours) => {
          if (requestId !== estimateRequestIdRef.current) return;
          if (hoursManuallyEditedRef.current) return;
          if (estimatedHoursRef.current.trim()) return;
          if (hours != null) {
            setEstimatedHours(String(hours));
          }
        })
        .finally(() => {
          if (requestId === estimateRequestIdRef.current) {
            setIsEstimating(false);
          }
        });
    }, HOURS_ESTIMATE_DEBOUNCE_MS);
  }, [active, title, channel, notes, project.name]);

  useEffect(() => {
    if (!active) {
      hoursManuallyEditedRef.current = false;
      estimateRequestIdRef.current += 1;
      if (estimateTimerRef.current) {
        clearTimeout(estimateTimerRef.current);
        estimateTimerRef.current = null;
      }
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
      setRepeatPreset('none');
      setError(null);
      setIsEstimating(false);
      return;
    }
    setTitle(initialTitle?.trim() ?? '');
    const ch = matchContentChannel(initialChannel);
    setChannel(ch ?? 'Other');
    setNotes(initialNotes?.trim() ?? '');
    const base = defaultPublishDate || new Date();
    setPublishDate(toContentInputDate(base));
    setError(null);
    hoursManuallyEditedRef.current = false;
  }, [active, project._id, initialTitle, initialChannel, initialNotes, defaultPublishDate]);

  useEffect(() => {
    onTitleDraftChange?.(title);
  }, [title, onTitleDraftChange]);

  useEffect(() => {
    if (!active) return;
    scheduleHourEstimate();
    return () => {
      if (estimateTimerRef.current) {
        clearTimeout(estimateTimerRef.current);
        estimateTimerRef.current = null;
      }
    };
  }, [active, title, notes, channel, scheduleHourEstimate]);

  const handleTitleChange = (value: string) => setTitle(value);

  const handleEstimatedHoursChange = (value: string) => {
    hoursManuallyEditedRef.current = true;
    setEstimatedHours(value);
  };

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {clientName ? <p className={metaClass}>Client: {clientName}</p> : null}
      <p className={metaClass}>Project: {project.name}</p>

      <ContentItemFormFields
        compactLayout
        title={title}
        onTitleChange={handleTitleChange}
        titleAutoFocus={active}
        inspectorStyled
        repeatPreset={repeatPreset}
        onRepeatPresetChange={setRepeatPreset}
        recurrenceAnchorDate={publishDate ? new Date(publishDate) : new Date()}
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
        onEstimatedHoursChange={handleEstimatedHoursChange}
        isEstimatingHours={isEstimating}
        estimatedHoursHint="AI suggests hours when left blank"
      />

      <ContentItemAssetsSection
        project={project}
        isManagerOrAdmin={isManagerOrAdmin}
        assignedToEmployeeId={assignedToEmployeeId}
        mode="draft"
        pendingAssets={pendingAssets}
        onPendingAsset={(asset) => setPendingAssets((prev) => [...prev, asset])}
        onRemovePendingAsset={(index) => setPendingAssets((prev) => prev.filter((_, i) => i !== index))}
        nestedInModal={nestedInModal}
        compact={false}
        showAddHintText={pendingAssets.length === 0}
      />

      <div className={`pt-3 border-t ${sectionBorder}`}>
        <h4 className={`${sectionHeading} mb-3`}>Targeting and links</h4>
        <ContentTargetingSection
          project={project}
          isManagerOrAdmin={isManagerOrAdmin}
          expanded
          embedded
          inspectorStyled
          keywords={keywords}
          onKeywordsChange={setKeywords}
          internalLinks={internalLinks}
          onInternalLinksChange={setInternalLinks}
          externalUrl={externalUrl}
          onExternalUrlChange={setExternalUrl}
          mode="live"
        />
      </div>

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

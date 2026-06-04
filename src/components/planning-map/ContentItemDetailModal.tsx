'use client';

import { useState, useEffect, useCallback } from 'react';
import { IContentItem, ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import { IProject } from '@/lib/models/Project';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ContentTargetingSection, { parseKeywordsInput } from '@/components/planning-map/ContentTargetingSection';
import ContentItemFormFields, { ContentFormErrorMessage } from '@/components/planning-map/ContentItemFormFields';
import ContentItemAssetsSection from '@/components/planning-map/ContentItemAssetsSection';
import { filterEmployeesForTaskAssignment } from '@/lib/utils/projectTeam';
import CommentThread from '@/components/comments/CommentThread';
import CommentsCollapsibleSection from '@/components/comments/CommentsCollapsibleSection';
import { type CommentSummary } from '@/lib/comments/commentUtils';
import {
  buildCommentThreadKey,
  hasUnreadCommentActivity,
  setCommentLastSeenMs,
  setCommentThreadManuallyCollapsed,
  shouldAutoExpandCommentThread,
} from '@/lib/comments/commentReadState';
import { CONTENT_CHANNELS, CONTENT_STATUSES, toContentInputDate } from '@/components/planning-map/contentItemFormConstants';

interface ContentItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentItemId: string | null;
  employees: IEmployee[];
  project?: IProject | null;
  isManagerOrAdmin?: boolean;
  currentUserEmployeeId?: string | null;
  onSaved: () => void;
  onDeleted?: () => void;
  stackAboveOverlays?: boolean;
}

export default function ContentItemDetailModal({
  isOpen,
  onClose,
  contentItemId,
  employees,
  project: projectProp,
  isManagerOrAdmin = true,
  currentUserEmployeeId,
  onSaved,
  onDeleted,
  stackAboveOverlays = false,
}: ContentItemDetailModalProps) {
  const [item, setItem] = useState<IContentItem | null>(null);
  const [project, setProject] = useState<IProject | null>(projectProp ?? null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsRefreshToken, setAssetsRefreshToken] = useState(0);

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
  const [expandedComments, setExpandedComments] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [commentSummary, setCommentSummary] = useState<CommentSummary>({ count: 0, latestActivityMs: 0 });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.id && setCurrentUserId(data.id))
      .catch(() => {});
  }, []);

  const fetchCommentSummary = useCallback(async () => {
    if (!contentItemId) return;
    try {
      const params = new URLSearchParams({
        entityType: 'contentItem',
        entityId: contentItemId,
        summary: '1',
      });
      const res = await fetch(`/api/comments?${params}`);
      if (!res.ok) return;
      const summary = (await res.json()) as CommentSummary;
      setCommentSummary(summary);
      if (currentUserId && summary.latestActivityMs > 0) {
        const threadKey = buildCommentThreadKey(currentUserId, 'contentItem', contentItemId);
        if (shouldAutoExpandCommentThread(threadKey, summary.latestActivityMs)) {
          setExpandedComments(true);
        }
      }
    } catch {
      // ignore
    }
  }, [contentItemId, currentUserId]);

  useEffect(() => {
    if (!isOpen || !contentItemId) {
      setExpandedComments(false);
      setCommentSummary({ count: 0, latestActivityMs: 0 });
      return;
    }
    void fetchCommentSummary();
  }, [isOpen, contentItemId, fetchCommentSummary]);

  useEffect(() => {
    if (!isOpen) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchCommentSummary();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isOpen, fetchCommentSummary]);

  const toggleComments = () => {
    if (!contentItemId) return;
    const threadKey = currentUserId
      ? buildCommentThreadKey(currentUserId, 'contentItem', contentItemId)
      : null;
    if (threadKey) {
      setCommentThreadManuallyCollapsed(threadKey, expandedComments);
    }
    setExpandedComments((prev) => !prev);
  };

  const handleCommentMetaChange = (meta: CommentSummary) => {
    setCommentSummary(meta);
    if (expandedComments && currentUserId && contentItemId && meta.latestActivityMs > 0) {
      setCommentLastSeenMs(
        buildCommentThreadKey(currentUserId, 'contentItem', contentItemId),
        meta.latestActivityMs
      );
    }
  };

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
        setChannel(CONTENT_CHANNELS.includes(data.channel) ? data.channel : 'Other');
        setStatus(CONTENT_STATUSES.includes(data.status) ? data.status : 'planned');
        setPublishDate(data.publishDate ? toContentInputDate(new Date(data.publishDate)) : '');
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
    ? filterEmployeesForTaskAssignment(employees, project, {
        includeEmployeeIds: assignedToEmployeeId ? [assignedToEmployeeId] : [],
      })
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
      {project && <p className="text-sm text-text-secondary">Project: {project.name}</p>}
      <ContentItemFormFields
        title={title}
        onTitleChange={setTitle}
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

      {project && contentItemId && (
        <ContentItemAssetsSection
          project={project}
          contentItemId={contentItemId}
          isManagerOrAdmin={isManagerOrAdmin}
          currentUserEmployeeId={currentUserEmployeeId}
          assignedToEmployeeId={assignedToEmployeeId || item.assignedToEmployeeId?.toString()}
          mode="live"
          refreshToken={assetsRefreshToken}
          onAssetsChanged={() => setAssetsRefreshToken((n) => n + 1)}
          nestedInModal={stackAboveOverlays}
        />
      )}

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

      {contentItemId && (
        <div className="pt-3 border-t border-border">
          <CommentsCollapsibleSection
            expanded={expandedComments}
            onToggle={toggleComments}
            count={commentSummary.count}
            hasUnread={
              currentUserId && contentItemId
                ? hasUnreadCommentActivity(
                    buildCommentThreadKey(currentUserId, 'contentItem', contentItemId),
                    commentSummary.latestActivityMs
                  )
                : false
            }
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <CommentThread
              entityType="contentItem"
              entityId={contentItemId}
              showHeading={false}
              isManagerOrAdmin={isManagerOrAdmin}
              showScreenshotGallery={false}
              onMetaChange={handleCommentMetaChange}
            />
          </CommentsCollapsibleSection>
        </div>
      )}

      {error && <ContentFormErrorMessage message={error} />}
      <div className="flex gap-2 pt-2 flex-wrap">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 min-w-0">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="flex-1 min-w-0">
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1 min-w-0">
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </form>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Content"
      maxWidth="md"
      elevated
      stackAboveOverlays={stackAboveOverlays}
    >
      {formContent}
    </Modal>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { IProject, IProjectTask, TaskStatus } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem, type ContentStatus } from '@/lib/models/ContentItem';
import EditableText from '@/components/ui/EditableText';
import EditableDate from '@/components/ui/EditableDate';
import EditableNumber from '@/components/ui/EditableNumber';
import EditableSelect from '@/components/ui/EditableSelect';
import SwipeableCard from '@/components/ui/SwipeableCard';
import Modal from '@/components/ui/Modal';
import ModalAction from '@/components/ui/ModalAction';
import ConfirmModal from '@/components/shared/ConfirmModal';
import AssetDeleteConfirmModal from '@/components/shared/AssetDeleteConfirmModal';
import Button from '@/components/ui/Button';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import CommentThread from '@/components/comments/CommentThread';
import CommentsCollapsibleSection from '@/components/comments/CommentsCollapsibleSection';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import HoverDeleteButton from '@/components/shared/HoverDeleteButton';
import ProjectLogo from '@/components/projects/ProjectLogo';
import { formatDate, parseDateSafe, type TimeframeType } from '@/lib/utils/dateUtils';
import { computeProjectEstimatedHours } from '@/lib/utils/projectHours';
import { fetchEstimatedHours } from '@/lib/ai/clientEstimateHours';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import ChecklistSection from '@/components/checklist/ChecklistSection';
import AddButton from '@/components/checklist/AddButton';
import type { AddSmartButtonPayload } from '@/components/checklist/CategoryModal';
import MultiSelect from '@/components/ui/MultiSelect';
import { emailSmartButtonHref } from '@/lib/utils/emailSmartLinks';
import { labelForPaletteIndex, parseCssColorInput, formatColorPaletteForCopy } from '@/lib/utils/cssColorInput';
import {
  taskAssigneeSelectOptions,
  getTaskAssigneeEmployeeIds,
  canUserContributeToProject,
  filterEmployeesForTaskAssignment,
  isEmployeeOnProjectTeam,
  isTaskAssigneeOnProjectTeam,
  sanitizeTaskAssigneesForProjectTeam,
} from '@/lib/utils/projectTeam';
import {
  labelForFontPaletteIndex,
  maxFontPaletteEntries,
  parseFontFamilyInput,
} from '@/lib/utils/fontPaletteInput';
import { normalizeProjectUrlHref, truncateProjectUrlDisplay } from '@/lib/utils/projectUrls';
import TaskLinkedAssets from '@/components/planning-map/TaskLinkedAssets';
import LinkedRecordingChips from '@/components/shared/LinkedRecordingChips';
import ContentLinkedAssets from '@/components/planning-map/ContentLinkedAssets';
import { deleteLinkedAsset, canUserDeleteAsset, normalizeAssetUserId } from '@/lib/utils/linkedAssets';
import ProjectSocialsBar from '@/components/projects/ProjectSocialsBar';
import { parseSocialLinkInput } from '@/lib/utils/socialUrls';
import type { IProjectSocialLink } from '@/lib/models/Project';
import { scrollElementIntoContainerAfterLayout } from '@/lib/utils/scrollIntoContainer';
import type { RefObject } from 'react';
import { expandTaskInstances } from '@/lib/recurrence/expandTaskInstances';
import TaskRecurrenceInline, { type TaskRecurrenceValue } from '@/components/planning-map/TaskRecurrenceInline';
import { taskCommentSummaryKey, type CommentSummary } from '@/lib/comments/commentUtils';
import {
  buildCommentThreadKey,
  hasUnreadCommentActivity,
  setCommentLastSeenMs,
  setCommentThreadManuallyCollapsed,
  shouldAutoExpandCommentThread,
} from '@/lib/comments/commentReadState';
import ItemSeenTag from '@/components/workspace/ItemSeenTag';
import {
  buildContentItemKey,
  buildContentItemObservation,
  buildTaskItemKey,
  buildTaskItemObservation,
  observeItemsForUser,
  type ItemSeenStatus,
} from '@/lib/workspace/itemSeenState';

interface InlineProjectViewProps {
  project: IProject;
  employees: IEmployee[];
  isManagerOrAdmin: boolean;
  currentUserEmployeeId?: string | null;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
  /** Merge logo and other inspector edits into workspace project list without full reload. */
  onProjectPatched?: (project: IProject) => void;
  onDelete?: () => void;
  onClose: () => void;
  onRefresh: () => void;
  /** Called when user clicks "Add Content"; parent should open ContentItemCreateModal and refresh on success. */
  onAddContent?: (project: IProject) => void;
  /** Called when user clicks a content item; parent should open ContentItemDetailModal. */
  onContentItemClick?: (item: IContentItem) => void;
  /** When this changes, project content list is refetched (e.g. after detail modal save/delete). */
  contentRefreshTrigger?: number;
  /** Notify workspace to refresh global content list after inspector content mutations. */
  onContentListChanged?: () => void;
  /** Open Tasks tab and focus this row (e.g. deep-link from workspace schedule). Cleared by parent via onInitialOpenTaskConsumed. */
  initialOpenTaskIndex?: number | null;
  onInitialOpenTaskConsumed?: () => void;
  /** Open Content tab and focus this item (e.g. deep-link from workspace schedule). */
  initialOpenContentId?: string | null;
  onInitialOpenContentConsumed?: () => void;
  /** Scrollable inspector container (BottomSheet inner region). */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  /** When true, create a new task row on mount (e.g. from schedule Add Task). */
  autoAddTaskOnOpen?: boolean;
  onAutoAddTaskConsumed?: () => void;
  /** Workspace timeframe for project hour rollup. */
  timeframe?: TimeframeType;
  /** Reference date for timeframe (defaults to today). */
  referenceDate?: Date;
}

type LinkedAssetRow = {
  _id: string;
  name: string;
  type: string;
  url?: string;
  fileUrl?: string;
  textContent?: string;
  userId?: string;
  linkedProjectTaskId?: string;
  linkedContentItemId?: string;
};

function normalizeLinkedAsset(raw: unknown): LinkedAssetRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o._id;
  const idStr =
    typeof id === 'string'
      ? id
      : id && typeof (id as { toString?: () => string }).toString === 'function'
        ? (id as { toString: () => string }).toString()
        : '';
  if (!idStr) return null;
  return {
    _id: idStr,
    name: typeof o.name === 'string' ? o.name : 'Untitled',
    type: typeof o.type === 'string' ? o.type : 'other',
    url: typeof o.url === 'string' ? o.url : undefined,
    fileUrl: typeof o.fileUrl === 'string' ? o.fileUrl : undefined,
    textContent: typeof o.textContent === 'string' ? o.textContent : undefined,
    userId: normalizeAssetUserId(o.userId),
    linkedProjectTaskId:
      typeof o.linkedProjectTaskId === 'string'
        ? o.linkedProjectTaskId
        : o.linkedProjectTaskId &&
            typeof (o.linkedProjectTaskId as { toString?: () => string }).toString === 'function'
          ? (o.linkedProjectTaskId as { toString: () => string }).toString()
          : undefined,
    linkedContentItemId:
      typeof o.linkedContentItemId === 'string'
        ? o.linkedContentItemId
        : o.linkedContentItemId &&
            typeof (o.linkedContentItemId as { toString?: () => string }).toString === 'function'
          ? (o.linkedContentItemId as { toString: () => string }).toString()
          : undefined,
  };
}

function linkedAssetOpenHref(asset: LinkedAssetRow): string | null {
  if (asset.fileUrl) return asset.fileUrl;
  if (asset.url) return asset.url;
  return null;
}

function isTextDocumentAssetType(type: string): boolean {
  return type === 'text' || type === 'document';
}

function formatLinkedAssetTypeLabel(type: string): string {
  if (!type) return 'Other';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Normalized smart button row from GET /projects/:id/buttons */
type ProjectPanelActionButton = {
  label: string;
  url: string;
  kind?: 'link' | 'email';
  password?: string;
};

function normalizeProjectActionButton(raw: unknown): ProjectPanelActionButton | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label : '';
  const url = typeof o.url === 'string' ? o.url : '';
  if (!label || !url) return null;
  if (o.kind === 'email') {
    const password = typeof o.password === 'string' ? o.password : undefined;
    return password !== undefined ? { label, url, kind: 'email' as const, password } : { label, url, kind: 'email' as const };
  }
  return { label, url };
}

function normalizeActionButtonsList(raw: unknown): ProjectPanelActionButton[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map(normalizeProjectActionButton)
    .filter((b): b is ProjectPanelActionButton => b != null);
}

function mailtoAddressFromUrl(mailtoUrl: string): string {
  const m = /^mailto:(.+)$/i.exec(String(mailtoUrl).trim());
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function contentAssigneeOptions(
  employees: IEmployee[],
  project: IProject,
  currentId: string | undefined,
) {
  const filtered = filterEmployeesForTaskAssignment(employees, project, {
    includeEmployeeIds: currentId ? [currentId] : [],
  });
  return [
    { value: '', label: 'Unassigned' },
    ...filtered.map((e) => ({ value: e._id.toString(), label: e.name })),
  ];
}

function canAddContentToProject(project: IProject, isManagerOrAdmin: boolean, currentUserEmployeeId: string | null | undefined): boolean {
  return canUserContributeToProject(project, currentUserEmployeeId ?? null, isManagerOrAdmin);
}

export default function InlineProjectView({ project, employees, isManagerOrAdmin, currentUserEmployeeId, onUpdate, onProjectPatched, onDelete, onClose, onRefresh, onAddContent, onContentItemClick, contentRefreshTrigger, onContentListChanged, initialOpenTaskIndex, onInitialOpenTaskConsumed, initialOpenContentId, onInitialOpenContentConsumed, scrollContainerRef, autoAddTaskOnOpen, onAutoAddTaskConsumed, timeframe = 'weekly', referenceDate }: InlineProjectViewProps) {
  const [localProject, setLocalProject] = useState(project);
  const localProjectRef = useRef(localProject);
  localProjectRef.current = localProject;
  const [expandedTaskComments, setExpandedTaskComments] = useState<Set<number>>(new Set());
  const [expandedContentComments, setExpandedContentComments] = useState<Set<string>>(new Set());
  const [commentSummaries, setCommentSummaries] = useState<{
    tasks: Record<string, CommentSummary>;
    contentItems: Record<string, CommentSummary>;
  }>({ tasks: {}, contentItems: {} });
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);
  const [showTaskActions, setShowTaskActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const initialTaskAppliedKeyRef = useRef<string | null>(null);
  const initialContentAppliedKeyRef = useRef<string | null>(null);
  const autoAddTaskAppliedKeyRef = useRef<string | null>(null);
  /** After adding a task, scroll its row into view once state settles. */
  const [pendingScrollToTaskIndex, setPendingScrollToTaskIndex] = useState<number | null>(null);
  const [autoEditTaskIndex, setAutoEditTaskIndex] = useState<number | null>(null);
  const [actionButtons, setActionButtons] = useState<ProjectPanelActionButton[]>([]);
  const [credentialSheet, setCredentialSheet] = useState<{
    index: number;
    label: string;
    url: string;
    password: string;
  } | null>(null);
  const [credentialSheetMode, setCredentialSheetMode] = useState<'view' | 'edit'>('view');
  const [credentialEditLabel, setCredentialEditLabel] = useState('');
  const [credentialEditEmail, setCredentialEditEmail] = useState('');
  const [credentialEditPassword, setCredentialEditPassword] = useState('');
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialReveal, setCredentialReveal] = useState(false);
  /** When set, overrides localProject.dismissedChecklistIds for ChecklistSection (avoids mutating IProject Document). */
  const [localDismissedChecklistIds, setLocalDismissedChecklistIds] = useState<string[] | null>(null);
  /** Tab for tasks vs content. */
  const [viewTab, setViewTab] = useState<'tasks' | 'content'>('tasks');
  const [taskTab, setTaskTab] = useState<'active' | 'completed'>('active');
  const [contentTab, setContentTab] = useState<'active' | 'completed'>('active');
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [projectContentItems, setProjectContentItems] = useState<IContentItem[]>([]);
  const [estimatingTaskIndices, setEstimatingTaskIndices] = useState<Set<number>>(() => new Set());
  const estimateTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const hoursSyncRef = useRef(false);
  const [linkedAssets, setLinkedAssets] = useState<LinkedAssetRow[]>([]);
  const [linkedAssetsLoading, setLinkedAssetsLoading] = useState(true);
  const [linkedAssetTypeFilter, setLinkedAssetTypeFilter] = useState('');
  const [assetPendingDelete, setAssetPendingDelete] = useState<LinkedAssetRow | null>(null);
  const [deletingLinkedAsset, setDeletingLinkedAsset] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<LinkedAssetRow | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [previewSheetMode, setPreviewSheetMode] = useState<'view' | 'edit'>('view');
  const [previewEditName, setPreviewEditName] = useState('');
  const [previewEditContent, setPreviewEditContent] = useState('');
  const [previewSaving, setPreviewSaving] = useState(false);
  const [paletteSheetOpen, setPaletteSheetOpen] = useState(false);
  const [paletteDraft, setPaletteDraft] = useState<string[]>(['#3b82f6']);
  const [paletteSaving, setPaletteSaving] = useState(false);
  const [paletteCopyFeedback, setPaletteCopyFeedback] = useState(false);
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [fontDraft, setFontDraft] = useState<string[]>(['']);
  const [fontSaving, setFontSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [taskAssetsRefreshToken, setTaskAssetsRefreshToken] = useState(0);
  const [contentAssetsRefreshToken, setContentAssetsRefreshToken] = useState(0);
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemSeenStatus>>({});

  const notifyContentListChanged = useCallback(() => {
    onContentListChanged?.();
  }, [onContentListChanged]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.id && setCurrentUserId(data.id))
      .catch(() => {});
  }, []);

  const loadLinkedAssets = useCallback(async () => {
    setLinkedAssetsLoading(true);
    try {
      const res = await fetch(`/api/assets?linkedProjectId=${localProject._id}`);
      if (!res.ok) {
        setLinkedAssets([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setLinkedAssets([]);
        return;
      }
      const rows = data.map(normalizeLinkedAsset).filter((x): x is LinkedAssetRow => x != null);
      setLinkedAssets(rows);
    } catch {
      setLinkedAssets([]);
    } finally {
      setLinkedAssetsLoading(false);
    }
  }, [localProject._id]);

  useEffect(() => {
    void loadLinkedAssets();
  }, [loadLinkedAssets]);

  useEffect(() => {
    setLinkedAssetTypeFilter('');
  }, [localProject._id]);

  useEffect(() => {
    if (!previewAsset) {
      setPreviewSheetMode('view');
      setPreviewEditName('');
      setPreviewEditContent('');
      return;
    }
    setPreviewSheetMode('view');
    setPreviewEditName(previewAsset.name);
    setPreviewEditContent(previewAsset.textContent ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync drafts when opening sheet or switching asset id; omit previewAsset ref so post-save identity updates do not reset edit mode
  }, [previewAsset?._id]);

  const linkedAssetTypeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of linkedAssets) {
      m.set(a.type, (m.get(a.type) ?? 0) + 1);
    }
    return m;
  }, [linkedAssets]);

  const linkedAssetTypesInUse = useMemo(
    () => Array.from(linkedAssetTypeCounts.keys()).sort((a, b) => a.localeCompare(b)),
    [linkedAssetTypeCounts]
  );

  const visibleLinkedAssets = useMemo(() => {
    if (!linkedAssetTypeFilter) return linkedAssets;
    return linkedAssets.filter((a) => a.type === linkedAssetTypeFilter);
  }, [linkedAssets, linkedAssetTypeFilter]);

  const taskAssets = useMemo(
    () => linkedAssets.filter((asset) => Boolean(asset.linkedProjectTaskId)),
    [linkedAssets]
  );
  const contentItemAssets = useMemo(
    () => linkedAssets.filter((asset) => Boolean(asset.linkedContentItemId)),
    [linkedAssets]
  );

  const projectIdStr = localProject._id.toString();
  const projectBadgeEligible =
    !!currentUserEmployeeId &&
    isManagerOrAdmin &&
    isEmployeeOnProjectTeam(localProject, currentUserEmployeeId);

  const taskItemKeyFor = useCallback(
    (task: IProjectTask, idx: number) =>
      buildTaskItemKey(projectIdStr, (task as { _id?: { toString(): string } })._id?.toString() ?? null, idx),
    [projectIdStr]
  );

  const contentItemKeyFor = useCallback(
    (item: IContentItem) => buildContentItemKey(projectIdStr, item._id.toString()),
    [projectIdStr]
  );

  const canShowTaskNewIndicator = useCallback(
    (task: IProjectTask): boolean => {
      if (!currentUserEmployeeId) return false;
      if (projectBadgeEligible) return true;
      return getTaskAssigneeEmployeeIds(task).includes(currentUserEmployeeId);
    },
    [currentUserEmployeeId, projectBadgeEligible]
  );

  const canShowContentNewIndicator = useCallback(
    (item: IContentItem): boolean => {
      if (!currentUserEmployeeId) return false;
      if (projectBadgeEligible) return true;
      return item.assignedToEmployeeId?.toString() === currentUserEmployeeId;
    },
    [currentUserEmployeeId, projectBadgeEligible]
  );

  const paletteChipSwatches = useMemo(() => {
    const pal = localProject.colorPalette;
    const raw =
      Array.isArray(pal) && pal.length > 0 ? pal : [localProject.color || '#3b82f6'];
    const out: string[] = [];
    for (const c of raw) {
      if (typeof c !== 'string') continue;
      const p = parseCssColorInput(c.trim());
      if (p.ok) out.push(p.normalized);
      if (out.length >= 4) break;
    }
    if (out.length === 0) {
      const p = parseCssColorInput(String(localProject.color || '#3b82f6'));
      out.push(p.ok ? p.normalized : '#3b82f6');
    }
    return out;
  }, [localProject.colorPalette, localProject.color]);

  const fontChipPreview = useMemo(() => {
    const pal = localProject.fontPalette;
    if (!Array.isArray(pal) || pal.length === 0) return [];
    const out: string[] = [];
    for (const f of pal) {
      if (typeof f !== 'string') continue;
      const t = f.trim();
      if (!t) continue;
      const p = parseFontFamilyInput(t);
      if (p.ok) out.push(p.normalized);
      if (out.length >= 3) break;
    }
    return out;
  }, [localProject.fontPalette]);

  const confirmDeleteLinkedAsset = async () => {
    if (!assetPendingDelete) return;
    setDeletingLinkedAsset(true);
    const result = await deleteLinkedAsset(assetPendingDelete._id);
    if (result.ok) {
      if (previewImage && linkedAssetOpenHref(assetPendingDelete) === previewImage.src) {
        setPreviewImage(null);
      }
      setAssetPendingDelete(null);
      await loadLinkedAssets();
    } else {
      alert(result.error ?? 'Could not delete asset.');
    }
    setDeletingLinkedAsset(false);
  };

  const closePreviewAssetSheet = () => {
    setPreviewSheetMode('view');
    setPreviewAsset(null);
  };

  const savePreviewLinkedAsset = async () => {
    if (!previewAsset || !previewEditName.trim()) return;
    setPreviewSaving(true);
    try {
      const res = await fetch(`/api/assets/${previewAsset._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: previewEditName.trim(),
          textContent: previewEditContent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const name = typeof data.name === 'string' ? data.name : previewEditName.trim();
        const textContent = typeof data.textContent === 'string' ? data.textContent : previewEditContent;
        setPreviewAsset((prev) => (prev ? { ...prev, name, textContent } : null));
        setLinkedAssets((prev) =>
          prev.map((a) => (a._id === previewAsset._id ? { ...a, name, textContent } : a))
        );
        setPreviewSheetMode('view');
      } else {
        let msg = 'Could not save asset.';
        try {
          const data = await res.json();
          if (data && typeof data.error === 'string') msg = data.error;
        } catch {
          // ignore
        }
        alert(msg);
      }
    } catch {
      alert('Could not save asset.');
    } finally {
      setPreviewSaving(false);
    }
  };

  const closeCredentialSheet = () => {
    setCredentialSheet(null);
    setCredentialSheetMode('view');
    setCredentialReveal(false);
  };

  const saveCredentialEmailButton = async () => {
    if (!credentialSheet || credentialSaving) return;
    const emailTrim = credentialEditEmail.trim();
    if (!emailTrim) {
      alert('Email address is required.');
      return;
    }
    setCredentialSaving(true);
    try {
      const res = await fetch(`/api/projects/${localProject._id}/buttons`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index: credentialSheet.index,
          label: credentialEditLabel,
          email: emailTrim,
          password: credentialEditPassword,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const arr = normalizeActionButtonsList(Array.isArray(data) ? data : []);
        setActionButtons(arr);
        const idx = credentialSheet.index;
        const row = arr[idx];
        if (row && row.kind === 'email') {
          setCredentialSheet({
            index: idx,
            label: row.label,
            url: row.url,
            password: row.password ?? '',
          });
        }
        setCredentialSheetMode('view');
      } else {
        let msg = 'Could not save.';
        try {
          const errBody = await res.json();
          if (errBody && typeof errBody.error === 'string') msg = errBody.error;
        } catch {
          // ignore
        }
        alert(msg);
      }
    } catch {
      alert('Could not save.');
    } finally {
      setCredentialSaving(false);
    }
  };

  const toggleTaskComments = (taskIdx: number) => {
    const threadKey = currentUserId
      ? buildCommentThreadKey(
          currentUserId,
          'projectTask',
          localProject._id.toString(),
          (localProject.tasks?.[taskIdx] as { _id?: { toString: () => string } })?._id?.toString()
        )
      : null;
    const isExpanded = expandedTaskComments.has(taskIdx);
    if (threadKey) {
      setCommentThreadManuallyCollapsed(threadKey, isExpanded);
    }
    setExpandedTaskComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskIdx)) {
        newSet.delete(taskIdx);
      } else {
        newSet.add(taskIdx);
      }
      return newSet;
    });
  };

  const toggleContentComments = (contentItemId: string) => {
    const threadKey = currentUserId
      ? buildCommentThreadKey(currentUserId, 'contentItem', contentItemId)
      : null;
    const isExpanded = expandedContentComments.has(contentItemId);
    if (threadKey) {
      setCommentThreadManuallyCollapsed(threadKey, isExpanded);
    }
    setExpandedContentComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contentItemId)) {
        newSet.delete(contentItemId);
      } else {
        newSet.add(contentItemId);
      }
      return newSet;
    });
  };

  const getTaskSummaryForIndex = useCallback(
    (taskIdx: number): CommentSummary => {
      const task = localProject.tasks?.[taskIdx];
      const key = taskCommentSummaryKey(
        (task as { _id?: { toString: () => string } })?._id?.toString(),
        taskIdx
      );
      return commentSummaries.tasks[key] ?? { count: 0, latestActivityMs: 0 };
    },
    [commentSummaries.tasks, localProject.tasks]
  );

  const handleTaskCommentMetaChange = useCallback(
    (taskIdx: number, meta: CommentSummary) => {
      const key = taskCommentSummaryKey(
        (localProject.tasks?.[taskIdx] as { _id?: { toString: () => string } })?._id?.toString(),
        taskIdx
      );
      setCommentSummaries((prev) => {
        const existing = prev.tasks[key];
        if (
          existing &&
          existing.count === meta.count &&
          existing.latestActivityMs === meta.latestActivityMs
        ) {
          return prev;
        }
        return {
          ...prev,
          tasks: { ...prev.tasks, [key]: meta },
        };
      });
      if (expandedTaskComments.has(taskIdx) && currentUserId && meta.latestActivityMs > 0) {
        const threadKey = buildCommentThreadKey(
          currentUserId,
          'projectTask',
          localProject._id.toString(),
          (localProject.tasks?.[taskIdx] as { _id?: { toString: () => string } })?._id?.toString()
        );
        setCommentLastSeenMs(threadKey, meta.latestActivityMs);
      }
    },
    [currentUserId, expandedTaskComments, localProject._id, localProject.tasks]
  );

  const handleContentCommentMetaChange = useCallback(
    (contentItemId: string, meta: CommentSummary) => {
      setCommentSummaries((prev) => {
        const existing = prev.contentItems[contentItemId];
        if (
          existing &&
          existing.count === meta.count &&
          existing.latestActivityMs === meta.latestActivityMs
        ) {
          return prev;
        }
        return {
          ...prev,
          contentItems: { ...prev.contentItems, [contentItemId]: meta },
        };
      });
      if (expandedContentComments.has(contentItemId) && currentUserId && meta.latestActivityMs > 0) {
        const threadKey = buildCommentThreadKey(currentUserId, 'contentItem', contentItemId);
        setCommentLastSeenMs(threadKey, meta.latestActivityMs);
      }
    },
    [currentUserId, expandedContentComments]
  );

  useEffect(() => {
    if (!currentUserId) return;

    const taskEntries = (localProject.tasks ?? []).map((task, idx) =>
      buildTaskItemObservation(localProject, task, idx)
    );

    const contentEntries = projectContentItems.map((item) => buildContentItemObservation(item));

    const observed = observeItemsForUser(currentUserId, [...taskEntries, ...contentEntries]);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, localProject, projectContentItems]);

  const sortedTaskEntries = useMemo(
    () =>
      (localProject.tasks ?? [])
        .map((task, idx) => ({ task, idx }))
        .sort((a, b) => {
          const aDue = parseDateSafe(a.task.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bDue = parseDateSafe(b.task.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          if (aDue !== bDue) return aDue - bDue;
          return a.idx - b.idx;
        }),
    [localProject.tasks]
  );

  const sortedContentItems = useMemo(
    () =>
      [...projectContentItems].sort((a, b) => {
        const aDue = parseDateSafe(a.publishDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = parseDateSafe(b.publishDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return aDue - bDue;
        const aCreated = parseDateSafe(a.createdAt)?.getTime() ?? 0;
        const bCreated = parseDateSafe(b.createdAt)?.getTime() ?? 0;
        if (aCreated !== bCreated) return aCreated - bCreated;
        return a._id.toString().localeCompare(b._id.toString());
      }),
    [projectContentItems]
  );

  const visibleTaskEntries = useMemo(
    () =>
      sortedTaskEntries.filter(({ task }) =>
        taskTab === 'active' ? task.status !== 'completed' : task.status === 'completed'
      ),
    [sortedTaskEntries, taskTab]
  );

  const visibleContentItems = useMemo(
    () =>
      sortedContentItems.filter((contentItem) =>
        contentTab === 'active' ? contentItem.status !== 'published' : contentItem.status === 'published'
      ),
    [sortedContentItems, contentTab]
  );

  const applyAutoExpandFromSummaries = useCallback(
    (data: { tasks: Record<string, CommentSummary>; contentItems: Record<string, CommentSummary> }) => {
      if (!currentUserId) return;

      const tasksToExpand = new Set<number>();
      (localProject.tasks ?? []).forEach((task, idx) => {
        const summaryKey = taskCommentSummaryKey(
          (task as { _id?: { toString: () => string } })?._id?.toString(),
          idx
        );
        const summary = data.tasks[summaryKey];
        if (!summary?.latestActivityMs) return;
        const threadKey = buildCommentThreadKey(
          currentUserId,
          'projectTask',
          localProject._id.toString(),
          (task as { _id?: { toString: () => string } })?._id?.toString()
        );
        if (shouldAutoExpandCommentThread(threadKey, summary.latestActivityMs)) {
          tasksToExpand.add(idx);
        }
      });

      const contentToExpand = new Set<string>();
      projectContentItems.forEach((item) => {
        const itemId = item._id.toString();
        const summary = data.contentItems[itemId];
        if (!summary?.latestActivityMs) return;
        const threadKey = buildCommentThreadKey(currentUserId, 'contentItem', itemId);
        if (shouldAutoExpandCommentThread(threadKey, summary.latestActivityMs)) {
          contentToExpand.add(itemId);
        }
      });

      if (tasksToExpand.size > 0) {
        setExpandedTaskComments((prev) => new Set([...prev, ...tasksToExpand]));
      }
      if (contentToExpand.size > 0) {
        setExpandedContentComments((prev) => new Set([...prev, ...contentToExpand]));
      }
    },
    [currentUserId, localProject._id, localProject.tasks, projectContentItems]
  );

  const fetchCommentSummaries = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${localProject._id.toString()}/comments-summary`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      const summaries = {
        tasks: (data.tasks ?? {}) as Record<string, CommentSummary>,
        contentItems: (data.contentItems ?? {}) as Record<string, CommentSummary>,
      };
      setCommentSummaries(summaries);
      applyAutoExpandFromSummaries(summaries);
    } catch {
      // ignore
    }
  }, [localProject._id, applyAutoExpandFromSummaries]);

  useEffect(() => {
    void fetchCommentSummaries();
  }, [fetchCommentSummaries]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchCommentSummaries();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchCommentSummaries]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchCommentSummaries();
      }
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, [fetchCommentSummaries]);

  useEffect(() => {
    applyAutoExpandFromSummaries(commentSummaries);
  }, [projectContentItems, commentSummaries, applyAutoExpandFromSummaries]);

  useEffect(() => {
    if (project._id.toString() !== localProject._id.toString()) {
      setLocalProject(project);
      setLocalDismissedChecklistIds(null);
      setViewTab('tasks');
      initialTaskAppliedKeyRef.current = null;
      autoAddTaskAppliedKeyRef.current = null;
      return;
    }
    setLocalProject((prev) => {
      const pAt = (project as { updatedAt?: string | Date }).updatedAt;
      const prevAt = (prev as { updatedAt?: string | Date }).updatedAt;
      if (pAt != null && prevAt != null && new Date(pAt).getTime() === new Date(prevAt).getTime()) return prev;
      return project;
    });
  }, [project, localProject._id]);

  useEffect(() => {
    if (initialOpenTaskIndex == null) {
      initialTaskAppliedKeyRef.current = null;
      return;
    }
    const key = `${project._id.toString()}-${initialOpenTaskIndex}`;
    if (initialTaskAppliedKeyRef.current === key) return;
    const tasks = project.tasks || [];
    if (initialOpenTaskIndex < 0 || initialOpenTaskIndex >= tasks.length) {
      onInitialOpenTaskConsumed?.();
      return;
    }
    initialTaskAppliedKeyRef.current = key;
    const t = tasks[initialOpenTaskIndex];
    setViewTab('tasks');
    setTaskTab(t.status === 'completed' ? 'completed' : 'active');
    setSelectedTaskIndex(initialOpenTaskIndex);
    setExpandedTaskComments((prev) => new Set(prev).add(initialOpenTaskIndex));
    const taskIdx = initialOpenTaskIndex;
    scrollElementIntoContainerAfterLayout(
      () => document.getElementById(`inspector-task-row-${taskIdx}`),
      scrollContainerRef?.current ?? null,
      { block: 'center', behavior: 'smooth' }
    );
    onInitialOpenTaskConsumed?.();
  }, [initialOpenTaskIndex, project._id, project.tasks, onInitialOpenTaskConsumed, scrollContainerRef]);

  useEffect(() => {
    if (initialOpenContentId == null) {
      initialContentAppliedKeyRef.current = null;
      return;
    }
    const key = `${project._id.toString()}-${initialOpenContentId}`;
    if (initialContentAppliedKeyRef.current === key) return;
    const item = projectContentItems.find((c) => c._id.toString() === initialOpenContentId);
    if (!item) return;

    initialContentAppliedKeyRef.current = key;
    const contentId = initialOpenContentId;
    setViewTab('content');
    setContentTab(item.status === 'published' ? 'completed' : 'active');
    setExpandedContentComments((prev) => new Set(prev).add(contentId));
    scrollElementIntoContainerAfterLayout(
      () => document.getElementById(`inspector-content-row-${contentId}`),
      scrollContainerRef?.current ?? null,
      { block: 'center', behavior: 'smooth' }
    );
    onInitialOpenContentConsumed?.();
  }, [
    initialOpenContentId,
    project._id,
    projectContentItems,
    onInitialOpenContentConsumed,
    scrollContainerRef,
  ]);

  useEffect(() => {
    if (pendingScrollToTaskIndex == null) return;
    const idx = pendingScrollToTaskIndex;
    const tasks = localProject.tasks || [];
    if (idx < 0 || idx >= tasks.length) return;
    setPendingScrollToTaskIndex(null);
    scrollElementIntoContainerAfterLayout(
      () => document.getElementById(`inspector-task-row-${idx}`),
      scrollContainerRef?.current ?? null,
      { block: 'center', behavior: 'smooth' }
    );
  }, [localProject.tasks, pendingScrollToTaskIndex, scrollContainerRef]);

  // Fetch project action buttons (smart buttons)
  useEffect(() => {
    const fetchButtons = async () => {
      try {
        const res = await fetch(`/api/projects/${localProject._id}/buttons`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : (data.actionButtons || []);
          setActionButtons(normalizeActionButtonsList(arr));
        }
      } catch (e) {
        // ignore
      }
    };
    fetchButtons();
  }, [localProject._id]);

  useEffect(() => {
    const fetchProjectContent = async () => {
      try {
        const res = await fetch(`/api/content-items?projectId=${localProject._id}`);
        if (res.ok) {
          const data = await res.json();
          setProjectContentItems(Array.isArray(data) ? data : []);
        }
      } catch {
        setProjectContentItems([]);
      }
    };
    fetchProjectContent();
  }, [localProject._id, contentRefreshTrigger]);

  const handleDeleteContentItem = async (item: IContentItem) => {
    if (!confirm('Delete this content item? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/content-items/${item._id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjectContentItems((prev) => prev.filter((c) => c._id.toString() !== item._id.toString()));
        notifyContentListChanged();
        onRefresh();
      }
    } catch {
      // ignore
    }
  };

  const handleContentItemHoursUpdate = async (item: IContentItem, hours: number | null) => {
    const id = item._id.toString();
    const previousHours = item.estimatedHours;
    setProjectContentItems((prev) =>
      prev.map((c) =>
        c._id.toString() === id ? ({ ...c, estimatedHours: hours ?? undefined } as IContentItem) : c
      )
    );
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedHours: hours ?? undefined }),
      });
      if (!res.ok) throw new Error('save failed');
      notifyContentListChanged();
    } catch {
      setProjectContentItems((prev) =>
        prev.map((c) =>
          c._id.toString() === id ? ({ ...c, estimatedHours: previousHours } as IContentItem) : c
        )
      );
    }
  };

  const handleContentItemPublishDateUpdate = async (item: IContentItem, date: Date | null) => {
    const id = item._id.toString();
    const previousPublishDate = item.publishDate;
    setProjectContentItems((prev) =>
      prev.map((c) =>
        c._id.toString() === id
          ? ({ ...c, publishDate: date ?? undefined } as IContentItem)
          : c
      )
    );
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishDate: date ? date.toISOString() : undefined }),
      });
      if (!res.ok) throw new Error('save failed');
      notifyContentListChanged();
    } catch {
      setProjectContentItems((prev) =>
        prev.map((c) =>
          c._id.toString() === id
            ? ({ ...c, publishDate: previousPublishDate } as IContentItem)
            : c
        )
      );
    }
  };

  const handleContentItemAssigneeUpdate = async (item: IContentItem, employeeId: string) => {
    const id = item._id.toString();
    const previousAssignee = item.assignedToEmployeeId;
    setProjectContentItems((prev) =>
      prev.map((c) =>
        c._id.toString() === id
          ? ({ ...c, assignedToEmployeeId: (employeeId || undefined) as IContentItem['assignedToEmployeeId'] } as IContentItem)
          : c
      )
    );
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToEmployeeId: employeeId || undefined }),
      });
      if (!res.ok) throw new Error('save failed');
      notifyContentListChanged();
    } catch {
      setProjectContentItems((prev) =>
        prev.map((c) =>
          c._id.toString() === id
            ? ({ ...c, assignedToEmployeeId: previousAssignee } as IContentItem)
            : c
        )
      );
    }
  };

  const canEditContentItemStatus = useCallback(
    (item: IContentItem): boolean => {
      if (isManagerOrAdmin) return true;
      if (!currentUserEmployeeId) return false;
      return item.assignedToEmployeeId?.toString() === currentUserEmployeeId;
    },
    [currentUserEmployeeId, isManagerOrAdmin]
  );

  const handleContentItemStatusUpdate = async (item: IContentItem, status: ContentStatus) => {
    const id = item._id.toString();
    const previousStatus = item.status;
    setProjectContentItems((prev) =>
      prev.map((c) =>
        c._id.toString() === id ? ({ ...c, status } as IContentItem) : c
      )
    );
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not update content status.');
      }
      if (previousStatus !== 'published' && status === 'published') {
        setContentAssetsRefreshToken((n) => n + 1);
        await loadLinkedAssets();
      }
      notifyContentListChanged();
    } catch (error) {
      setProjectContentItems((prev) =>
        prev.map((c) =>
          c._id.toString() === id ? ({ ...c, status: previousStatus } as IContentItem) : c
        )
      );
      alert(error instanceof Error ? error.message : 'Could not update content status.');
    }
  };

  const handleFieldUpdate = async (field: string, value: any) => {
    setLocalProject(prev => ({ ...prev, [field]: value } as IProject));
    try {
      const updates = { [field]: value };
      await onUpdate(updates);
    } catch (error) {
      console.error('Error in handleFieldUpdate:', error);
      setLocalProject(project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const handleLogoUpdate = useCallback(
    (logoUrl: string | undefined) => {
      setLocalProject((prev) => {
        const next = { ...prev, logo: logoUrl } as IProject;
        onProjectPatched?.(next);
        return next;
      });
    },
    [onProjectPatched]
  );

  const openPaletteSheet = useCallback(() => {
    const pal = localProject.colorPalette;
    const initial =
      Array.isArray(pal) && pal.length > 0 ? pal.map((c) => String(c)) : [localProject.color || '#3b82f6'];
    setPaletteDraft(initial.length > 0 ? initial : ['#3b82f6']);
    setPaletteSheetOpen(true);
  }, [localProject.colorPalette, localProject.color]);

  const savePaletteFromDraft = async () => {
    const sanitized: string[] = [];
    for (let i = 0; i < paletteDraft.length; i++) {
      const t = paletteDraft[i].trim();
      if (!t) continue;
      const p = parseCssColorInput(t);
      if (!p.ok) {
        alert(`Invalid ${labelForPaletteIndex(i)}: ${t}. Use #hex or rgb() / rgba().`);
        return;
      }
      sanitized.push(p.normalized);
    }
    setPaletteSaving(true);
    const nextColor = sanitized.length > 0 ? sanitized[0] : localProject.color;
    setLocalProject((prev) => ({ ...prev, colorPalette: sanitized as string[], color: nextColor } as IProject));
    try {
      await onUpdate({
        colorPalette: sanitized,
        ...(sanitized.length > 0 ? { color: sanitized[0] } : {}),
      });
      setPaletteSheetOpen(false);
    } catch (error) {
      console.error('Error saving palette:', error);
      setLocalProject(project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setPaletteSaving(false);
    }
  };

  const clearPalette = async () => {
    setPaletteSaving(true);
    setPaletteDraft(['']);
    setLocalProject((prev) => ({ ...prev, colorPalette: [] as string[], color: prev.color } as IProject));
    try {
      await onUpdate({ colorPalette: [] });
      setPaletteSheetOpen(false);
    } catch (error) {
      console.error('Error clearing palette:', error);
      setLocalProject(project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setPaletteSaving(false);
    }
  };

  const openFontSheet = useCallback(() => {
    const pal = localProject.fontPalette;
    const initial =
      Array.isArray(pal) && pal.length > 0 ? pal.map((f) => String(f)) : [''];
    setFontDraft(initial.length > 0 ? initial : ['']);
    setFontSheetOpen(true);
  }, [localProject.fontPalette]);

  const saveFontFromDraft = async () => {
    const sanitized: string[] = [];
    for (let i = 0; i < fontDraft.length; i++) {
      const t = fontDraft[i].trim();
      if (!t) {
        if (i === 0) {
          alert('Primary font is required. Enter a font family name.');
          return;
        }
        continue;
      }
      const p = parseFontFamilyInput(t);
      if (!p.ok) {
        alert(
          `Invalid ${labelForFontPaletteIndex(i)}: ${t}. Use letters, numbers, spaces, commas, quotes, or hyphens.`
        );
        return;
      }
      sanitized.push(p.normalized);
    }
    if (sanitized.length === 0) {
      alert('Add at least one valid font.');
      return;
    }
    if (sanitized.length > maxFontPaletteEntries) {
      alert(`You can save at most ${maxFontPaletteEntries} fonts.`);
      return;
    }
    setFontSaving(true);
    setLocalProject((prev) => ({ ...prev, fontPalette: sanitized } as IProject));
    try {
      await onUpdate({ fontPalette: sanitized });
      setFontSheetOpen(false);
    } catch (error) {
      console.error('Error saving fonts:', error);
      setLocalProject(project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setFontSaving(false);
    }
  };

  const handleTaskUpdate = async (taskIndex: number, field: string, value: any) => {
    if (field === 'status' && !isManagerOrAdmin) {
      const previousTasks = [...(localProject.tasks || [])];
      const optimisticTasks = [...previousTasks];
      const existingTask = optimisticTasks[taskIndex];
      if (!existingTask) return;
      optimisticTasks[taskIndex] = { ...existingTask, status: value };
      setLocalProject((prev) => ({ ...prev, tasks: optimisticTasks } as IProject));
      try {
        const taskId = (existingTask as { _id?: { toString?: () => string } })._id?.toString?.();
        const response = await fetch(`/api/tasks/${taskIndex}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: localProjectRef.current._id.toString(),
            taskIndex,
            taskId,
            status: value,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update task status');
        }
        const data = (await response.json()) as {
          task?: { status?: TaskStatus };
          status?: TaskStatus;
        };
        const savedStatus = data.task?.status ?? data.status ?? value;
        setLocalProject((prev) => {
          const tasks = [...(prev.tasks || [])];
          const task = tasks[taskIndex];
          if (task) tasks[taskIndex] = { ...task, status: savedStatus };
          return { ...prev, tasks } as IProject;
        });
        const wasCompleted = existingTask.status === 'completed';
        if (!wasCompleted && savedStatus === 'completed') {
          setTaskAssetsRefreshToken((n) => n + 1);
          await loadLinkedAssets();
        }
      } catch (error) {
        console.error('Error updating task status:', error);
        setLocalProject((prev) => ({ ...prev, tasks: previousTasks } as IProject));
        alert(error instanceof Error ? error.message : 'Failed to save');
      }
      return;
    }

    const updatedTasks = [...(localProject.tasks || [])];
    const previousStatus = updatedTasks[taskIndex]?.status;
    const updatedTask = { ...updatedTasks[taskIndex], [field]: value };

    // Optimistically update the name if the ID changes
    if (field === 'assignedToEmployeeId') {
      const emp = employees.find(e => e._id.toString() === value);
      updatedTask.assignedTo = emp ? emp.name : undefined;
    }
    if (field === 'assignedToEmployeeIds') {
      const ids = Array.isArray(value) ? value : [];
      updatedTask.assignedToEmployeeIds = ids;
      updatedTask.assignedToEmployeeId = ids[0] ?? undefined;
      const names = ids
        .map((id: string) => employees.find((e) => e._id.toString() === id)?.name)
        .filter(Boolean);
      updatedTask.assignedTo = names.length > 0 ? names.join(', ') : undefined;
    }

    updatedTasks[taskIndex] = updatedTask;
    const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(localProject, updatedTasks);
    setLocalProject((prev) => ({ ...prev, tasks: tasksToSave } as IProject));
    try {
      await onUpdate({ tasks: tasksToSave });
      if (field === 'status' && previousStatus !== 'completed' && value === 'completed') {
        setTaskAssetsRefreshToken((n) => n + 1);
        await loadLinkedAssets();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setLocalProject(project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const applyTaskEstimatedHours = useCallback(
    async (taskIndex: number, hours: number, titleFallback: string) => {
      const proj = localProjectRef.current;
      const updatedTasks = [...(proj.tasks || [])];
      const task = updatedTasks[taskIndex];
      if (!task) return;
      const mergedName = task.name?.trim() || titleFallback.trim();
      updatedTasks[taskIndex] = {
        ...task,
        estimatedHours: hours,
        name: mergedName,
      };
      const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(proj, updatedTasks);
      setLocalProject((prev) => ({ ...prev, tasks: tasksToSave } as IProject));
      try {
        await onUpdate({ tasks: tasksToSave });
      } catch (error) {
        console.error('Error updating estimated hours:', error);
        setLocalProject((prev) => {
          const tasks = [...(prev.tasks || [])];
          if (tasks[taskIndex]) {
            tasks[taskIndex] = { ...tasks[taskIndex], estimatedHours: task.estimatedHours };
          }
          return { ...prev, tasks } as IProject;
        });
        throw error;
      }
    },
    [onUpdate]
  );

  const scheduleTaskHourEstimate = useCallback((taskIndex: number, title: string) => {
    const timers = estimateTimersRef.current;
    const existing = timers.get(taskIndex);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      timers.delete(taskIndex);
      const trimmed = title.trim();
      if (!trimmed) return;

      const proj = localProjectRef.current;
      const task = (proj.tasks || [])[taskIndex];
      if (!task) return;
      const currentHours =
        typeof task.estimatedHours === 'number'
          ? task.estimatedHours
          : parseFloat(String(task.estimatedHours ?? ''));
      if (Number.isFinite(currentHours) && currentHours > 0) return;

      setEstimatingTaskIndices((prev) => new Set(prev).add(taskIndex));
      try {
        const hours = await fetchEstimatedHours({
          kind: 'task',
          title: trimmed,
          description: task.description,
          projectName: proj.name,
        });
        if (hours != null) {
          await applyTaskEstimatedHours(taskIndex, hours, trimmed);
        }
      } finally {
        setEstimatingTaskIndices((prev) => {
          const next = new Set(prev);
          next.delete(taskIndex);
          return next;
        });
      }
    }, 600);
    timers.set(taskIndex, timer);
  }, [applyTaskEstimatedHours]);

  const handleTaskNameSave = async (taskIndex: number, name: string) => {
    await handleTaskUpdate(taskIndex, 'name', name);
    scheduleTaskHourEstimate(taskIndex, name);
  };

  useEffect(() => () => {
    estimateTimersRef.current.forEach((t) => clearTimeout(t));
  }, []);

  const computedProjectHours = useMemo(
    () => computeProjectEstimatedHours(localProject, projectContentItems, timeframe, referenceDate),
    [localProject, projectContentItems, timeframe, referenceDate]
  );

  useEffect(() => {
    if (hoursSyncRef.current) return;
    const stored = localProject.estimatedHours ?? 0;
    if (Math.abs(stored - computedProjectHours) < 0.005) return;
    hoursSyncRef.current = true;
    onUpdate({ estimatedHours: computedProjectHours })
      .then(() => {
        setLocalProject((prev) => ({ ...prev, estimatedHours: computedProjectHours } as IProject));
      })
      .catch(() => {})
      .finally(() => {
        hoursSyncRef.current = false;
      });
  }, [computedProjectHours, localProject.estimatedHours, onUpdate]);

  const handleSubmitForReview = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'in-review'); setShowTaskActions(false); };
  const handleCompleteTask = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'completed'); setShowTaskActions(false); };
  const handleDeclineReview = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'active'); setShowTaskActions(false); };
  const handleDeleteTask = async (taskIndex: number) => {
    const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(
      localProject,
      (localProject.tasks || []).filter((_, idx) => idx !== taskIndex)
    );
    await onUpdate({ tasks: tasksToSave });
    setShowTaskActions(false);
    setSelectedTaskIndex(null);
  };
  const canContributeToProject = canUserContributeToProject(
    localProject,
    currentUserEmployeeId ?? null,
    isManagerOrAdmin
  );

  const commitAddTasks = async (tasksToAppend: NonNullable<IProject['tasks']>) => {
    const prevTasks = localProject.tasks || [];
    const newIdx = prevTasks.length + tasksToAppend.length - 1;

    if (!isManagerOrAdmin) {
      setLocalProject((prev) => ({
        ...prev,
        tasks: [...prevTasks, ...tasksToAppend],
      } as IProject));
      try {
        const res = await fetch(`/api/projects/${localProject._id.toString()}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: tasksToAppend }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add task');
        }
        const data = (await res.json()) as { tasks: IProject['tasks']; addedFromIndex?: number };
        const nextProject = { ...localProject, tasks: data.tasks ?? localProject.tasks } as IProject;
        setLocalProject(nextProject);
        onProjectPatched?.(nextProject);
        setViewTab('tasks');
        setTaskTab('active');
        setAutoEditTaskIndex(data.addedFromIndex ?? newIdx);
        setPendingScrollToTaskIndex(data.addedFromIndex ?? newIdx);
        return;
      } catch (error) {
        console.error('Error adding task:', error);
        setLocalProject(project);
        setPendingScrollToTaskIndex(null);
        setAutoEditTaskIndex(null);
        alert(error instanceof Error ? error.message : 'Failed to save');
        throw error;
      }
    }

    const nextTasks = [...prevTasks, ...tasksToAppend];
    const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(localProject, nextTasks);
    const addedIdx = tasksToSave.length - 1;
    setLocalProject((prev) => ({ ...prev, tasks: tasksToSave } as IProject));
    try {
      await onUpdate({ tasks: tasksToSave });
      setViewTab('tasks');
      setTaskTab('active');
      setAutoEditTaskIndex(addedIdx);
      setPendingScrollToTaskIndex(addedIdx);
    } catch (error) {
      console.error('Error adding task:', error);
      setLocalProject(project);
      setPendingScrollToTaskIndex(null);
      setAutoEditTaskIndex(null);
      alert(error instanceof Error ? error.message : 'Failed to save');
      throw error;
    }
  };

  const applyTaskRecurrence = useCallback(
    async (taskIndex: number, recurrence: TaskRecurrenceValue) => {
      if (recurrence.preset === 'none') return;

      const tasks = localProjectRef.current.tasks || [];
      const task = tasks[taskIndex];
      if (!task || task.recurrenceSeriesId) return;

      try {
        const until =
          recurrence.end === 'on' && recurrence.until
            ? new Date(`${recurrence.until}T23:59:59`)
            : undefined;
        const instances = expandTaskInstances(task, {
          preset: recurrence.preset,
          end: recurrence.end,
          until,
          count: recurrence.count,
        });
        const nextTasks = [
          ...tasks.slice(0, taskIndex),
          ...instances,
          ...tasks.slice(taskIndex + 1),
        ];
        const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(
          localProjectRef.current,
          nextTasks
        );
        setLocalProject((prev) => ({ ...prev, tasks: tasksToSave } as IProject));
        await onUpdate({ tasks: tasksToSave });
        setViewTab('tasks');
        setTaskTab('active');
        setAutoEditTaskIndex(taskIndex);
        setPendingScrollToTaskIndex(taskIndex);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Invalid recurrence settings');
      }
    },
    [onUpdate]
  );

  const handleAddTask = async () => {
    const newTask = {
      name: '',
      description: '',
      status: 'active' as TaskStatus,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedHours: 0,
    };
    await commitAddTasks([newTask]);
  };

  useEffect(() => {
    if (!autoAddTaskOnOpen) {
      autoAddTaskAppliedKeyRef.current = null;
      return;
    }
    if (!canContributeToProject) {
      onAutoAddTaskConsumed?.();
      return;
    }
    const key = project._id.toString();
    if (autoAddTaskAppliedKeyRef.current === key) return;
    autoAddTaskAppliedKeyRef.current = key;
    void handleAddTask().finally(() => onAutoAddTaskConsumed?.());
  }, [autoAddTaskOnOpen, isManagerOrAdmin, project._id, onAutoAddTaskConsumed]);

  const handleCopyPalette = async () => {
    const text = formatColorPaletteForCopy(paletteDraft);
    if (!text) {
      alert('Add at least one valid color to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setPaletteCopyFeedback(true);
      window.setTimeout(() => setPaletteCopyFeedback(false), 2000);
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  const statusOptions = [{ value: 'planning', label: 'Planning', color: '#3b82f6' }, { value: 'in-development', label: 'Building', color: '#22c55e' }, { value: 'launched', label: 'Running', color: '#a855f7' }, { value: 'completed', label: 'Completed', color: '#10b981' }];
  const projectTypeOptions = [{ value: 'internal', label: 'Internal' }, { value: 'client', label: 'Client' }];
  const categoryOptions = [{ value: 'website', label: 'Website' }, { value: 'store', label: 'Store' }, { value: 'app', label: 'App' }, { value: 'generic', label: 'Generic' }];
  const taskStatusOptions = [{ value: 'active', label: 'Active', color: '#3b82f6' }, { value: 'in-review', label: 'In Review', color: '#f59e0b' }, { value: 'completed', label: 'Completed', color: '#22c55e' }];
  const contentStatusOptions: { value: ContentStatus; label: string; color: string }[] = [
    { value: 'idea', label: 'Idea', color: '#6b7280' },
    { value: 'planned', label: 'Planned', color: '#3b82f6' },
    { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
    { value: 'ready', label: 'Ready', color: '#22c55e' },
    { value: 'published', label: 'Published', color: '#8b5cf6' },
  ];
  const hasEndDate = !!localProject.endDate;
  const compactFieldLabelClass =
    'text-sm text-gray-500 rounded px-1 py-0.5 transition-colors hover:bg-gray-100';

  const dismissedChecklistIds = useMemo(() => {
    const raw = localDismissedChecklistIds ?? localProject.dismissedChecklistIds ?? [];
    return raw.map((id) => id.toString());
  }, [
    localDismissedChecklistIds,
    (localProject.dismissedChecklistIds ?? []).map((id) => id.toString()).join(','),
  ]);

  return (
    <div className="space-y-4">
      {/* Project Header Card */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <ProjectLogo
            projectId={localProject._id.toString()}
            logo={localProject.logo}
            color={localProject.color || '#3b82f6'}
            isManagerOrAdmin={isManagerOrAdmin}
            onLogoUpdate={handleLogoUpdate}
          />
          <div className="flex-1 min-w-0">
            <EditableText value={localProject.name} onSave={(v) => handleFieldUpdate('name', v)} className="text-xl font-bold text-gray-900 block w-full" placeholder="Project name" disabled={!isManagerOrAdmin} />
            <EditableText value={localProject.description || ''} onSave={(v) => handleFieldUpdate('description', v)} className="text-gray-600 mt-1 block w-full" placeholder="Add description..." multiline disabled={!isManagerOrAdmin} />
          </div>
          <EditableSelect value={localProject.status} options={statusOptions} onSave={(v) => handleFieldUpdate('status', v)} showColorDot disabled={!isManagerOrAdmin} />
        </div>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm"><span className="text-gray-500">Type:</span><EditableSelect value={localProject.projectType || 'client'} options={projectTypeOptions} onSave={(v) => handleFieldUpdate('projectType', v)} className="text-gray-900" disabled={!isManagerOrAdmin} /></div>
          <div className="flex items-center gap-2 text-sm"><span className="text-gray-500">Category:</span><EditableSelect value={localProject.category || 'generic'} options={categoryOptions} onSave={(v) => handleFieldUpdate('category', v)} className="text-gray-900" disabled={!isManagerOrAdmin} /></div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Est. Hours:</span>
            <span className="font-medium text-gray-900">{computedProjectHours}h</span>
          </div>
          {hasEndDate || editingEndDate ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">End Date:</span>
              <EditableDate
                value={localProject.endDate ?? null}
                onSave={(v) => handleFieldUpdate('endDate', v)}
                className="text-gray-900"
                clearable
                disabled={!isManagerOrAdmin}
                hideWhenEmpty
                startInEditMode={editingEndDate}
                onEditEnd={() => setEditingEndDate(false)}
              />
            </div>
          ) : isManagerOrAdmin ? (
            <button type="button" onClick={() => setEditingEndDate(true)} className={compactFieldLabelClass}>
              End Date
            </button>
          ) : (
            <span className="text-sm text-gray-500">End Date</span>
          )}
          {isManagerOrAdmin && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => openPaletteSheet()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50"
              >
                <span className="flex -space-x-1" aria-hidden>
                  {paletteChipSwatches.map((swatch, i) => (
                    <span
                      key={`${swatch}-${i}`}
                      className="inline-block h-4 w-4 rounded-full border border-white ring-1 ring-gray-300 shadow-sm"
                      style={{ backgroundColor: swatch, zIndex: paletteChipSwatches.length - i }}
                    />
                  ))}
                </span>
                Color palette
              </button>
              <button
                type="button"
                onClick={() => openFontSheet()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50"
              >
                {fontChipPreview.length > 0 ? (
                  <span
                    className="text-xs text-gray-600 max-w-[10rem] truncate"
                    style={
                      fontChipPreview[0] &&
                      /^[\p{L}\p{N}\s\-]+$/u.test(fontChipPreview[0]) &&
                      !fontChipPreview[0].includes(',')
                        ? { fontFamily: fontChipPreview[0] }
                        : undefined
                    }
                    title={fontChipPreview.join(', ')}
                    aria-hidden
                  >
                    {fontChipPreview
                      .map((name) => (name.length > 14 ? `${name.slice(0, 12)}…` : name))
                      .join(' · ')}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400" aria-hidden>
                    Aa
                  </span>
                )}
                Fonts
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm min-w-0">
            {isManagerOrAdmin ? (
              <>
                <EditableText
                  value={localProject.devUrl ?? ''}
                  onSave={async (v) => {
                    await handleFieldUpdate('devUrl', v.trim());
                  }}
                  className="min-w-0 max-w-[11rem] sm:max-w-[14rem] text-gray-900"
                  placeholder="Dev URL"
                />
                {normalizeProjectUrlHref(localProject.devUrl ?? '') ? (
                  <a
                    href={normalizeProjectUrlHref(localProject.devUrl ?? '')!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center rounded-lg border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Open
                  </a>
                ) : null}
              </>
            ) : normalizeProjectUrlHref(localProject.devUrl ?? '') ? (
              <a
                href={normalizeProjectUrlHref(localProject.devUrl ?? '')!}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline max-w-[11rem] sm:max-w-[14rem] text-blue-600"
              >
                {truncateProjectUrlDisplay(localProject.devUrl ?? '', 40)}
              </a>
            ) : (
              <span className="text-gray-400">Not set</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm min-w-0">
            {isManagerOrAdmin ? (
              <>
                <EditableText
                  value={localProject.liveUrl ?? ''}
                  onSave={async (v) => {
                    await handleFieldUpdate('liveUrl', v.trim());
                  }}
                  className="min-w-0 max-w-[11rem] sm:max-w-[14rem] text-gray-900"
                  placeholder="Live URL"
                />
                {normalizeProjectUrlHref(localProject.liveUrl ?? '') ? (
                  <a
                    href={normalizeProjectUrlHref(localProject.liveUrl ?? '')!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center rounded-lg border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Open
                  </a>
                ) : null}
              </>
            ) : normalizeProjectUrlHref(localProject.liveUrl ?? '') ? (
              <a
                href={normalizeProjectUrlHref(localProject.liveUrl ?? '')!}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline max-w-[11rem] sm:max-w-[14rem] text-blue-600"
              >
                {truncateProjectUrlDisplay(localProject.liveUrl ?? '', 40)}
              </a>
            ) : (
              <span className="text-gray-400">Not set</span>
            )}
          </div>
          <ProjectSocialsBar
            socialLinks={(localProject.socialLinks ?? []) as IProjectSocialLink[]}
            socialsToolbarVisible={localProject.socialsToolbarVisible !== false}
            isManagerOrAdmin={isManagerOrAdmin}
            onUpdate={async (updates) => {
              setLocalProject((prev) => ({ ...prev, ...updates } as IProject));
              try {
                await onUpdate(updates);
              } catch (error) {
                setLocalProject(project);
                alert(error instanceof Error ? error.message : 'Failed to save');
              }
            }}
          />
        </div>
        {isManagerOrAdmin && employees.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <MultiSelect
              label="Assigned to (project)"
              value={(() => {
                const ids = localProject.assignedToEmployeeIds ?? [];
                if (ids.length > 0) return ids.map((id: unknown) => typeof id === 'string' ? id : (id as { toString(): string }).toString());
                const single = (localProject as { assignedToEmployeeId?: unknown }).assignedToEmployeeId;
                return single ? [typeof single === 'string' ? single : (single as { toString(): string }).toString()] : [];
              })()}
              onChange={(selectedIds) => handleFieldUpdate('assignedToEmployeeIds', selectedIds)}
              options={employees.map((emp) => ({ value: emp._id.toString(), label: emp.name }))}
              disabled={!isManagerOrAdmin}
            />
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
          {actionButtons.map((btn, idx) => {
            const isEmail = btn.kind === 'email';
            const pillClass = isEmail
              ? 'inline-flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-1.5 text-sm'
              : 'inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm';
            const linkClass = isEmail
              ? 'font-medium text-violet-800 hover:underline truncate max-w-[160px]'
              : 'font-medium text-indigo-700 hover:underline truncate max-w-[180px]';
            const iconMuted = isEmail
              ? 'text-violet-600 hover:text-violet-900'
              : 'text-indigo-500 hover:text-red-600';

            const emailLink = isEmail ? emailSmartButtonHref(btn.url) : null;
            const linkHref = emailLink?.href ?? btn.url;
            const openLinkInNewTab = isEmail ? !!emailLink?.openInNewTab : true;

            return (
              <span key={idx} className={pillClass}>
                <a
                  href={linkHref}
                  {...(openLinkInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={linkClass}
                >
                  {btn.label}
                </a>
                {isEmail && btn.password != null && btn.password !== '' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCredentialReveal(false);
                      setCredentialSheetMode('view');
                      setCredentialSheet({
                        index: idx,
                        label: btn.label,
                        url: btn.url,
                        password: btn.password ?? '',
                      });
                    }}
                    className={`p-0.5 shrink-0 rounded touch-manipulation ${iconMuted}`}
                    aria-label="Show mailbox password"
                    title="Password"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                )}
                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch(`/api/projects/${localProject._id}/buttons`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ index: idx }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const arr = Array.isArray(data) ? data : [];
                        setActionButtons(normalizeActionButtonsList(arr));
                      }
                    }}
                    className={`${iconMuted} p-0.5 shrink-0`}
                    aria-label="Remove button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </span>
            );
          })}
          <AddButton
            projectId={localProject._id.toString()}
            phase={mapStatusToStage(localProject.status)}
            projectType={localProject.projectType || 'generic'}
            isManagerOrAdmin={isManagerOrAdmin}
            socialsToolbarHidden={localProject.socialsToolbarVisible === false}
            onAddSocial={async (url) => {
              const parsed = parseSocialLinkInput(url);
              if (!parsed) throw new Error('Invalid URL');
              const existing = (localProject.socialLinks ?? []) as IProjectSocialLink[];
              if (existing.some((l) => l.url === parsed.url)) {
                alert('That social link is already on this project.');
                return;
              }
              await handleFieldUpdate('socialLinks', [...existing, parsed]);
            }}
            onAddButton={async (payload: AddSmartButtonPayload) => {
              const body =
                payload.kind === 'email'
                  ? {
                      kind: 'email',
                      email: payload.email,
                      ...(payload.password?.trim() ? { password: payload.password.trim() } : {}),
                      ...(payload.label ? { label: payload.label } : {}),
                    }
                  : { label: payload.label, url: payload.url };
              const res = await fetch(`/api/projects/${localProject._id}/buttons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (res.ok) {
                const data = await res.json();
                const arr = Array.isArray(data) ? data : [];
                setActionButtons(normalizeActionButtonsList(arr));
              }
            }}
            onDocumentCreated={() => {
              void loadLinkedAssets();
              setTaskAssetsRefreshToken((n) => n + 1);
            }}
          />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Linked assets</h4>
          {linkedAssetsLoading ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : linkedAssets.length === 0 ? (
            <p className="text-xs text-gray-500">
              No linked assets yet. Use Add → Document or link items from the Assets page.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => setLinkedAssetTypeFilter('')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors touch-manipulation ${
                    !linkedAssetTypeFilter
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All ({linkedAssets.length})
                </button>
                {linkedAssetTypesInUse.map((t) => {
                  const count = linkedAssetTypeCounts.get(t) ?? 0;
                  const active = linkedAssetTypeFilter === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLinkedAssetTypeFilter(active ? '' : t)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors touch-manipulation ${
                        active
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-medium'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {formatLinkedAssetTypeLabel(t)} ({count})
                    </button>
                  );
                })}
              </div>
              {visibleLinkedAssets.length === 0 ? (
                <p className="text-xs text-gray-500">No assets match this type filter.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {visibleLinkedAssets.map((asset) => {
                    const chipClass =
                      'relative group inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 max-w-[260px]';
                    const href = linkedAssetOpenHref(asset);
                    const deleteBtn = canUserDeleteAsset(asset.userId, currentUserId, isManagerOrAdmin) ? (
                      <HoverDeleteButton
                        label={`Delete asset ${asset.name}`}
                        onClick={() => setAssetPendingDelete(asset)}
                      />
                    ) : null;

                    if (isTextDocumentAssetType(asset.type)) {
                      return (
                        <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
                          <button
                            type="button"
                            onClick={() => setPreviewAsset(asset)}
                            className="truncate flex-1 min-w-0 text-left hover:underline touch-manipulation"
                          >
                            {asset.name}
                          </button>
                          {deleteBtn}
                        </span>
                      );
                    }

                    if (asset.type === 'screenshot' && href) {
                      return (
                        <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
                          <button
                            type="button"
                            onClick={() => setPreviewImage({ src: href, title: asset.name })}
                            className="truncate hover:underline min-w-0 flex-1 text-left touch-manipulation"
                          >
                            {asset.name}
                          </button>
                          {deleteBtn}
                        </span>
                      );
                    }

                    if (href) {
                      return (
                        <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate hover:underline min-w-0 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {asset.name}
                          </a>
                          {deleteBtn}
                        </span>
                      );
                    }

                    return (
                      <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
                        <Link
                          href={`/assets?projectId=${localProject._id.toString()}`}
                          className="truncate hover:underline min-w-0 flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {asset.name}
                        </Link>
                        <span className="text-xs shrink-0 opacity-80">· Assets</span>
                        {deleteBtn}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <LinkedRecordingChips
                  projectId={localProject._id.toString()}
                  refreshToken={taskAssetsRefreshToken}
                  chipClassName="relative group inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 max-w-[260px]"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checklist (replaces Smart buttons) */}
      <ChecklistSection
        projectId={localProject._id.toString()}
        phase={mapStatusToStage(localProject.status)}
        projectType={localProject.category || 'generic'}
        actionButtons={actionButtons}
        dismissedChecklistIds={dismissedChecklistIds}
        isManagerOrAdmin={isManagerOrAdmin}
        onUpdate={async (updates) => {
          await onUpdate(updates as Partial<IProject>);
          if (updates.dismissedChecklistIds !== undefined) {
            setLocalDismissedChecklistIds(updates.dismissedChecklistIds);
          }
        }}
        onRefreshButtons={async () => {
          const res = await fetch(`/api/projects/${localProject._id}/buttons`);
          if (res.ok) {
            const data = await res.json();
            const arr = Array.isArray(data) ? data : [];
            setActionButtons(normalizeActionButtonsList(arr));
          }
        }}
      />

      {/* Tasks / Content – tabbed */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-1 p-2 border-b border-gray-100">
          <button type="button" onClick={() => setViewTab('tasks')} className={`px-3 py-2 rounded text-sm font-medium ${viewTab === 'tasks' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}>Tasks ({localProject.tasks?.length || 0})</button>
          <button type="button" onClick={() => setViewTab('content')} className={`px-3 py-2 rounded text-sm font-medium ${viewTab === 'content' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}>Content ({projectContentItems.length})</button>

          <div className="ml-auto flex gap-2">
            {viewTab === 'tasks' && canContributeToProject && <Button size="sm" onClick={() => void handleAddTask()}>+ Add Task</Button>}
            {viewTab === 'content' && onAddContent && canAddContentToProject(localProject, isManagerOrAdmin, currentUserEmployeeId ?? null) && <Button size="sm" variant="secondary" onClick={() => onAddContent(localProject)}>+ Add Content</Button>}
          </div>
        </div>

        {viewTab === 'content' ? (
          <div className="p-4">
            <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
              <button onClick={() => setContentTab('active')} className={`text-sm font-medium px-2 py-1 rounded-md ${contentTab === 'active' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Active ({sortedContentItems.filter(c => c.status !== 'published').length})</button>
              <button onClick={() => setContentTab('completed')} className={`text-sm font-medium px-2 py-1 rounded-md ${contentTab === 'completed' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Completed ({sortedContentItems.filter(c => c.status === 'published').length})</button>
            </div>
            {visibleContentItems.length === 0 ? (
              <div className="text-center text-gray-500 py-6">No {contentTab} content yet. Add content from the calendar or here.</div>
            ) : (
              <div className="divide-y divide-gray-100 space-y-0">
                {visibleContentItems.map((item, visibleIndex) => {
                  const itemId = item._id.toString();
                  const distributionMethods = Array.isArray(item.distributionMethods) ? item.distributionMethods : [];
                  const visibleDistribution = distributionMethods.slice(0, 3);
                  const extraDistributionCount = Math.max(0, distributionMethods.length - 3);
                  const contentKey = contentItemKeyFor(item);
                  const contentSeenStatus: ItemSeenStatus = canShowContentNewIndicator(item)
                    ? (itemStatusByKey[contentKey] ?? 'none')
                    : 'none';
                  return (
                  <div key={itemId} id={`inspector-content-row-${itemId}`} className="p-4 scroll-mt-4">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => onContentItemClick?.(item)} className="flex-1 min-w-0 text-left">
                        <span className={`font-medium flex flex-wrap items-center gap-1 truncate ${contentTab === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          <ItemSeenTag status={contentSeenStatus} />
                          <span className="truncate">{item.title}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => handleDeleteContentItem(item)} className="text-red-600 hover:text-red-700 text-sm px-2 py-1 shrink-0">Delete</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 shrink-0">{item.channel}</span>
                      {visibleDistribution.map((m) => (
                        <span key={m} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 shrink-0">{m}</span>
                      ))}
                      {extraDistributionCount > 0 && (
                        <span className="text-gray-400 italic shrink-0">+{extraDistributionCount}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="leading-none">Due:</span>
                        <EditableDate
                          value={item.publishDate ?? null}
                          onSave={(v) => handleContentItemPublishDateUpdate(item, v)}
                          className="text-gray-900 leading-none py-0"
                          placeholder="Set date"
                          disabled={!isManagerOrAdmin}
                          clearable
                        />
                      </div>
                      <EditableNumber
                        value={item.estimatedHours}
                        onSave={(v) => handleContentItemHoursUpdate(item, v)}
                        className="leading-none py-0"
                        suffix="h"
                        min={0}
                        placeholder="Hours"
                        disabled={!isManagerOrAdmin}
                      />
                      {employees.length > 0 && (
                        <div className="flex items-center gap-1 min-w-[8rem]">
                          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <EditableSelect
                            value={item.assignedToEmployeeId?.toString() ?? ''}
                            options={contentAssigneeOptions(employees, localProject, item.assignedToEmployeeId?.toString())}
                            onSave={(v) => handleContentItemAssigneeUpdate(item, v)}
                            disabled={!isManagerOrAdmin}
                            className="text-xs text-gray-900 min-w-[8rem]"
                          />
                        </div>
                      )}
                      <EditableSelect
                        value={item.status}
                        options={contentStatusOptions}
                        onSave={(v) => handleContentItemStatusUpdate(item, v as ContentStatus)}
                        disabled={!canEditContentItemStatus(item)}
                        showColorDot
                        className="text-xs text-gray-900"
                      />
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                      <CommentsCollapsibleSection
                        expanded={expandedContentComments.has(itemId)}
                        onToggle={() => toggleContentComments(itemId)}
                        count={commentSummaries.contentItems[itemId]?.count ?? 0}
                        hasUnread={
                          currentUserId
                            ? hasUnreadCommentActivity(
                                buildCommentThreadKey(currentUserId, 'contentItem', itemId),
                                commentSummaries.contentItems[itemId]?.latestActivityMs ?? 0
                              )
                            : false
                        }
                      >
                        <CommentThread
                          entityType="contentItem"
                          entityId={itemId}
                          showHeading={false}
                          isManagerOrAdmin={isManagerOrAdmin}
                          showScreenshotGallery={false}
                          onMetaChange={(meta) => handleContentCommentMetaChange(itemId, meta)}
                        />
                      </CommentsCollapsibleSection>
                    </div>
                    <ContentLinkedAssets
                      project={localProject}
                      contentItemId={itemId}
                      prefetchedAssets={contentItemAssets}
                      isManagerOrAdmin={isManagerOrAdmin}
                      currentUserId={currentUserId}
                      currentUserEmployeeId={currentUserEmployeeId}
                      assignedToEmployeeId={item.assignedToEmployeeId?.toString()}
                      refreshToken={(contentRefreshTrigger ?? 0) + contentAssetsRefreshToken}
                      showAddHintText={visibleIndex === 0}
                      onAssetsChanged={() => {
                        setContentAssetsRefreshToken((n) => n + 1);
                        void loadLinkedAssets();
                      }}
                    />
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-gray-100 p-4">
            <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
              <button onClick={() => setTaskTab('active')} className={`text-sm font-medium px-2 py-1 rounded-md ${taskTab === 'active' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Active ({sortedTaskEntries.filter(({ task }) => task.status !== 'completed').length})</button>
              <button onClick={() => setTaskTab('completed')} className={`text-sm font-medium px-2 py-1 rounded-md ${taskTab === 'completed' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Completed ({sortedTaskEntries.filter(({ task }) => task.status === 'completed').length})</button>
            </div>
            {visibleTaskEntries.length === 0 ? (
              <div className="text-center text-gray-500 py-6">No {taskTab} tasks yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {visibleTaskEntries.map(({ task, idx }, visibleIndex) => {
                  const taskKey = taskItemKeyFor(task, idx);
                  const taskSeenStatus: ItemSeenStatus = canShowTaskNewIndicator(task)
                    ? (itemStatusByKey[taskKey] ?? 'none')
                    : 'none';

                  return (
                    <SwipeableCard key={idx} rightActions={isManagerOrAdmin ? [{ label: 'Delete', color: '#ef4444', onClick: () => handleDeleteTask(idx) }] : []} leftActions={[{ label: task.status === 'in-review' ? 'Approve' : 'Complete', color: '#22c55e', onClick: () => handleCompleteTask(idx) }]}>
                      <div id={`inspector-task-row-${idx}`} className="p-4 scroll-mt-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center gap-1">
                              <ItemSeenTag status={taskSeenStatus} />
                              <EditableText
                                value={task.name}
                                onSave={(v) => handleTaskNameSave(idx, v)}
                                className={`font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                                placeholder="Task name"
                                autoMultilineAfter={100}
                                disabled={!isManagerOrAdmin}
                                autoEditOnMount={autoEditTaskIndex === idx}
                                onAutoEditMount={() => {
                                  if (autoEditTaskIndex === idx) setAutoEditTaskIndex(null);
                                }}
                              />
                            </div>
                            {(task.description || isManagerOrAdmin) && <EditableText value={task.description || ''} onSave={(v) => handleTaskUpdate(idx, 'description', v)} className="text-sm text-gray-500 mt-1" placeholder="Add description..." autoMultilineAfter={100} disabled={!isManagerOrAdmin} />}
                          </div>
                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <EditableSelect value={task.status || 'active'} options={taskStatusOptions} onSave={(v) => handleTaskUpdate(idx, 'status', v)} showColorDot className="text-xs text-gray-900" />
                            {isManagerOrAdmin && (
                              <button type="button" onClick={() => { if (confirm('Delete this task? This cannot be undone.')) handleDeleteTask(idx); }} className="text-red-600 hover:text-red-700 text-sm px-2 py-1">Delete</button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <EditableDate value={task.startDate} onSave={(v) => handleTaskUpdate(idx, 'startDate', v)} className="text-gray-900 leading-none py-0" placeholder="Start" disabled={!isManagerOrAdmin} />
                            <span className="leading-none">→</span>
                            <EditableDate value={task.endDate} onSave={(v) => handleTaskUpdate(idx, 'endDate', v)} className="text-gray-900 leading-none py-0" placeholder="End" disabled={!isManagerOrAdmin} />
                          </div>
                          {isManagerOrAdmin && task.recurrenceSeriesId ? (
                            <span className="text-xs text-gray-400 italic leading-none">Repeating series</span>
                          ) : isManagerOrAdmin ? (
                            <TaskRecurrenceInline
                              anchorDate={new Date(task.startDate)}
                              onRecurrenceChange={(value) => void applyTaskRecurrence(idx, value)}
                            />
                          ) : null}
                          {estimatingTaskIndices.has(idx) ? (
                            <span className="text-gray-400 italic leading-none">Estimating…</span>
                          ) : (
                            <EditableNumber value={task.estimatedHours} onSave={(v) => handleTaskUpdate(idx, 'estimatedHours', v)} className="leading-none py-0" suffix="h" min={0} placeholder="Hours" disabled={!isManagerOrAdmin} />
                          )}
                          {employees.length > 0 && (
                            <div className="flex flex-col gap-0.5 min-w-[8rem]">
                              <div className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <MultiSelect
                                  value={getTaskAssigneeEmployeeIds(task)}
                                  options={taskAssigneeSelectOptions(employees, localProject, getTaskAssigneeEmployeeIds(task))}
                                  onChange={(selectedIds) => handleTaskUpdate(idx, 'assignedToEmployeeIds', selectedIds)}
                                  disabled={!isManagerOrAdmin}
                                  className="text-xs min-w-[8rem]"
                                />
                              </div>
                              {!isTaskAssigneeOnProjectTeam(localProject, task) && (
                                <p className="text-[10px] text-amber-600 leading-snug max-w-[14rem]">
                                  Assignee is not on the project team—reassign or clear to save changes.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                          <CommentsCollapsibleSection
                            expanded={expandedTaskComments.has(idx)}
                            onToggle={() => toggleTaskComments(idx)}
                            count={getTaskSummaryForIndex(idx).count}
                            hasUnread={
                              currentUserId
                                ? hasUnreadCommentActivity(
                                    buildCommentThreadKey(
                                      currentUserId,
                                      'projectTask',
                                      localProject._id.toString(),
                                      (localProject.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString()
                                    ),
                                    getTaskSummaryForIndex(idx).latestActivityMs
                                  )
                                : false
                            }
                          >
                            <CommentThread
                              entityType="projectTask"
                              entityId={localProject._id.toString()}
                              taskIndex={idx}
                              taskId={(localProject.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString()}
                              showHeading={false}
                              isManagerOrAdmin={isManagerOrAdmin}
                              showScreenshotGallery={false}
                              onMetaChange={(meta) => handleTaskCommentMetaChange(idx, meta)}
                            />
                          </CommentsCollapsibleSection>
                        </div>
                        <TaskLinkedAssets
                          key={`task-assets-${(localProject.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString() ?? idx}-${taskAssetsRefreshToken}`}
                          project={localProject}
                          taskId={(localProject.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString()}
                          taskIndex={idx}
                          prefetchedAssets={taskAssets}
                          isManagerOrAdmin={isManagerOrAdmin}
                          currentUserId={currentUserId}
                          currentUserEmployeeId={currentUserEmployeeId}
                          refreshToken={taskAssetsRefreshToken}
                          showAddHintText={visibleIndex === 0}
                          onAssetsChanged={() => {
                            setTaskAssetsRefreshToken((n) => n + 1);
                            void loadLinkedAssets();
                          }}
                        />
                      </div>
                    </SwipeableCard>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - one Close at bottom, same size as Delete */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Close
        </button>
        {isManagerOrAdmin && onDelete && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm px-3 py-1.5 rounded text-error hover:bg-error-light transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Task Actions */}
      <Modal
        isOpen={showTaskActions && selectedTaskIndex !== null}
        onClose={() => {
          setShowTaskActions(false);
          setSelectedTaskIndex(null);
        }}
        title={selectedTaskIndex !== null ? localProject.tasks?.[selectedTaskIndex]?.name : 'Task Actions'}
        maxWidth="sm"
        elevated
        bodyPadding={false}
      >
        <div className="py-1">
          {selectedTaskIndex !== null && localProject.tasks?.[selectedTaskIndex] && (
            <>
              {localProject.tasks[selectedTaskIndex].status === 'active' && (
                <ModalAction
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  }
                  label="Submit for Review"
                  onClick={() => handleSubmitForReview(selectedTaskIndex)}
                  variant="warning"
                />
              )}
              {localProject.tasks[selectedTaskIndex].status === 'in-review' && isManagerOrAdmin && (
                <>
                  <ModalAction
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    }
                    label="Approve & Complete"
                    onClick={() => handleCompleteTask(selectedTaskIndex)}
                    variant="success"
                  />
                  <ModalAction
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    }
                    label="Decline Review"
                    onClick={() => handleDeclineReview(selectedTaskIndex)}
                    variant="danger"
                  />
                </>
              )}
              {localProject.tasks[selectedTaskIndex].status !== 'completed' && (
                <ModalAction
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  }
                  label="Mark Complete"
                  onClick={() => handleCompleteTask(selectedTaskIndex)}
                  variant="success"
                />
              )}
              {isManagerOrAdmin && (
                <ModalAction
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  }
                  label="Delete Task"
                  onClick={() => handleDeleteTask(selectedTaskIndex)}
                  variant="danger"
                />
              )}
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Project?"
        message={
          <>
            Are you sure you want to delete <strong className="text-gray-900">{localProject.name}</strong>?
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          onDelete?.();
          setShowDeleteConfirm(false);
        }}
        elevated
        stackAboveOverlays
      />

      {/* Linked asset text/document preview */}
      <Modal
        isOpen={previewAsset !== null}
        onClose={closePreviewAssetSheet}
        title={
          previewSheetMode === 'edit'
            ? 'Edit asset'
            : (previewAsset?.name ?? 'Document')
        }
        maxWidth="lg"
        elevated
        stackAboveOverlays
      >
        <div className="space-y-4">
          {previewSheetMode === 'view' ? (
            <>
              <pre className="text-sm whitespace-pre-wrap text-gray-800 font-sans bg-gray-50 rounded-lg p-3 max-h-[50vh] overflow-y-auto">
                {previewAsset?.textContent?.trim() ? previewAsset.textContent : 'No content yet.'}
              </pre>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!previewAsset) return;
                    setPreviewEditName(previewAsset.name);
                    setPreviewEditContent(previewAsset.textContent ?? '');
                    setPreviewSheetMode('edit');
                  }}
                >
                  Edit
                </Button>
                <Link
                  href={`/assets?projectId=${localProject._id.toString()}`}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  More options on Assets
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={previewEditName}
                  onChange={(e) => setPreviewEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                  disabled={previewSaving}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Content</label>
                <AutoGrowTextarea
                  value={previewEditContent}
                  onChange={(e) => setPreviewEditContent(e.target.value)}
                  minRows={4}
                  disabled={previewSaving}
                  className="px-3 py-2 border-gray-200 bg-white text-gray-900 text-sm whitespace-pre-wrap max-h-[50vh]"
                  placeholder="Document body…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={previewSaving || !previewEditName.trim()}
                  onClick={() => void savePreviewLinkedAsset()}
                >
                  {previewSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={previewSaving}
                  onClick={() => {
                    if (!previewAsset) return;
                    setPreviewEditName(previewAsset.name);
                    setPreviewEditContent(previewAsset.textContent ?? '');
                    setPreviewSheetMode('view');
                  }}
                >
                  Cancel
                </Button>
              </div>
              <Link
                href={`/assets?projectId=${localProject._id.toString()}`}
                className="inline-block text-xs text-gray-500 hover:text-gray-700 underline"
              >
                More options on Assets
              </Link>
            </>
          )}
        </div>
      </Modal>

      <AssetDeleteConfirmModal
        isOpen={assetPendingDelete !== null}
        assetName={assetPendingDelete?.name ?? ''}
        assetTypeLabel={
          assetPendingDelete ? formatLinkedAssetTypeLabel(assetPendingDelete.type) : undefined
        }
        deleting={deletingLinkedAsset}
        onCancel={() => {
          if (!deletingLinkedAsset) setAssetPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteLinkedAsset()}
        stackAboveLightbox
      />

      {/* Project color palette */}
      <Modal
        isOpen={paletteSheetOpen}
        onClose={() => {
          if (!paletteSaving) setPaletteSheetOpen(false);
        }}
        title="Color palette"
        elevated
        stackAboveOverlays
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Primary is optional and is used on the map when set. Enter hex (#RGB or #RRGGBB) or rgb() / rgba(). Blank rows are omitted when you save. Clear palette removes all swatches but keeps your project color on the map.
          </p>
          <div className="space-y-3">
            {paletteDraft.map((row, idx) => {
              const trimmed = row.trim();
              const parsed = trimmed ? parseCssColorInput(trimmed) : null;
              const ok = parsed?.ok === true;
              return (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-2 sm:pt-0">
                    {labelForPaletteIndex(idx)}
                  </span>
                  <div
                    className={`h-9 w-9 shrink-0 rounded-lg border-2 ${
                      ok ? 'border-gray-200' : 'border-dashed border-amber-500/80 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)_50%/8px_8px]'
                    }`}
                    style={ok && parsed ? { backgroundColor: parsed.normalized } : undefined}
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={row}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPaletteDraft((prev) => prev.map((x, i) => (i === idx ? v : x)));
                    }}
                    disabled={paletteSaving}
                    placeholder={idx === 0 ? '#3b82f6 or rgb(59, 130, 246)' : '#RRGGBB or rgb()'}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-mono"
                  />
                  {idx >= 1 && (
                    <button
                      type="button"
                      disabled={paletteSaving}
                      onClick={() => setPaletteDraft((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-sm text-red-600 hover:underline shrink-0 text-left sm:text-right sm:w-16"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={paletteSaving}
            onClick={() => setPaletteDraft((prev) => [...prev, ''])}
          >
            Add color
          </Button>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <Button type="button" size="sm" disabled={paletteSaving} onClick={() => void savePaletteFromDraft()}>
              {paletteSaving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={paletteSaving}
              onClick={() => void clearPalette()}
            >
              Clear palette
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={paletteSaving}
              onClick={() => void handleCopyPalette()}
            >
              {paletteCopyFeedback ? 'Copied' : 'Copy palette'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={paletteSaving}
              onClick={() => setPaletteSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Project font listing */}
      <Modal
        isOpen={fontSheetOpen}
        onClose={() => {
          if (!fontSaving) setFontSheetOpen(false);
        }}
        title="Fonts"
        elevated
        stackAboveOverlays
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Brand typefaces for this project. Primary is required. Extra rows can be left blank and are omitted when you save.
          </p>
          <div className="space-y-3">
            {fontDraft.map((row, idx) => {
              const trimmed = row.trim();
              const parsed = trimmed ? parseFontFamilyInput(trimmed) : null;
              const ok = parsed?.ok === true;
              const previewFamily =
                ok && parsed && /^[\p{L}\p{N}\s\-]+$/u.test(parsed.normalized) && !parsed.normalized.includes(',')
                  ? parsed.normalized
                  : undefined;
              return (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-2 sm:pt-0">
                    {labelForFontPaletteIndex(idx)}
                  </span>
                  {previewFamily ? (
                    <span
                      className="text-lg shrink-0 text-gray-700 w-9 text-center"
                      style={{ fontFamily: previewFamily }}
                      aria-hidden
                    >
                      Aa
                    </span>
                  ) : (
                    <span
                      className="text-lg shrink-0 text-gray-400 w-9 text-center"
                      aria-hidden
                    >
                      Aa
                    </span>
                  )}
                  <input
                    type="text"
                    value={row}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFontDraft((prev) => prev.map((x, i) => (i === idx ? v : x)));
                    }}
                    disabled={fontSaving}
                    placeholder={idx === 0 ? 'Inter' : 'Georgia or "Inter", sans-serif'}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                  />
                  {idx >= 1 && (
                    <button
                      type="button"
                      disabled={fontSaving}
                      onClick={() => setFontDraft((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-sm text-red-600 hover:underline shrink-0 text-left sm:text-right sm:w-16"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={fontSaving || fontDraft.length >= maxFontPaletteEntries}
            onClick={() => setFontDraft((prev) => [...prev, ''])}
          >
            Add font
          </Button>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <Button type="button" size="sm" disabled={fontSaving} onClick={() => void saveFontFromDraft()}>
              {fontSaving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={fontSaving}
              onClick={() => setFontSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Email smart button — mailbox password */}
      <Modal
        isOpen={credentialSheet !== null}
        onClose={closeCredentialSheet}
        title={
          credentialSheetMode === 'edit'
            ? 'Edit email shortcut'
            : credentialSheet
              ? `Password · ${credentialSheet.label}`
              : 'Password'
        }
        elevated
        stackAboveOverlays
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Mailbox password for this project shortcut. Stored for your team only; use a dedicated mailbox password when possible.
          </p>
          {credentialSheet && credentialSheetMode === 'view' && (
            <>
              {credentialSheet.password ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type={credentialReveal ? 'text' : 'password'}
                      readOnly
                      value={credentialSheet.password}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm font-mono"
                      aria-label="Mailbox password"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setCredentialReveal((r) => !r)}
                    >
                      {credentialReveal ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(credentialSheet.password);
                          alert('Password copied.');
                        } catch {
                          alert('Could not copy to clipboard.');
                        }
                      }}
                    >
                      Copy password
                    </Button>
                    {isManagerOrAdmin && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setCredentialReveal(false);
                          setCredentialEditLabel(credentialSheet.label);
                          setCredentialEditEmail(mailtoAddressFromUrl(credentialSheet.url));
                          setCredentialEditPassword(credentialSheet.password);
                          setCredentialSheetMode('edit');
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500">No password stored for this email button.</p>
                  {isManagerOrAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setCredentialReveal(false);
                        setCredentialEditLabel(credentialSheet.label);
                        setCredentialEditEmail(mailtoAddressFromUrl(credentialSheet.url));
                        setCredentialEditPassword(credentialSheet.password);
                        setCredentialSheetMode('edit');
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </>
              )}
            </>
          )}
          {credentialSheet && credentialSheetMode === 'edit' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={credentialEditLabel}
                  onChange={(e) => setCredentialEditLabel(e.target.value)}
                  disabled={credentialSaving}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={credentialEditEmail}
                  onChange={(e) => setCredentialEditEmail(e.target.value)}
                  disabled={credentialSaving}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mailbox password</label>
                <input
                  type="text"
                  value={credentialEditPassword}
                  onChange={(e) => setCredentialEditPassword(e.target.value)}
                  disabled={credentialSaving}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-mono"
                  placeholder="Leave empty to clear stored password"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={credentialSaving || !credentialEditEmail.trim()}
                  onClick={() => void saveCredentialEmailButton()}
                >
                  {credentialSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={credentialSaving}
                  onClick={() => {
                    if (!credentialSheet) return;
                    setCredentialEditLabel(credentialSheet.label);
                    setCredentialEditEmail(mailtoAddressFromUrl(credentialSheet.url));
                    setCredentialEditPassword(credentialSheet.password);
                    setCredentialSheetMode('view');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ImagePreviewModal
        isOpen={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src ?? null}
        title={previewImage?.title}
      />
    </div>
  );
}

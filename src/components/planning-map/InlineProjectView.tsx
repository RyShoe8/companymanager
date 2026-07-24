'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePageActivity } from '@/hooks/usePageActivity';
import { IProject, IProjectTask, TaskStatus } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem, type ContentStatus } from '@/lib/models/ContentItem';
import EditableText from '@/components/ui/EditableText';
import { taskIdString } from '@/lib/projects/taskArrayGuards';
import { mergeTasksPreservingReferences } from '@/lib/projects/taskMerge';
import { canDeleteTask } from '@/lib/projects/taskDeleteAuth';
import { canDeleteContentItem } from '@/lib/content/contentDeleteAuth';
import EditableDate from '@/components/ui/EditableDate';
import EditableNumber from '@/components/ui/EditableNumber';
import EditableSelect from '@/components/ui/EditableSelect';
import SwipeableCard from '@/components/ui/SwipeableCard';
import Modal from '@/components/ui/Modal';
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
import { computeProjectAssignedHours } from '@/lib/utils/projectHours';
import { fetchEstimatedHours } from '@/lib/ai/clientEstimateHours';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import InsightsPanel from '@/components/insights/InsightsPanel';
import ContentItemCreateForm from '@/components/planning-map/ContentItemCreateForm';
import CollapsibleInspectorSection from '@/components/ui/CollapsibleInspectorSection';
import { formInputClassInspector } from '@/components/ui/formClasses';
import { IClient } from '@/lib/models/Client';
import AddButton from '@/components/checklist/AddButton';
import type { AddSmartButtonPayload } from '@/components/checklist/categoryModalTypes';
import { useOnGoogleAssetCreated } from '@/hooks/google/useGoogleWorkspaceResume';
import MultiSelect from '@/components/ui/MultiSelect';
import { emailSmartButtonHref } from '@/lib/utils/emailSmartLinks';
import { parseCssColorInput } from '@/lib/utils/cssColorInput';
import {
  taskAssigneeSelectOptions,
  getTaskAssigneeEmployeeIds,
  canUserContributeToProject,
  filterEmployeesForTaskAssignment,
  isEmployeeOnProjectTeam,
  isTaskAssigneeOnProjectTeam,
  sanitizeTaskAssigneesForProjectTeam,
  mergeProjectTeamWithClient,
} from '@/lib/utils/projectTeam';
import { parseFontFamilyInput } from '@/lib/utils/fontPaletteInput';
import { normalizeProjectUrlHref, truncateProjectUrlDisplay } from '@/lib/utils/projectUrls';
import { getPlatformUrlList, syncPlatformUrlFields } from '@/lib/utils/platformUrls';
import PlatformUrlsSection from '@/components/shared/PlatformUrlsSection';
import TaskLinkedAssets from '@/components/planning-map/TaskLinkedAssets';
import LinkedRecordingChips from '@/components/shared/LinkedRecordingChips';
import ContentLinkedAssets from '@/components/planning-map/ContentLinkedAssets';
import EmptyStateIllustration from '@/components/ui/EmptyStateIllustration';
import {
  deleteLinkedAsset,
  canUserDeleteAsset,
  normalizeAssetUserId,
  isTextDocumentAssetType,
  linkedAssetHref,
} from '@/lib/utils/linkedAssets';
import ProjectSocialsBar from '@/components/projects/ProjectSocialsBar';
import ProjectTechStackBar from '@/components/projects/ProjectTechStackBar';
import ProjectMarketingStackBar from '@/components/projects/ProjectMarketingStackBar';
import ProjectCustomPlatformStacks from '@/components/projects/ProjectCustomPlatformStacks';
import { parseSocialLinkInput } from '@/lib/utils/socialUrls';
import type { IProjectMarketingStackItem, IProjectSocialLink, IProjectTechStackItem } from '@/lib/models/Project';
import {
  scrollElementIntoContainerAfterLayout,
} from '@/lib/utils/scrollIntoContainer';
import type { RefObject } from 'react';
import { expandTaskInstances, expandTaskExtensionInstances } from '@/lib/recurrence/expandTaskInstances';
import TaskRecurrenceInline, { type TaskRecurrenceValue } from '@/components/planning-map/TaskRecurrenceInline';
import { expandExtensionDates, type ExtendUnit } from '@/lib/recurrence/recurrenceHorizons';
import {
  getTaskSeriesPosition,
  getContentSeriesPosition,
  shouldShowExtendSeries,
} from '@/lib/recurrence/seriesDisplay';
import {
  filterContentToSeriesRepresentatives,
  filterTasksToSeriesRepresentatives,
} from '@/lib/recurrence/filterSeriesRepresentatives';
import SeriesPositionBadge from '@/components/shared/SeriesPositionBadge';
import ExtendSeriesSelect from '@/components/shared/ExtendSeriesSelect';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { taskCommentSummaryKey, type CommentSummary } from '@/lib/comments/commentUtils';
import {
  buildCommentThreadKey,
  hasUnreadCommentActivity,
  setCommentLastSeenMs,
  setCommentThreadManuallyCollapsed,
  shouldAutoExpandCommentThread,
} from '@/lib/comments/commentReadState';
import ItemSeenTag from '@/components/workspace/ItemSeenTag';
import { useProjectPaletteSheet } from '@/hooks/useProjectPaletteSheet';
import { useProjectFontSheet } from '@/hooks/useProjectFontSheet';
import ProjectPaletteSheetModal from '@/components/planning-map/ProjectPaletteSheetModal';
import ProjectFontSheetModal from '@/components/planning-map/ProjectFontSheetModal';
import TaskActionsModal from '@/components/planning-map/TaskActionsModal';
import {
  buildContentItemKey,
  buildContentItemObservation,
  buildTaskItemKey,
  buildTaskItemObservation,
  observeItemsForUser,
  readObservedItemsForUser,
  type ItemSeenStatus,
} from '@/lib/workspace/itemSeenState';

interface InlineProjectViewProps {
  project: IProject;
  employees: IEmployee[];
  isManagerOrAdmin: boolean;
  currentUserEmployeeId?: string | null;
  onUpdate: (
    updates: Partial<IProject> & { allowBulkTaskExpand?: boolean }
  ) => Promise<IProject | void>;
  /** Merge logo and other inspector edits into workspace project list without full reload. */
  onProjectPatched?: (project: IProject) => void;
  onDelete?: () => void;
  onClose: () => void;
  onRefresh: () => void;
  clients?: IClient[];
  /** Open add-content panel on mount (e.g. voice intent while inspector is focused on this project). */
  initialAddContentOpen?: boolean;
  initialAddContentDate?: Date;
  initialAddContentPrefill?: { title?: string; channel?: string; notes?: string };
  onAddContentOpenConsumed?: () => void;
  /** Called when user activates a content item outside this list (e.g. nested client inspector). */
  onContentItemClick?: (item: IContentItem) => void;
  /** When this changes, project content list is refetched (e.g. after content save/delete). */
  contentRefreshTrigger?: number;
  /** Notify workspace to refresh global content list after inspector content mutations. */
  onContentListChanged?: (contentItemId?: string) => void;
  /** Register a flush callback for pending debounced task saves (inspector close). */
  registerFlushPendingSaves?: (flush: (() => Promise<void>) | null) => void;
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
  /** Initial Tasks section expanded state (e.g. when project has unseen tasks). */
  initialTasksExpanded?: boolean;
  /** Initial Content section expanded state (e.g. when project has unseen content). */
  initialContentExpanded?: boolean;
  itemSeenRefreshTrigger?: number;
  /** When set, render only tasks and content sections (e.g. embedded in client inspector). */
  sectionsOnly?: 'tasks-content';
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
  linkedProjectTaskIndex?: number;
  linkedContentItemId?: string;
};

function isProjectLevelLinkedAsset(asset: LinkedAssetRow): boolean {
  return (
    !asset.linkedProjectTaskId &&
    (asset.linkedProjectTaskIndex == null || asset.linkedProjectTaskIndex === undefined) &&
    !asset.linkedContentItemId
  );
}

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
    linkedProjectTaskIndex:
      typeof o.linkedProjectTaskIndex === 'number' && Number.isInteger(o.linkedProjectTaskIndex)
        ? o.linkedProjectTaskIndex
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

function formatLinkedAssetTypeLabel(type: string): string {
  if (type === 'text') return 'Note';
  if (!type) return 'Other';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Normalized smart button row from GET /projects/:id/buttons */
type ProjectPanelActionButton = {
  label: string;
  url: string;
  kind?: 'link' | 'email';
};

function normalizeProjectActionButton(raw: unknown): ProjectPanelActionButton | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label : '';
  const url = typeof o.url === 'string' ? o.url : '';
  if (!label || !url) return null;
  if (o.kind === 'email') {
    return { label, url, kind: 'email' as const };
  }
  return { label, url };
}

function normalizeActionButtonsList(raw: unknown): ProjectPanelActionButton[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map(normalizeProjectActionButton)
    .filter((b): b is ProjectPanelActionButton => b != null);
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

export default function InlineProjectView({ project, employees, isManagerOrAdmin, currentUserEmployeeId, onUpdate, onProjectPatched, onDelete, onClose, onRefresh, clients = [], onContentItemClick, contentRefreshTrigger, onContentListChanged, registerFlushPendingSaves, initialOpenTaskIndex, onInitialOpenTaskConsumed, initialOpenContentId, onInitialOpenContentConsumed, initialAddContentOpen, initialAddContentDate, initialAddContentPrefill, onAddContentOpenConsumed, scrollContainerRef, autoAddTaskOnOpen, onAutoAddTaskConsumed, timeframe = 'weekly', referenceDate, initialTasksExpanded = false, initialContentExpanded = false, itemSeenRefreshTrigger, sectionsOnly }: InlineProjectViewProps) {
  const pageActivity = usePageActivity();
  const [localProject, setLocalProject] = useState(project);
  const [urlList, setUrlList] = useState<string[]>(() => getPlatformUrlList(project));
  const localProjectRef = useRef(localProject);
  localProjectRef.current = localProject;
  const linkedClient = useMemo(() => {
    if (!localProject.clientId) return undefined;
    return clients.find((c) => String(c._id) === String(localProject.clientId));
  }, [clients, localProject.clientId]);
  const projectTeamForTasks = useMemo(
    () => mergeProjectTeamWithClient(localProject, linkedClient),
    [localProject, linkedClient]
  );
  const getProjectTeamForTasks = useCallback(
    (proj: IProject) => mergeProjectTeamWithClient(proj, linkedClient),
    [linkedClient]
  );
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
  const initialAddContentAppliedKeyRef = useRef<string | null>(null);
  const autoAddTaskAppliedKeyRef = useRef<string | null>(null);
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [addContentPrefill, setAddContentPrefill] = useState<{
    title?: string;
    channel?: string;
    notes?: string;
  } | null>(null);
  const [addContentDefaultDate, setAddContentDefaultDate] = useState<Date | undefined>(undefined);
  /** After adding a task, scroll its row into view once state settles. */
  const [pendingScrollToTaskIndex, setPendingScrollToTaskIndex] = useState<number | null>(null);
  const [highlightedTaskIndex, setHighlightedTaskIndex] = useState<number | null>(null);
  const [actionButtons, setActionButtons] = useState<ProjectPanelActionButton[]>([]);
  const [tasksExpanded, setTasksExpanded] = useState(initialTasksExpanded);
  const [contentExpanded, setContentExpanded] = useState(initialContentExpanded);
  const [draftTaskOpen, setDraftTaskOpen] = useState(false);
  const [addTaskNameDraft, setAddTaskNameDraft] = useState('');
  const addTaskInputRef = useRef<HTMLTextAreaElement>(null);
  const draftFocusPendingRef = useRef(false);
  const pendingNamedTaskEstimateRef = useRef<{ index: number; name: string } | null>(null);
  const TASK_LIST_SCROLL_PADDING = 24;

  const scrollTaskRowIntoView = useCallback(
    (taskIndex: number, behavior: ScrollBehavior = 'smooth') => {
      scrollElementIntoContainerAfterLayout(
        () => document.getElementById(`inspector-task-row-${taskIndex}`),
        scrollContainerRef?.current ?? null,
        { block: 'center', behavior, padding: TASK_LIST_SCROLL_PADDING }
      );
    },
    [scrollContainerRef]
  );
  const [taskTab, setTaskTab] = useState<'active' | 'completed'>('active');
  const [contentTab, setContentTab] = useState<'active' | 'completed'>('active');
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [projectContentItems, setProjectContentItems] = useState<IContentItem[]>([]);
  const [estimatingTaskIndices, setEstimatingTaskIndices] = useState<Set<number>>(() => new Set());
  const estimateTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const taskSaveInFlightRef = useRef(0);
  const pendingProjectSyncRef = useRef<IProject | null>(null);
  const taskSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTaskSaveRef = useRef<{
    tasks: IProjectTask[];
    allowBulkTaskExpand?: boolean;
    onSuccess?: () => void | Promise<void>;
  } | null>(null);
  const recurrenceInFlightRef = useRef<Set<string>>(new Set());
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
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [taskAssetsRefreshToken, setTaskAssetsRefreshToken] = useState(0);
  const [contentAssetsRefreshToken, setContentAssetsRefreshToken] = useState(0);
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemSeenStatus>>({});

  const notifyContentListChanged = useCallback(() => {
    onContentListChanged?.();
  }, [onContentListChanged]);

  const bumpWorkspaceRecency = useCallback(
    (next?: IProject) => {
      const projectSnapshot = next ?? localProjectRef.current;
      onProjectPatched?.({ ...projectSnapshot, updatedAt: new Date() } as IProject);
    },
    [onProjectPatched]
  );

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.id && setCurrentUserId(data.id))
      .catch(() => {});
  }, []);

  const loadLinkedAssets = useCallback(async () => {
    setLinkedAssetsLoading(true);
    try {
      const res = await fetch(
        `/api/assets?linkedProjectId=${localProject._id.toString()}&linkedScope=all`
      );
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

  useOnGoogleAssetCreated(() => {
    void loadLinkedAssets();
    setTaskAssetsRefreshToken((n) => n + 1);
  });

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

  const projectLinkedAssets = useMemo(
    () => linkedAssets.filter(isProjectLevelLinkedAsset),
    [linkedAssets]
  );

  const linkedAssetTypeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of projectLinkedAssets) {
      m.set(a.type, (m.get(a.type) ?? 0) + 1);
    }
    return m;
  }, [projectLinkedAssets]);

  const linkedAssetTypesInUse = useMemo(
    () => Array.from(linkedAssetTypeCounts.keys()).sort((a, b) => a.localeCompare(b)),
    [linkedAssetTypeCounts]
  );

  const visibleLinkedAssets = useMemo(() => {
    if (!linkedAssetTypeFilter) return projectLinkedAssets;
    return projectLinkedAssets.filter((a) => a.type === linkedAssetTypeFilter);
  }, [projectLinkedAssets, linkedAssetTypeFilter]);

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
      if (previewImage && linkedAssetHref(assetPendingDelete) === previewImage.src) {
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

  const focusContentItem = useCallback(
    (contentId: string) => {
      const item = projectContentItems.find((c) => c._id.toString() === contentId);
      if (!item) return;
      setContentExpanded(true);
      setContentTab(item.status === 'published' ? 'completed' : 'active');
      setExpandedContentComments((prev) => new Set(prev).add(contentId));
      scrollElementIntoContainerAfterLayout(
        () => document.getElementById(`inspector-content-row-${contentId}`),
        scrollContainerRef?.current ?? null,
        { block: 'center', behavior: 'smooth' }
      );
    },
    [projectContentItems, scrollContainerRef]
  );

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

    const taskEntries = (localProject.tasks ?? []).map((task, idx) => {
      const summaryKey = taskCommentSummaryKey(
        (task as { _id?: { toString: () => string } })?._id?.toString(),
        idx
      );
      const summary = commentSummaries.tasks[summaryKey];
      return buildTaskItemObservation(localProject, task, idx, {
        commentActivityMs: summary?.latestActivityMs ?? 0,
      });
    });

    const contentEntries = projectContentItems.map((item) => {
      const itemId = item._id.toString();
      const summary = commentSummaries.contentItems[itemId];
      return buildContentItemObservation(item, {
        commentActivityMs: summary?.latestActivityMs ?? 0,
      });
    });

    const observed = observeItemsForUser(currentUserId, [...taskEntries, ...contentEntries]);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, localProject, projectContentItems, commentSummaries]);

  useEffect(() => {
    if (!currentUserId || (itemSeenRefreshTrigger ?? 0) <= 0) return;
    const taskEntries = (localProject.tasks ?? []).map((task, idx) =>
      buildTaskItemKey(
        localProject._id.toString(),
        (task as { _id?: { toString: () => string } })._id?.toString() ?? null,
        idx
      )
    );
    const contentEntries = projectContentItems.map((item) =>
      buildContentItemKey(item.projectId?.toString() ?? 'none', item._id.toString())
    );
    const observed = readObservedItemsForUser(currentUserId, [...taskEntries, ...contentEntries]);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, itemSeenRefreshTrigger, localProject._id, localProject.tasks, projectContentItems]);

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

  const visibleTaskEntries = useMemo(() => {
    const mode = taskTab === 'active' ? 'active' : 'completed';
    const tabTasks = sortedTaskEntries
      .filter(({ task }) =>
        mode === 'active' ? task.status !== 'completed' : task.status === 'completed'
      )
      .map(({ task }) => task);
    const representatives = filterTasksToSeriesRepresentatives(tabTasks, {
      mode,
      referenceDate,
    });
    const repIds = new Set(
      representatives.map((t) => taskIdString(t)).filter((id): id is string => !!id)
    );
    return sortedTaskEntries.filter(({ task }) => {
      if (mode === 'active' ? task.status === 'completed' : task.status !== 'completed') {
        return false;
      }
      if (!task.recurrenceSeriesId) return true;
      const id = taskIdString(task);
      return id != null && repIds.has(id);
    });
  }, [sortedTaskEntries, taskTab, referenceDate]);

  const visibleContentItems = useMemo(() => {
    const mode = contentTab === 'active' ? 'active' : 'completed';
    const tabItems = sortedContentItems.filter((item) =>
      mode === 'active' ? item.status !== 'published' : item.status === 'published'
    );
    const representatives = filterContentToSeriesRepresentatives(tabItems, {
      mode,
      referenceDate,
    });
    const repIds = new Set(representatives.map((c) => c._id.toString()));
    return sortedContentItems.filter((item) => {
      if (mode === 'active' ? item.status === 'published' : item.status !== 'published') {
        return false;
      }
      if (!item.recurrenceSeriesId) return true;
      return repIds.has(item._id.toString());
    });
  }, [sortedContentItems, contentTab, referenceDate]);

  const activeTaskDisplayCount = useMemo(() => {
    const tasks = sortedTaskEntries
      .filter(({ task }) => task.status !== 'completed')
      .map(({ task }) => task);
    return filterTasksToSeriesRepresentatives(tasks, { mode: 'active', referenceDate }).length;
  }, [sortedTaskEntries, referenceDate]);

  const completedTaskDisplayCount = useMemo(() => {
    const tasks = sortedTaskEntries
      .filter(({ task }) => task.status === 'completed')
      .map(({ task }) => task);
    return filterTasksToSeriesRepresentatives(tasks, { mode: 'completed', referenceDate }).length;
  }, [sortedTaskEntries, referenceDate]);

  const activeContentDisplayCount = useMemo(() => {
    const items = sortedContentItems.filter((c) => c.status !== 'published');
    return filterContentToSeriesRepresentatives(items, { mode: 'active', referenceDate }).length;
  }, [sortedContentItems, referenceDate]);

  const completedContentDisplayCount = useMemo(() => {
    const items = sortedContentItems.filter((c) => c.status === 'published');
    return filterContentToSeriesRepresentatives(items, { mode: 'completed', referenceDate }).length;
  }, [sortedContentItems, referenceDate]);

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
        setExpandedTaskComments((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const idx of tasksToExpand) {
            if (!next.has(idx)) {
              next.add(idx);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
      if (contentToExpand.size > 0) {
        setExpandedContentComments((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const id of contentToExpand) {
            if (!next.has(id)) {
              next.add(id);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
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
      setCommentSummaries((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(summaries)) return prev;
        return summaries;
      });
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
    if (!pageActivity.visible) return;
    // Active inspector: 30s. Idle but visible: 60s.
    const intervalMs = pageActivity.isActive ? 30_000 : 60_000;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchCommentSummaries();
      }
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [fetchCommentSummaries, pageActivity.visible, pageActivity.isActive]);

  useEffect(() => {
    applyAutoExpandFromSummaries(commentSummaries);
  }, [projectContentItems, commentSummaries, applyAutoExpandFromSummaries]);

  useEffect(() => {
    if (project._id.toString() !== localProject._id.toString()) {
      setLocalProject(project);
      setUrlList(getPlatformUrlList(project));
      setTasksExpanded(initialTasksExpanded);
      setContentExpanded(initialContentExpanded);
      initialTaskAppliedKeyRef.current = null;
      autoAddTaskAppliedKeyRef.current = null;
      return;
    }
    if (taskSaveInFlightRef.current > 0) {
      pendingProjectSyncRef.current = project;
      return;
    }
    setLocalProject((prev) => {
      const pAt = (project as { updatedAt?: string | Date }).updatedAt;
      const prevAt = (prev as { updatedAt?: string | Date }).updatedAt;
      if (pAt != null && prevAt != null && new Date(pAt).getTime() === new Date(prevAt).getTime()) return prev;
      return project;
    });
  }, [project, localProject._id, initialTasksExpanded, initialContentExpanded]);

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
    setTasksExpanded(true);
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
    focusContentItem(initialOpenContentId);
    onInitialOpenContentConsumed?.();
  }, [
    initialOpenContentId,
    project._id,
    projectContentItems,
    focusContentItem,
    onInitialOpenContentConsumed,
  ]);

  useEffect(() => {
    if (!initialAddContentOpen) {
      initialAddContentAppliedKeyRef.current = null;
      return;
    }
    const key = `${project._id.toString()}-add-content`;
    if (initialAddContentAppliedKeyRef.current === key) return;
    initialAddContentAppliedKeyRef.current = key;
    setAddContentPrefill(initialAddContentPrefill ?? null);
    setAddContentDefaultDate(initialAddContentDate);
    setAddContentOpen(true);
    setContentExpanded(true);
    scrollElementIntoContainerAfterLayout(
      () => document.getElementById('content-create-form'),
      scrollContainerRef?.current ?? null,
      { block: 'start', behavior: 'smooth' }
    );
    onAddContentOpenConsumed?.();
  }, [initialAddContentOpen, initialAddContentDate, initialAddContentPrefill, project._id, onAddContentOpenConsumed, scrollContainerRef]);

  const handleOpenAddContent = useCallback(() => {
    setAddContentPrefill(null);
    setAddContentDefaultDate(undefined);
    setAddContentOpen(true);
    setContentExpanded(true);
    scrollElementIntoContainerAfterLayout(
      () => document.getElementById('content-create-form'),
      scrollContainerRef?.current ?? null,
      { block: 'start', behavior: 'smooth' }
    );
  }, [scrollContainerRef]);

  const handleOpenDraftTask = useCallback(() => {
    setDraftTaskOpen(true);
    setAddTaskNameDraft('');
    setTasksExpanded(true);
    setTaskTab('active');
    draftFocusPendingRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftTaskOpen || !draftFocusPendingRef.current) return;
    draftFocusPendingRef.current = false;
    scrollElementIntoContainerAfterLayout(
      () => document.getElementById('inspector-task-draft-row'),
      scrollContainerRef?.current ?? null,
      { block: 'center', behavior: 'smooth', padding: TASK_LIST_SCROLL_PADDING }
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        addTaskInputRef.current?.focus();
      });
    });
  }, [draftTaskOpen, scrollContainerRef]);

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete content item');
      }
      setProjectContentItems((prev) => prev.filter((c) => c._id.toString() !== item._id.toString()));
      bumpWorkspaceRecency();
      notifyContentListChanged();
      onContentListChanged?.(item._id.toString());
      onRefresh();
    } catch (error) {
      console.error('Error deleting content item:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete content item');
    }
  };

  const handleContentItemTitleUpdate = async (item: IContentItem, title: string) => {
    const id = item._id.toString();
    const trimmed = title.trim();
    if (!trimmed) return;
    const previousTitle = item.title;
    setProjectContentItems((prev) =>
      prev.map((c) => (c._id.toString() === id ? ({ ...c, title: trimmed } as IContentItem) : c))
    );
    bumpWorkspaceRecency();
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error('save failed');
      notifyContentListChanged();
    } catch {
      setProjectContentItems((prev) =>
        prev.map((c) => (c._id.toString() === id ? ({ ...c, title: previousTitle } as IContentItem) : c))
      );
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
    bumpWorkspaceRecency();
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
    bumpWorkspaceRecency();
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
    bumpWorkspaceRecency();
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
    bumpWorkspaceRecency();
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

  const handleFieldUpdate = async (field: string, value: unknown) => {
    const optimistic = { ...localProjectRef.current, [field]: value } as IProject;
    setLocalProject(optimistic);
    bumpWorkspaceRecency(optimistic);
    try {
      const updates = { [field]: value };
      await onUpdate(updates);
    } catch (error) {
      console.error('Error in handleFieldUpdate:', error);
      setLocalProject(project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const persistUrlList = async (nextUrls: string[]) => {
    const synced = syncPlatformUrlFields(nextUrls);
    setUrlList(getPlatformUrlList({ ...localProject, ...synced }));
    setLocalProject((prev) => ({ ...prev, ...synced } as IProject));
    try {
      await onUpdate(synced);
    } catch (error) {
      setLocalProject(project);
      setUrlList(getPlatformUrlList(project));
      alert(error instanceof Error ? error.message : 'Failed to save URLs');
    }
  };

  const handleUrlSave = async (index: number, value: string) => {
    const trimmed = value.trim();
    const next = [...urlList];
    if (!trimmed) {
      next.splice(index, 1);
    } else {
      next[index] = trimmed;
    }
    await persistUrlList(next);
  };

  const handleUrlRemove = async (index: number) => {
    await persistUrlList(urlList.filter((_, i) => i !== index));
  };

  const handleAddUrl = () => {
    setUrlList((prev) => [...prev, '']);
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

  const {
    paletteSheetOpen,
    setPaletteSheetOpen,
    paletteDraft,
    setPaletteDraft,
    paletteSaving,
    paletteCopyFeedback,
    openPaletteSheet,
    savePaletteFromDraft,
    clearPalette,
    handleCopyPalette,
  } = useProjectPaletteSheet({ localProject, project, setLocalProject, onUpdate });

  const {
    fontSheetOpen,
    setFontSheetOpen,
    fontDraft,
    setFontDraft,
    fontSaving,
    openFontSheet,
    saveFontFromDraft,
  } = useProjectFontSheet({ localProject, project, setLocalProject, onUpdate });

  useEffect(() => () => {
    estimateTimersRef.current.forEach((t) => clearTimeout(t));
    if (taskSaveDebounceRef.current) clearTimeout(taskSaveDebounceRef.current);
  }, []);

  const persistProjectTasks = useCallback(
    async (
      tasks: IProjectTask[],
      options?: { allowBulkTaskExpand?: boolean; onSuccess?: () => void | Promise<void> }
    ) => {
      taskSaveInFlightRef.current += 1;
      try {
        const payload: Partial<IProject> & { allowBulkTaskExpand?: boolean } = { tasks };
        if (options?.allowBulkTaskExpand) payload.allowBulkTaskExpand = true;
        const saved = await onUpdate(payload);
        if (saved?.tasks) {
          let tasksUnchanged = false;
          setLocalProject((prev) => {
            const mergedTasks = mergeTasksPreservingReferences(prev.tasks, saved.tasks!);
            tasksUnchanged =
              mergedTasks.length === (prev.tasks?.length ?? 0) &&
              mergedTasks.every((t, i) => t === prev.tasks?.[i]);
            const next = {
              ...prev,
              tasks: mergedTasks,
              updatedAt: saved.updatedAt ?? prev.updatedAt,
            } as IProject;
            onProjectPatched?.(next);
            return next;
          });
          if (!tasksUnchanged) {
            setTaskAssetsRefreshToken((n) => n + 1);
          }
        } else if (saved) {
          onProjectPatched?.(saved);
        }
        await options?.onSuccess?.();
      } catch (error) {
        console.error('Error saving tasks:', error);
        setLocalProject(project);
        alert(error instanceof Error ? error.message : 'Failed to save');
        throw error;
      } finally {
        taskSaveInFlightRef.current -= 1;
        if (taskSaveInFlightRef.current === 0 && pendingProjectSyncRef.current) {
          const pending = pendingProjectSyncRef.current;
          pendingProjectSyncRef.current = null;
          setLocalProject(pending);
        }
      }
    },
    [onUpdate, onProjectPatched, project]
  );

  const queueProjectTasksSave = useCallback(
    (
      tasks: IProjectTask[],
      options?: {
        allowBulkTaskExpand?: boolean;
        immediate?: boolean;
        onSuccess?: () => void | Promise<void>;
      }
    ) => {
      pendingTaskSaveRef.current = {
        tasks,
        allowBulkTaskExpand: options?.allowBulkTaskExpand,
        onSuccess: options?.onSuccess,
      };
      if (options?.immediate) {
        if (taskSaveDebounceRef.current) {
          clearTimeout(taskSaveDebounceRef.current);
          taskSaveDebounceRef.current = null;
        }
        const pending = pendingTaskSaveRef.current;
        pendingTaskSaveRef.current = null;
        if (pending) {
          void persistProjectTasks(pending.tasks, {
            allowBulkTaskExpand: pending.allowBulkTaskExpand,
            onSuccess: pending.onSuccess,
          });
        }
        return;
      }
      if (taskSaveDebounceRef.current) clearTimeout(taskSaveDebounceRef.current);
      taskSaveDebounceRef.current = setTimeout(() => {
        taskSaveDebounceRef.current = null;
        const pending = pendingTaskSaveRef.current;
        pendingTaskSaveRef.current = null;
        if (pending) {
          void persistProjectTasks(pending.tasks, {
            allowBulkTaskExpand: pending.allowBulkTaskExpand,
            onSuccess: pending.onSuccess,
          });
        }
      }, 300);
    },
    [persistProjectTasks]
  );

  const flushPendingTaskSaves = useCallback(async () => {
    if (taskSaveDebounceRef.current) {
      clearTimeout(taskSaveDebounceRef.current);
      taskSaveDebounceRef.current = null;
    }
    const pending = pendingTaskSaveRef.current;
    pendingTaskSaveRef.current = null;
    if (pending) {
      await persistProjectTasks(pending.tasks, {
        allowBulkTaskExpand: pending.allowBulkTaskExpand,
        onSuccess: pending.onSuccess,
      });
    }
  }, [persistProjectTasks]);

  useEffect(() => {
    registerFlushPendingSaves?.(flushPendingTaskSaves);
    return () => registerFlushPendingSaves?.(null);
  }, [registerFlushPendingSaves, flushPendingTaskSaves]);

  const patchContributorTask = useCallback(
    async (
      taskIndex: number,
      fields: { name?: string; description?: string; estimatedHours?: number }
    ) => {
      const proj = localProjectRef.current;
      const task = proj.tasks?.[taskIndex];
      if (!task) return;

      const taskId = taskIdString(task);
      const response = await fetch(`/api/tasks/${taskIndex}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: proj._id.toString(),
          taskIndex,
          taskId,
          ...fields,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save task');
      }

      const data = (await response.json()) as {
        task?: IProjectTask;
        projectUpdatedAt?: string;
      };
      const projectUpdatedAt = data.projectUpdatedAt
        ? new Date(data.projectUpdatedAt)
        : new Date();

      setLocalProject((prev) => {
        const tasks = [...(prev.tasks || [])];
        if (data.task) {
          tasks[taskIndex] = data.task;
        } else {
          tasks[taskIndex] = { ...tasks[taskIndex], ...fields };
        }
        const next = { ...prev, tasks, updatedAt: projectUpdatedAt } as IProject;
        onProjectPatched?.(next);
        return next;
      });
      setTaskAssetsRefreshToken((n) => n + 1);
    },
    [onProjectPatched]
  );

  const handleTaskUpdate = async (taskIndex: number, field: string, value: unknown) => {
    if (field === 'status' && !isManagerOrAdmin) {
      const previousTasks = [...(localProject.tasks || [])];
      const optimisticTasks = [...previousTasks];
      const existingTask = optimisticTasks[taskIndex];
      if (!existingTask) return;
      optimisticTasks[taskIndex] = { ...existingTask, status: value as TaskStatus };
      setLocalProject((prev) => ({ ...prev, tasks: optimisticTasks } as IProject));
      bumpWorkspaceRecency({ ...localProjectRef.current, tasks: optimisticTasks } as IProject);
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
          task?: { status?: TaskStatus; completedAt?: string | Date };
          status?: TaskStatus;
          projectUpdatedAt?: string;
        };
        const savedStatus = data.task?.status ?? data.status ?? (value as TaskStatus);
        const projectUpdatedAt = data.projectUpdatedAt
          ? new Date(data.projectUpdatedAt)
          : new Date();
        setLocalProject((prev) => {
          const tasks = [...(prev.tasks || [])];
          const task = tasks[taskIndex];
          if (task) {
            tasks[taskIndex] = {
              ...task,
              status: savedStatus,
              ...(savedStatus === 'completed'
                ? {
                    completedAt:
                      data.task?.completedAt != null
                        ? new Date(data.task.completedAt)
                        : new Date(),
                  }
                : { completedAt: undefined }),
            };
          }
          const next = { ...prev, tasks, updatedAt: projectUpdatedAt } as IProject;
          onProjectPatched?.(next);
          return next;
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

    const contributorPatchFields = new Set(['name', 'description', 'estimatedHours']);
    if (!isManagerOrAdmin && contributorPatchFields.has(field)) {
      const previousTasks = [...(localProject.tasks || [])];
      const updatedTasks = [...previousTasks];
      const existingTask = updatedTasks[taskIndex];
      if (!existingTask) return;
      updatedTasks[taskIndex] = { ...existingTask, [field]: value };
      setLocalProject((prev) => ({ ...prev, tasks: updatedTasks } as IProject));
      bumpWorkspaceRecency({ ...localProjectRef.current, tasks: updatedTasks } as IProject);
      try {
        await patchContributorTask(taskIndex, { [field]: value } as {
          name?: string;
          description?: string;
          estimatedHours?: number;
        });
      } catch (error) {
        console.error('Error updating task:', error);
        setLocalProject((prev) => ({ ...prev, tasks: previousTasks } as IProject));
        alert(error instanceof Error ? error.message : 'Failed to save');
      }
      return;
    }

    const proj = localProjectRef.current;
    const updatedTasks = [...(proj.tasks || [])];
    const previousStatus = updatedTasks[taskIndex]?.status;
    const updatedTask = {
      ...updatedTasks[taskIndex],
      [field]: field === 'startDate' || field === 'endDate' ? value ?? null : value,
    };

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
    const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(
      getProjectTeamForTasks(proj),
      updatedTasks
    );
    setLocalProject((prev) => ({ ...prev, tasks: tasksToSave } as IProject));
    bumpWorkspaceRecency({ ...proj, tasks: tasksToSave } as IProject);
    const onSuccess =
      field === 'status' && previousStatus !== 'completed' && value === 'completed'
        ? async () => {
            setTaskAssetsRefreshToken((n) => n + 1);
            await loadLinkedAssets();
          }
        : undefined;
    queueProjectTasksSave(tasksToSave, { immediate: field === 'status', onSuccess });
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
      const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(getProjectTeamForTasks(proj), updatedTasks);
      const optimistic = { ...proj, tasks: tasksToSave } as IProject;
      setLocalProject(optimistic);
      bumpWorkspaceRecency(optimistic);
      try {
        if (!isManagerOrAdmin) {
          await patchContributorTask(taskIndex, {
            estimatedHours: hours,
            name: mergedName,
          });
        } else {
          await persistProjectTasks(tasksToSave);
        }
      } catch (error) {
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
    [persistProjectTasks, patchContributorTask, isManagerOrAdmin, bumpWorkspaceRecency]
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
        requestAnimationFrame(() => scrollTaskRowIntoView(taskIndex, 'smooth'));
      }
    }, 600);
    timers.set(taskIndex, timer);
  }, [applyTaskEstimatedHours, scrollTaskRowIntoView]);

  const handleTaskNameSave = async (taskIndex: number, name: string) => {
    await handleTaskUpdate(taskIndex, 'name', name);
    scheduleTaskHourEstimate(taskIndex, name);
  };

  useEffect(() => {
    if (pendingScrollToTaskIndex == null) return;
    const idx = pendingScrollToTaskIndex;
    const tasks = localProject.tasks || [];
    if (idx < 0 || idx >= tasks.length) return;
    setPendingScrollToTaskIndex(null);
    setHighlightedTaskIndex(idx);
    scrollTaskRowIntoView(idx, 'smooth');
    const retryTimer = window.setTimeout(() => scrollTaskRowIntoView(idx, 'smooth'), 400);
    const clearHighlightTimer = window.setTimeout(() => setHighlightedTaskIndex(null), 2400);
    requestAnimationFrame(() => {
      const pendingEstimate = pendingNamedTaskEstimateRef.current;
      if (pendingEstimate && pendingEstimate.index === idx) {
        pendingNamedTaskEstimateRef.current = null;
        scheduleTaskHourEstimate(idx, pendingEstimate.name);
      }
    });
    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [localProject.tasks, pendingScrollToTaskIndex, scrollTaskRowIntoView, scheduleTaskHourEstimate]);

  const computedProjectHours = useMemo(
    () => computeProjectAssignedHours(localProject, projectContentItems),
    [localProject, projectContentItems]
  );

  const handleSubmitForReview = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'in-review'); setShowTaskActions(false); };
  const handleCompleteTask = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'completed'); setShowTaskActions(false); };
  const handleDeclineReview = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'active'); setShowTaskActions(false); };
  const handleDeleteTask = async (taskIndex: number) => {
    const tasks = localProject.tasks || [];
    const task = tasks[taskIndex];
    if (!task) return;

    try {
      if (isManagerOrAdmin) {
        const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(
          getProjectTeamForTasks(localProject),
          tasks.filter((_, idx) => idx !== taskIndex)
        );
        await persistProjectTasks(tasksToSave);
      } else {
        const taskId = taskIdString(task);
        const response = await fetch(`/api/tasks/${taskIndex}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: localProject._id.toString(),
            taskIndex,
            taskId,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete task');
        }
        const data = (await response.json()) as {
          tasks?: IProject['tasks'];
          projectUpdatedAt?: string;
        };
        const nextProject = {
          ...localProject,
          tasks: data.tasks ?? tasks.filter((_, idx) => idx !== taskIndex),
          updatedAt: data.projectUpdatedAt
            ? new Date(data.projectUpdatedAt)
            : localProject.updatedAt,
        } as IProject;
        setLocalProject(nextProject);
        onProjectPatched?.(nextProject);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete task');
    }
    setShowTaskActions(false);
    setSelectedTaskIndex(null);
  };
  const canContributeToProject = canUserContributeToProject(
    localProject,
    currentUserEmployeeId ?? null,
    isManagerOrAdmin
  );
  const canAddContent = canAddContentToProject(
    localProject,
    isManagerOrAdmin,
    currentUserEmployeeId ?? null
  );

  const commitAddTasks = async (tasksToAppend: NonNullable<IProject['tasks']>) => {
    const prevTasks = localProject.tasks || [];
    const newIdx = prevTasks.length + tasksToAppend.length - 1;

    if (!isManagerOrAdmin) {
      const optimisticProject = {
        ...localProject,
        tasks: [...prevTasks, ...tasksToAppend],
      } as IProject;
      setLocalProject(optimisticProject);
      bumpWorkspaceRecency(optimisticProject);
      setTasksExpanded(true);
      setTaskTab('active');
      setPendingScrollToTaskIndex(newIdx);
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
        const data = (await res.json()) as {
          tasks: IProject['tasks'];
          addedFromIndex?: number;
        };
        const nextProject = { ...localProject, tasks: data.tasks ?? localProject.tasks } as IProject;
        setLocalProject(nextProject);
        onProjectPatched?.(nextProject);
      } catch (error) {
        console.error('Error adding task:', error);
        setLocalProject(project);
        setPendingScrollToTaskIndex(null);
        alert(error instanceof Error ? error.message : 'Failed to save');
      }
      return;
    }

    const nextTasks = [...prevTasks, ...tasksToAppend];
    const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(getProjectTeamForTasks(localProject), nextTasks);
    const addedIdx = tasksToSave.length - 1;
    const optimisticProject = { ...localProject, tasks: tasksToSave } as IProject;
    setLocalProject(optimisticProject);
    bumpWorkspaceRecency(optimisticProject);
    setTasksExpanded(true);
    setTaskTab('active');
    setPendingScrollToTaskIndex(addedIdx);
    try {
      await persistProjectTasks(tasksToSave);
    } catch (error) {
      console.error('Error adding task:', error);
      setLocalProject(project);
      setPendingScrollToTaskIndex(null);
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const applyTaskRecurrence = useCallback(
    async (taskIndex: number, recurrence: TaskRecurrenceValue) => {
      if (recurrence.preset === 'none') return;

      const tasks = localProjectRef.current.tasks || [];
      const task = tasks[taskIndex];
      if (!task || task.recurrenceSeriesId) return;

      const flightKey =
        (task as { _id?: { toString?: () => string } })._id?.toString?.() ?? `index:${taskIndex}`;
      if (recurrenceInFlightRef.current.has(flightKey)) return;
      recurrenceInFlightRef.current.add(flightKey);

      try {
        const instances = expandTaskInstances(task, {
          preset: recurrence.preset as Exclude<RecurrencePreset, 'none'>,
        });
        const nextTasks = [
          ...tasks.slice(0, taskIndex),
          ...instances,
          ...tasks.slice(taskIndex + 1),
        ];
        const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(
          getProjectTeamForTasks(localProjectRef.current),
          nextTasks
        );
        setLocalProject((prev) => ({ ...prev, tasks: tasksToSave } as IProject));
        await persistProjectTasks(tasksToSave, { allowBulkTaskExpand: true });
        setTasksExpanded(true);
        setTaskTab('active');
        setPendingScrollToTaskIndex(taskIndex);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Invalid recurrence settings');
      } finally {
        recurrenceInFlightRef.current.delete(flightKey);
      }
    },
    [persistProjectTasks]
  );

  const applyExtendTaskSeries = useCallback(
    async (seriesId: string, unit: ExtendUnit) => {
      const tasks = localProjectRef.current.tasks || [];
      const seriesTasks = tasks.filter((t) => t.recurrenceSeriesId === seriesId);
      if (seriesTasks.length === 0) return;

      const sorted = [...seriesTasks].sort(
        (a, b) =>
          (parseDateSafe(a.startDate)?.getTime() ?? 0) - (parseDateSafe(b.startDate)?.getTime() ?? 0)
      );
      const last = sorted[sorted.length - 1];
      if (!last?.startDate) return;
      const preset = (last.recurrencePreset ?? 'weekly') as RecurrencePreset;
      const extensionDates = expandExtensionDates(new Date(last.startDate), preset, unit);
      if (extensionDates.length === 0) return;

      const newInstances = expandTaskExtensionInstances(last, extensionDates);
      const { tasks: tasksToSave } = sanitizeTaskAssigneesForProjectTeam(
        getProjectTeamForTasks(localProjectRef.current),
        [...tasks, ...newInstances]
      );
      setLocalProject((prev) => ({ ...prev, tasks: tasksToSave } as IProject));
      try {
        await persistProjectTasks(tasksToSave, { allowBulkTaskExpand: true });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to extend series');
      }
    },
    [persistProjectTasks]
  );

  const reloadProjectContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/content-items?projectId=${localProjectRef.current._id}`);
      if (res.ok) {
        const data = await res.json();
        setProjectContentItems(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
    notifyContentListChanged();
  }, [notifyContentListChanged]);

  const applyContentRecurrence = useCallback(
    async (item: IContentItem, preset: RecurrencePreset) => {
      if (preset === 'none' || item.recurrenceSeriesId) return;
      try {
        const res = await fetch(`/api/content-items/${item._id}/recurrence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to apply repeat');
        }
        await reloadProjectContent();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to apply repeat');
      }
    },
    [reloadProjectContent]
  );

  const extendContentSeries = useCallback(
    async (seriesId: string, unit: ExtendUnit) => {
      try {
        const res = await fetch('/api/content-items/extend-series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId, unit }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to extend series');
        }
        await reloadProjectContent();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to extend series');
      }
    },
    [reloadProjectContent]
  );

  const buildNewTaskPayload = (name: string): NonNullable<IProject['tasks']>[number] => {
    const task: NonNullable<IProject['tasks']>[number] = {
      name: name.trim(),
      description: '',
      status: 'active' as TaskStatus,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedHours: 0,
    };
    if (!isManagerOrAdmin && currentUserEmployeeId) {
      (task as { assignedToEmployeeIds?: string[] }).assignedToEmployeeIds = [
        currentUserEmployeeId,
      ];
    }
    return task;
  };

  const submitDraftTask = (name: string) => {
    const normalized = name.trim();
    setDraftTaskOpen(false);
    setAddTaskNameDraft('');
    if (!normalized) return;
    const prevLen = (localProject.tasks || []).length;
    pendingNamedTaskEstimateRef.current = { index: prevLen, name: normalized };
    void commitAddTasks([buildNewTaskPayload(normalized)]);
  };

  const handleDraftTaskBlur = () => {
    // Only auto-discard when nothing was typed. If the user switches browser tabs (or
    // clicks elsewhere) mid-name, keep the draft open with their text intact instead of
    // finalizing it as a task — they can resume typing when they come back.
    if (!addTaskNameDraft.trim()) {
      setDraftTaskOpen(false);
      setAddTaskNameDraft('');
    }
  };

  const userCanDeleteTask = useCallback(
    (task: IProjectTask) =>
      canDeleteTask({
        task,
        isManagerOrAdmin,
        currentUserEmployeeId,
      }),
    [isManagerOrAdmin, currentUserEmployeeId]
  );

  const userCanDeleteContentItem = useCallback(
    (item: IContentItem) =>
      canDeleteContentItem({
        item,
        isManagerOrAdmin,
        currentUserId,
        currentUserEmployeeId,
      }),
    [isManagerOrAdmin, currentUserId, currentUserEmployeeId]
  );

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
    handleOpenDraftTask();
    onAutoAddTaskConsumed?.();
  }, [autoAddTaskOnOpen, canContributeToProject, project._id, onAutoAddTaskConsumed, handleOpenDraftTask]);

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

  return (
    <div className="space-y-4">
      {sectionsOnly !== 'tasks-content' && (
      <>
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
            <div className="mt-3 w-full max-w-md">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Progress</span>
                <span className="text-xs font-medium text-gray-700">{localProject.tasks?.length ? Math.round((localProject.tasks.filter((t) => t.status === 'completed').length / localProject.tasks.length) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${localProject.tasks?.length ? Math.round((localProject.tasks.filter((t) => t.status === 'completed').length / localProject.tasks.length) * 100) : 0}%` }} 
                />
              </div>
            </div>
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
          <div className="w-full basis-full">
            <PlatformUrlsSection
              urlList={urlList}
              isManagerOrAdmin={isManagerOrAdmin}
              onUrlSave={handleUrlSave}
              onUrlRemove={handleUrlRemove}
              onAddUrl={handleAddUrl}
              titleClassName="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
              editableClassName="min-w-0 max-w-[14rem] sm:max-w-[18rem] text-gray-900"
              emptyClassName="text-gray-400 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm min-w-0 w-full basis-full">
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
            <ProjectTechStackBar
              techStack={(localProject.techStack ?? []) as IProjectTechStackItem[]}
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
            <ProjectMarketingStackBar
              marketingStack={(localProject.marketingStack ?? []) as IProjectMarketingStackItem[]}
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
            <ProjectCustomPlatformStacks
              platformStacks={localProject.platformStacks}
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
            const linkHref = emailLink?.href ?? normalizeProjectUrlHref(btn.url) ?? '#';
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
          ) : projectLinkedAssets.length === 0 ? (
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
                  All ({projectLinkedAssets.length})
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
                    const href = linkedAssetHref(asset);
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

      {isManagerOrAdmin && <InsightsPanel ownerType="project" ownerId={localProject._id.toString()} />}
      </>
      )}

      <CollapsibleInspectorSection
        id="inspector-tasks-section"
        title="Tasks"
        titleSuffix={
          <span className="text-sm font-normal text-gray-500">({activeTaskDisplayCount} active)</span>
        }
        collapsedSummary={`${activeTaskDisplayCount} active`}
        expanded={tasksExpanded}
        onToggle={() => setTasksExpanded((v) => !v)}
        headerActions={
          canContributeToProject ? (
            <Button size="sm" onClick={handleOpenDraftTask}>
              + Add Task
            </Button>
          ) : undefined
        }
      >
        <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
          <button onClick={() => setTaskTab('active')} className={`text-sm font-medium px-2 py-1 rounded-md ${taskTab === 'active' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Active ({activeTaskDisplayCount})</button>
          <button onClick={() => setTaskTab('completed')} className={`text-sm font-medium px-2 py-1 rounded-md ${taskTab === 'completed' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Completed ({completedTaskDisplayCount})</button>
        </div>
        {!draftTaskOpen && visibleTaskEntries.length === 0 ? (
          <EmptyStateIllustration
            title={`No ${taskTab} tasks`}
            description={`There are no ${taskTab} tasks. Add a task to start tracking work.`}
          />
        ) : (
          <div className="space-y-3">
            {visibleTaskEntries.map(({ task, idx }) => {
              const taskKey = taskItemKeyFor(task, idx);
              const taskSeenStatus: ItemSeenStatus = canShowTaskNewIndicator(task)
                ? (itemStatusByKey[taskKey] ?? 'none')
                : 'none';
              const rowKey = `task-${idx}`;
              const taskRowId = taskIdString(task) ?? rowKey;

              return (
                <div
                  key={rowKey}
                  className={
                    highlightedTaskIndex === idx
                      ? 'rounded-lg ring-2 ring-primary/40 bg-primary/5'
                      : undefined
                  }
                >
                <SwipeableCard
                  rightActions={
                    userCanDeleteTask(task)
                      ? [{ label: 'Delete', color: '#ef4444', onClick: () => handleDeleteTask(idx) }]
                      : []
                  }
                  leftActions={[{ label: task.status === 'in-review' ? 'Approve' : 'Complete', color: '#22c55e', onClick: () => handleCompleteTask(idx) }]}
                >
                  <div id={`inspector-task-row-${idx}`} className="p-4 scroll-mt-6 scroll-mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-1">
                          <ItemSeenTag status={taskSeenStatus} />
                          <EditableText
                            value={task.name}
                            onSave={(v) => handleTaskNameSave(idx, v)}
                            className={`font-medium whitespace-pre-wrap ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                            placeholder="Task name"
                            multiline
                            disabled={!canContributeToProject}
                          />
                        </div>
                        {canContributeToProject && (
                          <EditableText
                            value={task.description || ''}
                            onSave={(v) => handleTaskUpdate(idx, 'description', v)}
                            className="text-sm text-gray-500 mt-1"
                            placeholder="Add description..."
                            multiline
                            disabled={!canContributeToProject}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <EditableSelect value={task.status || 'active'} options={taskStatusOptions} onSave={(v) => handleTaskUpdate(idx, 'status', v)} showColorDot className="text-xs text-gray-900" />
                        {userCanDeleteTask(task) && (
                          <button type="button" onClick={() => { if (confirm('Delete this task? This cannot be undone.')) handleDeleteTask(idx); }} className="text-red-600 hover:text-red-700 text-sm px-2 py-1">Delete</button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <EditableDate value={task.startDate ?? null} onSave={(v) => handleTaskUpdate(idx, 'startDate', v)} className="text-gray-900 leading-none py-0" placeholder="Start" disabled={!isManagerOrAdmin} clearable />
                        <span className="leading-none">→</span>
                        <EditableDate value={task.endDate ?? null} onSave={(v) => handleTaskUpdate(idx, 'endDate', v)} className="text-gray-900 leading-none py-0" placeholder="End" disabled={!isManagerOrAdmin} clearable />
                      </div>
                      {canContributeToProject && task.recurrenceSeriesId ? (
                        <>
                          {(() => {
                            const pos = getTaskSeriesPosition(task, localProject.tasks ?? []);
                            if (!pos) return null;
                            return (
                              <>
                                <SeriesPositionBadge index={pos.index} total={pos.total} />
                                {shouldShowExtendSeries(pos) && (
                                  <ExtendSeriesSelect
                                    disabled={!canContributeToProject}
                                    onExtend={(unit) => void applyExtendTaskSeries(task.recurrenceSeriesId!, unit)}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </>
                      ) : canContributeToProject ? (
                        <TaskRecurrenceInline
                          onRecurrenceChange={(value) => void applyTaskRecurrence(idx, value)}
                        />
                      ) : null}
                      <span className="inline-flex items-center min-w-[4.5rem]">
                        {estimatingTaskIndices.has(idx) ? (
                          <span className="text-gray-400 italic leading-none">Estimating…</span>
                        ) : (
                          <EditableNumber value={task.estimatedHours} onSave={(v) => handleTaskUpdate(idx, 'estimatedHours', v)} className="leading-none py-0" suffix="h" min={0} placeholder="Hours" disabled={!isManagerOrAdmin} />
                        )}
                      </span>
                      {employees.length > 0 && (
                        <div className="flex flex-col gap-0.5 min-w-[8rem]">
                          <div className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <MultiSelect
                              value={getTaskAssigneeEmployeeIds(task)}
                              options={taskAssigneeSelectOptions(employees, projectTeamForTasks, getTaskAssigneeEmployeeIds(task))}
                              onChange={(selectedIds) => handleTaskUpdate(idx, 'assignedToEmployeeIds', selectedIds)}
                              disabled={!isManagerOrAdmin}
                              className="text-xs min-w-[8rem]"
                            />
                          </div>
                          {!isTaskAssigneeOnProjectTeam(projectTeamForTasks, task) && (
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
                          projectId={localProject._id.toString()}
                          canAddAssets={canContributeToProject}
                          linkContext={{
                            linkedProjectId: localProject._id.toString(),
                            linkedProjectTaskId: (localProject.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString(),
                            linkedProjectTaskIndex: idx,
                          }}
                          onAssetsChanged={() => {
                            setTaskAssetsRefreshToken((n) => n + 1);
                            void loadLinkedAssets();
                          }}
                          onMetaChange={(meta) => handleTaskCommentMetaChange(idx, meta)}
                        />
                      </CommentsCollapsibleSection>
                    </div>
                    <TaskLinkedAssets
                      key={`task-assets-${(localProject.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString() ?? idx}-${taskAssetsRefreshToken}`}
                      project={localProject}
                      taskId={(localProject.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString()}
                      taskIndex={idx}
                      isManagerOrAdmin={isManagerOrAdmin}
                      currentUserId={currentUserId}
                      currentUserEmployeeId={currentUserEmployeeId}
                      refreshToken={taskAssetsRefreshToken}
                      showAddHintText
                      onAssetsChanged={() => {
                        setTaskAssetsRefreshToken((n) => n + 1);
                        void loadLinkedAssets();
                      }}
                    />
                  </div>
                </SwipeableCard>
                </div>
              );
            })}
            {draftTaskOpen && canContributeToProject && taskTab === 'active' && (
              <div
                id="inspector-task-draft-row"
                className="p-4 scroll-mt-6 scroll-mb-4 ring-2 ring-primary/40 bg-primary/5 rounded-lg"
              >
                <p className="text-xs font-medium text-primary mb-2">New task — name it below</p>
                <AutoGrowTextarea
                  id="inspector-task-draft-name"
                  ref={addTaskInputRef}
                  minRows={1}
                  value={addTaskNameDraft}
                  onChange={(e) => setAddTaskNameDraft(e.target.value)}
                  onBlur={handleDraftTaskBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDraftTaskOpen(false);
                      setAddTaskNameDraft('');
                      return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitDraftTask(addTaskNameDraft);
                    }
                  }}
                  placeholder="What needs to be done?"
                  aria-label="New task name"
                  className={`${formInputClassInspector} text-sm font-medium focus:ring-2 focus:ring-primary`}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => submitDraftTask(addTaskNameDraft)}
                    disabled={!addTaskNameDraft.trim()}
                  >
                    Add task
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDraftTaskOpen(false);
                      setAddTaskNameDraft('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleInspectorSection>

      <CollapsibleInspectorSection
        id="inspector-content-section"
        title="Content"
        titleSuffix={
          <span className="text-sm font-normal text-gray-500">({activeContentDisplayCount} active)</span>
        }
        collapsedSummary={`${activeContentDisplayCount} active`}
        expanded={contentExpanded}
        onToggle={() => setContentExpanded((v) => !v)}
        headerActions={
          canAddContent ? (
            <Button size="sm" onClick={handleOpenAddContent}>
              + Add Content
            </Button>
          ) : undefined
        }
      >
        {addContentOpen && canAddContent && (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <ContentItemCreateForm
              project={localProject}
              clients={clients}
              employees={employees}
              isManagerOrAdmin={isManagerOrAdmin}
              defaultPublishDate={addContentDefaultDate}
              initialTitle={addContentPrefill?.title}
              initialChannel={addContentPrefill?.channel}
              initialNotes={addContentPrefill?.notes}
              active={addContentOpen}
              embeddedInInspector
              onCancel={() => setAddContentOpen(false)}
              onSuccess={() => {
                setAddContentPrefill(null);
                setAddContentDefaultDate(undefined);
                setAddContentOpen(false);
                onContentListChanged?.();
              }}
            />
          </div>
        )}
        <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
          <button onClick={() => setContentTab('active')} className={`text-sm font-medium px-2 py-1 rounded-md ${contentTab === 'active' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Active ({activeContentDisplayCount})</button>
          <button onClick={() => setContentTab('completed')} className={`text-sm font-medium px-2 py-1 rounded-md ${contentTab === 'completed' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Completed ({completedContentDisplayCount})</button>
        </div>
        {visibleContentItems.length === 0 ? (
          <EmptyStateIllustration
            title={`No ${contentTab} content`}
            description={`You don't have any ${contentTab} content items yet. Add content from the calendar or right here.`}
          />
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
                  <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1">
                      <ItemSeenTag status={contentSeenStatus} />
                      <EditableText
                        value={item.title}
                        onSave={(v) => handleContentItemTitleUpdate(item, v)}
                        className={`font-medium ${contentTab === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                        placeholder="Content title"
                        autoMultilineAfter={100}
                        disabled={!isManagerOrAdmin}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <EditableSelect
                      value={item.status}
                      options={contentStatusOptions}
                      onSave={(v) => handleContentItemStatusUpdate(item, v as ContentStatus)}
                      disabled={!canEditContentItemStatus(item)}
                      showColorDot
                      className="text-xs text-gray-900"
                    />
                    {userCanDeleteContentItem(item) && (
                      <button type="button" onClick={() => handleDeleteContentItem(item)} className="text-red-600 hover:text-red-700 text-sm px-2 py-1">Delete</button>
                    )}
                  </div>
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
                  {canContributeToProject && item.recurrenceSeriesId ? (
                    <>
                      {(() => {
                        const pos = getContentSeriesPosition(item, projectContentItems);
                        if (!pos) return null;
                        return (
                          <>
                            <SeriesPositionBadge index={pos.index} total={pos.total} />
                            {shouldShowExtendSeries(pos) && (
                              <ExtendSeriesSelect
                                disabled={!canContributeToProject}
                                onExtend={(unit) => void extendContentSeries(item.recurrenceSeriesId!, unit)}
                              />
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : canContributeToProject && !item.recurrenceSeriesId ? (
                    <TaskRecurrenceInline
                      onRecurrenceChange={(value) =>
                        void applyContentRecurrence(item, value.preset)
                      }
                    />
                  ) : null}
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
      </CollapsibleInspectorSection>

      {sectionsOnly !== 'tasks-content' && (
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
      )}

      {/* Task Actions */}
      <TaskActionsModal
        isOpen={showTaskActions && selectedTaskIndex !== null}
        task={selectedTaskIndex !== null ? localProject.tasks?.[selectedTaskIndex] : undefined}
        isManagerOrAdmin={isManagerOrAdmin}
        canDeleteTask={
          selectedTaskIndex !== null &&
          !!localProject.tasks?.[selectedTaskIndex] &&
          userCanDeleteTask(localProject.tasks[selectedTaskIndex])
        }
        onClose={() => {
          setShowTaskActions(false);
          setSelectedTaskIndex(null);
        }}
        onSubmitForReview={() => selectedTaskIndex !== null && handleSubmitForReview(selectedTaskIndex)}
        onCompleteTask={() => selectedTaskIndex !== null && handleCompleteTask(selectedTaskIndex)}
        onDeclineReview={() => selectedTaskIndex !== null && handleDeclineReview(selectedTaskIndex)}
        onDeleteTask={() => selectedTaskIndex !== null && handleDeleteTask(selectedTaskIndex)}
      />

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
        maxWidth="5xl"
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
      <ProjectPaletteSheetModal
        isOpen={paletteSheetOpen}
        paletteDraft={paletteDraft}
        paletteSaving={paletteSaving}
        paletteCopyFeedback={paletteCopyFeedback}
        setPaletteDraft={setPaletteDraft}
        onClose={() => setPaletteSheetOpen(false)}
        onSave={savePaletteFromDraft}
        onClear={clearPalette}
        onCopy={handleCopyPalette}
      />

      {/* Project font listing */}
      <ProjectFontSheetModal
        isOpen={fontSheetOpen}
        fontDraft={fontDraft}
        fontSaving={fontSaving}
        setFontDraft={setFontDraft}
        onClose={() => setFontSheetOpen(false)}
        onSave={saveFontFromDraft}
      />

      <ImagePreviewModal
        isOpen={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src ?? null}
        title={previewImage?.title}
      />
    </div>
  );
}

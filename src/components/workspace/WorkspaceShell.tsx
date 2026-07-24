'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { IClient } from '@/lib/models/Client';
import useWorkspaceData, { PhaseType, LensType } from '@/lib/hooks/useWorkspaceData';
import { PlatformCatalogProvider } from '@/contexts/PlatformCatalogContext';
import useWorkspaceMeetings from '@/lib/hooks/useWorkspaceMeetings';
import useIsMobile from '@/lib/hooks/useIsMobile';
import { useMobileInspectorHistory } from '@/hooks/useMobileInspectorHistory';
import PhaseFilter from '@/components/workspace/PhaseFilter';
import LensBar from '@/components/workspace/LensBar';
import WorkspaceLensSelect from '@/components/workspace/WorkspaceLensSelect';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import ScheduleLens from '@/components/workspace/ScheduleLens';
import AgendaView from '@/components/workspace/AgendaView';
import ClientScheduleLens from '@/components/workspace/ClientScheduleLens';
import ClientCreateModal from '@/components/workspace/ClientCreateModal';
import OrganizationBrand from '@/components/organization/OrganizationBrand';
import SchedulingPanel from '@/components/scheduling/SchedulingPanel';
import SchedulingCalendarBar from '@/components/scheduling/SchedulingCalendarBar';
import SchedulingHeaderToolbar from '@/components/scheduling/SchedulingHeaderToolbar';
import AvailabilityModal from '@/components/scheduling/AvailabilityModal';
import CreateMeetingModal from '@/components/scheduling/CreateMeetingModal';
import ScreenshotToolModal from '@/components/shared/ScreenshotToolModal';
import ScreenshotSaveDialog from '@/components/shared/ScreenshotSaveDialog';
import RecordingToolModal from '@/components/shared/RecordingToolModal';
import RecordingSaveDialog from '@/components/shared/RecordingSaveDialog';
import RecordingOverlay from '@/components/shared/RecordingOverlay';
import RecordingStatusBanner from '@/components/shared/RecordingStatusBanner';
import { getScreenshotCaptureMode, getRecordingCaptureMode, isTouchMobileDevice } from '@/lib/capture/mobileCapture';
import { useScreenshotUpload } from '@/hooks/useScreenshotUpload';
import { useRecordingUpload } from '@/hooks/useRecordingUpload';
import { useGoogleWorkspaceResume } from '@/hooks/google/useGoogleWorkspaceResume';
import { useSchedulingCalendar } from '@/hooks/scheduling/useSchedulingCalendar';
import { useSchedulingAvailability } from '@/hooks/scheduling/useSchedulingAvailability';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import QuickProjectForm from '@/components/planning-map/QuickProjectForm';
import ContentItemCreateModal from '@/components/planning-map/ContentItemCreateModal';
import CreateMenu from '@/components/workspace/CreateMenu';
import LinkTargetPickerModal from '@/components/workspace/LinkTargetPickerModal';
import { filterContributableProjects } from '@/lib/utils/projectTeam';
import InspectorHost from '@/components/workspace/InspectorHost';
import Modal from '@/components/ui/Modal';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import WorkspaceEmailDigestSelect from '@/components/workspace/WorkspaceEmailDigestSelect';
import WorkspaceTeamFilter from '@/components/workspace/WorkspaceTeamFilter';
import WorkspaceLensToolbar from '@/components/workspace/WorkspaceLensToolbar';
import WorkspaceViewOptions, { countActiveViewOptions } from '@/components/workspace/WorkspaceViewOptions';
import WorkspaceViewOptionsSheet from '@/components/workspace/WorkspaceViewOptionsSheet';
import ContentChannelFilter from '@/components/workspace/ContentChannelFilter';
import CommandRegistry from '@/lib/commands/CommandRegistry';
import CommandPalette from '@/components/workspace/CommandPalette';
import VoiceProvider from '@/components/voice/VoiceProvider';
import FeedbackLauncher from '@/components/feedback/FeedbackLauncher';
import VoiceOverlay from '@/components/voice/VoiceOverlay';
import MobileShellBridge from '@/components/mobile/MobileShellBridge';
import { useMobileShell } from '@/contexts/MobileShellContext';
import { PAGE_GUTTER_WIDE_CLASS } from '@/lib/ui/mobileLayout';
import { IntentConfirmationProvider } from '@/components/intent/IntentConfirmationContext';
import { buildWorkspaceIntentContext } from '@/lib/voice/workspaceIntentContext';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';
import { useWorkspaceIntentHandler } from '@/hooks/workspace/useWorkspaceIntentHandler';
import { usePageActivity } from '@/hooks/usePageActivity';
import {
  collectWorkspaceItemObservations,
  markProjectItemsSeen,
  markItemsSeenByKeys,
  readProjectUnseenSections,
  buildTaskItemKey,
  buildContentItemKey,
} from '@/lib/workspace/itemSeenState';
import {
  clearReturnToActionInbox,
  getPendingActionInboxItemKey,
} from '@/lib/mobile/actionInboxReturn';
import PlatformGuideWorkspaceBridge from '@/lib/platformGuide/PlatformGuideWorkspaceBridge';
import { usePlatformGuideOptional } from '@/lib/platformGuide/PlatformGuideProvider';

interface WorkspaceShellProps {
    initialPhase?: PhaseType;
    initialLens?: LensType;
    initialDeepLinkProjectId?: string | null;
    initialDeepLinkTaskId?: string | null;
    initialDeepLinkContentId?: string | null;
    initialDeepLinkClientId?: string | null;
}

export default function WorkspaceShell({
    initialPhase = 'All',
    initialLens = 'schedule',
    initialDeepLinkProjectId = null,
    initialDeepLinkTaskId = null,
    initialDeepLinkContentId = null,
    initialDeepLinkClientId = null,
}: WorkspaceShellProps) {
    const isMobile = useIsMobile();
    const { consumeCreateAction } = useMobileShell();
    const router = useRouter();
    const pathname = usePathname();
    const ws = useWorkspaceData(initialPhase, initialLens);
    const pageActivity = usePageActivity();

    // Inspector / form state
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [createMenuOpen, setCreateMenuOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<IProject | undefined>();
    const [projectFormDefaultClientId, setProjectFormDefaultClientId] = useState<string | null>(null);
    const [addContentProject, setAddContentProject] = useState<IProject | null>(null);
    const [showContentCreateModal, setShowContentCreateModal] = useState(false);
    const [showClientCreateModal, setShowClientCreateModal] = useState(false);
    const [projectPickerMode, setProjectPickerMode] = useState<'task' | 'content' | null>(null);
    const [addContentDefaultDate, setAddContentDefaultDate] = useState<Date | undefined>(undefined);
    const [addContentVoicePrefill, setAddContentVoicePrefill] = useState<{
        title?: string;
        channel?: string;
        notes?: string;
    } | null>(null);

    const [inspectorFocus, setInspectorFocus] = useState<string | null>(null);
    /** When opening a project from a client inspector, return here on close. */
    const [inspectorParentFocus, setInspectorParentFocus] = useState<string | null>(null);
    /** Task row index in `project.tasks` when opening inspector from the schedule (cleared after the project view applies it). */
    const [inspectorOpenTaskIndex, setInspectorOpenTaskIndex] = useState<number | null>(null);
    /** Content item id when opening inspector from schedule content click. */
    const [inspectorOpenContentId, setInspectorOpenContentId] = useState<string | null>(null);
    const [inspectorAutoAddTask, setInspectorAutoAddTask] = useState(false);
    const [inspectorInitialAddContentOpen, setInspectorInitialAddContentOpen] = useState(false);
    const [inspectorAddContentDate, setInspectorAddContentDate] = useState<Date | undefined>(undefined);
    const [inspectorAddContentPrefill, setInspectorAddContentPrefill] = useState<{
        title?: string;
        channel?: string;
        notes?: string;
    } | null>(null);
    const [inspectorInitialTasksExpanded, setInspectorInitialTasksExpanded] = useState(false);
    const [inspectorInitialContentExpanded, setInspectorInitialContentExpanded] = useState(false);
    const deepLinkHandledRef = useRef(false);

    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [showMeetingModal, setShowMeetingModal] = useState(false);
    const [meetingRefreshKey, setMeetingRefreshKey] = useState(0);
    const [contentRefreshTrigger, setContentRefreshTrigger] = useState(0);
    const [itemSeenRefreshTrigger, setItemSeenRefreshTrigger] = useState(0);
    const [scheduleSyncRefreshKey, setScheduleSyncRefreshKey] = useState(0);
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [showScreenshotModal, setShowScreenshotModal] = useState(false);
    const [showRecordingModal, setShowRecordingModal] = useState(false);
    const [schedulePanelMessage, setSchedulePanelMessage] = useState<string | null>(null);
    const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
    const onEnterScheduleSyncRef = useRef<() => void>(() => {});
    const pendingScheduleSyncRef = useRef(false);
    const onSyncBlockedRef = useRef<() => void>(() => {});

    const [showViewOptionsOpen, setShowViewOptionsOpen] = useState(false);
    const [emailDigestInterval, setEmailDigestInterval] = useState('off');

    const viewOptionsProps = useMemo(
        () => ({
            lens: ws.lens,
            isManagerOrAdmin: ws.isManagerOrAdmin,
            showOnlyMyAssignments: ws.showOnlyMyAssignments,
            onShowOnlyMyAssignmentsChange: ws.setShowOnlyMyAssignments,
            showTasks: ws.showTasks,
            onShowTasksChange: ws.setShowTasks,
            showContent: ws.showContent,
            onShowContentChange: ws.setShowContent,
            showMeetings: ws.showMeetings,
            onShowMeetingsChange: ws.setShowMeetings,
            teamFilter: ws.teamFilter,
            onTeamFilterChange: ws.setTeamFilter,
            onEmailDigestIntervalChange: setEmailDigestInterval,
        }),
        [ws.lens, ws.isManagerOrAdmin, ws.showOnlyMyAssignments, ws.setShowOnlyMyAssignments, ws.showTasks, ws.setShowTasks, ws.showContent, ws.setShowContent, ws.showMeetings, ws.setShowMeetings, ws.teamFilter, ws.setTeamFilter]
    );

    const activeViewOptionsCount = useMemo(
        () =>
            countActiveViewOptions({
                lens: ws.lens,
                isManagerOrAdmin: ws.isManagerOrAdmin,
                showOnlyMyAssignments: ws.showOnlyMyAssignments,
                showTasks: ws.showTasks,
                showContent: ws.showContent,
                showMeetings: ws.showMeetings,
                teamFilter: ws.teamFilter,
                emailDigestInterval,
            }),
        [ws.lens, ws.isManagerOrAdmin, ws.showOnlyMyAssignments, ws.showTasks, ws.showContent, ws.showMeetings, ws.teamFilter, emailDigestInterval]
    );

    const platformGuide = usePlatformGuideOptional();


    useEffect(() => {
        const pending = consumeCreateAction();
        if (pending === 'screenshot') setShowScreenshotModal(true);
        else if (pending === 'record') setShowRecordingModal(true);
    }, [consumeCreateAction]);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (!res.ok) return;
                const data = await res.json();
                setIsPlatformAdmin(!!data?.isAdmin);
            } catch {
                // ignore
            }
        };
        void load();
    }, []);

    const createScreenshot = useScreenshotUpload(null);
    const closeRecordingModal = useCallback(() => setShowRecordingModal(false), []);
    const createRecording = useRecordingUpload(null, closeRecordingModal, closeRecordingModal);

    useEffect(() => {
        if (createRecording.isNaming) {
            setShowRecordingModal(false);
        }
    }, [createRecording.isNaming]);

    useGoogleWorkspaceResume(setSchedulePanelMessage);

    const canCreateTaskOrContent = useMemo(
        () =>
            filterContributableProjects(
                ws.allProjects,
                ws.currentUserEmployeeId,
                ws.isManagerOrAdmin
            ).length > 0,
        [ws.allProjects, ws.currentUserEmployeeId, ws.isManagerOrAdmin]
    );

    const {
        calendar: scheduleCalendar,
        syncing: scheduleSyncing,
        message: scheduleCalendarMessage,
        setMessage: setScheduleCalendarMessage,
        loadCalendar: loadScheduleCalendar,
        handleSync: handleScheduleCalendarSync,
        handleDisconnect: handleScheduleCalendarDisconnect,
    } = useSchedulingCalendar(ws.timeframe, ws.currentDate, {
        onSyncBlocked: () => onSyncBlockedRef.current(),
        onCalendarConnectedRedirect: () => {
            pendingScheduleSyncRef.current = true;
        },
    });
    const schedulingAvailability = useSchedulingAvailability();

    // Fetch meetings whenever the utilization sidebar is shown (all timeframes including Today).
    const meetingsFetchEnabled =
        ws.phase === 'Schedule' ||
        ws.lens === 'agenda' ||
        ws.lens === 'schedule' ||
        ws.lens === 'capacity';
    const { meetings: workspaceMeetings, loadingMeetings, refetchMeetings } = useWorkspaceMeetings(
        ws.timeframe,
        ws.currentDate,
        meetingsFetchEnabled,
        meetingRefreshKey + scheduleSyncRefreshKey
    );

    onSyncBlockedRef.current = () => {
        void refetchMeetings();
    };

    const [paletteNlError, setPaletteNlError] = useState<string | null>(null);

    const workspaceIntentContext = useMemo(
        () =>
            buildWorkspaceIntentContext({
                pathname: pathname || '/workspace',
                phase: ws.phase,
                lens: ws.lens,
                inspectorFocus,
                allProjects: ws.allProjects,
            }),
        [pathname, ws.phase, ws.lens, inspectorFocus, ws.allProjects]
    );

    useEffect(() => {
        if (ws.lens === 'agenda' && !isFeatureEnabled('agendaViewEnabled')) {
            ws.setLens('schedule');
        }
        if (ws.lens === 'projects') {
            ws.setLens('schedule');
        }
    }, [ws.lens, ws.setLens]);

    const shouldPollProjectActivity = useMemo(() => {
        const pollablePhase =
            ws.phase === 'All' ||
            ws.phase === 'Plan' ||
            ws.phase === 'Build' ||
            ws.phase === 'Schedule';
        const pollableLens =
            ws.lens === 'schedule' || ws.lens === 'projects' || ws.lens === 'agenda';
        return pollablePhase && pollableLens;
    }, [ws.phase, ws.lens]);

    const workspaceActivityTokenRef = useRef<string | null>(null);
    const refreshProjectActivity = useCallback(async () => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        try {
            const res = await fetch('/api/workspace/activity', { cache: 'no-store' });
            if (!res.ok) return;
            const payload = (await res.json()) as { token?: string };
            const nextToken = payload.token ?? null;
            if (!nextToken) return;
            if (workspaceActivityTokenRef.current === nextToken) return;
            workspaceActivityTokenRef.current = nextToken;
            await ws.loadData({ silent: true });
        } catch {
            // Ignore background activity polling errors.
        }
    }, [ws.loadData]);

    useEffect(() => {
        if (!shouldPollProjectActivity) return;

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshProjectActivity();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [shouldPollProjectActivity, refreshProjectActivity]);

    useEffect(() => {
        if (!shouldPollProjectActivity || !pageActivity.visible) return;

        // Active: 60s. Idle but visible: 5 min. Hidden: no interval (handled above).
        const intervalMs = pageActivity.isActive ? 60_000 : 5 * 60_000;
        const intervalId = window.setInterval(refreshProjectActivity, intervalMs);
        return () => window.clearInterval(intervalId);
    }, [shouldPollProjectActivity, pageActivity.visible, pageActivity.isActive, refreshProjectActivity]);

    const syncWorkspaceUrl = useCallback(
        (opts: { phase?: PhaseType; lens?: LensType }) => {
            if (pathname !== '/workspace') return;
            const phase = opts.phase ?? ws.phase;
            const lens = opts.lens ?? ws.lens;
            const params = new URLSearchParams();
            if (phase !== 'All') params.set('phase', phase);
            if (lens !== 'schedule') params.set('lens', lens);
            const q = params.toString();
            router.replace(q ? `/workspace?${q}` : '/workspace', { scroll: false });
        },
        [pathname, ws.phase, ws.lens, router]
    );

    const handlePhaseSelect = useCallback(
        (p: PhaseType) => {
            const enteringSchedule = p === 'Schedule' && ws.phase !== 'Schedule';
            if (enteringSchedule) {
                pendingScheduleSyncRef.current = true;
            }
            ws.setPhase(p);
            if (p === 'Schedule' && ws.lens === 'clients') {
                ws.setLens('schedule');
                syncWorkspaceUrl({ phase: p, lens: 'schedule' });
                if (enteringSchedule && scheduleCalendar?.connected) {
                    pendingScheduleSyncRef.current = false;
                    onEnterScheduleSyncRef.current();
                }
                return;
            }
            syncWorkspaceUrl({ phase: p });
            if (enteringSchedule && scheduleCalendar?.connected) {
                pendingScheduleSyncRef.current = false;
                onEnterScheduleSyncRef.current();
            }
        },
        [ws, syncWorkspaceUrl, scheduleCalendar?.connected]
    );

    const handleLensSelect = useCallback(
        (lens: LensType) => {
            let resolved = lens === 'projects' ? 'schedule' : lens;
            if (resolved === 'agenda' && !isFeatureEnabled('agendaViewEnabled')) {
                resolved = 'schedule';
            }
            if (resolved === 'agenda' && ws.timeframe !== 'today') {
                ws.setCurrentDate(new Date());
            }
            ws.setLens(resolved);
            syncWorkspaceUrl({ lens: resolved });
        },
        [ws, syncWorkspaceUrl]
    );

    // Handlers
    const handleCreateProject = () => {
        setEditingProject(undefined);
        setProjectFormDefaultClientId(null);
        setShowProjectForm(true);
    };

    const handleAddProjectForClient = useCallback((clientId: string) => {
        setEditingProject(undefined);
        setProjectFormDefaultClientId(clientId);
        setShowProjectForm(true);
    }, []);

    const markWorkspaceItemSeen = useCallback(
        (keys: string[]) => {
            if (!ws.currentUserId || keys.length === 0) return;
            markItemsSeenByKeys(ws.currentUserId, keys);
            setItemSeenRefreshTrigger((t) => t + 1);
        },
        [ws.currentUserId]
    );

    const markOpenedProjectSeen = useCallback(
        (projectId: string) => {
            if (!ws.currentUserId) return;
            markProjectItemsSeen(ws.currentUserId, projectId);
            setItemSeenRefreshTrigger((t) => t + 1);
        },
        [ws.currentUserId]
    );

    const inspectorProjectId = useMemo(
        () =>
            inspectorFocus?.startsWith('project:') ? inspectorFocus.split(':')[1] : null,
        [inspectorFocus]
    );

    const getProjectUnseenExpandFlags = useCallback(
        (projectId: string) => {
            if (!ws.currentUserId) {
                return { hasUnseenTasks: false, hasUnseenContent: false };
            }
            const project = ws.allProjects.find((p) => p._id.toString() === projectId);
            if (!project) {
                return { hasUnseenTasks: false, hasUnseenContent: false };
            }
            const contentForProject = ws.contentItems.filter(
                (item) => item.projectId?.toString() === projectId
            );
            const observations = collectWorkspaceItemObservations([project], contentForProject);
            const keys = observations.map((entry) => entry.key);
            return readProjectUnseenSections(ws.currentUserId, projectId, keys);
        },
        [ws.allProjects, ws.contentItems, ws.currentUserId]
    );

    const applyProjectInspectorExpandFlags = useCallback(
        (
            projectId: string,
            overrides?: { tasksExpanded?: boolean; contentExpanded?: boolean }
        ) => {
            const unseen = getProjectUnseenExpandFlags(projectId);
            setInspectorInitialTasksExpanded(overrides?.tasksExpanded ?? unseen.hasUnseenTasks);
            setInspectorInitialContentExpanded(overrides?.contentExpanded ?? unseen.hasUnseenContent);
        },
        [getProjectUnseenExpandFlags]
    );

    const markInspectorSeenOnExit = useCallback(() => {
        if (!ws.currentUserId) return;
        const inboxKey = getPendingActionInboxItemKey();
        if (inboxKey) {
            markItemsSeenByKeys(ws.currentUserId, [inboxKey]);
            setItemSeenRefreshTrigger((t) => t + 1);
        } else {
            const projectIdToMark = inspectorFocus?.startsWith('project:')
                ? inspectorFocus.split(':')[1]
                : null;
            if (projectIdToMark) {
                markOpenedProjectSeen(projectIdToMark);
            }
        }
        clearReturnToActionInbox();
    }, [ws.currentUserId, inspectorFocus, markOpenedProjectSeen]);

    const closeInspector = useCallback(() => {
        if (inspectorFocus?.startsWith('project:') && inspectorParentFocus) {
            setInspectorFocus(inspectorParentFocus);
            setInspectorParentFocus(null);
            setInspectorOpenTaskIndex(null);
            setInspectorOpenContentId(null);
            setInspectorAutoAddTask(false);
            setInspectorInitialAddContentOpen(false);
            setInspectorAddContentDate(undefined);
            setInspectorAddContentPrefill(null);
            return;
        }

        markInspectorSeenOnExit();
        setInspectorFocus(null);
        setInspectorParentFocus(null);
        setInspectorOpenTaskIndex(null);
        setInspectorOpenContentId(null);
        setInspectorAutoAddTask(false);
        setInspectorInitialAddContentOpen(false);
        setInspectorAddContentDate(undefined);
        setInspectorAddContentPrefill(null);
    }, [inspectorFocus, inspectorParentFocus, markInspectorSeenOnExit]);

    const closeInspectorFully = useCallback(() => {
        markInspectorSeenOnExit();
        setInspectorFocus(null);
        setInspectorParentFocus(null);
        setInspectorOpenTaskIndex(null);
        setInspectorOpenContentId(null);
        setInspectorAutoAddTask(false);
        setInspectorInitialAddContentOpen(false);
        setInspectorAddContentDate(undefined);
        setInspectorAddContentPrefill(null);
    }, [markInspectorSeenOnExit]);

    const { completeInspectorClose } = useMobileInspectorHistory({
        inspectorFocus,
        onCloseInspector: closeInspector,
        onCloseInspectorFully: closeInspectorFully,
        enabled: isMobile,
    });

    const handleViewClient = useCallback((client: IClient) => {
        setInspectorParentFocus(null);
        setInspectorAutoAddTask(false);
        setInspectorOpenTaskIndex(null);
        setInspectorOpenContentId(null);
        setInspectorInitialAddContentOpen(false);
        setInspectorAddContentDate(undefined);
        setInspectorAddContentPrefill(null);
        setInspectorFocus(`client:${client._id}`);
    }, []);

    const handleViewProjectFromClientCalendar = useCallback(
        (client: IClient, project: IProject) => {
            setInspectorParentFocus(`client:${client._id}`);
            setInspectorAutoAddTask(false);
            setInspectorOpenTaskIndex(null);
            setInspectorOpenContentId(null);
            setInspectorInitialAddContentOpen(false);
            setInspectorAddContentDate(undefined);
            setInspectorAddContentPrefill(null);
            setInspectorFocus(`project:${project._id}`);
            applyProjectInspectorExpandFlags(project._id.toString());
        },
        [applyProjectInspectorExpandFlags]
    );

    const handleViewProjectFromClientInspector = useCallback(
        (project: IProject) => {
            if (inspectorFocus?.startsWith('client:')) {
                setInspectorParentFocus(inspectorFocus);
            }
            setInspectorAutoAddTask(false);
            setInspectorOpenTaskIndex(null);
            setInspectorOpenContentId(null);
            setInspectorFocus(`project:${project._id}`);
            applyProjectInspectorExpandFlags(project._id.toString());
        },
        [inspectorFocus, applyProjectInspectorExpandFlags]
    );

    const handleViewProject = useCallback(
        (project: IProject) => {
            setInspectorParentFocus(null);
            setInspectorAutoAddTask(false);
            setInspectorOpenTaskIndex(null);
            setInspectorOpenContentId(null);
            setInspectorFocus(`project:${project._id}`);
            applyProjectInspectorExpandFlags(project._id.toString());
        },
        [applyProjectInspectorExpandFlags]
    );

    const handleViewProjectTask = useCallback(
        (project: IProject, taskIndex: number) => {
            const task = project.tasks?.[taskIndex];
            const taskId = task?._id?.toString() ?? null;
            if (taskId) {
                markWorkspaceItemSeen([
                    buildTaskItemKey(project._id.toString(), taskId, taskIndex),
                ]);
            }
            setInspectorAutoAddTask(false);
            setInspectorOpenContentId(null);
            setInspectorFocus(`project:${project._id}`);
            setInspectorOpenTaskIndex(taskIndex);
            applyProjectInspectorExpandFlags(project._id.toString(), { tasksExpanded: true });
        },
        [applyProjectInspectorExpandFlags, markWorkspaceItemSeen]
    );

    const handleViewProjectContent = useCallback(
        (project: IProject, contentItemId: string) => {
            markWorkspaceItemSeen([buildContentItemKey(project._id.toString(), contentItemId)]);
            setInspectorAutoAddTask(false);
            setInspectorOpenTaskIndex(null);
            setInspectorOpenContentId(contentItemId);
            setInspectorFocus(`project:${project._id}`);
            applyProjectInspectorExpandFlags(project._id.toString(), { contentExpanded: true });
        },
        [applyProjectInspectorExpandFlags, markWorkspaceItemSeen]
    );

    const handleContentItemClickFromSchedule = useCallback(
        (item: IContentItem) => {
            const projectId = item.projectId?.toString();
            if (!projectId) return;
            const project = ws.allProjects.find((p) => p._id.toString() === projectId);
            if (!project) return;
            handleViewProjectContent(project, item._id.toString());
        },
        [ws.allProjects, handleViewProjectContent]
    );

    const handleAddTaskToProject = useCallback(
        (project: IProject) => {
            setInspectorOpenTaskIndex(null);
            setInspectorOpenContentId(null);
            setInspectorInitialAddContentOpen(false);
            setInspectorAddContentDate(undefined);
            setInspectorAddContentPrefill(null);
            setInspectorAutoAddTask(true);
            setInspectorFocus(`project:${project._id}`);
            applyProjectInspectorExpandFlags(project._id.toString(), { tasksExpanded: true });
        },
        [applyProjectInspectorExpandFlags]
    );

    const handleAddContentToProject = useCallback(
        (project: IProject, defaultDate?: Date) => {
            setInspectorOpenTaskIndex(null);
            setInspectorOpenContentId(null);
            setInspectorAutoAddTask(false);
            setInspectorInitialAddContentOpen(true);
            setInspectorAddContentDate(defaultDate);
            setInspectorAddContentPrefill(null);
            setInspectorFocus(`project:${project._id}`);
            applyProjectInspectorExpandFlags(project._id.toString(), { contentExpanded: true });
        },
        [applyProjectInspectorExpandFlags]
    );

    const handleCreateRecord = useCallback(() => {
        setShowRecordingModal(true);
    }, []);

    const handleMobileViewProject = useCallback(
        (projectId: string) => {
            const project = ws.allProjects.find((p) => p._id.toString() === projectId);
            if (project) handleViewProject(project);
        },
        [ws.allProjects, handleViewProject]
    );

    const handleMobileViewClient = useCallback(
        (clientId: string) => {
            const client = ws.filteredClients.find((c) => c._id.toString() === clientId);
            if (client) handleViewClient(client);
        },
        [ws.filteredClients, handleViewClient]
    );

    const handleMobileOpenTask = useCallback(
        (projectId: string, taskId: string) => {
            const project = ws.allProjects.find((p) => p._id.toString() === projectId);
            if (!project) return;
            const taskIndex = (project.tasks ?? []).findIndex(
                (t) => t._id?.toString() === taskId
            );
            if (taskIndex >= 0) handleViewProjectTask(project, taskIndex);
        },
        [ws.allProjects, handleViewProjectTask]
    );

    const handleMobileOpenContent = useCallback(
        (projectId: string, contentId: string) => {
            const project = ws.allProjects.find((p) => p._id.toString() === projectId);
            if (project) handleViewProjectContent(project, contentId);
        },
        [ws.allProjects, handleViewProjectContent]
    );

    useEffect(() => {
        if (!initialDeepLinkClientId || ws.filteredClients.length === 0) return;
        ws.setLens('clients');
    }, [initialDeepLinkClientId, ws.filteredClients.length, ws.setLens]);

    useEffect(() => {
        if (deepLinkHandledRef.current || !initialDeepLinkClientId || ws.filteredClients.length === 0) return;
        const client = ws.filteredClients.find((c) => c._id.toString() === initialDeepLinkClientId);
        if (!client) return;
        deepLinkHandledRef.current = true;
        handleViewClient(client);
    }, [initialDeepLinkClientId, ws.filteredClients, handleViewClient]);

    useEffect(() => {
        if (deepLinkHandledRef.current || !initialDeepLinkProjectId || ws.allProjects.length === 0) return;

        const project = ws.allProjects.find((p) => p._id.toString() === initialDeepLinkProjectId);
        if (!project) return;

        deepLinkHandledRef.current = true;

        if (initialDeepLinkContentId) {
            handleViewProjectContent(project, initialDeepLinkContentId);
            return;
        }

        if (initialDeepLinkTaskId) {
            const taskIndex = (project.tasks ?? []).findIndex(
                (task) => (task as { _id?: { toString(): string } })._id?.toString() === initialDeepLinkTaskId
            );
            if (taskIndex >= 0) {
                handleViewProjectTask(project, taskIndex);
                return;
            }
        }

        handleViewProject(project);
    }, [
        initialDeepLinkProjectId,
        initialDeepLinkTaskId,
        initialDeepLinkContentId,
        ws.allProjects,
        handleViewProject,
        handleViewProjectTask,
        handleViewProjectContent,
    ]);

    const handleDeleteProject = async (id: string) => {
        try {
            const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            if (response.ok) {
                closeInspector();
                ws.loadData();
            }
        } catch {
            // Error deleting project
        }
    };

    const handleSubmitProject = async (
        data: Partial<Omit<IProject, 'assignedToEmployeeIds'>> & { assignedToEmployeeIds?: string[] }
    ) => {
        try {
            const url = editingProject ? `/api/projects/${editingProject._id}` : '/api/projects';
            const method = editingProject ? 'PUT' : 'POST';
            const projectData = editingProject ? data : { ...data, status: 'planning' };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData),
            });

            if (response.ok) {
                setShowProjectForm(false);
                setEditingProject(undefined);
                setProjectFormDefaultClientId(null);
                ws.loadData();
            }
        } catch {
            // Error saving project
        }
    };

    const handleUpdateClient = async (clientId: string, updates: Partial<IClient> & Record<string, unknown>) => {
        try {
            const res = await fetch('/api/clients', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _id: clientId, ...updates }),
            });
            if (res.ok) {
                ws.loadData({ silent: true });
            }
        } catch (e) {
            console.error('Failed to update client', e);
        }
    };

    // Voice intent execution handler (may return Promise for async actions)
    const handleIntent = useWorkspaceIntentHandler({
        ws,
        router,
        inspectorFocus,
        handleDeleteProject,
        handlePhaseSelect,
        handleLensSelect,
        handleViewProjectTask,
        handleViewProjectContent,
        setInspectorFocus,
        setInspectorOpenTaskIndex,
        setInspectorInitialAddContentOpen,
        setInspectorAddContentDate,
        setInspectorAddContentPrefill,
        setAddContentProject,
        setAddContentDefaultDate,
        setAddContentVoicePrefill,
        setShowContentCreateModal,
    });

    // Command Palette Registration (voice can trigger via RUN_COMMAND)
    useEffect(() => {
        const commands = [
            {
                id: 'nav-projects',
                label: 'Go to Projects',
                category: 'navigate' as const,
                keywords: ['calendar', 'projects', 'schedule', 'time'],
                voicePatterns: [
                    'go to projects',
                    'show projects',
                    'open projects',
                    'view projects',
                    'go to schedule',
                    'show schedule',
                ],
                execute: () => handleLensSelect('schedule'),
            },
            {
                id: 'nav-agenda',
                label: 'Go to Agenda',
                category: 'navigate' as const,
                keywords: ['agenda', 'list', 'day'],
                voicePatterns: ['go to agenda', 'show agenda', 'open agenda', 'view agenda'],
                execute: () => handleLensSelect('agenda'),
            },
            {
                id: 'nav-capacity',
                label: 'Go to Capacity',
                category: 'navigate' as const,
                keywords: ['team', 'people', 'workload', 'capacity'],
                voicePatterns: ['go to capacity', 'show capacity', 'team', 'employees', 'open team'],
                execute: () => handleLensSelect('capacity'),
            },
            {
                id: 'create-project',
                label: 'Create Project',
                category: 'create' as const,
                keywords: ['new', 'add', 'project'],
                voicePatterns: ['create project', 'new project', 'add project'],
                canExecute: () => ws.isManagerOrAdmin,
                execute: handleCreateProject,
            },
            {
                id: 'view-calendar',
                label: 'Calendar view',
                category: 'view' as const,
                keywords: ['calendar', 'week', 'month'],
                voicePatterns: ['show calendar', 'open calendar', 'view calendar', 'go to calendar'],
                execute: () => handleLensSelect('schedule'),
            },
            {
                id: 'view-agenda',
                label: 'Agenda view',
                category: 'view' as const,
                keywords: ['agenda', 'list'],
                voicePatterns: ['show agenda', 'open agenda', 'view agenda', 'go to agenda'],
                execute: () => handleLensSelect('agenda'),
            },
            {
                id: 'show-tasks',
                label: 'Show tasks',
                category: 'filter' as const,
                keywords: ['tasks'],
                voicePatterns: ['show tasks'],
                execute: () => ws.setShowTasks(true),
            },
            {
                id: 'hide-tasks',
                label: 'Hide tasks',
                category: 'filter' as const,
                keywords: ['tasks'],
                voicePatterns: ['hide tasks'],
                execute: () => ws.setShowTasks(false),
            },
            {
                id: 'show-content',
                label: 'Show content',
                category: 'filter' as const,
                keywords: ['content'],
                voicePatterns: ['show content'],
                execute: () => ws.setShowContent(true),
            },
            {
                id: 'hide-content',
                label: 'Hide content',
                category: 'filter' as const,
                keywords: ['content'],
                voicePatterns: ['hide content'],
                execute: () => ws.setShowContent(false),
            },
            ...(
                [
                    ['filter-channel-all', 'All', 'All channels'] as const,
                    ['filter-channel-linkedin', 'LinkedIn', 'LinkedIn channel'] as const,
                    ['filter-channel-x', 'X', 'X channel'] as const,
                    ['filter-channel-instagram', 'Instagram', 'Instagram channel'] as const,
                    ['filter-channel-tiktok', 'TikTok', 'TikTok channel'] as const,
                    ['filter-channel-email', 'Email', 'Email channel'] as const,
                    ['filter-channel-article', 'Article', 'Article channel'] as const,
                    ['filter-channel-video', 'Video', 'Video channel'] as const,
                    ['filter-channel-reddit', 'Reddit', 'Reddit channel'] as const,
                    ['filter-channel-bluesky', 'Bluesky', 'Bluesky channel'] as const,
                    ['filter-channel-other', 'Other', 'Other channel'] as const,
                ] as const
            ).map(([id, channel, phrase]) => ({
                id,
                label: `Channel: ${channel}`,
                category: 'filter' as const,
                keywords: [channel.toLowerCase()],
                voicePatterns: [`filter ${phrase}`, `show ${phrase}`],
                execute: () => ws.setContentChannelFilter(channel),
            })),
            {
                id: 'nav-workspace',
                label: 'Workspace',
                category: 'navigate' as const,
                keywords: ['workspace'],
                voicePatterns: ['go to workspace', 'open workspace'],
                execute: () => router.push('/workspace'),
            },
            {
                id: 'nav-assets',
                label: 'Assets',
                category: 'navigate' as const,
                keywords: ['assets'],
                voicePatterns: ['go to assets', 'open assets', 'show assets'],
                execute: () => router.push('/assets'),
            },
            {
                id: 'nav-employees-page',
                label: 'Employees page',
                category: 'navigate' as const,
                keywords: ['employees'],
                voicePatterns: ['go to employees page', 'open employees'],
                execute: () => router.push('/employees'),
            },
            {
                id: 'nav-admin',
                label: 'Admin',
                category: 'navigate' as const,
                keywords: ['admin'],
                voicePatterns: ['go to admin', 'open admin'],
                execute: () => router.push('/admin'),
            },
            {
                id: 'nav-plan',
                label: 'Plan',
                category: 'navigate' as const,
                keywords: ['plan'],
                voicePatterns: ['go to plan', 'open plan'],
                execute: () => router.push('/plan'),
            },
            {
                id: 'nav-build',
                label: 'Build',
                category: 'navigate' as const,
                keywords: ['build'],
                voicePatterns: ['go to build', 'open build'],
                execute: () => router.push('/build'),
            },
            {
                id: 'nav-run',
                label: 'Run',
                category: 'navigate' as const,
                keywords: ['run'],
                voicePatterns: ['go to run', 'open run'],
                execute: () => router.push('/run'),
            },
        ];

        commands.forEach(c => CommandRegistry.register(c));
        return () => commands.forEach(c => CommandRegistry.unregister(c.id));
    }, [ws, ws.isManagerOrAdmin, router, handleCreateProject, handleLensSelect]);

    // Close inspector command (only when inspector is open, so voice "close" / "cancel" works)
    useEffect(() => {
        if (!inspectorFocus) return;
        const closeCmd = {
            id: 'close-inspector',
            label: 'Close',
            category: 'view' as const,
            keywords: ['close', 'cancel', 'dismiss'],
            voicePatterns: ['close', 'close modal', 'cancel', 'dismiss', 'close inspector'],
            execute: completeInspectorClose,
        };
        CommandRegistry.register(closeCmd);
        return () => CommandRegistry.unregister('close-inspector');
    }, [inspectorFocus, completeInspectorClose]);

    // Global keyboard shortcuts (command palette â€” platform admins only)
    useEffect(() => {
        if (!isPlatformAdmin) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(open => !open);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPlatformAdmin]);

    useEffect(() => {
        if (isCommandPaletteOpen) setPaletteNlError(null);
    }, [isCommandPaletteOpen]);

    const isSchedulingPhase = ws.phase === 'Schedule';
    const isAgendaLens = ws.lens === 'agenda';
    const isScheduleLens = ws.lens === 'schedule';
    const isClientsLens = ws.lens === 'clients';
    const needsCalendarData = isSchedulingPhase || isAgendaLens || isScheduleLens;

    useEffect(() => {
        if (needsCalendarData) {
            void loadScheduleCalendar();
        }
    }, [needsCalendarData, loadScheduleCalendar]);

    const handleScheduleSync = useCallback(async () => {
        const data = await handleScheduleCalendarSync();
        if (data) {
            setScheduleSyncRefreshKey((k) => k + 1);
        }
    }, [handleScheduleCalendarSync]);

    onEnterScheduleSyncRef.current = () => {
        void handleScheduleSync();
    };

    useEffect(() => {
        if (!pendingScheduleSyncRef.current) return;
        if (ws.phase !== 'Schedule' || !scheduleCalendar?.connected) return;
        pendingScheduleSyncRef.current = false;
        void handleScheduleSync();
    }, [ws.phase, scheduleCalendar?.connected, handleScheduleSync]);

    const scheduleHeaderMessage = schedulePanelMessage ?? scheduleCalendarMessage;

    // Default status for new projects depends on phase
    const defaultStatus = ws.phase === 'Build' ? 'in-development' : ws.phase === 'Run' ? 'launched' : 'planning';

    if (ws.loading && ws.allProjects.length === 0) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-text-secondary">Loading...</div>
            </div>
        );
    }

    return (
        <IntentConfirmationProvider
            executeIntent={handleIntent}
            onExecuted={(r, meta) => {
                if (meta.origin === 'palette') {
                    setPaletteNlError(r.success ? null : r.message);
                }
            }}
        >
            <VoiceProvider
                isPlatformAdmin={isPlatformAdmin}
                getWorkspaceContext={() => workspaceIntentContext}
            >
                <PlatformCatalogProvider>
                <div className={`min-h-screen bg-background overflow-x-hidden md:overflow-x-visible ${PAGE_GUTTER_WIDE_CLASS}`}>
                    <MobileShellBridge
                        isManagerOrAdmin={ws.isManagerOrAdmin}
                        currentUserId={ws.currentUserId}
                        currentUserEmployeeId={ws.currentUserEmployeeId}
                        projects={ws.allProjects}
                        contentItems={ws.contentItems}
                        clients={ws.filteredClients}
                        itemSeenRefreshTrigger={itemSeenRefreshTrigger}
                        onLensSelect={handleLensSelect}
                        onPhaseSelect={handlePhaseSelect}
                        onViewProject={handleMobileViewProject}
                        onViewClient={handleMobileViewClient}
                        onCreateProject={handleCreateProject}
                        onCreateClient={() => setShowClientCreateModal(true)}
                        onCreateTask={() => setProjectPickerMode('task')}
                        onCreateContent={() => setProjectPickerMode('content')}
                        onCreateMeeting={() => setShowMeetingModal(true)}
                        onCreateScreenshot={() => setShowScreenshotModal(true)}
                        onCreateRecord={handleCreateRecord}
                        onOpenTask={handleMobileOpenTask}
                        onOpenContent={handleMobileOpenContent}
                    />
                    <div className="w-full mx-auto pt-[30px] pb-8">
                    {/* ===== Workspace Header ===== */}
                    <div className="mb-4">
                        <div className="w-full min-w-0 lg:max-w-none mb-3">
                            <OrganizationBrand />
                        </div>
                        {isMobile ? (
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="overflow-x-auto min-w-0 -mx-0.5 px-0.5">
                                <PhaseFilter selected={ws.phase} onSelect={handlePhaseSelect} compact />
                            </div>
                            <div className="flex items-stretch gap-2 min-w-0">
                                <div className="flex-1 min-w-0">
                                    <WorkspaceLensSelect
                                        value={ws.lens}
                                        onChange={handleLensSelect}
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <TimeHorizonSelector
                                        selected={ws.timeframe}
                                        onSelect={(newTimeframe) => {
                                            ws.setTimeframe(newTimeframe);
                                            if (newTimeframe === 'today') {
                                                ws.setCurrentDate(new Date());
                                            }
                                        }}
                                        mobileSelectClassName="w-full"
                                    />
                                </div>
                                <button
                                    type="button"
                                    data-tour="lens-toggles"
                                    onClick={() => setShowViewOptionsOpen(true)}
                                    className="relative shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background-elevated"
                                    aria-label="View options"
                                >
                                    <span aria-hidden>âš™</span>
                                    Options
                                    {activeViewOptionsCount > 0 ? (
                                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
                                            {activeViewOptionsCount}
                                        </span>
                                    ) : null}
                                </button>
                            </div>
                            {isSchedulingPhase ? (
                                <SchedulingHeaderToolbar
                                    calendar={scheduleCalendar}
                                    onSetAvailability={() => setShowAvailabilityModal(true)}
                                    onDisconnect={
                                        scheduleCalendar?.connected
                                            ? () => void handleScheduleCalendarDisconnect()
                                            : undefined
                                    }
                                    className="w-full"
                                />
                            ) : null}
                            <CreateMenu
                                isManagerOrAdmin={ws.isManagerOrAdmin}
                                currentUserRole={ws.currentUserRole}
                                canCreateTaskOrContent={canCreateTaskOrContent}
                                menuOpen={createMenuOpen}
                                onMenuOpenChange={setCreateMenuOpen}
                                onCreateProject={handleCreateProject}
                                onCreateClient={() => setShowClientCreateModal(true)}
                                onCreateTask={() => setProjectPickerMode('task')}
                                onCreateContent={() => setProjectPickerMode('content')}
                                onCreateMeeting={() => setShowMeetingModal(true)}
                                onCreateScreenshot={() => setShowScreenshotModal(true)}
                                onCreateRecord={() => setShowRecordingModal(true)}
                                triggerClassName="w-full justify-center"
                            />
                        </div>
                        ) : (
                        <div className="flex flex-row flex-wrap items-center gap-3 lg:gap-4 mb-3">
                            <div className="shrink-0">
                                <PhaseFilter selected={ws.phase} onSelect={handlePhaseSelect} />
                            </div>
                            <TimeHorizonSelector
                                selected={ws.timeframe}
                                onSelect={(newTimeframe) => {
                                    ws.setTimeframe(newTimeframe);
                                    if (newTimeframe === 'today') {
                                        ws.setCurrentDate(new Date());
                                    }
                                }}
                            />
                            <div className="flex gap-2 shrink-0 ml-auto items-center">
                                {isSchedulingPhase ? (
                                    <SchedulingHeaderToolbar
                                        calendar={scheduleCalendar}
                                        onSetAvailability={() => setShowAvailabilityModal(true)}
                                        onDisconnect={
                                            scheduleCalendar?.connected
                                                ? () => void handleScheduleCalendarDisconnect()
                                                : undefined
                                        }
                                    />
                                ) : needsCalendarData ? (
                                    <SchedulingCalendarBar
                                        calendar={scheduleCalendar}
                                        syncing={scheduleSyncing}
                                        onSync={() => void handleScheduleSync()}
                                        flashMessage={scheduleCalendarMessage}
                                        onDismissFlash={() => setScheduleCalendarMessage(null)}
                                    />
                                ) : null}
                                {isPlatformAdmin ? (
                                <button
                                    type="button"
                                    data-tour="command-palette-trigger"
                                    onClick={() => setIsCommandPaletteOpen(true)}
                                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-background-elevated transition-colors"
                                    title="Open command palette (Ctrl+K)"
                                >
                                    <span>âŒ˜K</span>
                                </button>
                                ) : null}
                                <CreateMenu
                                    isManagerOrAdmin={ws.isManagerOrAdmin}
                                    currentUserRole={ws.currentUserRole}
                                    canCreateTaskOrContent={canCreateTaskOrContent}
                                    menuOpen={createMenuOpen}
                                    onMenuOpenChange={setCreateMenuOpen}
                                    onCreateProject={handleCreateProject}
                                    onCreateClient={() => setShowClientCreateModal(true)}
                                    onCreateTask={() => setProjectPickerMode('task')}
                                    onCreateContent={() => setProjectPickerMode('content')}
                                    onCreateMeeting={() => setShowMeetingModal(true)}
                                    onCreateScreenshot={() => setShowScreenshotModal(true)}
                                    onCreateRecord={() => setShowRecordingModal(true)}
                                />
                            </div>
                        </div>
                        )}

                        {/* Row 2: Lens bar + view toggles (desktop only) */}
                        {!isMobile && (
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-between min-w-0">
                            <LensBar
                                selected={ws.lens}
                                onSelect={handleLensSelect}
                                trailing={
                                    <div className="flex flex-wrap items-center gap-3">
                                        {ws.isManagerOrAdmin ? (
                                            <Toggle
                                                label="Show only my assignments"
                                                checked={ws.showOnlyMyAssignments}
                                                onChange={ws.setShowOnlyMyAssignments}
                                            />
                                        ) : null}
                                        <WorkspaceEmailDigestSelect onIntervalChange={setEmailDigestInterval} />
                                    </div>
                                }
                            />
                            {(ws.lens === 'schedule' || ws.lens === 'agenda' || ws.lens === 'clients') ? (
                                <WorkspaceLensToolbar className="ml-auto min-w-0 max-w-full">
                                    {platformGuide?.showRestartGuide ? (
                                        <button
                                            type="button"
                                            data-tour="restart-guide"
                                            onClick={() => platformGuide.restartGuide()}
                                            className="text-xs font-medium text-primary hover:text-primary-hover whitespace-nowrap"
                                        >
                                            Platform guide
                                        </button>
                                    ) : null}
                                    <div data-tour="lens-toggles" className="flex flex-nowrap items-center gap-3 sm:gap-4 min-w-0 max-w-full">
                                    {ws.lens !== 'agenda' ? (
                                        <>
                                            <Toggle
                                                label="Show Tasks"
                                                checked={ws.showTasks}
                                                onChange={ws.setShowTasks}
                                                className="shrink-0 whitespace-nowrap"
                                            />
                                            <Toggle
                                                label="Show Content"
                                                checked={ws.showContent}
                                                onChange={ws.setShowContent}
                                                className="shrink-0 whitespace-nowrap"
                                            />
                                        </>
                                    ) : null}
                                    {ws.lens === 'agenda' ? (
                                        <Toggle
                                            label="Show Meetings"
                                            checked={ws.showMeetings}
                                            onChange={ws.setShowMeetings}
                                            className="shrink-0 whitespace-nowrap"
                                        />
                                    ) : null}
                                    {ws.lens !== 'clients' ? (
                                        <WorkspaceTeamFilter
                                            value={ws.teamFilter}
                                            onChange={ws.setTeamFilter}
                                            className="w-auto max-w-[9.5rem] min-w-0 shrink"
                                        />
                                    ) : null}
                                    </div>
                                </WorkspaceLensToolbar>
                            ) : null}
                        </div>
                        )}

                    </div>

                    {/* ===== Main Content ===== */}
                    <div className="flex w-full gap-3 md:gap-6">
                        <div className="flex-1 min-w-0">
                            {isSchedulingPhase ? (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-6">
                                    <div className="xl:col-span-2 min-h-0 min-w-0">
                                        <SchedulingPanel
                                            projects={ws.projectsForLens}
                                            clients={ws.filteredClients}
                                            employees={ws.employees}
                                            currentUserEmployeeId={ws.currentUserEmployeeId}
                                            currentUserId={ws.currentUserId}
                                            isManagerOrAdmin={ws.isManagerOrAdmin}
                                            meetings={workspaceMeetings}
                                            loadingMeetings={loadingMeetings}
                                            meetingRefreshKey={meetingRefreshKey}
                                            timeframe={ws.timeframe}
                                            currentDate={ws.currentDate}
                                            onDateChange={ws.setCurrentDate}
                                            onRefreshMeetings={() => void refetchMeetings()}
                                            schedulingTimeZone={schedulingAvailability.timezone}
                                            teamFilter={ws.teamFilter}
                                            calendar={scheduleCalendar}
                                            syncing={scheduleSyncing}
                                            onSync={() => void handleScheduleSync()}
                                            externalMessage={scheduleHeaderMessage}
                                            onClearExternalMessage={() => {
                                                setSchedulePanelMessage(null);
                                                setScheduleCalendarMessage(null);
                                            }}
                                            onSetMessage={setSchedulePanelMessage}
                                        />
                                    </div>
                                    <div className="hidden md:block xl:col-span-1">
                                        <EmployeeSidebar
                                            employees={ws.employees}
                                            projects={ws.filteredProjects}
                                            allProjects={ws.projectsForLens}
                                            contentItems={ws.filteredContentItems}
                                            meetings={workspaceMeetings}
                                            timeframe={ws.timeframe}
                                            currentDate={ws.currentDate}
                                            currentUserRole={ws.currentUserRole}
                                            currentUserEmployeeId={ws.currentUserEmployeeId}
                                        />
                                    </div>
                                </div>
                            ) : isClientsLens ? (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-6">
                                    <div className="xl:col-span-2 min-h-0 min-w-0" data-tour="clients-main">
                                        <ClientScheduleLens
                                                clients={ws.filteredClients}
                                                allProjects={ws.allProjects}
                                                contentItems={ws.contentItems}
                                                showTasks={ws.showTasks}
                                                showContent={ws.showContent}
                                                timeframe={ws.timeframe}
                                                currentDate={ws.currentDate}
                                                onClientClick={handleViewClient}
                                                onProjectClick={handleViewProjectFromClientCalendar}
                                                onTaskClick={handleViewProjectTask}
                                                onContentItemClick={handleContentItemClickFromSchedule}
                                                onDateChange={ws.setCurrentDate}
                                                currentUserId={ws.currentUserId}
                                                inspectorProjectId={inspectorProjectId}
                                                itemSeenRefreshTrigger={itemSeenRefreshTrigger}
                                            />
                                    </div>
                                    <div className="hidden md:block xl:col-span-1">
                                        <EmployeeSidebar
                                            employees={ws.employees}
                                            projects={ws.filteredProjects}
                                            allProjects={ws.projectsForLens}
                                            contentItems={ws.filteredContentItems}
                                            meetings={workspaceMeetings}
                                            timeframe={ws.timeframe}
                                            currentDate={ws.currentDate}
                                            currentUserRole={ws.currentUserRole}
                                            currentUserEmployeeId={ws.currentUserEmployeeId}
                                        />
                                    </div>
                                </div>
                            ) : ws.lens === 'schedule' || ws.lens === 'agenda' ? (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-6">
                                    <div className="xl:col-span-2 min-h-0 min-w-0" data-tour="schedule-main">
                                        {ws.lens === 'schedule' ? (
                                            <ScheduleLens
                                                projects={ws.filteredProjects}
                                                contentItems={ws.filteredContentItems}
                                                showTasks={ws.showTasks}
                                                showContent={ws.showContent}
                                                contentChannelFilter={ws.contentChannelFilter}
                                                timeframe={ws.timeframe}
                                                currentDate={ws.currentDate}
                                                onProjectClick={handleViewProject}
                                                onTaskClick={handleViewProjectTask}
                                                onDateChange={ws.setCurrentDate}
                                                currentUserEmployeeName={ws.currentUserEmployeeName}
                                                currentUserEmployeeId={ws.currentUserEmployeeId}
                                                currentUserId={ws.currentUserId}
                                                isManagerOrAdmin={ws.isManagerOrAdmin}
                                                showOnlyMyAssignments={ws.showOnlyMyAssignments}
                                                teamFilter={ws.teamFilter}
                                                onRefreshContent={ws.fetchContentItems}
                                                onAddContent={(project, defaultDate) => {
                                                    setAddContentVoicePrefill(null);
                                                    setAddContentProject(project);
                                                    setAddContentDefaultDate(defaultDate);
                                                    setShowContentCreateModal(true);
                                                }}
                                                onAddTask={handleAddTaskToProject}
                                                onContentItemClick={handleContentItemClickFromSchedule}
                                                itemSeenRefreshTrigger={itemSeenRefreshTrigger}
                                                inspectorProjectId={inspectorProjectId}
                                                projectLocalTouchMs={ws.projectLocalTouchMs}
                                            />
                                        ) : (
                                            <AgendaView
                                                projects={ws.filteredProjectsForAgenda}
                                                contentItems={ws.filteredContentItems}
                                                employees={ws.employees}
                                                meetings={workspaceMeetings}
                                                showTasks={ws.showTasks}
                                                showContent={ws.showContent}
                                                showMeetings={ws.showMeetings}
                                                contentChannelFilter={ws.contentChannelFilter}
                                                timeframe={ws.timeframe}
                                                currentDate={ws.currentDate}
                                                onDateChange={ws.setCurrentDate}
                                                onProjectClick={handleViewProject}
                                                onTaskClick={handleViewProjectTask}
                                                currentUserEmployeeName={ws.currentUserEmployeeName}
                                                currentUserEmployeeId={ws.currentUserEmployeeId}
                                                currentUserId={ws.currentUserId}
                                                currentUserRole={ws.currentUserRole}
                                                isManagerOrAdmin={ws.isManagerOrAdmin}
                                                showOnlyMyAssignments={ws.showOnlyMyAssignments}
                                                teamFilter={ws.teamFilter}
                                                onAddContent={(project, defaultDate) => {
                                                    setAddContentVoicePrefill(null);
                                                    setAddContentProject(project);
                                                    setAddContentDefaultDate(defaultDate);
                                                    setShowContentCreateModal(true);
                                                }}
                                                onAddTask={handleAddTaskToProject}
                                                onContentItemClick={handleContentItemClickFromSchedule}
                                                itemSeenRefreshTrigger={itemSeenRefreshTrigger}
                                                inspectorProjectId={inspectorProjectId}
                                                projectLocalTouchMs={ws.projectLocalTouchMs}
                                            />
                                        )}
                                    </div>
                                    <div className="hidden md:block xl:col-span-1">
                                        <EmployeeSidebar
                                            employees={ws.employees}
                                            projects={ws.filteredProjects}
                                            allProjects={ws.projectsForLens}
                                            contentItems={ws.filteredContentItems}
                                            meetings={workspaceMeetings}
                                            timeframe={ws.timeframe}
                                            currentDate={ws.currentDate}
                                            currentUserRole={ws.currentUserRole}
                                            currentUserEmployeeId={ws.currentUserEmployeeId}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {!isSchedulingPhase && ws.lens === 'capacity' && (
                                <div className="max-w-4xl mx-auto">
                                    <EmployeeSidebar
                                        employees={ws.employees}
                                        projects={ws.filteredProjects}
                                        allProjects={ws.projectsForLens}
                                        contentItems={ws.filteredContentItems}
                                        meetings={workspaceMeetings}
                                        timeframe={ws.timeframe}
                                        currentDate={ws.currentDate}
                                        currentUserRole={ws.currentUserRole}
                                        currentUserEmployeeId={ws.currentUserEmployeeId}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ===== Modals & Sheets ===== */}
                    <WorkspaceViewOptionsSheet
                        isOpen={showViewOptionsOpen}
                        onClose={() => setShowViewOptionsOpen(false)}
                        {...viewOptionsProps}
                    />
                    <ClientCreateModal
                        isOpen={showClientCreateModal}
                        onClose={() => setShowClientCreateModal(false)}
                        employees={ws.employees}
                        isManagerOrAdmin={ws.isManagerOrAdmin}
                        onSuccess={() => {
                            ws.loadData({ silent: true });
                        }}
                    />

                    <CreateMeetingModal
                        isOpen={showMeetingModal}
                        onClose={() => setShowMeetingModal(false)}
                        projects={ws.allProjects}
                        clients={ws.filteredClients}
                        employees={ws.employees}
                        currentUserEmployeeId={ws.currentUserEmployeeId}
                        schedulingTimeZone={schedulingAvailability.timezone}
                        onSuccess={() => setMeetingRefreshKey((k) => k + 1)}
                    />

                    <AvailabilityModal
                        isOpen={showAvailabilityModal}
                        onClose={() => setShowAvailabilityModal(false)}
                        timezone={schedulingAvailability.timezone}
                        onTimezoneChange={schedulingAvailability.setTimezone}
                        slots={schedulingAvailability.slots}
                        onUpdateSlot={schedulingAvailability.updateSlotByDay}
                        onSave={schedulingAvailability.saveAvailability}
                        saving={schedulingAvailability.saving}
                    />

                    <LinkTargetPickerModal
                        isOpen={projectPickerMode !== null}
                        title={projectPickerMode === 'task' ? 'Add task' : 'Add content'}
                        clients={ws.filteredClients}
                        projects={ws.allProjects}
                        currentUserEmployeeId={ws.currentUserEmployeeId}
                        isManagerOrAdmin={ws.isManagerOrAdmin}
                        onClose={() => setProjectPickerMode(null)}
                        onSelectProject={(project) => {
                            const mode = projectPickerMode;
                            setProjectPickerMode(null);
                            if (mode === 'task') {
                                handleAddTaskToProject(project);
                                return;
                            }
                            setAddContentVoicePrefill(null);
                            setAddContentProject(project);
                            setAddContentDefaultDate(new Date());
                            setShowContentCreateModal(true);
                        }}
                    />

                    <ScreenshotToolModal
                        isOpen={showScreenshotModal}
                        onClose={() => setShowScreenshotModal(false)}
                        target={null}
                        projects={ws.allProjects}
                        uploadOnly={getScreenshotCaptureMode() === 'upload-only'}
                        elevated={isTouchMobileDevice()}
                    />

                    <RecordingToolModal
                        isOpen={showRecordingModal}
                        onClose={() => setShowRecordingModal(false)}
                        target={null}
                        projects={ws.allProjects}
                        uploadOnly={getRecordingCaptureMode() === 'upload-only'}
                        recordingControl={createRecording}
                    />

                    {(createRecording.isStabilizing ||
                        createRecording.isArmed ||
                        createRecording.isRecording) &&
                        !createRecording.controlsInPopout && (
                        <RecordingOverlay
                            phase={
                                createRecording.isRecording
                                    ? 'recording'
                                    : createRecording.isStabilizing
                                      ? 'stabilizing'
                                      : 'armed'
                            }
                            elapsedLabel={createRecording.elapsedLabel}
                            stabilizeSecondsRemaining={createRecording.stabilizeSecondsRemaining}
                            onStart={createRecording.beginRecording}
                            onStop={() => void createRecording.stopRecording()}
                            onSkipStabilization={createRecording.skipStabilization}
                        />
                    )}

                    {createRecording.isConverting && (
                        <RecordingStatusBanner
                            variant="progress"
                            message={createRecording.statusMessage ?? 'Preparing videoâ€¦'}
                        />
                    )}

                    {createRecording.status === 'error' && createRecording.errorMessage && (
                        <RecordingStatusBanner
                            variant="error"
                            message={createRecording.errorMessage}
                            onDismiss={createRecording.reset}
                        />
                    )}

                    <ScreenshotSaveDialog
                        isOpen={createScreenshot.isNaming}
                        defaultName={createScreenshot.suggestedName}
                        previewUrl={createScreenshot.previewUrl}
                        projects={ws.allProjects}
                        saving={createScreenshot.status === 'uploading'}
                        onSave={(name, uploadTarget) => void createScreenshot.confirmName(name, uploadTarget)}
                        onDownload={createScreenshot.downloadByName}
                        onCancel={createScreenshot.cancelNaming}
                    />

                    <RecordingSaveDialog
                        isOpen={createRecording.isNaming}
                        defaultName={createRecording.suggestedName}
                        previewUrl={createRecording.previewUrl}
                        projects={ws.allProjects}
                        micWarning={createRecording.micWarning}
                        transcodeDebug={createRecording.transcodeDebug}
                        saving={createRecording.status === 'uploading'}
                        processing={createRecording.status === 'processing'}
                        statusMessage={createRecording.statusMessage}
                        onSave={(name, uploadTarget) => void createRecording.confirmSave(name, uploadTarget)}
                        onDownload={createRecording.downloadByName}
                        onCancel={createRecording.cancelNaming}
                    />

                    <ContentItemCreateModal
                        isOpen={showContentCreateModal && !!addContentProject}
                        onClose={() => {
                            setShowContentCreateModal(false);
                            setAddContentProject(null);
                            setAddContentDefaultDate(undefined);
                            setAddContentVoicePrefill(null);
                        }}
                        project={addContentProject}
                        clients={ws.filteredClients}
                        defaultPublishDate={addContentDefaultDate}
                        initialTitle={addContentVoicePrefill?.title}
                        initialChannel={addContentVoicePrefill?.channel}
                        initialNotes={addContentVoicePrefill?.notes}
                        employees={ws.employees}
                        isManagerOrAdmin={ws.isManagerOrAdmin}
                        onSuccess={async () => {
                            if (addContentProject?._id) {
                                ws.touchProjectLocalActivity(addContentProject._id.toString());
                            }
                            await ws.fetchContentItems();
                            setContentRefreshTrigger((t) => t + 1);
                        }}
                    />

                    {inspectorFocus && (
                        <InspectorHost
                            focusId={inspectorFocus}
                            onClose={completeInspectorClose}
                            projects={ws.allProjects}
                            clients={ws.filteredClients}
                            employees={ws.employees}
                            isManagerOrAdmin={ws.isManagerOrAdmin}
                            currentUserEmployeeId={ws.currentUserEmployeeId || undefined}
                            currentUserId={ws.currentUserId ?? undefined}
                            onRefresh={() => ws.loadData({ silent: true })}
                            onProjectPatched={ws.patchProjectInState}
                            onUpdateClient={handleUpdateClient}
                            onViewProject={handleViewProjectFromClientInspector}
                            initialOpenTaskIndex={inspectorOpenTaskIndex}
                            onInitialOpenTaskConsumed={() => setInspectorOpenTaskIndex(null)}
                            initialOpenContentId={inspectorOpenContentId}
                            onInitialOpenContentConsumed={() => setInspectorOpenContentId(null)}
                            autoAddTaskOnOpen={inspectorAutoAddTask}
                            onAutoAddTaskConsumed={() => setInspectorAutoAddTask(false)}
                            initialAddContentOpen={inspectorInitialAddContentOpen}
                            initialAddContentDate={inspectorAddContentDate}
                            initialAddContentPrefill={inspectorAddContentPrefill ?? undefined}
                            onAddContentOpenConsumed={() => {
                                setInspectorInitialAddContentOpen(false);
                                setInspectorAddContentDate(undefined);
                                setInspectorAddContentPrefill(null);
                            }}
                            onContentItemClick={handleContentItemClickFromSchedule}
                            contentRefreshTrigger={contentRefreshTrigger}
                            onContentListChanged={(contentItemId) => {
                                if (contentItemId) {
                                    ws.removeContentItem(contentItemId);
                                }
                                if (inspectorProjectId) {
                                    ws.touchProjectLocalActivity(inspectorProjectId);
                                }
                                void ws.fetchContentItems();
                                setContentRefreshTrigger((t) => t + 1);
                            }}
                            contentItems={ws.contentItems}
                            timeframe={ws.timeframe}
                            referenceDate={ws.currentDate}
                            initialTasksExpanded={inspectorInitialTasksExpanded}
                            initialContentExpanded={inspectorInitialContentExpanded}
                            itemSeenRefreshTrigger={itemSeenRefreshTrigger}
                            onAddProject={
                                inspectorFocus?.startsWith('client:') && ws.isManagerOrAdmin
                                    ? () => handleAddProjectForClient(inspectorFocus.split(':')[1])
                                    : undefined
                            }
                        />
                    )}

                    {/* Quick Project Creation */}
                    {isMobile ? (
                        <BottomSheet
                            isOpen={showProjectForm}
                            onClose={() => {
                                setShowProjectForm(false);
                                setEditingProject(undefined);
                                setProjectFormDefaultClientId(null);
                            }}
                            title="New Project"
                        >
                            <div className="p-4">
                                <QuickProjectForm
                                    clients={ws.filteredClients}
                                    employees={ws.employees}
                                    defaultStatus={defaultStatus}
                                    defaultClientId={projectFormDefaultClientId ?? undefined}
                                    onSubmit={handleSubmitProject}
                                    onCancel={() => {
                                        setShowProjectForm(false);
                                        setEditingProject(undefined);
                                        setProjectFormDefaultClientId(null);
                                    }}
                                />
                            </div>
                        </BottomSheet>
                    ) : (
                        <Modal
                            isOpen={showProjectForm}
                            onClose={() => {
                                setShowProjectForm(false);
                                setEditingProject(undefined);
                                setProjectFormDefaultClientId(null);
                            }}
                            title="New Project"
                        >
                            <QuickProjectForm
                                clients={ws.filteredClients}
                                employees={ws.employees}
                                defaultStatus={defaultStatus}
                                defaultClientId={projectFormDefaultClientId ?? undefined}
                                onSubmit={handleSubmitProject}
                                onCancel={() => {
                                    setShowProjectForm(false);
                                    setEditingProject(undefined);
                                    setProjectFormDefaultClientId(null);
                                }}
                            />
                        </Modal>
                    )}

                    {isPlatformAdmin ? (
                    <CommandPalette
                        isOpen={isCommandPaletteOpen}
                        onClose={() => setIsCommandPaletteOpen(false)}
                        workspaceIntentContext={workspaceIntentContext}
                        nlError={paletteNlError}
                    />
                    ) : null}
                    <PlatformGuideWorkspaceBridge
                        currentUserRole={ws.currentUserRole}
                        allProjects={ws.allProjects}
                        setPhase={ws.setPhase}
                        setLens={ws.setLens}
                        createMenuOpen={createMenuOpen}
                        setCreateMenuOpen={setCreateMenuOpen}
                        showProjectForm={showProjectForm}
                        setShowProjectForm={setShowProjectForm}
                        setEditingProject={setEditingProject}
                        setProjectPickerMode={setProjectPickerMode}
                        inspectorFocus={inspectorFocus}
                        setInspectorFocus={setInspectorFocus}
                        setInspectorAutoAddTask={setInspectorAutoAddTask}
                        setInspectorOpenTaskIndex={setInspectorOpenTaskIndex}
                        setInspectorOpenContentId={setInspectorOpenContentId}
                        isCommandPaletteOpen={isCommandPaletteOpen}
                        setIsCommandPaletteOpen={setIsCommandPaletteOpen}
                        onViewProject={handleViewProject}
                    />
                    <FeedbackLauncher />
                        <VoiceOverlay />
                    </div>
                </div>
                </PlatformCatalogProvider>
            </VoiceProvider>
        </IntentConfirmationProvider>
    );
}

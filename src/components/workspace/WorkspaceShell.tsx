'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { IProject, TaskStatus } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import useWorkspaceData, { PhaseType, LensType } from '@/lib/hooks/useWorkspaceData';
import useWorkspaceMeetings from '@/lib/hooks/useWorkspaceMeetings';
import useIsMobile from '@/lib/hooks/useIsMobile';
import PhaseFilter from '@/components/workspace/PhaseFilter';
import LensBar from '@/components/workspace/LensBar';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import ScheduleLens from '@/components/workspace/ScheduleLens';
import AgendaView from '@/components/workspace/AgendaView';
import OrganizationBrand from '@/components/organization/OrganizationBrand';
import SchedulingPanel from '@/components/scheduling/SchedulingPanel';
import SchedulingCalendarBar from '@/components/scheduling/SchedulingCalendarBar';
import AvailabilityModal from '@/components/scheduling/AvailabilityModal';
import CreateMeetingModal from '@/components/scheduling/CreateMeetingModal';
import ImageCreateModal from '@/components/workspace/ImageCreateModal';
import ScreenshotToolModal from '@/components/shared/ScreenshotToolModal';
import { useSchedulingCalendar } from '@/hooks/scheduling/useSchedulingCalendar';
import { useSchedulingAvailability } from '@/hooks/scheduling/useSchedulingAvailability';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import QuickProjectForm from '@/components/planning-map/QuickProjectForm';
import ContentItemCreateModal from '@/components/planning-map/ContentItemCreateModal';
import ContentItemDetailModal from '@/components/planning-map/ContentItemDetailModal';
import CreateMenu from '@/components/workspace/CreateMenu';
import InspectorHost from '@/components/workspace/InspectorHost';
import Modal from '@/components/ui/Modal';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import WorkspaceLensToolbar from '@/components/workspace/WorkspaceLensToolbar';
import ContentChannelFilter from '@/components/workspace/ContentChannelFilter';
import CommandRegistry from '@/lib/commands/CommandRegistry';
import CommandPalette from '@/components/workspace/CommandPalette';
import VoiceProvider from '@/components/voice/VoiceProvider';
import FeedbackLauncher from '@/components/feedback/FeedbackLauncher';
import VoiceOverlay, { VoiceButton } from '@/components/voice/VoiceOverlay';
import { IntentConfirmationProvider } from '@/components/intent/IntentConfirmationContext';
import { fetchEstimatedHoursBatch } from '@/lib/ai/clientEstimateHours';
import { buildWorkspaceIntentContext } from '@/lib/voice/workspaceIntentContext';
import { ParsedIntent, splitBatchTaskTitles } from '@/lib/voice/IntentParser';
import { matchTaskInProjects } from '@/lib/voice/matchProjectTask';
import { isEmployeeOnProjectTeam } from '@/lib/utils/projectTeam';
import { matchEmployeeByVoiceName } from '@/lib/voice/employeeMatcher';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';

interface WorkspaceShellProps {
    initialPhase?: PhaseType;
    initialLens?: LensType;
}

export default function WorkspaceShell({
    initialPhase = 'All',
    initialLens = 'schedule',
}: WorkspaceShellProps) {
    const isMobile = useIsMobile();
    const router = useRouter();
    const pathname = usePathname();
    const ws = useWorkspaceData(initialPhase, initialLens);

    // Inspector / form state
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [editingProject, setEditingProject] = useState<IProject | undefined>();
    const [addContentProject, setAddContentProject] = useState<IProject | null>(null);
    const [addContentDefaultDate, setAddContentDefaultDate] = useState<Date | undefined>(undefined);
    const [addContentVoicePrefill, setAddContentVoicePrefill] = useState<{
        title?: string;
        channel?: string;
        notes?: string;
    } | null>(null);

    const [inspectorFocus, setInspectorFocus] = useState<string | null>(null);
    const [editingContentItemId, setEditingContentItemId] = useState<string | null>(null);
    /** Task row index in `project.tasks` when opening inspector from the schedule (cleared after the project view applies it). */
    const [inspectorOpenTaskIndex, setInspectorOpenTaskIndex] = useState<number | null>(null);
    /** Content item id when opening inspector from schedule content click. */
    const [inspectorOpenContentId, setInspectorOpenContentId] = useState<string | null>(null);
    const [inspectorAutoAddTask, setInspectorAutoAddTask] = useState(false);

    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [showMeetingModal, setShowMeetingModal] = useState(false);
    const [meetingRefreshKey, setMeetingRefreshKey] = useState(0);
    const [contentRefreshTrigger, setContentRefreshTrigger] = useState(0);
    const [scheduleSyncRefreshKey, setScheduleSyncRefreshKey] = useState(0);
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showScreenshotModal, setShowScreenshotModal] = useState(false);
    const [schedulePanelMessage, setSchedulePanelMessage] = useState<string | null>(null);

    const {
        calendar: scheduleCalendar,
        syncing: scheduleSyncing,
        message: scheduleCalendarMessage,
        setMessage: setScheduleCalendarMessage,
        loadCalendar: loadScheduleCalendar,
        handleSync: handleScheduleCalendarSync,
        handleDisconnect: handleScheduleCalendarDisconnect,
    } = useSchedulingCalendar(ws.timeframe, ws.currentDate);
    const schedulingAvailability = useSchedulingAvailability();

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
    }, [ws.lens, ws]);

    const shouldPollProjectActivity = useMemo(() => {
        const activePhase = ws.phase === 'All' || ws.phase === 'Plan' || ws.phase === 'Build';
        const scheduleView =
            ws.phase !== 'Schedule' && (ws.lens === 'schedule' || ws.lens === 'projects');
        return activePhase && scheduleView;
    }, [ws.phase, ws.lens]);

    const refreshProjectActivity = useCallback(() => {
        void ws.loadData({ silent: true });
        void ws.fetchContentItems();
    }, [ws.loadData, ws.fetchContentItems]);

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
        if (!shouldPollProjectActivity) return;

        const intervalId = window.setInterval(refreshProjectActivity, 60_000);
        return () => window.clearInterval(intervalId);
    }, [shouldPollProjectActivity, refreshProjectActivity]);

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
            ws.setPhase(p);
            syncWorkspaceUrl({ phase: p });
        },
        [ws, syncWorkspaceUrl]
    );

    const handleLensSelect = useCallback(
        (lens: LensType) => {
            let resolved = lens === 'projects' ? 'schedule' : lens;
            if (resolved === 'agenda' && !isFeatureEnabled('agendaViewEnabled')) {
                resolved = 'schedule';
            }
            ws.setLens(resolved);
            syncWorkspaceUrl({ lens: resolved });
        },
        [ws, syncWorkspaceUrl]
    );

    // Handlers
    const handleCreateProject = () => {
        setEditingProject(undefined);
        setShowProjectForm(true);
    };

    const closeInspector = useCallback(() => {
        setInspectorFocus(null);
        setInspectorOpenTaskIndex(null);
        setInspectorOpenContentId(null);
        setInspectorAutoAddTask(false);
    }, []);

    const handleContentItemClickFromProject = useCallback((item: IContentItem) => {
        setEditingContentItemId(item._id.toString());
    }, []);

    const handleViewProject = useCallback((project: IProject) => {
        setInspectorAutoAddTask(false);
        setInspectorOpenTaskIndex(null);
        setInspectorOpenContentId(null);
        setInspectorFocus(`project:${project._id}`);
    }, []);

    const handleViewProjectTask = useCallback((project: IProject, taskIndex: number) => {
        setInspectorAutoAddTask(false);
        setInspectorOpenContentId(null);
        setInspectorFocus(`project:${project._id}`);
        setInspectorOpenTaskIndex(taskIndex);
    }, []);

    const handleViewProjectContent = useCallback((project: IProject, contentItemId: string) => {
        setInspectorAutoAddTask(false);
        setInspectorOpenTaskIndex(null);
        setInspectorOpenContentId(contentItemId);
        setInspectorFocus(`project:${project._id}`);
    }, []);

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

    const handleAddTaskToProject = useCallback((project: IProject) => {
        setInspectorOpenTaskIndex(null);
        setInspectorAutoAddTask(true);
        setInspectorFocus(`project:${project._id}`);
    }, []);

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

    const handleSubmitProject = async (data: Partial<IProject>) => {
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
                ws.loadData();
            }
        } catch {
            // Error saving project
        }
    };

    // Voice intent execution handler (may return Promise for async actions)
    const handleIntent = useCallback(async (intent: ParsedIntent): Promise<{ success: boolean; message: string }> => {
        const normalize = (s: string) =>
            s.toLowerCase().replace(/\b(the|task|item|a|an)\b/g, '').replace(/\s+/g, ' ').trim();

        const mergePatchProject = async (projectId: string, body: Record<string, unknown>) => {
            try {
                const res = await fetch(`/api/projects/${projectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { ok: false as const, message: (data as { error?: string }).error || 'Update failed' };
                }
                const data = await res.json().catch(() => null);
                if (data && typeof data === 'object' && (data as IProject)._id) {
                    ws.patchProjectInState(data as IProject);
                } else {
                    await ws.loadData({ silent: true });
                }
                return { ok: true as const, message: 'Updated' };
            } catch {
                return { ok: false as const, message: 'Network error' };
            }
        };

        const findEmployeeByVoice = (spoken: string) => matchEmployeeByVoiceName(spoken, ws.employees);

        const scoreBand = (score: number) => {
            if (score >= 0.9) return 'high';
            if (score >= 0.82) return 'medium';
            return 'low';
        };

        const describeEmployeeMismatch = (spoken: string) => {
            const outcome = findEmployeeByVoice(spoken);
            if (outcome.kind === 'exact' || outcome.kind === 'fuzzy') {
                console.log('[Voice] Employee match outcome', {
                    category: outcome.kind,
                    scoreBand: scoreBand(outcome.match.score),
                });
                return { employee: outcome.match.employee, error: null as string | null };
            }

            if (outcome.kind === 'ambiguous') {
                const options = outcome.candidates
                    .slice(0, 2)
                    .map((c) => c.employee.name)
                    .join(' or ');
                console.log('[Voice] Employee match outcome', {
                    category: 'ambiguous',
                    scoreBand: scoreBand(outcome.candidates[0]?.score ?? 0),
                });
                return {
                    employee: null,
                    error: `Couldn’t confidently match "${spoken}". Did you mean ${options}?`,
                };
            }

            console.log('[Voice] Employee match outcome', { category: 'none', scoreBand: 'none' });
            return {
                employee: null,
                error: `Couldn’t confidently match employee "${spoken}". Try full first and last name.`,
            };
        };

        const mapProjectStatus = (raw: string): IProject['status'] | null => {
            const s = raw.toLowerCase().trim();
            if (s.includes('plan')) return 'planning';
            if (s.includes('build') || s.includes('development')) return 'in-development';
            if (s.includes('launch') || s.includes('run')) return 'launched';
            if (s.includes('review')) return 'in-review';
            if (s.includes('complete') || s.includes('done') || s.includes('finished')) return 'completed';
            return null;
        };

        const mapTaskStatus = (raw: string): TaskStatus | null => {
            const s = raw.toLowerCase().trim();
            if (s.includes('review')) return 'in-review';
            if (s.includes('complete') || s.includes('done') || s.includes('finished')) return 'completed';
            if (s.includes('active')) return 'active';
            return null;
        };

        const sanitizeVoiceCreateTaskTitle = (raw: string) =>
            raw
                .replace(/^\s*(?:called|named)\s+/i, '')
                .replace(/\b(?:add|create)\s+(?:a\s+)?tasks?\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

        const sanitizeVoiceProjectSlot = (raw: string) =>
            raw
                .replace(/^\s*(?:called|named)\s+/i, '')
                .replace(/\s+/g, ' ')
                .trim();

        const resolveVoiceTaskProject = (cleanedProjectId: string, cleanedProjectName: string): IProject | null => {
            let target: IProject | null = null;
            if (cleanedProjectId) {
                target = ws.allProjects.find((p) => p._id.toString() === cleanedProjectId) ?? null;
            }
            if (!target && cleanedProjectName) {
                const searchName = normalize(cleanedProjectName);
                target =
                    ws.allProjects.find((p) => {
                        const pName = normalize(p.name);
                        return pName.includes(searchName) || searchName.includes(pName);
                    }) ?? null;
            }
            return target;
        };

        if (intent.type === 'NAVIGATE') {
            const place = intent.slots.place;
            if (place === 'workspace') {
                router.push('/workspace');
                return { success: true, message: 'Opening workspace' };
            }
            if (place === 'assets') {
                router.push('/assets');
                return { success: true, message: 'Opening assets' };
            }
            if (place === 'employees') {
                router.push('/employees');
                return { success: true, message: 'Opening employees' };
            }
            if (place === 'admin') {
                router.push('/admin');
                return { success: true, message: 'Opening admin' };
            }
        }
        if (intent.type === 'SWITCH_LENS') {
            const lens = intent.slots.lens;
            if (lens === 'schedule' || lens === 'projects') {
                handleLensSelect('schedule');
                return { success: true, message: 'Switched to projects view' };
            }
            if (lens === 'agenda') {
                handleLensSelect('agenda');
                return { success: true, message: 'Switched to agenda lens' };
            }
            if (lens === 'capacity') {
                handleLensSelect('capacity');
                return { success: true, message: 'Switched to capacity lens' };
            }
        }
        if (intent.type === 'FILTER_PHASE') {
            const phase = intent.slots.phase as PhaseType;
            if (['All', 'Plan', 'Build', 'Run', 'Schedule'].includes(phase)) {
                handlePhaseSelect(phase);
                return { success: true, message: `Filtered to ${phase} phase` };
            }
        }
        if (intent.type === 'SET_TIMEFRAME') {
            ws.setTimeframe(intent.slots.timeframe as any);
            return { success: true, message: `Timeframe set to ${intent.slots.timeframe}` };
        }
        if (intent.type === 'SWITCH_VIEW') {
            if (intent.slots.mode === 'calendar') {
                handleLensSelect('schedule');
                return { success: true, message: 'Switched to projects view' };
            }
            if (intent.slots.mode === 'agenda') {
                handleLensSelect('agenda');
                return { success: true, message: 'Switched to agenda view' };
            }
        }
        if (intent.type === 'CREATE_CONTENT') {
            const { title, channel, date, notes, project_name, projectId } = intent.slots;
            const titleStr = title?.trim() ?? '';
            const channelStr = channel?.trim() ?? '';
            const notesStr = notes?.trim() ?? '';
            const dateStr = date?.trim();

            let project: IProject | null = null;
            const pid = projectId?.trim();
            if (pid) {
                project = ws.allProjects.find((p) => p._id.toString() === pid) ?? null;
            }
            const pname = project_name?.trim();
            if (!project && pname) {
                const searchName = normalize(pname);
                project =
                    ws.allProjects.find((p) => {
                        const pName = normalize(p.name);
                        return pName.includes(searchName) || searchName.includes(pName);
                    }) ?? null;
            }
            if (!project) {
                project = ws.filteredProjects[0] ?? ws.allProjects[0] ?? null;
            }
            if (!project) {
                return { success: false, message: 'No project available to attach content' };
            }

            let defaultDate = new Date();
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const d = new Date(`${dateStr}T12:00:00`);
                if (!isNaN(d.getTime())) defaultDate = d;
            }

            setAddContentProject(project);
            setAddContentDefaultDate(defaultDate);
            setAddContentVoicePrefill({ title: titleStr, channel: channelStr, notes: notesStr });
            return { success: true, message: 'Opening content creation form' };
        }
        if (intent.type === 'TOGGLE_FILTER') {
            if (intent.slots.filter === 'myAssignments') {
                if (!ws.isManagerOrAdmin) return { success: false, message: 'You must be a manager to toggle assignments filter' };
                ws.setShowOnlyMyAssignments(intent.slots.action === 'show');
                return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} only your assignments` };
            }
            if (intent.slots.filter === 'tasks') {
                ws.setShowTasks(intent.slots.action === 'show');
                return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} tasks` };
            }
            if (intent.slots.filter === 'content') {
                ws.setShowContent(intent.slots.action === 'show');
                return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} content` };
            }
        }
        if (intent.type === 'UPDATE_PROJECT_DESCRIPTION') {
            const { name, description } = intent.slots;
            if (!description?.trim()) return { success: false, message: 'No description text provided' };
            const searchName = normalize(name);
            const target = ws.allProjects.find(p => {
                const pName = normalize(p.name);
                return pName.includes(searchName) || searchName.includes(pName);
            });
            if (!target) return { success: false, message: `Could not find project matching "${name}"` };
            try {
                const res = await fetch(`/api/projects/${target._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: description.trim() }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    return { success: false, message: (data as { error?: string }).error || 'Failed to update description' };
                }
                if (data && typeof data === 'object' && (data as IProject)._id) {
                    ws.patchProjectInState(data as IProject);
                } else {
                    await ws.loadData({ silent: true });
                }
                return { success: true, message: `Updated description for ${target.name}` };
            } catch {
                return { success: false, message: 'Failed to update description' };
            }
        }

        if (intent.type === 'OPEN_ENTITY') {
            const { entityType, name } = intent.slots;
            const searchName = normalize(name);
            if (entityType === 'project') {
                const target = ws.allProjects.find(p => {
                    const pName = normalize(p.name);
                    return pName.includes(searchName) || searchName.includes(pName);
                });
                if (target) {
                    setInspectorOpenTaskIndex(null);
                    setInspectorFocus(`project:${target._id}`);
                    return { success: true, message: `Opening project: ${target.name}` };
                }
            } else if (entityType === 'content') {
                const target = ws.contentItems.find(c => {
                    const cTitle = normalize(c.title);
                    return cTitle.includes(searchName) || searchName.includes(cTitle);
                });
                if (target) {
                    setInspectorOpenTaskIndex(null);
                    const projectId = target.projectId?.toString();
                    if (projectId) {
                        setInspectorFocus(`project:${projectId}`);
                    }
                    setEditingContentItemId(target._id.toString());
                    return { success: true, message: `Opening content: ${target.title}` };
                }
            }
            return { success: false, message: `Could not find ${entityType} matching "${name}"` };
        }
        if (intent.type === 'DELETE_ENTITY') {
            const { entityType, name } = intent.slots;
            const searchName = normalize(name);
            if (entityType === 'project') {
                const target = ws.allProjects.find(p => {
                    const pName = normalize(p.name);
                    return pName.includes(searchName) || searchName.includes(pName);
                });
                if (target) {
                    handleDeleteProject(target._id.toString());
                    return { success: true, message: `Deleted project: ${target.name}` };
                }
            }
            if (entityType === 'task') {
                const m = matchTaskInProjects(ws.allProjects, normalize, name, null, { allowCompleted: true });
                if (m) {
                    const { project: p, taskIdx } = m;
                    const nextTasks = (p.tasks || []).filter((_, i) => i !== taskIdx);
                    const r = await mergePatchProject(p._id.toString(), { tasks: nextTasks });
                    return r.ok
                        ? { success: true, message: `Removed task from ${p.name}` }
                        : { success: false, message: r.message };
                }
            }
            return { success: false, message: `Could not find ${entityType} matching "${name}" to delete` };
        }
        if (intent.type === 'COMPLETE_TASK') {
            const { name, context } = intent.slots;
            const searchName = name ? normalize(name) : '';
            const searchContext = context ? normalize(context) : null;

            if ((!searchName || searchName === 'project') && searchContext) {
                const project = ws.allProjects.find(p => {
                    const pName = normalize(p.name);
                    return pName.includes(searchContext) || searchContext.includes(pName) || (searchContext.length <= 2 && pName.startsWith(searchContext));
                });
                if (!project) return { success: false, message: `Could not find project matching "${context}"` };
                const updatedTasks = (project.tasks || []).map(t => ({ ...t, status: 'completed' as const }));
                const r = await mergePatchProject(project._id.toString(), { status: 'completed', tasks: updatedTasks });
                return r.ok
                    ? { success: true, message: `Marked project "${project.name}" as complete.` }
                    : { success: false, message: r.message };
            }

            const bestMatch = matchTaskInProjects(ws.allProjects, normalize, name, context, { allowCompleted: false });
            if (bestMatch) {
                const { project: mProject, taskIdx, score } = bestMatch;
                const task = mProject.tasks![taskIdx];
                const updatedTasks = [...(mProject.tasks || [])];
                updatedTasks[taskIdx] = { ...task, status: 'completed' };
                const r = await mergePatchProject(mProject._id.toString(), { tasks: updatedTasks });
                return r.ok
                    ? { success: true, message: `Marked task "${task.name}" as complete (score ${Math.round(score)})` }
                    : { success: false, message: r.message };
            }

            return { success: false, message: `Could not find task matching "${name}"${context ? ` for "${context}"` : ''}` };
        }

        if (intent.type === 'OPEN_TASK') {
            const { name, context } = intent.slots;
            const ctx = context?.trim() ? context : null;
            const m = matchTaskInProjects(ws.allProjects, normalize, name, ctx, { allowCompleted: true });
            if (m) {
                handleViewProjectTask(m.project, m.taskIdx);
                return { success: true, message: `Opening task "${m.project.tasks![m.taskIdx].name}"` };
            }
            return { success: false, message: `Could not find task matching "${name}"` };
        }

        if (intent.type === 'BATCH_ADD_TASKS') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can add tasks' };
            const { titlesJoined, projectName, projectId, employeeName } = intent.slots;
            const cleanedProjectName = sanitizeVoiceProjectSlot(projectName || '');
            const cleanedProjectId = projectId?.trim() ?? '';

            const target = resolveVoiceTaskProject(cleanedProjectId, cleanedProjectName);
            if (!target) {
                return { success: false, message: 'Could not resolve a project for these tasks.' };
            }

            const rawTitles = splitBatchTaskTitles(titlesJoined || '');
            const cleanedTitles = rawTitles
                .map((t) => sanitizeVoiceCreateTaskTitle(t))
                .filter(
                    (t) =>
                        t.length >= 3 &&
                        !/\bproject\b/i.test(t) &&
                        !/\bto\s+(?:the\s+)?project\b/i.test(t)
                );
            if (cleanedTitles.length === 0) {
                return { success: false, message: 'No valid task names heard.' };
            }

            let assignEmp: { _id: unknown; name: string } | null = null;
            if (employeeName?.trim()) {
                const employeeResolution = describeEmployeeMismatch(employeeName);
                if (!employeeResolution.employee) {
                    return { success: false, message: employeeResolution.error || 'Could not find employee' };
                }
                assignEmp = employeeResolution.employee;
            }

            console.log('[Voice]', {
                kind: 'batch_add_tasks',
                count: cleanedTitles.length,
                assigned: !!assignEmp,
            });

            const weekMs = 7 * 24 * 60 * 60 * 1000;
            const newTasksBase = cleanedTitles.map((name) => ({
                name,
                description: '',
                status: 'active' as TaskStatus,
                startDate: new Date(),
                endDate: new Date(Date.now() + weekMs),
                estimatedHours: 0,
                assignedTo: assignEmp?.name ?? '',
                ...(assignEmp ? { assignedToEmployeeId: assignEmp._id as never } : {}),
            }));

            const estimates = await fetchEstimatedHoursBatch(
                cleanedTitles.map((name) => ({
                    kind: 'task' as const,
                    title: name,
                    projectName: target.name,
                }))
            );
            const newTasks = newTasksBase.map((task, i) => ({
                ...task,
                estimatedHours: estimates[i] ?? task.estimatedHours,
            }));

            const nextTasks = [...(target.tasks || []), ...newTasks];
            const r = await mergePatchProject(target._id.toString(), { tasks: nextTasks });
            if (!r.ok) return { success: false, message: r.message };
            const n = cleanedTitles.length;
            const assignHint = assignEmp ? ` Assigned to ${assignEmp.name}.` : '';
            return { success: true, message: `Added ${n} task${n === 1 ? '' : 's'} to ${target.name}.${assignHint}` };
        }

        if (intent.type === 'ADD_TASK') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can add tasks' };
            const { taskName, projectName, projectId } = intent.slots;

            const cleanedTaskName = sanitizeVoiceCreateTaskTitle(taskName || '');
            const cleanedProjectName = sanitizeVoiceProjectSlot(projectName || '');
            const cleanedProjectId = projectId?.trim() ?? '';

            const target = resolveVoiceTaskProject(cleanedProjectId, cleanedProjectName);
            if (!target) {
                return { success: false, message: 'Could not resolve a project for this task.' };
            }
            if (!cleanedTaskName || cleanedTaskName.length < 3) {
                return { success: false, message: 'I heard the project, but not a clean task name.' };
            }
            if (/\bproject\b/i.test(cleanedTaskName) || /\bto\s+(?:the\s+)?project\b/i.test(cleanedTaskName)) {
                return { success: false, message: 'Task name looked like command text. Please repeat the task title only.' };
            }
            const newTaskBase = {
                name: cleanedTaskName,
                description: '',
                status: 'active' as TaskStatus,
                startDate: new Date(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                estimatedHours: 0,
                assignedTo: '',
            };
            const [estimatedHours] = await fetchEstimatedHoursBatch([
                { kind: 'task', title: cleanedTaskName, projectName: target.name },
            ]);
            const newTask = {
                ...newTaskBase,
                estimatedHours: estimatedHours ?? newTaskBase.estimatedHours,
            };
            const nextTasks = [...(target.tasks || []), newTask];
            const r = await mergePatchProject(target._id.toString(), { tasks: nextTasks });
            return r.ok
                ? { success: true, message: `Added task to ${target.name}` }
                : { success: false, message: r.message };
        }

        if (intent.type === 'RENAME_PROJECT') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can rename projects' };
            const { fromName, toName } = intent.slots;
            const searchName = normalize(fromName);
            const target = ws.allProjects.find(p => {
                const pName = normalize(p.name);
                return pName.includes(searchName) || searchName.includes(pName);
            });
            if (!target) return { success: false, message: `Could not find project "${fromName}"` };
            const r = await mergePatchProject(target._id.toString(), { name: toName.trim() });
            return r.ok ? { success: true, message: `Renamed project to "${toName.trim()}"` } : { success: false, message: r.message };
        }

        if (intent.type === 'RENAME_TASK') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can rename tasks' };
            const { fromName, toName, context } = intent.slots;
            const ctx = context?.trim() ? context : null;
            const m = matchTaskInProjects(ws.allProjects, normalize, fromName, ctx, { allowCompleted: true });
            if (!m) return { success: false, message: `Could not find task "${fromName}"` };
            const tasks = [...(m.project.tasks || [])];
            tasks[m.taskIdx] = { ...tasks[m.taskIdx], name: toName.trim() };
            const r = await mergePatchProject(m.project._id.toString(), { tasks });
            return r.ok ? { success: true, message: `Renamed task to "${toName.trim()}"` } : { success: false, message: r.message };
        }

        if (intent.type === 'SET_PROJECT_STATUS') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can change project status' };
            const { projectName, status } = intent.slots;
            const st = mapProjectStatus(status);
            if (!st) return { success: false, message: `Unknown status "${status}"` };
            const searchName = normalize(projectName);
            const target = ws.allProjects.find(p => {
                const pName = normalize(p.name);
                return pName.includes(searchName) || searchName.includes(pName);
            });
            if (!target) return { success: false, message: `Could not find project "${projectName}"` };
            const r = await mergePatchProject(target._id.toString(), { status: st });
            return r.ok ? { success: true, message: `Set ${target.name} to ${st}` } : { success: false, message: r.message };
        }

        if (intent.type === 'SET_TASK_STATUS') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can change task status' };
            const { taskName, status, context } = intent.slots;
            const st = mapTaskStatus(status);
            if (!st) return { success: false, message: `Unknown task status "${status}"` };
            const ctx = context?.trim() ? context : null;
            const m = matchTaskInProjects(ws.allProjects, normalize, taskName, ctx, { allowCompleted: true });
            if (!m) return { success: false, message: `Could not find task "${taskName}"` };
            const tasks = [...(m.project.tasks || [])];
            tasks[m.taskIdx] = { ...tasks[m.taskIdx], status: st };
            const r = await mergePatchProject(m.project._id.toString(), { tasks });
            return r.ok ? { success: true, message: `Updated task status to ${st}` } : { success: false, message: r.message };
        }

        if (intent.type === 'ASSIGN_PROJECT') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can assign projects' };
            const { projectName, employeeName } = intent.slots;
            const employeeResolution = describeEmployeeMismatch(employeeName);
            if (!employeeResolution.employee) {
                return { success: false, message: employeeResolution.error || 'Could not find employee' };
            }
            const emp = employeeResolution.employee;
            const searchName = normalize(projectName);
            const target = ws.allProjects.find(p => {
                const pName = normalize(p.name);
                return pName.includes(searchName) || searchName.includes(pName);
            });
            if (!target) return { success: false, message: `Could not find project "${projectName}"` };
            const existing = ((target as { assignedToEmployeeIds?: unknown[] }).assignedToEmployeeIds || []).map((id) =>
                typeof id === 'string' ? id : (id as { toString: () => string }).toString()
            );
            const idStr = emp._id.toString();
            const merged = existing.includes(idStr) ? existing : [...existing, idStr];
            const r = await mergePatchProject(target._id.toString(), { assignedToEmployeeIds: merged });
            return r.ok
                ? { success: true, message: `Assigned ${target.name} to ${emp.name}` }
                : { success: false, message: r.message };
        }

        if (intent.type === 'ASSIGN_TASK') {
            if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can assign tasks' };
            const { taskName, employeeName, context } = intent.slots;
            const employeeResolution = describeEmployeeMismatch(employeeName);
            if (!employeeResolution.employee) {
                return { success: false, message: employeeResolution.error || 'Could not find employee' };
            }
            const emp = employeeResolution.employee;
            const ctx = context?.trim() ? context : null;
            const m = matchTaskInProjects(ws.allProjects, normalize, taskName, ctx, { allowCompleted: true });
            if (!m) return { success: false, message: `Could not find task "${taskName}"` };
            if (!isEmployeeOnProjectTeam(m.project, emp._id)) {
                return { success: false, message: `Add ${emp.name} to the project team first` };
            }
            const tasks = [...(m.project.tasks || [])];
            const task = tasks[m.taskIdx];
            const existingIds = ((task as { assignedToEmployeeIds?: unknown[] }).assignedToEmployeeIds || []).map((id) =>
                typeof id === 'string' ? id : (id as { toString: () => string }).toString()
            );
            const legacyId = (task as { assignedToEmployeeId?: { toString(): string } }).assignedToEmployeeId?.toString();
            const mergedIds = existingIds.length > 0 ? existingIds : legacyId ? [legacyId] : [];
            const idStr = emp._id.toString();
            const nextIds = mergedIds.includes(idStr) ? mergedIds : [...mergedIds, idStr];
            const names = nextIds
                .map((id) => ws.employees.find((e) => e._id.toString() === id)?.name)
                .filter(Boolean);
            tasks[m.taskIdx] = {
                ...task,
                assignedToEmployeeIds: nextIds as never,
                assignedToEmployeeId: nextIds[0] as never,
                assignedTo: names.join(', '),
            };
            const r = await mergePatchProject(m.project._id.toString(), { tasks });
            return r.ok ? { success: true, message: `Assigned task to ${emp.name}` } : { success: false, message: r.message };
        }

        if (intent.type === 'RUN_COMMAND') {
            const commandId = intent.slots.commandId?.trim();
            if (!commandId) return { success: false, message: 'No command specified' };
            const executed = CommandRegistry.execute(commandId);
            return executed
                ? { success: true, message: `Done` }
                : { success: false, message: `Command "${commandId}" not available or failed` };
        }

        return { success: false, message: `Voice action ${intent.type} not fully implemented yet` };
    }, [ws, handleDeleteProject, router, handleViewProjectTask, handlePhaseSelect, handleLensSelect]);

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
            execute: closeInspector,
        };
        CommandRegistry.register(closeCmd);
        return () => CommandRegistry.unregister('close-inspector');
    }, [inspectorFocus, closeInspector]);

    // Global keyboard shortcuts
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(open => !open);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (isCommandPaletteOpen) setPaletteNlError(null);
    }, [isCommandPaletteOpen]);

    const isSchedulingPhase = ws.phase === 'Schedule';

    useEffect(() => {
        if (isSchedulingPhase) {
            void loadScheduleCalendar();
        }
    }, [isSchedulingPhase, loadScheduleCalendar]);

    const handleScheduleSync = useCallback(async () => {
        const data = await handleScheduleCalendarSync();
        if (data) {
            setScheduleSyncRefreshKey((k) => k + 1);
        }
    }, [handleScheduleCalendarSync]);

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
            <VoiceProvider getWorkspaceContext={() => workspaceIntentContext}>
                <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px]">
                    <div className="w-full mx-auto pt-[30px] pb-8">
                    {/* ===== Workspace Header ===== */}
                    <div className="mb-4">
                        {/* Row 1: Title + Phase + Timeframe + Actions */}
                        <div className="flex flex-row items-center gap-4 flex-wrap lg:flex-nowrap mb-3">
                            <OrganizationBrand />
                            <PhaseFilter selected={ws.phase} onSelect={handlePhaseSelect} />
                            <TimeHorizonSelector
                                selected={ws.timeframe}
                                onSelect={(newTimeframe) => {
                                    ws.setTimeframe(newTimeframe);
                                    if (newTimeframe === 'today' && ws.timeframe === 'today') {
                                        ws.setCurrentDate(new Date());
                                    }
                                }}
                            />
                            <div className="flex gap-2 flex-shrink-0 ml-auto items-center flex-wrap justify-end">
                                {isSchedulingPhase && (
                                    <>
                                        <SchedulingCalendarBar
                                            calendar={scheduleCalendar}
                                            syncing={scheduleSyncing}
                                            onSync={() => void handleScheduleSync()}
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setShowAvailabilityModal(true)}
                                        >
                                            Set Availability
                                        </Button>
                                        {scheduleCalendar?.connected ? (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => void handleScheduleCalendarDisconnect()}
                                            >
                                                Disconnect
                                            </Button>
                                        ) : null}
                                    </>
                                )}
                                <CreateMenu
                                    isManagerOrAdmin={ws.isManagerOrAdmin}
                                    currentUserRole={ws.currentUserRole}
                                    onCreateProject={handleCreateProject}
                                    onCreateContent={() => {
                                        setAddContentProject(null);
                                        setAddContentDefaultDate(new Date());
                                        setAddContentVoicePrefill(null);
                                    }}
                                    onCreateMeeting={() => setShowMeetingModal(true)}
                                    onCreateImage={() => setShowImageModal(true)}
                                />
                            </div>
                        </div>

                        {/* Row 2: Lens bar + view toggles (hidden in Scheduling phase) */}
                        {!isSchedulingPhase && (
                        <div className="flex flex-wrap items-center gap-4 justify-between">
                            <LensBar
                                selected={ws.lens}
                                onSelect={handleLensSelect}
                                trailing={
                                    ws.isManagerOrAdmin ? (
                                        <Toggle
                                            label="Show only my assignments"
                                            checked={ws.showOnlyMyAssignments}
                                            onChange={ws.setShowOnlyMyAssignments}
                                        />
                                    ) : undefined
                                }
                            />
                            {(ws.lens === 'schedule' || ws.lens === 'agenda') && (
                                <WorkspaceLensToolbar className="ml-auto">
                                    <Toggle label="Show Tasks" checked={ws.showTasks} onChange={ws.setShowTasks} />
                                    <Toggle
                                        label="Show Content"
                                        checked={ws.showContent}
                                        onChange={ws.setShowContent}
                                    />
                                    {ws.lens === 'agenda' ? (
                                        <Toggle
                                            label="Show Meetings"
                                            checked={ws.showMeetings}
                                            onChange={ws.setShowMeetings}
                                        />
                                    ) : null}
                                    <ContentChannelFilter
                                        value={ws.contentChannelFilter}
                                        onChange={ws.setContentChannelFilter}
                                    />
                                </WorkspaceLensToolbar>
                            )}
                        </div>
                        )}

                    </div>

                    {/* ===== Main Content ===== */}
                    <div className="flex w-full gap-6">
                        <div className="flex-1 min-w-0">
                            {isSchedulingPhase ? (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <div className="xl:col-span-2 min-h-0 min-w-0">
                                        <SchedulingPanel
                                            projects={ws.allProjects}
                                            employees={ws.employees}
                                            currentUserEmployeeId={ws.currentUserEmployeeId}
                                            meetings={workspaceMeetings}
                                            loadingMeetings={loadingMeetings}
                                            meetingRefreshKey={meetingRefreshKey}
                                            timeframe={ws.timeframe}
                                            currentDate={ws.currentDate}
                                            onDateChange={ws.setCurrentDate}
                                            onRefreshMeetings={() => void refetchMeetings()}
                                            schedulingTimeZone={schedulingAvailability.timezone}
                                            externalMessage={scheduleHeaderMessage}
                                            onClearExternalMessage={() => {
                                                setSchedulePanelMessage(null);
                                                setScheduleCalendarMessage(null);
                                            }}
                                            onSetMessage={setSchedulePanelMessage}
                                        />
                                    </div>
                                    <div className="xl:col-span-1">
                                        <EmployeeSidebar
                                            employees={ws.employees}
                                            projects={ws.filteredProjects}
                                            allProjects={ws.allProjects}
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
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <div className="xl:col-span-2 min-h-0 min-w-0">
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
                                                isManagerOrAdmin={ws.isManagerOrAdmin}
                                                showOnlyMyAssignments={ws.showOnlyMyAssignments}
                                                onRefreshContent={ws.fetchContentItems}
                                                onAddContent={(project, defaultDate) => {
                                                    setAddContentVoicePrefill(null);
                                                    setAddContentProject(project);
                                                    setAddContentDefaultDate(defaultDate);
                                                }}
                                                onAddTask={handleAddTaskToProject}
                                                onContentItemClick={handleContentItemClickFromSchedule}
                                            />
                                        ) : (
                                            <AgendaView
                                                projects={ws.filteredProjects}
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
                                                onAddContent={(project, defaultDate) => {
                                                    setAddContentVoicePrefill(null);
                                                    setAddContentProject(project);
                                                    setAddContentDefaultDate(defaultDate);
                                                }}
                                                onContentItemClick={handleContentItemClickFromSchedule}
                                            />
                                        )}
                                    </div>
                                    <div className="xl:col-span-1">
                                        <EmployeeSidebar
                                            employees={ws.employees}
                                            projects={ws.filteredProjects}
                                            allProjects={ws.allProjects}
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
                                        allProjects={ws.allProjects}
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
                    <CreateMeetingModal
                        isOpen={showMeetingModal}
                        onClose={() => setShowMeetingModal(false)}
                        projects={ws.allProjects}
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

                    <ImageCreateModal
                        isOpen={showImageModal}
                        onClose={() => setShowImageModal(false)}
                        onScreenshot={() => setShowScreenshotModal(true)}
                    />

                    <ScreenshotToolModal
                        isOpen={showScreenshotModal}
                        onClose={() => setShowScreenshotModal(false)}
                        target={null}
                    />

                    <ContentItemCreateModal
                        isOpen={!!addContentProject}
                        onClose={() => {
                            setAddContentProject(null);
                            setAddContentDefaultDate(undefined);
                            setAddContentVoicePrefill(null);
                        }}
                        project={addContentProject}
                        defaultPublishDate={addContentDefaultDate}
                        initialTitle={addContentVoicePrefill?.title}
                        initialChannel={addContentVoicePrefill?.channel}
                        initialNotes={addContentVoicePrefill?.notes}
                        employees={ws.employees}
                        isManagerOrAdmin={ws.isManagerOrAdmin}
                        onSuccess={async () => {
                            await ws.fetchContentItems();
                            setContentRefreshTrigger((t) => t + 1);
                        }}
                    />

                    <ContentItemDetailModal
                        isOpen={!!editingContentItemId}
                        onClose={() => setEditingContentItemId(null)}
                        contentItemId={editingContentItemId}
                        employees={ws.employees}
                        isManagerOrAdmin={ws.isManagerOrAdmin}
                        currentUserEmployeeId={ws.currentUserEmployeeId}
                        stackAboveOverlays
                        onSaved={() => {
                            void ws.fetchContentItems();
                            setContentRefreshTrigger((t) => t + 1);
                        }}
                        onDeleted={() => {
                            void ws.fetchContentItems();
                            setContentRefreshTrigger((t) => t + 1);
                            setEditingContentItemId(null);
                        }}
                    />

                    {inspectorFocus && (
                        <InspectorHost
                            focusId={inspectorFocus}
                            onClose={closeInspector}
                            projects={ws.allProjects}
                            employees={ws.employees}
                            isManagerOrAdmin={ws.isManagerOrAdmin}
                            currentUserEmployeeId={ws.currentUserEmployeeId || undefined}
                            onRefresh={() => ws.loadData({ silent: true })}
                            onProjectPatched={ws.patchProjectInState}
                            initialOpenTaskIndex={inspectorOpenTaskIndex}
                            onInitialOpenTaskConsumed={() => setInspectorOpenTaskIndex(null)}
                            initialOpenContentId={inspectorOpenContentId}
                            onInitialOpenContentConsumed={() => setInspectorOpenContentId(null)}
                            autoAddTaskOnOpen={inspectorAutoAddTask}
                            onAutoAddTaskConsumed={() => setInspectorAutoAddTask(false)}
                            onAddContent={(project) => {
                                setAddContentVoicePrefill(null);
                                setAddContentProject(project);
                            }}
                            onContentItemClick={handleContentItemClickFromProject}
                            contentRefreshTrigger={contentRefreshTrigger}
                            onContentListChanged={() => setContentRefreshTrigger((t) => t + 1)}
                            timeframe={ws.timeframe}
                            referenceDate={ws.currentDate}
                        />
                    )}

                    {/* Quick Project Creation */}
                    {isMobile ? (
                        <BottomSheet
                            isOpen={showProjectForm}
                            onClose={() => {
                                setShowProjectForm(false);
                                setEditingProject(undefined);
                            }}
                            title="New Project"
                        >
                            <div className="p-4">
                                <QuickProjectForm
                                    employees={ws.employees}
                                    defaultStatus={defaultStatus}
                                    onSubmit={handleSubmitProject}
                                    onCancel={() => {
                                        setShowProjectForm(false);
                                        setEditingProject(undefined);
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
                            }}
                            title="New Project"
                        >
                            <QuickProjectForm
                                employees={ws.employees}
                                defaultStatus={defaultStatus}
                                onSubmit={handleSubmitProject}
                                onCancel={() => {
                                    setShowProjectForm(false);
                                    setEditingProject(undefined);
                                }}
                            />
                        </Modal>
                    )}

                    <CommandPalette
                        isOpen={isCommandPaletteOpen}
                        onClose={() => setIsCommandPaletteOpen(false)}
                        workspaceIntentContext={workspaceIntentContext}
                        nlError={paletteNlError}
                    />
                    <FeedbackLauncher />
                        <VoiceOverlay />
                    </div>
                </div>
            </VoiceProvider>
        </IntentConfirmationProvider>
    );
}

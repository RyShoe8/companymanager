'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import { IClient } from '@/lib/models/Client';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { getProjectsForStage, ProjectStage } from '@/lib/utils/statusMapping';
import { excludeClientHubProjects, isClientHubProject, mergeClientHubProjectsForAgenda } from '@/lib/clients/clientProjectHelpers';
import { isEmployeeAssignedToClient } from '@/lib/utils/clientTeam';
import { mergeProjectsPreservingRecency } from '@/lib/utils/mergeProjectsPreservingRecency';
import { buildContentItemsByProjectId } from '@/lib/utils/projectLatestActivity';
import { TeamFilterType } from '@/components/workspace/WorkspaceTeamFilter';
import { filterContentItemsForMyAssignments } from '@/lib/workspace/workspaceContentFilter';
import { isManagerOrAdminRole } from '@/lib/utils/roles';

function toMs(d: Date | string | undefined): number {
    if (!d) return 0;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/** Cheap fingerprint so silent reloads can keep previous array refs when data is unchanged. */
function entityListFingerprint(
    items: Array<{ _id?: { toString(): string } | string; updatedAt?: Date | string }>
): string {
    if (!Array.isArray(items) || items.length === 0) return '0';
    let maxUpdated = 0;
    const ids: string[] = [];
    for (const item of items) {
        const id =
            typeof item._id === 'string' ? item._id : item._id?.toString?.() ?? '';
        ids.push(id);
        const u = toMs(item.updatedAt);
        if (u > maxUpdated) maxUpdated = u;
    }
    return `${items.length}:${maxUpdated}:${ids.join(',')}`;
}

function sameEntityList(
    prev: Array<{ _id?: { toString(): string } | string; updatedAt?: Date | string }>,
    next: Array<{ _id?: { toString(): string } | string; updatedAt?: Date | string }>
): boolean {
    return entityListFingerprint(prev) === entityListFingerprint(next);
}

export type LensType = 'schedule' | 'agenda' | 'projects' | 'clients' | 'capacity';
export type PhaseType = 'All' | 'Plan' | 'Build' | 'Run' | 'Schedule';

export interface WorkspaceState {
    // Data
    projects: IProject[];
    allProjects: IProject[];
    /** All org projects minus client HQ hubs — for project/schedule lenses. */
    projectsForLens: IProject[];
    clients: IClient[];
    employees: IEmployee[];
    contentItems: IContentItem[];
    loading: boolean;

    // User
    isManagerOrAdmin: boolean;
    currentUserRole: 'Administrator' | 'Manager' | 'User' | undefined;
    currentUserEmployeeName: string | null;
    currentUserEmployeeId: string | null;
    currentUserId: string | null;

    // View state
    phase: PhaseType;
    setPhase: (phase: PhaseType) => void;
    lens: LensType;
    setLens: (lens: LensType) => void;
    timeframe: TimeframeType;
    setTimeframe: (tf: TimeframeType) => void;
    currentDate: Date;
    setCurrentDate: (d: Date) => void;
    showOnlyMyAssignments: boolean;
    setShowOnlyMyAssignments: (v: boolean) => void;
    showTasks: boolean;
    setShowTasks: (v: boolean) => void;
    showContent: boolean;
    setShowContent: (v: boolean) => void;
    showMeetings: boolean;
    setShowMeetings: (v: boolean) => void;
    contentChannelFilter: string;
    setContentChannelFilter: (v: string) => void;
    teamFilter: TeamFilterType;
    setTeamFilter: (v: TeamFilterType) => void;

    // Filtered data
    filteredProjects: IProject[];
    /** Projects for Agenda lens — includes client hub projects with client-level tasks. */
    filteredProjectsForAgenda: IProject[];
    filteredContentItems: IContentItem[];
    filteredClients: IClient[];

    // Actions
    loadData: (options?: { silent?: boolean }) => Promise<void>;
    fetchContentItems: () => Promise<void>;
    /** Remove a content item from local state immediately (e.g. after delete). */
    removeContentItem: (contentItemId: string) => void;
    /** Merge one project from API (e.g. PUT response) without full reload — avoids inspector jitter */
    patchProjectInState: (updated: IProject) => void;
    /** Bump local recency for content-only saves that do not patch the project document */
    touchProjectLocalActivity: (projectId: string) => void;
    projectLocalTouchMs: Record<string, number>;
}

export default function useWorkspaceData(
    initialPhase: PhaseType = 'All',
    initialLens: LensType = 'schedule'
): WorkspaceState {
    const router = useRouter();

    // View state
    const [phase, setPhase] = useState<PhaseType>(initialPhase);
    const [lens, setLens] = useState<LensType>(initialLens);
    const [timeframe, setTimeframe] = useState<TimeframeType>('today');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Filters
    const [showOnlyMyAssignments, setShowOnlyMyAssignments] = useState(false);
    const [showTasks, setShowTasks] = useState(false);
    const [showContent, setShowContent] = useState(false);
    const [showMeetings, setShowMeetings] = useState(true);
    const [contentChannelFilter, setContentChannelFilter] = useState<string>('All');
    const [teamFilter, setTeamFilter] = useState<TeamFilterType>('All Teams');

    // Data
    const [allProjects, setAllProjects] = useState<IProject[]>([]);
    const [clients, setClients] = useState<IClient[]>([]);
    const [employees, setEmployees] = useState<IEmployee[]>([]);
    const [contentItems, setContentItems] = useState<IContentItem[]>([]);
    const [projectLocalTouchMs, setProjectLocalTouchMs] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    // User
    const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<'Administrator' | 'Manager' | 'User' | undefined>();
    const [currentUserEmployeeName, setCurrentUserEmployeeName] = useState<string | null>(null);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const loadGenerationRef = useRef(0);

    const fetchContentItems = useCallback(async () => {
        try {
            const res = await fetch('/api/content-items');
            if (res.ok) {
                const data = await res.json();
                setContentItems(data);
            }
        } catch {
            // ignore
        }
    }, []);

    const removeContentItem = useCallback((contentItemId: string) => {
        setContentItems((prev) => prev.filter((item) => item._id.toString() !== contentItemId));
    }, []);

    const loadData = useCallback(async (options?: { silent?: boolean }) => {
        const generation = ++loadGenerationRef.current;
        if (!options?.silent) {
            setLoading(true);
        }
        try {
            const [projectsRes, clientsRes, employeesRes, userResponse, contentRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/clients'),
                fetch('/api/employees'),
                fetch('/api/auth/me'),
                fetch('/api/content-items'),
            ]);

            if (generation !== loadGenerationRef.current) return;

            if (projectsRes.status === 401 || employeesRes.status === 401) {
                router.push('/login');
                return;
            }

            const projectsData = await projectsRes.json();
            const clientsData = clientsRes.ok ? await clientsRes.json() : [];
            const employeesData = await employeesRes.json();
            const contentData = contentRes.ok ? await contentRes.json() : [];

            if (generation !== loadGenerationRef.current) return;

            // Get current user's role and employee info
            try {
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData && userData.id) {
                        setCurrentUserId(userData.id);
                        let currentEmployee = employeesData.find(
                            (emp: IEmployee) => emp.userId?.toString() === userData.id
                        );
                        if (!currentEmployee && userData.email) {
                            currentEmployee = employeesData.find(
                                (emp: IEmployee) => emp.email?.toLowerCase() === userData.email?.toLowerCase()
                            );
                        }
                        if (currentEmployee) {
                            const role = currentEmployee.role || 'User';
                            setIsManagerOrAdmin(isManagerOrAdminRole(role));
                            setCurrentUserRole(role as 'Administrator' | 'Manager' | 'User');
                            setCurrentUserEmployeeName(currentEmployee.name || null);
                            setCurrentUserEmployeeId(currentEmployee._id?.toString() || null);
                        } else {
                            setIsManagerOrAdmin(false);
                            setCurrentUserRole(undefined);
                            setCurrentUserEmployeeName(null);
                            setCurrentUserEmployeeId(null);
                        }
                    } else {
                        setCurrentUserId(null);
                    }
                }
            } catch {
                // Error loading current user
            }

            if (generation !== loadGenerationRef.current) return;

            setAllProjects((prev) => {
                const merged = mergeProjectsPreservingRecency(prev, projectsData, {
                    contentByProjectId: buildContentItemsByProjectId(
                        Array.isArray(contentData) ? contentData : []
                    ),
                });
                return sameEntityList(prev, merged) ? prev : merged;
            });
            setClients((prev) =>
                Array.isArray(clientsData) && sameEntityList(prev, clientsData) ? prev : clientsData
            );
            setEmployees((prev) =>
                Array.isArray(employeesData) && sameEntityList(prev, employeesData)
                    ? prev
                    : employeesData
            );

            if (contentRes.ok) {
                const nextContent = Array.isArray(contentData) ? contentData : [];
                setContentItems((prev) => (sameEntityList(prev, nextContent) ? prev : nextContent));
            }
        } catch {
            // Error loading data
        } finally {
            if (generation === loadGenerationRef.current && !options?.silent) {
                setLoading(false);
            }
        }
    }, [router]);

    const bumpProjectLocalTouch = useCallback((projectId: string, ms?: number) => {
        const touchMs = ms ?? Date.now();
        setProjectLocalTouchMs((prev) => {
            const next = {
                ...prev,
                [projectId]: Math.max(prev[projectId] ?? 0, touchMs),
            };
            const keys = Object.keys(next);
            const MAX_TOUCH_KEYS = 200;
            if (keys.length <= MAX_TOUCH_KEYS) return next;
            // Drop oldest touches so long sessions don't grow unbounded.
            keys
                .sort((a, b) => (next[a] ?? 0) - (next[b] ?? 0))
                .slice(0, keys.length - MAX_TOUCH_KEYS)
                .forEach((k) => {
                    delete next[k];
                });
            return next;
        });
    }, []);

    const touchProjectLocalActivity = useCallback(
        (projectId: string) => {
            bumpProjectLocalTouch(projectId);
        },
        [bumpProjectLocalTouch]
    );

    const patchProjectInState = useCallback(
        (updated: IProject) => {
            const id =
                typeof updated._id === 'string'
                    ? updated._id
                    : (updated._id as { toString: () => string }).toString();
            const updatedAt = (updated as { updatedAt?: Date }).updatedAt ?? new Date();
            bumpProjectLocalTouch(id, Math.max(toMs(updatedAt), Date.now()));
            setAllProjects((prev) =>
                prev.map((p) => {
                    if (p._id.toString() !== id) return p;
                    const next = {
                        ...p,
                        ...updated,
                        _id: p._id,
                        updatedAt,
                    } as IProject;
                    if ('logo' in updated && (updated.logo === null || updated.logo === undefined)) {
                        next.logo = undefined;
                    }
                    return next;
                })
            );
        },
        [bumpProjectLocalTouch]
    );

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Phase-filtered projects (client HQ hubs excluded from project lenses)
    const projectsForLens = useMemo(
        () => excludeClientHubProjects(allProjects),
        [allProjects]
    );

    const projects = useMemo(() => {
        if (phase === 'All') return projectsForLens;
        if (phase === 'Schedule') return [];
        return getProjectsForStage(projectsForLens, phase as ProjectStage);
    }, [projectsForLens, phase]);



    const shouldRestrictToMyAssignments = useMemo(() => {
        if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
            return true;
        }
        return Boolean(
            showOnlyMyAssignments && (currentUserEmployeeName || currentUserEmployeeId)
        );
    }, [currentUserRole, showOnlyMyAssignments, currentUserEmployeeName, currentUserEmployeeId]);

    const filterProjectsToMyAssignments = useCallback(
        (list: IProject[], clientsList: IClient[]) => {
            const clientsById = new Map(clientsList.map((c) => [String(c._id), c]));
            return list.filter((project) => {
                if (
                    isClientHubProject(project) &&
                    project.clientId != null &&
                    currentUserEmployeeId
                ) {
                    const client = clientsById.get(String(project.clientId));
                    if (client && isEmployeeAssignedToClient(client, currentUserEmployeeId)) {
                        return true;
                    }
                }
                const projectAssignedToIds = project.assignedToEmployeeIds;
                if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
                    if (projectAssignedToIds.some((id) => id?.toString() === currentUserEmployeeId))
                        return true;
                }
                const projectAssignedToId = project.assignedToEmployeeId?.toString();
                if (
                    projectAssignedToId === currentUserEmployeeId ||
                    project.assignedTo === currentUserEmployeeName
                )
                    return true;
                if (
                    project.tasks?.some((task) => {
                        const taskAssignedToId = task.assignedToEmployeeId?.toString();
                        return (
                            taskAssignedToId === currentUserEmployeeId ||
                            task.assignedTo === currentUserEmployeeName
                        );
                    })
                )
                    return true;
                return false;
            });
        },
        [currentUserEmployeeId, currentUserEmployeeName]
    );

    const filterClientsToMyAssignments = useCallback(
        (list: IClient[]) =>
            list.filter((client) => {
                const assignedIds = (client as { assignedToEmployeeIds?: unknown[] }).assignedToEmployeeIds;
                if (assignedIds && Array.isArray(assignedIds)) {
                    if (
                        assignedIds.some(
                            (id: unknown) => id?.toString() === currentUserEmployeeId
                        )
                    ) {
                        return true;
                    }
                }
                const assignedId = (client as { assignedToEmployeeId?: { toString(): string } })
                    .assignedToEmployeeId?.toString();
                return assignedId === currentUserEmployeeId;
            }),
        [currentUserEmployeeId]
    );

    // User-role + "my assignments" filter
    const filteredProjects = useMemo(() => {
        if (!currentUserRole) return [];

        const list = shouldRestrictToMyAssignments
            ? filterProjectsToMyAssignments(projects, clients)
            : projects;

        if (lens === 'schedule') {
            return list.filter((p) => p.status !== 'completed');
        }

        return list;
    }, [
        projects,
        currentUserRole,
        shouldRestrictToMyAssignments,
        filterProjectsToMyAssignments,
        lens,
    ]);

    const filteredClients = useMemo(() => {
        if (!shouldRestrictToMyAssignments || !currentUserEmployeeId) {
            return clients;
        }
        return filterClientsToMyAssignments(clients);
    }, [
        clients,
        shouldRestrictToMyAssignments,
        currentUserEmployeeId,
        filterClientsToMyAssignments,
    ]);

    const filteredProjectsForAgenda = useMemo(() => {
        if (!currentUserRole) return [];

        const base = shouldRestrictToMyAssignments
            ? filterProjectsToMyAssignments(projects, clients)
            : projects;

        let withHubs = mergeClientHubProjectsForAgenda(base, allProjects, filteredClients);

        if (shouldRestrictToMyAssignments) {
            const seen = new Set(withHubs.map((p) => String(p._id)));
            for (const hub of allProjects) {
                if (!isClientHubProject(hub) || seen.has(String(hub._id))) continue;
                if (filterProjectsToMyAssignments([hub], clients).length > 0) {
                    withHubs = [...withHubs, hub];
                    seen.add(String(hub._id));
                }
            }
        }

        return withHubs.filter((p) => p.status !== 'completed');
    }, [
        projects,
        allProjects,
        clients,
        filteredClients,
        currentUserRole,
        shouldRestrictToMyAssignments,
        filterProjectsToMyAssignments,
    ]);

    const filteredContentItems = useMemo(() => {
        if (!shouldRestrictToMyAssignments || !currentUserEmployeeId) {
            return contentItems;
        }
        return filterContentItemsForMyAssignments(
            contentItems,
            currentUserEmployeeId,
            currentUserId
        );
    }, [contentItems, shouldRestrictToMyAssignments, currentUserEmployeeId, currentUserId]);

    return useMemo(
        () => ({
            projects,
            allProjects,
            projectsForLens,
            clients,
            filteredClients,
            employees,
            contentItems,
            loading,
            isManagerOrAdmin,
            currentUserRole,
            currentUserEmployeeName,
            currentUserEmployeeId,
            currentUserId,
            phase,
            setPhase,
            lens,
            setLens,
            timeframe,
            setTimeframe,
            currentDate,
            setCurrentDate,
            showOnlyMyAssignments,
            setShowOnlyMyAssignments,
            showTasks,
            setShowTasks,
            showContent,
            setShowContent,
            showMeetings,
            setShowMeetings,
            contentChannelFilter,
            setContentChannelFilter,
            teamFilter,
            setTeamFilter,
            filteredProjects,
            filteredProjectsForAgenda,
            filteredContentItems,
            loadData,
            fetchContentItems,
            removeContentItem,
            patchProjectInState,
            touchProjectLocalActivity,
            projectLocalTouchMs,
        }),
        [
            projects,
            allProjects,
            projectsForLens,
            clients,
            filteredClients,
            employees,
            contentItems,
            loading,
            isManagerOrAdmin,
            currentUserRole,
            currentUserEmployeeName,
            currentUserEmployeeId,
            currentUserId,
            phase,
            lens,
            timeframe,
            currentDate,
            showOnlyMyAssignments,
            showTasks,
            showContent,
            showMeetings,
            contentChannelFilter,
            teamFilter,
            filteredProjects,
            filteredProjectsForAgenda,
            filteredContentItems,
            loadData,
            fetchContentItems,
            removeContentItem,
            patchProjectInState,
            touchProjectLocalActivity,
            projectLocalTouchMs,
        ]
    );
}

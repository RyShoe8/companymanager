'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import { IClient } from '@/lib/models/Client';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { getProjectsForStage, ProjectStage } from '@/lib/utils/statusMapping';
import { TeamFilterType } from '@/components/workspace/WorkspaceTeamFilter';

export type LensType = 'schedule' | 'agenda' | 'projects' | 'capacity';
export type PhaseType = 'All' | 'Plan' | 'Build' | 'Run' | 'Schedule' | 'Clients';

export interface WorkspaceState {
    // Data
    projects: IProject[];
    allProjects: IProject[];
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
    filteredContentItems: IContentItem[];

    // Actions
    loadData: (options?: { silent?: boolean }) => Promise<void>;
    fetchContentItems: () => Promise<void>;
    /** Merge one project from API (e.g. PUT response) without full reload — avoids inspector jitter */
    patchProjectInState: (updated: IProject) => void;
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
    const [showTasks, setShowTasks] = useState(true);
    const [showContent, setShowContent] = useState(true);
    const [showMeetings, setShowMeetings] = useState(true);
    const [contentChannelFilter, setContentChannelFilter] = useState<string>('All');
    const [teamFilter, setTeamFilter] = useState<TeamFilterType>('All Teams');

    // Data
    const [allProjects, setAllProjects] = useState<IProject[]>([]);
    const [clients, setClients] = useState<IClient[]>([]);
    const [employees, setEmployees] = useState<IEmployee[]>([]);
    const [contentItems, setContentItems] = useState<IContentItem[]>([]);
    const [loading, setLoading] = useState(true);

    // User
    const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<'Administrator' | 'Manager' | 'User' | undefined>();
    const [currentUserEmployeeName, setCurrentUserEmployeeName] = useState<string | null>(null);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

    const loadData = useCallback(async (options?: { silent?: boolean }) => {
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

            if (projectsRes.status === 401 || employeesRes.status === 401) {
                router.push('/login');
                return;
            }

            const projectsData = await projectsRes.json();
            const clientsData = clientsRes.ok ? await clientsRes.json() : [];
            const employeesData = await employeesRes.json();

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
                            setIsManagerOrAdmin(role === 'Manager' || role === 'Administrator');
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

            setAllProjects(projectsData);
            setClients(clientsData);
            setEmployees(employeesData);

            if (contentRes.ok) {
                const contentData = await contentRes.json();
                setContentItems(contentData);
            }
        } catch {
            // Error loading data
        } finally {
            if (!options?.silent) {
                setLoading(false);
            }
        }
    }, [router]);

    const patchProjectInState = useCallback((updated: IProject) => {
        const id =
            typeof updated._id === 'string' ? updated._id : (updated._id as { toString: () => string }).toString();
        setAllProjects((prev) =>
            prev.map((p) => {
                if (p._id.toString() !== id) return p;
                const next = {
                    ...p,
                    ...updated,
                    _id: p._id,
                    updatedAt: (updated as { updatedAt?: Date }).updatedAt ?? new Date(),
                } as IProject;
                if ('logo' in updated && (updated.logo === null || updated.logo === undefined)) {
                    next.logo = undefined;
                }
                return next;
            })
        );
    }, []);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Phase-filtered projects
    const projects = useMemo(() => {
        if (phase === 'All') return allProjects;
        if (phase === 'Schedule' || phase === 'Clients') return [];
        return getProjectsForStage(allProjects, phase as ProjectStage);
    }, [allProjects, phase]);



    const shouldRestrictToMyAssignments = useMemo(() => {
        if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
            return true;
        }
        return Boolean(
            showOnlyMyAssignments && (currentUserEmployeeName || currentUserEmployeeId)
        );
    }, [currentUserRole, showOnlyMyAssignments, currentUserEmployeeName, currentUserEmployeeId]);

    const filterProjectsToMyAssignments = useCallback(
        (list: IProject[]) =>
            list.filter((project) => {
                const projectAssignedToIds = (project as any).assignedToEmployeeIds;
                if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
                    if (projectAssignedToIds.some((id: any) => id?.toString() === currentUserEmployeeId))
                        return true;
                }
                const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
                if (
                    projectAssignedToId === currentUserEmployeeId ||
                    project.assignedTo === currentUserEmployeeName
                )
                    return true;
                if (
                    project.tasks?.some((task) => {
                        const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
                        return (
                            taskAssignedToId === currentUserEmployeeId ||
                            task.assignedTo === currentUserEmployeeName
                        );
                    })
                )
                    return true;
                return false;
            }),
        [currentUserEmployeeId, currentUserEmployeeName]
    );

    // User-role + "my assignments" filter
    const filteredProjects = useMemo(() => {
        if (!currentUserRole) return [];

        const list = shouldRestrictToMyAssignments
            ? filterProjectsToMyAssignments(projects)
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

    const filteredContentItems = useMemo(() => {
        if (!shouldRestrictToMyAssignments || !currentUserEmployeeId) {
            return contentItems;
        }
        return contentItems.filter(
            (item) => item.assignedToEmployeeId?.toString() === currentUserEmployeeId
        );
    }, [contentItems, shouldRestrictToMyAssignments, currentUserEmployeeId]);

    return {
        projects,
        allProjects,
        clients,
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
        filteredContentItems,
        loadData,
        fetchContentItems,
        patchProjectInState,
    };
}

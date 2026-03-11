'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType, getTimeframeRange } from '@/lib/utils/dateUtils';
import { getProjectsForStage, ProjectStage } from '@/lib/utils/statusMapping';

export type LensType = 'schedule' | 'projects' | 'capacity';
export type PhaseType = 'All' | 'Plan' | 'Build' | 'Run';
export type ScheduleMode = 'calendar' | 'agenda';

export interface WorkspaceState {
    // Data
    projects: IProject[];
    allProjects: IProject[];
    operations: IOperation[];
    allOperations: IOperation[];
    employees: IEmployee[];
    contentItems: IContentItem[];
    loading: boolean;

    // User
    isManagerOrAdmin: boolean;
    currentUserRole: 'Administrator' | 'Manager' | 'User' | undefined;
    currentUserEmployeeName: string | null;
    currentUserEmployeeId: string | null;

    // View state
    phase: PhaseType;
    setPhase: (phase: PhaseType) => void;
    lens: LensType;
    setLens: (lens: LensType) => void;
    scheduleMode: ScheduleMode;
    setScheduleMode: (mode: ScheduleMode) => void;
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
    contentChannelFilter: string;
    setContentChannelFilter: (v: string) => void;

    // Filtered data
    filteredProjects: IProject[];

    // Actions
    loadData: () => Promise<void>;
    fetchContentItems: () => Promise<void>;
}

export default function useWorkspaceData(
    initialPhase: PhaseType = 'All',
    initialLens: LensType = 'schedule'
): WorkspaceState {
    const router = useRouter();

    // View state
    const [phase, setPhase] = useState<PhaseType>(initialPhase);
    const [lens, setLens] = useState<LensType>(initialLens);
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('calendar');
    const [timeframe, setTimeframe] = useState<TimeframeType>('today');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Filters
    const [showOnlyMyAssignments, setShowOnlyMyAssignments] = useState(false);
    const [showTasks, setShowTasks] = useState(true);
    const [showContent, setShowContent] = useState(true);
    const [contentChannelFilter, setContentChannelFilter] = useState<string>('All');

    // Data
    const [allProjects, setAllProjects] = useState<IProject[]>([]);
    const [allOperations, setAllOperations] = useState<IOperation[]>([]);
    const [employees, setEmployees] = useState<IEmployee[]>([]);
    const [contentItems, setContentItems] = useState<IContentItem[]>([]);
    const [loading, setLoading] = useState(true);

    // User
    const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<'Administrator' | 'Manager' | 'User' | undefined>();
    const [currentUserEmployeeName, setCurrentUserEmployeeName] = useState<string | null>(null);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null);

    const fetchContentItems = useCallback(async () => {
        const { start, end } = getTimeframeRange(timeframe, currentDate);
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        try {
            const res = await fetch(`/api/content-items?start=${startStr}&end=${endStr}`);
            if (res.ok) {
                const data = await res.json();
                setContentItems(data);
            }
        } catch {
            // ignore
        }
    }, [timeframe, currentDate]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [projectsRes, operationsRes, employeesRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/operations'),
                fetch('/api/employees'),
            ]);

            if (projectsRes.status === 401 || operationsRes.status === 401 || employeesRes.status === 401) {
                router.push('/login');
                return;
            }

            const projectsData = await projectsRes.json();
            const operationsData = await operationsRes.json();
            const employeesData = await employeesRes.json();

            // Get current user's role and employee info
            try {
                const userResponse = await fetch('/api/auth/me');
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData && userData.id) {
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
                        }
                    }
                }
            } catch {
                // Error loading current user
            }

            setAllProjects(projectsData);
            setAllOperations(operationsData);
            setEmployees(employeesData);

            // Fetch content items for current timeframe
            const { start, end } = getTimeframeRange(timeframe, currentDate);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];
            const contentRes = await fetch(`/api/content-items?start=${startStr}&end=${endStr}`);
            if (contentRes.ok) {
                const contentData = await contentRes.json();
                setContentItems(contentData);
            }
        } catch {
            // Error loading data
        } finally {
            setLoading(false);
        }
    }, [router, timeframe, currentDate]);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-fetch content when timeframe/date changes
    useEffect(() => {
        if (!loading) {
            fetchContentItems();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeframe, currentDate]);

    // Phase-filtered projects
    const projects = useMemo(() => {
        if (phase === 'All') return allProjects;
        return getProjectsForStage(allProjects, phase as ProjectStage);
    }, [allProjects, phase]);

    // Operations (only show in Run or All)
    const operations = useMemo(() => {
        if (phase === 'All' || phase === 'Run') return allOperations;
        return [];
    }, [allOperations, phase]);

    // User-role + "my assignments" filter
    const filteredProjects = useMemo(() => {
        if (!currentUserRole) return projects;

        const filterToMyAssignments = (list: IProject[]) =>
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
            });

        // Regular users always see only their assignments
        if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
            return filterToMyAssignments(projects);
        }

        // Managers / Admins with toggle
        if (showOnlyMyAssignments && (currentUserEmployeeName || currentUserEmployeeId)) {
            return filterToMyAssignments(projects);
        }

        return projects;
    }, [
        projects,
        currentUserRole,
        currentUserEmployeeName,
        currentUserEmployeeId,
        showOnlyMyAssignments,
    ]);

    return {
        projects,
        allProjects,
        operations,
        allOperations,
        employees,
        contentItems,
        loading,
        isManagerOrAdmin,
        currentUserRole,
        currentUserEmployeeName,
        currentUserEmployeeId,
        phase,
        setPhase,
        lens,
        setLens,
        scheduleMode,
        setScheduleMode,
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
        contentChannelFilter,
        setContentChannelFilter,
        filteredProjects,
        loadData,
        fetchContentItems,
    };
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOsAuth } from '@/hooks/os/useOsAuth';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IEmployee } from '@/lib/models/Employee';
import type { IProject } from '@/lib/models/Project';
import type { TimeframeType } from '@/lib/utils/dateUtils';

interface OsScheduleData {
    projects: IProject[];
    contentItems: IContentItem[];
    employees: IEmployee[];
    loading: boolean;
    error: string | null;
    currentUserEmployeeName: string | null;
    refresh: () => void;
}

export function useOsScheduleData(
    timeframe: TimeframeType,
    currentDate: Date
): OsScheduleData {
    const auth = useOsAuth();
    const [projects, setProjects] = useState<IProject[]>([]);
    const [contentItems, setContentItems] = useState<IContentItem[]>([]);
    const [employees, setEmployees] = useState<IEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentUserEmployeeName =
        employees.find((e) => e._id?.toString() === auth.employeeId)?.name ??
        employees.find((e) => e.userId?.toString() === auth.userId)?.name ??
        auth.name;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [projectsRes, contentRes, employeesRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/content-items'),
                fetch('/api/employees'),
            ]);

            if (!projectsRes.ok) {
                setError(`Failed to load projects (HTTP ${projectsRes.status})`);
                return;
            }

            setProjects((await projectsRes.json()) as IProject[]);
            setContentItems(
                contentRes.ok ? ((await contentRes.json()) as IContentItem[]) : []
            );
            setEmployees(
                employeesRes.ok ? ((await employeesRes.json()) as IEmployee[]) : []
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load schedule data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return {
        projects,
        contentItems,
        employees,
        loading,
        error,
        currentUserEmployeeName: currentUserEmployeeName ?? null,
        refresh: load,
    };
}

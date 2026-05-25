'use client';

import { useCallback, useEffect, useState } from 'react';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import { useOsAuth } from '@/hooks/os/useOsAuth';
import { useWindowManager } from '@/hooks/os/useWindowManager';
import type { ModuleRenderContext } from '@/lib/os/types';
import type { IEmployee } from '@/lib/models/Employee';
import type { IProject } from '@/lib/models/Project';
import { projectSaveErrorMessage } from '@/lib/utils/projectSaveError';

export default function ProjectDetailModule({ windowId, payload }: ModuleRenderContext) {
    const wm = useWindowManager();
    const auth = useOsAuth();
    const projectId = payload?.projectId;
    const initialOpenTaskIndex = payload?.initialOpenTaskIndex
        ? Number.parseInt(payload.initialOpenTaskIndex, 10)
        : null;

    const [project, setProject] = useState<IProject | null>(null);
    const [employees, setEmployees] = useState<IEmployee[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!projectId) return;
        try {
            const [projectRes, employeesRes] = await Promise.all([
                fetch(`/api/projects/${projectId}`),
                fetch('/api/employees'),
            ]);
            if (!projectRes.ok) {
                setError(`Failed to load project (HTTP ${projectRes.status})`);
                return;
            }
            const projectData = (await projectRes.json()) as IProject;
            const employeesData = employeesRes.ok
                ? ((await employeesRes.json()) as IEmployee[])
                : [];
            setProject(projectData);
            setEmployees(employeesData);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load project');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (!projectId) {
            setLoading(false);
            setError('No project selected');
            return;
        }
        setLoading(true);
        refresh();
    }, [projectId, refresh]);

    if (!projectId) {
        return <div className="p-4 text-sm text-zinc-500">No project selected.</div>;
    }

    if (loading) {
        return <div className="p-4 text-sm text-zinc-500">Loading project…</div>;
    }

    if (error || !project) {
        return (
            <div className="p-4 text-sm text-red-400">
                {error ?? 'Project not found'}
            </div>
        );
    }

    return (
        <div className="px-3 py-3 sm:px-4 sm:py-4">
            <InlineProjectView
                project={project}
                employees={employees}
                isManagerOrAdmin={auth.isManagerOrAdmin}
                currentUserEmployeeId={auth.employeeId}
                onProjectPatched={(updated) => setProject(updated)}
                onUpdate={async (updates) => {
                    if (!updates || Object.keys(updates).length === 0) return;
                    const res = await fetch(`/api/projects/${project._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updates),
                    });
                    if (!res.ok) {
                        throw new Error(await projectSaveErrorMessage(res));
                    }
                    const data = (await res.json().catch(() => null)) as IProject | null;
                    if (data && typeof data === 'object' && data._id) {
                        setProject(data);
                    } else {
                        await refresh();
                    }
                }}
                onDelete={async () => {
                    const res = await fetch(`/api/projects/${project._id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Failed to delete project');
                    wm.close(windowId);
                }}
                onClose={() => wm.close(windowId)}
                onRefresh={refresh}
                timeframe="weekly"
                initialOpenTaskIndex={Number.isFinite(initialOpenTaskIndex) ? initialOpenTaskIndex : null}
            />
        </div>
    );
}

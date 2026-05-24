'use client';

import { useCallback, useState } from 'react';
import CalendarView from '@/components/planning-map/CalendarView';
import { useOsAuth } from '@/hooks/os/useOsAuth';
import { useOsScheduleData } from '@/hooks/os/useOsScheduleData';
import { useWindowManager } from '@/hooks/os/useWindowManager';
import type { IProject } from '@/lib/models/Project';
import { TimeframeType } from '@/lib/utils/dateUtils';

export default function ScheduleModule() {
    const wm = useWindowManager();
    const auth = useOsAuth();
    const [timeframe] = useState<TimeframeType>('weekly');
    const [currentDate, setCurrentDate] = useState(() => new Date());

    const { projects, contentItems, loading, error, currentUserEmployeeName, refresh } =
        useOsScheduleData(timeframe, currentDate);

    const openProject = useCallback(
        (project: IProject) => {
            wm.open('project-detail', {
                payload: {
                    projectId: project._id.toString(),
                    projectName: project.name,
                },
            });
        },
        [wm]
    );

    const openTask = useCallback(
        (project: IProject, taskIndex: number) => {
            wm.open('project-detail', {
                payload: {
                    projectId: project._id.toString(),
                    projectName: project.name,
                    initialOpenTaskIndex: String(taskIndex),
                },
            });
        },
        [wm]
    );

    if (loading) {
        return <div className="p-4 text-sm text-zinc-500">Loading schedule…</div>;
    }

    if (error) {
        return <div className="p-4 text-sm text-red-400">{error}</div>;
    }

    return (
        <div className="p-3">
            <CalendarView
                projects={projects}
                contentItems={contentItems}
                showTasks
                showContent
                contentChannelFilter="All"
                timeframe={timeframe}
                currentDate={currentDate}
                onProjectClick={openProject}
                onTaskClick={openTask}
                onDateChange={setCurrentDate}
                currentUserEmployeeName={currentUserEmployeeName}
                currentUserEmployeeId={auth.employeeId}
                isManagerOrAdmin={auth.isManagerOrAdmin}
                showOnlyMyAssignments={false}
                onRefreshContent={refresh}
                onAddContent={() => {}}
                onContentItemClick={() => {}}
            />
        </div>
    );
}

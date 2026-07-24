'use client';

import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType } from '@/lib/utils/dateUtils';
import CalendarView from '@/components/planning-map/CalendarView';
import type { TeamFilterType } from '@/components/workspace/WorkspaceTeamFilter';

interface ScheduleLensProps {
    projects: IProject[];
    contentItems: IContentItem[];
    showTasks: boolean;
    showContent: boolean;
    contentChannelFilter: string;
    timeframe: TimeframeType;
    currentDate: Date;
    onProjectClick: (project: IProject) => void;
    onTaskClick?: (project: IProject, taskIndex: number) => void;
    onDateChange: (date: Date) => void;
    currentUserEmployeeName: string | null;
    currentUserEmployeeId: string | null;
    currentUserId?: string | null;
    isManagerOrAdmin: boolean;
    showOnlyMyAssignments: boolean;
    teamFilter?: TeamFilterType;
    onRefreshContent: () => void;
    onAddContent: (project: IProject, defaultDate?: Date) => void;
    onAddTask?: (project: IProject) => void;
    onContentItemClick: (item: IContentItem) => void;
    itemSeenRefreshTrigger?: number;
    inspectorProjectId?: string | null;
    projectLocalTouchMs?: Record<string, number>;
}

export default function ScheduleLens({
    projects,
    contentItems,
    showTasks,
    showContent,
    contentChannelFilter,
    timeframe,
    currentDate,
    onProjectClick,
    onTaskClick,
    onDateChange,
    currentUserEmployeeName,
    currentUserEmployeeId,
    currentUserId,
    isManagerOrAdmin,
    showOnlyMyAssignments,
    teamFilter,
    onRefreshContent,
    onAddContent,
    onAddTask,
    onContentItemClick,
    itemSeenRefreshTrigger,
    inspectorProjectId,
    projectLocalTouchMs,
}: ScheduleLensProps) {
    return (
        <CalendarView
            projects={projects}
            contentItems={contentItems}
            showTasks={showTasks}
            showContent={showContent}
            contentChannelFilter={contentChannelFilter}
            timeframe={timeframe}
            currentDate={currentDate}
            onProjectClick={onProjectClick}
            onTaskClick={onTaskClick}
            onDateChange={onDateChange}
            currentUserEmployeeName={currentUserEmployeeName}
            currentUserEmployeeId={currentUserEmployeeId}
            currentUserId={currentUserId}
            isManagerOrAdmin={isManagerOrAdmin}
            showOnlyMyAssignments={showOnlyMyAssignments}
            teamFilter={teamFilter}
            onRefreshContent={onRefreshContent}
            onAddContent={onAddContent}
            onAddTask={onAddTask}
            onContentItemClick={onContentItemClick}
            itemSeenRefreshTrigger={itemSeenRefreshTrigger}
            inspectorProjectId={inspectorProjectId}
            projectLocalTouchMs={projectLocalTouchMs}
        />
    );
}

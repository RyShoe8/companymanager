'use client';

import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType } from '@/lib/utils/dateUtils';
import CalendarView from '@/components/planning-map/CalendarView';

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
    onRefreshContent: () => void;
    onAddContent: (project: IProject, defaultDate?: Date) => void;
    onAddTask?: (project: IProject) => void;
    onContentItemClick: (item: IContentItem) => void;
    itemSeenRefreshTrigger?: number;
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
    onRefreshContent,
    onAddContent,
    onAddTask,
    onContentItemClick,
    itemSeenRefreshTrigger,
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
            onDateChange={onDateChange}
            currentUserEmployeeName={currentUserEmployeeName}
            currentUserEmployeeId={currentUserEmployeeId}
            currentUserId={currentUserId}
            isManagerOrAdmin={isManagerOrAdmin}
            showOnlyMyAssignments={showOnlyMyAssignments}
            onRefreshContent={onRefreshContent}
            onAddContent={onAddContent}
            onAddTask={onAddTask}
            onContentItemClick={onContentItemClick}
            onTaskClick={onTaskClick}
            itemSeenRefreshTrigger={itemSeenRefreshTrigger}
        />
    );
}

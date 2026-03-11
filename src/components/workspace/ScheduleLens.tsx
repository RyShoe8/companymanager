'use client';

import { useState } from 'react';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { ScheduleMode } from '@/lib/hooks/useWorkspaceData';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';
import CalendarView from '@/components/planning-map/CalendarView';
import AgendaView from '@/components/workspace/AgendaView';

interface ScheduleLensProps {
    projects: IProject[];
    contentItems: IContentItem[];
    showTasks: boolean;
    showContent: boolean;
    contentChannelFilter: string;
    timeframe: TimeframeType;
    currentDate: Date;
    onProjectClick: (project: IProject) => void;
    onDateChange: (date: Date) => void;
    currentUserEmployeeName: string | null;
    currentUserEmployeeId: string | null;
    isManagerOrAdmin: boolean;
    showOnlyMyAssignments: boolean;
    onRefreshContent: () => void;
    onAddContent: (project: IProject, defaultDate?: Date) => void;
    onContentItemClick: (item: IContentItem) => void;
    scheduleMode: ScheduleMode;
    onScheduleModeChange: (mode: ScheduleMode) => void;
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
    onDateChange,
    currentUserEmployeeName,
    currentUserEmployeeId,
    isManagerOrAdmin,
    showOnlyMyAssignments,
    onRefreshContent,
    onAddContent,
    onContentItemClick,
    scheduleMode,
    onScheduleModeChange,
}: ScheduleLensProps) {
    const agendaEnabled = isFeatureEnabled('agendaViewEnabled');

    return (
        <div>
            {/* Mode toggle */}
            {agendaEnabled && (
                <div className="flex items-center gap-1 mb-4">
                    <button
                        onClick={() => onScheduleModeChange('calendar')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${scheduleMode === 'calendar'
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        📅 Calendar
                    </button>
                    <button
                        onClick={() => onScheduleModeChange('agenda')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${scheduleMode === 'agenda'
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        📋 Agenda
                    </button>
                </div>
            )}

            {/* Calendar mode */}
            {scheduleMode === 'calendar' && (
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
                    isManagerOrAdmin={isManagerOrAdmin}
                    showOnlyMyAssignments={showOnlyMyAssignments}
                    onRefreshContent={onRefreshContent}
                    onAddContent={onAddContent}
                    onContentItemClick={onContentItemClick}
                />
            )}

            {/* Agenda mode */}
            {scheduleMode === 'agenda' && (
                <AgendaView
                    projects={projects}
                    contentItems={contentItems}
                    showTasks={showTasks}
                    showContent={showContent}
                    contentChannelFilter={contentChannelFilter}
                    timeframe={timeframe}
                    currentDate={currentDate}
                    onProjectClick={onProjectClick}
                    currentUserEmployeeName={currentUserEmployeeName}
                    currentUserEmployeeId={currentUserEmployeeId}
                    isManagerOrAdmin={isManagerOrAdmin}
                    showOnlyMyAssignments={showOnlyMyAssignments}
                    onAddContent={onAddContent}
                    onContentItemClick={onContentItemClick}
                />
            )}
        </div>
    );
}

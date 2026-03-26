'use client';

import { useMemo } from 'react';
import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType, getTimeframeRange, formatDate } from '@/lib/utils/dateUtils';
import { resolveTaskIndexInProject } from '@/lib/utils/resolveTaskIndex';

interface AgendaViewProps {
    projects: IProject[];
    contentItems: IContentItem[];
    showTasks: boolean;
    showContent: boolean;
    contentChannelFilter: string;
    timeframe: TimeframeType;
    currentDate: Date;
    onProjectClick: (project: IProject) => void;
    onTaskClick?: (project: IProject, taskIndex: number) => void;
    currentUserEmployeeName: string | null;
    currentUserEmployeeId: string | null;
    isManagerOrAdmin: boolean;
    showOnlyMyAssignments: boolean;
    onAddContent: (project: IProject, defaultDate?: Date) => void;
    onContentItemClick: (item: IContentItem) => void;
}

interface AgendaDay {
    date: Date;
    dateStr: string;
    isToday: boolean;
    projects: AgendaDayProject[];
    contentItems: IContentItem[];
}

interface AgendaDayProject {
    project: IProject;
    tasks: IProjectTask[];
    content: IContentItem[];
}

const statusColors: Record<string, string> = {
    idea: '#6b7280',
    planned: '#3b82f6',
    in_progress: '#f59e0b',
    ready: '#10b981',
    published: '#8b5cf6',
};

const channelIcons: Record<string, string> = {
    X: '𝕏',
    LinkedIn: '💼',
    Instagram: '📸',
    TikTok: '🎵',
    Email: '📧',
    Article: '📝',
    Video: '🎬',
    Reddit: '🤖',
    Bluesky: '🦋',
    Other: '📎',
};

export default function AgendaView({
    projects,
    contentItems,
    showTasks,
    showContent,
    contentChannelFilter,
    timeframe,
    currentDate,
    onProjectClick,
    onTaskClick,
    isManagerOrAdmin,
    onAddContent,
    onContentItemClick,
}: AgendaViewProps) {
    const agendaDays = useMemo(() => {
        const { start, end } = getTimeframeRange(timeframe, currentDate);
        const days: AgendaDay[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Generate each day in the range
        const current = new Date(start);
        current.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        while (current <= endDate) {
            const dayStart = new Date(current);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(current);
            dayEnd.setHours(23, 59, 59, 999);

            // Find projects with tasks on this day
            const dayProjects: AgendaDayProject[] = [];
            projects.forEach((project) => {
                const tasksOnDay: IProjectTask[] = [];
                if (showTasks && project.tasks) {
                    project.tasks.forEach((task) => {
                        const taskStart = new Date(task.startDate);
                        taskStart.setHours(0, 0, 0, 0);
                        const taskEnd = new Date(task.endDate);
                        taskEnd.setHours(23, 59, 59, 999);
                        if (taskStart <= dayEnd && taskEnd >= dayStart) {
                            tasksOnDay.push(task);
                        }
                    });
                }

                // Find content items for this project on this day
                const contentOnDay: IContentItem[] = [];
                if (showContent) {
                    contentItems
                        .filter((item) => {
                            if (item.projectId?.toString() !== project._id.toString()) return false;
                            if (contentChannelFilter !== 'All' && item.channel !== contentChannelFilter)
                                return false;
                            if (!item.publishDate) return false;
                            const d = new Date(item.publishDate);
                            d.setHours(0, 0, 0, 0);
                            return d.getTime() === dayStart.getTime();
                        })
                        .forEach((item) => contentOnDay.push(item));
                }

                if (tasksOnDay.length > 0 || contentOnDay.length > 0) {
                    dayProjects.push({
                        project,
                        tasks: tasksOnDay,
                        content: contentOnDay,
                    });
                }
            });


            // Orphan content (no project match found in filtered set)
            const orphanContent = showContent
                ? contentItems.filter((item) => {
                    if (contentChannelFilter !== 'All' && item.channel !== contentChannelFilter)
                        return false;
                    if (!item.publishDate) return false;
                    const d = new Date(item.publishDate);
                    d.setHours(0, 0, 0, 0);
                    if (d.getTime() !== dayStart.getTime()) return false;
                    // Check it's not already under a project
                    return !dayProjects.some((dp) =>
                        dp.content.some((c) => c._id.toString() === item._id.toString())
                    );
                })
                : [];

            if (dayProjects.length > 0 || orphanContent.length > 0) {
                days.push({
                    date: new Date(dayStart),
                    dateStr: dayStart.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                    }),
                    isToday: dayStart.getTime() === today.getTime(),
                    projects: dayProjects,
                    contentItems: orphanContent,
                });
            }

            current.setDate(current.getDate() + 1);
        }

        return days;
    }, [
        projects,
        contentItems,
        showTasks,
        showContent,
        contentChannelFilter,
        timeframe,
        currentDate,
    ]);

    if (agendaDays.length === 0) {
        return (
            <div className="text-center py-16 text-text-secondary">
                <p className="text-lg mb-2">No items scheduled for this period</p>
                <p className="text-sm">Switch to calendar view or adjust your timeframe.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {agendaDays.map((day) => (
                <div key={day.date.toISOString()} className="border border-gray-700 rounded-lg overflow-hidden">
                    {/* Day header */}
                    <div
                        className={`px-4 py-3 flex items-center justify-between ${day.isToday ? 'bg-primary/20 border-b border-primary/30' : 'bg-gray-800/50 border-b border-gray-700'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`text-lg font-semibold ${day.isToday ? 'text-primary' : 'text-white'}`}>
                                {day.dateStr}
                            </span>
                            {day.isToday && (
                                <span className="px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-full">
                                    Today
                                </span>
                            )}
                        </div>
                        <span className="text-sm text-gray-400">
                            {day.projects.length > 0 && `${day.projects.length} project${day.projects.length > 1 ? 's' : ''}`}
                        </span>
                    </div>

                    {/* Day content */}
                    <div className="divide-y divide-gray-700/50">
                        {/* Projects */}
                        {day.projects.map(({ project, tasks, content }) => (
                            <div key={project._id.toString()} className="px-4 py-3">
                                {/* Project header */}
                                <div
                                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity mb-2"
                                    onClick={() => onProjectClick(project)}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: project.color || '#3b82f6' }}
                                    />
                                    <span className="font-medium text-white">{project.name}</span>
                                    <span className="text-xs text-gray-400">
                                        {tasks.length > 0 && `${tasks.length} task${tasks.length > 1 ? 's' : ''}`}
                                        {tasks.length > 0 && content.length > 0 && ' · '}
                                        {content.length > 0 && `${content.length} content`}
                                    </span>
                                </div>

                                {/* Tasks */}
                                {tasks.map((task) => {
                                    const tIdx = resolveTaskIndexInProject(project, task);
                                    return (
                                        <button
                                            key={task._id?.toString() || task.name}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (tIdx >= 0) onTaskClick?.(project, tIdx);
                                            }}
                                            className="ml-6 py-1.5 flex items-center gap-2 text-sm text-left w-[calc(100%-1.5rem)] rounded px-1 -mx-1 hover:bg-gray-800/50 transition-colors cursor-pointer"
                                        >
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'completed' ? 'bg-green-500' : task.status === 'in-review' ? 'bg-yellow-500' : 'bg-blue-400'
                                                }`} />
                                            <span className={`text-gray-300 ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                                {task.name}
                                            </span>
                                            {task.estimatedHours && (
                                                <span className="text-xs text-gray-500">{task.estimatedHours}h</span>
                                            )}
                                        </button>
                                    );
                                })}

                                {/* Content items */}
                                {content.map((item) => (
                                    <div
                                        key={item._id.toString()}
                                        className="ml-6 py-1.5 flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800/50 rounded px-1 -mx-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onContentItemClick(item);
                                        }}
                                    >
                                        <span className="flex-shrink-0">{channelIcons[item.channel] || '📎'}</span>
                                        <span className="text-gray-300">{item.title}</span>
                                        <span
                                            className="px-1.5 py-0.5 rounded text-xs font-medium"
                                            style={{
                                                backgroundColor: (statusColors[item.status] || '#6b7280') + '20',
                                                color: statusColors[item.status] || '#6b7280',
                                            }}
                                        >
                                            {item.status.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-gray-500">{item.channel}</span>
                                    </div>
                                ))}

                                {/* Quick add */}
                                {isManagerOrAdmin && (
                                    <button
                                        className="ml-6 mt-1 text-xs text-gray-500 hover:text-primary transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddContent(project, day.date);
                                        }}
                                    >
                                        + Add content
                                    </button>
                                )}
                            </div>
                        ))}


                        {/* Orphan content items */}
                        {day.contentItems.map((item) => (
                            <div
                                key={item._id.toString()}
                                className="px-4 py-3 flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800/30 transition-colors"
                                onClick={() => onContentItemClick(item)}
                            >
                                <span className="flex-shrink-0">{channelIcons[item.channel] || '📎'}</span>
                                <span className="text-gray-300">{item.title}</span>
                                <span
                                    className="px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{
                                        backgroundColor: (statusColors[item.status] || '#6b7280') + '20',
                                        color: statusColors[item.status] || '#6b7280',
                                    }}
                                >
                                    {item.status.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-gray-500">{item.channel}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

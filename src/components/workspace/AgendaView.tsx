'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { openMeetingPopout } from '@/lib/scheduling/openMeetingPopout';
import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import { IMeeting } from '@/lib/models/Meeting';
import {
    TimeframeType,
    getTimeframeRange,
    parseDateSafe,
    taskOverlapsViewDay,
    publishDateOnViewDay,
} from '@/lib/utils/dateUtils';
import { resolveTaskIndexInProject } from '@/lib/utils/resolveTaskIndex';
import {
    formatAgendaAssigneeDisplay,
    taskPassesAssignmentFilter,
    contentPassesAssignmentFilter,
} from '@/lib/utils/assigneeDisplay';
import { meetingsForAgendaDay } from '@/lib/scheduling/meetingHours';
import AssigneeTag from '@/components/workspace/AssigneeTag';
import PeriodNavButton from '@/components/ui/PeriodNavButton';
import { getPeriodViewTitle, shiftPeriodDate } from '@/lib/utils/periodNavigation';

interface AgendaViewProps {
    projects: IProject[];
    contentItems: IContentItem[];
    employees: IEmployee[];
    meetings?: IMeeting[];
    showTasks: boolean;
    showContent: boolean;
    showMeetings?: boolean;
    contentChannelFilter: string;
    timeframe: TimeframeType;
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onProjectClick: (project: IProject) => void;
    onTaskClick?: (project: IProject, taskIndex: number) => void;
    currentUserEmployeeName: string | null;
    currentUserEmployeeId: string | null;
    currentUserId?: string | null;
    currentUserRole?: 'Administrator' | 'Manager' | 'User';
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
    meetings: IMeeting[];
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

const agendaTypeBadgeClass =
    'px-1.5 py-0.5 rounded text-xs font-medium bg-background-elevated text-text-secondary flex-shrink-0';

function AgendaItemTypeBadge({ type }: { type: 'Task' | 'Content' | 'Meeting' }) {
    return <span className={agendaTypeBadgeClass}>{type}</span>;
}

function formatMeetingTimeRange(start: Date, end: Date): string {
    const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

export default function AgendaView({
    projects,
    contentItems,
    employees,
    meetings = [],
    showTasks,
    showContent,
    showMeetings = true,
    contentChannelFilter,
    timeframe,
    currentDate,
    onDateChange,
    onProjectClick,
    onTaskClick,
    currentUserEmployeeName,
    currentUserEmployeeId,
    currentUserId = null,
    currentUserRole,
    isManagerOrAdmin,
    showOnlyMyAssignments,
    onAddContent,
    onContentItemClick,
}: AgendaViewProps) {
    const assignmentFilterOpts = useMemo(
        () => ({
            showOnlyMyAssignments,
            isManagerOrAdmin,
            currentUserEmployeeId,
            currentUserEmployeeName,
            currentUserRole,
        }),
        [
            showOnlyMyAssignments,
            isManagerOrAdmin,
            currentUserEmployeeId,
            currentUserEmployeeName,
            currentUserRole,
        ]
    );

    const agendaDays = useMemo(() => {
        const { start, end } = getTimeframeRange(timeframe, currentDate);
        const days: AgendaDay[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const current = new Date(start);
        current.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        while (current <= endDate) {
            const dayStart = new Date(current);
            dayStart.setHours(0, 0, 0, 0);

            const dayProjects: AgendaDayProject[] = [];
            projects.forEach((project) => {
                const tasksOnDay: IProjectTask[] = [];
                if (showTasks && project.tasks) {
                    project.tasks.forEach((task) => {
                        const taskStart = parseDateSafe(task.startDate);
                        const taskEnd = parseDateSafe(task.endDate);
                        if (!taskStart || !taskEnd) return;
                        if (!taskOverlapsViewDay(dayStart, taskStart, taskEnd)) return;
                        if (!taskPassesAssignmentFilter(task, assignmentFilterOpts)) return;
                        tasksOnDay.push(task);
                    });
                }

                const contentOnDay: IContentItem[] = [];
                if (showContent) {
                    contentItems
                        .filter((item) => {
                            if (item.projectId?.toString() !== project._id.toString()) return false;
                            if (contentChannelFilter !== 'All' && item.channel !== contentChannelFilter)
                                return false;
                            if (!contentPassesAssignmentFilter(item, assignmentFilterOpts)) return false;
                            if (!item.publishDate) return false;
                            const d = parseDateSafe(item.publishDate);
                            if (!d) return false;
                            return publishDateOnViewDay(dayStart, d);
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

            const orphanContent = showContent
                ? contentItems.filter((item) => {
                    if (contentChannelFilter !== 'All' && item.channel !== contentChannelFilter)
                        return false;
                    if (!contentPassesAssignmentFilter(item, assignmentFilterOpts)) return false;
                    if (!item.publishDate) return false;
                    const d = parseDateSafe(item.publishDate);
                    if (!d || !publishDateOnViewDay(dayStart, d)) return false;
                    return !dayProjects.some((dp) =>
                        dp.content.some((c) => c._id.toString() === item._id.toString())
                    );
                })
                : [];

            if (dayProjects.length > 0 || orphanContent.length > 0 || (showMeetings && meetings.length > 0)) {
                const dayMeetings = showMeetings
                    ? meetingsForAgendaDay(meetings, dayStart, {
                          showOnlyMyAssignments,
                          currentUserEmployeeId,
                          currentUserId,
                      })
                    : [];

                if (dayProjects.length > 0 || orphanContent.length > 0 || dayMeetings.length > 0) {
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
                    meetings: dayMeetings,
                });
                }
            }

            current.setDate(current.getDate() + 1);
        }

        return days;
    }, [
        projects,
        contentItems,
        meetings,
        showTasks,
        showContent,
        showMeetings,
        contentChannelFilter,
        timeframe,
        currentDate,
        assignmentFilterOpts,
        showOnlyMyAssignments,
        currentUserEmployeeId,
        currentUserId,
    ]);

    const periodHeader = (
        <div className="bg-background-card rounded-lg border border-border">
            <div className="flex items-center gap-3 p-4 border-b border-border">
                <PeriodNavButton
                    direction="prev"
                    onClick={() => onDateChange(shiftPeriodDate(timeframe, currentDate, 'prev'))}
                />
                <h3 className="text-lg font-semibold text-text-primary min-w-[220px] text-center flex-1">
                    {getPeriodViewTitle(timeframe, currentDate)}
                </h3>
                <PeriodNavButton
                    direction="next"
                    onClick={() => onDateChange(shiftPeriodDate(timeframe, currentDate, 'next'))}
                />
            </div>
        </div>
    );

    if (agendaDays.length === 0) {
        return (
            <div className="space-y-4">
                {periodHeader}
                <div className="text-center py-16 text-text-secondary">
                    <p className="text-lg mb-2 text-text-primary">No items scheduled for this period</p>
                    <p className="text-sm">
                        Try the Schedule lens, turn on Show Content or Show Meetings, or adjust your timeframe.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {periodHeader}
            <div className="space-y-6">
            {agendaDays.map((day) => (
                <div key={day.date.toISOString()} className="border border-border rounded-lg overflow-hidden bg-background-card">
                    <div
                        className={`px-4 py-3 flex items-center justify-between ${day.isToday ? 'bg-primary/20 border-b border-primary/30' : 'bg-background-elevated border-b border-border'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`text-lg font-semibold ${day.isToday ? 'text-primary' : 'text-text-primary'}`}>
                                {day.dateStr}
                            </span>
                            {day.isToday && (
                                <span className="px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-full">
                                    Today
                                </span>
                            )}
                        </div>
                        <span className="text-sm text-text-secondary">
                            {[
                                day.meetings.length > 0
                                    ? `${day.meetings.length} meeting${day.meetings.length > 1 ? 's' : ''}`
                                    : null,
                                day.projects.length > 0
                                    ? `${day.projects.length} project${day.projects.length > 1 ? 's' : ''}`
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </div>

                    <div className="divide-y divide-border">
                        {day.meetings.map((meeting) => {
                            const start = new Date(meeting.start);
                            const end = new Date(meeting.end);
                            const linkedCount = meeting.linkedProjectIds?.length || 0;
                            return (
                                <div
                                    key={meeting._id.toString()}
                                    className="px-4 py-3 flex items-start gap-3 text-sm hover:bg-background-elevated transition-colors"
                                >
                                    <AgendaItemTypeBadge type="Meeting" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-text-primary">{meeting.title}</span>
                                            <span className="text-xs text-text-muted">
                                                {formatMeetingTimeRange(start, end)}
                                            </span>
                                        </div>
                                        {linkedCount > 0 ? (
                                            <p className="text-xs text-text-secondary mt-1">
                                                {linkedCount} linked project{linkedCount === 1 ? '' : 's'}
                                            </p>
                                        ) : null}
                                    </div>
                                    {meeting.agendaToken ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            className="shrink-0"
                                            onClick={() => openMeetingPopout(meeting.agendaToken)}
                                        >
                                            Open Meeting
                                        </Button>
                                    ) : null}
                                </div>
                            );
                        })}

                        {day.projects.map(({ project, tasks, content }) => (
                            <div key={project._id.toString()} className="px-4 py-3">
                                <div
                                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity mb-2"
                                    onClick={() => onProjectClick(project)}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: project.color || '#3b82f6' }}
                                    />
                                    <span className="font-medium text-text-primary">{project.name}</span>
                                    <span className="text-xs text-text-secondary">
                                        {tasks.length > 0 && `${tasks.length} task${tasks.length > 1 ? 's' : ''}`}
                                        {tasks.length > 0 && content.length > 0 && ' · '}
                                        {content.length > 0 && `${content.length} content`}
                                    </span>
                                </div>

                                {tasks.map((task) => {
                                    const tIdx = resolveTaskIndexInProject(project, task);
                                    const assignee = formatAgendaAssigneeDisplay(
                                        employees,
                                        currentUserEmployeeId,
                                        currentUserEmployeeName,
                                        task
                                    );
                                    return (
                                        <button
                                            key={task._id?.toString() || task.name}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (tIdx >= 0) onTaskClick?.(project, tIdx);
                                            }}
                                            className="ml-6 py-1.5 flex items-center gap-2 text-sm text-left w-[calc(100%-1.5rem)] rounded px-1 -mx-1 hover:bg-background-elevated transition-colors cursor-pointer flex-wrap"
                                        >
                                            <AgendaItemTypeBadge type="Task" />
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'completed' ? 'bg-green-500' : task.status === 'in-review' ? 'bg-yellow-500' : 'bg-blue-400'
                                                }`} />
                                            <span className={`text-text-primary ${task.status === 'completed' ? 'line-through text-text-muted' : ''}`}>
                                                {task.name}
                                            </span>
                                            {task.estimatedHours ? (
                                                <span className="text-xs text-text-muted">{task.estimatedHours}h</span>
                                            ) : null}
                                            {assignee ? <AssigneeTag name={assignee} /> : null}
                                        </button>
                                    );
                                })}

                                {content.map((item) => {
                                    const assignee = formatAgendaAssigneeDisplay(
                                        employees,
                                        currentUserEmployeeId,
                                        currentUserEmployeeName,
                                        item
                                    );
                                    return (
                                        <div
                                            key={item._id.toString()}
                                            className="ml-6 py-1.5 flex items-center gap-2 text-sm cursor-pointer hover:bg-background-elevated rounded px-1 -mx-1 flex-wrap"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onContentItemClick(item);
                                            }}
                                        >
                                            <AgendaItemTypeBadge type="Content" />
                                            <span className="flex-shrink-0" aria-hidden>
                                                {channelIcons[item.channel] || '📎'}
                                            </span>
                                            <span className="text-text-primary">{item.title}</span>
                                            <span
                                                className="px-1.5 py-0.5 rounded text-xs font-medium"
                                                style={{
                                                    backgroundColor: (statusColors[item.status] || '#6b7280') + '20',
                                                    color: statusColors[item.status] || '#6b7280',
                                                }}
                                            >
                                                {item.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-text-muted">{item.channel}</span>
                                            {assignee ? <AssigneeTag name={assignee} /> : null}
                                        </div>
                                    );
                                })}

                                {isManagerOrAdmin && (
                                    <button
                                        type="button"
                                        className="ml-6 mt-1 text-xs text-text-muted hover:text-primary transition-colors"
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

                        {day.contentItems.map((item) => {
                            const assignee = formatAgendaAssigneeDisplay(
                                employees,
                                currentUserEmployeeId,
                                currentUserEmployeeName,
                                item
                            );
                            return (
                                <div
                                    key={item._id.toString()}
                                    className="px-4 py-3 flex items-center gap-2 text-sm cursor-pointer hover:bg-background-elevated transition-colors flex-wrap"
                                    onClick={() => onContentItemClick(item)}
                                >
                                    <AgendaItemTypeBadge type="Content" />
                                    <span className="flex-shrink-0" aria-hidden>
                                        {channelIcons[item.channel] || '📎'}
                                    </span>
                                    <span className="text-text-primary">{item.title}</span>
                                    <span
                                        className="px-1.5 py-0.5 rounded text-xs font-medium"
                                        style={{
                                            backgroundColor: (statusColors[item.status] || '#6b7280') + '20',
                                            color: statusColors[item.status] || '#6b7280',
                                        }}
                                    >
                                        {item.status.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs text-text-muted">{item.channel}</span>
                                    {assignee ? <AssigneeTag name={assignee} /> : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            </div>
        </div>
    );
}

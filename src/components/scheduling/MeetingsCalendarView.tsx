'use client';

import { useEffect, useMemo, useState } from 'react';
import type { IMeeting } from '@/lib/models/Meeting';
import type { IProject } from '@/lib/models/Project';
import type { IEmployee } from '@/lib/models/Employee';
import Button from '@/components/ui/Button';
import CalendarPeriodHeader from '@/components/planning-map/CalendarPeriodHeader';
import MeetingAgendaRow, { type MeetingRow } from '@/components/scheduling/MeetingAgendaRow';
import {
  getCalendarPeriodTitle,
  navigateCalendarPeriod,
} from '@/lib/utils/calendarPeriodNav';
import { getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';

function toMeetingRow(meeting: IMeeting): MeetingRow {
  return {
    _id: meeting._id.toString(),
    title: meeting.title,
    start: new Date(meeting.start).toISOString(),
    end: new Date(meeting.end).toISOString(),
    agendaToken: meeting.agendaToken,
    linkedProjectIds: (meeting.linkedProjectIds || []).map((id) => id.toString()),
    attendeeEmployeeIds: meeting.attendeeEmployeeIds?.map((id) => id.toString()),
    externalAttendeeEmails: meeting.externalAttendeeEmails,
    googleRecurringEventId: meeting.googleRecurringEventId,
  };
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function meetingsOnDay(meetings: IMeeting[], day: Date): IMeeting[] {
  return meetings
    .filter((m) => {
      const start = new Date(m.start);
      return !Number.isNaN(start.getTime()) && isSameCalendarDay(start, day);
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function meetingsInRange(meetings: IMeeting[], rangeStart: Date, rangeEnd: Date): IMeeting[] {
  return meetings
    .filter((m) => {
      const start = new Date(m.start);
      return start >= rangeStart && start <= rangeEnd;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function isToday(day: Date): boolean {
  return isSameCalendarDay(day, new Date());
}

interface MeetingsCalendarViewProps {
  meetings: IMeeting[];
  timeframe: TimeframeType;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  projects: IProject[];
  employees: IEmployee[];
  editingId: string | null;
  editProjectIds: string[];
  onToggleProject: (id: string) => void;
  onStartEdit: (meetingId: string, linkedProjectIds: string[]) => void;
  onSaveLinks: (meetingId: string) => void;
  onNewMeeting: () => void;
}

export default function MeetingsCalendarView({
  meetings,
  timeframe,
  currentDate,
  onDateChange,
  projects,
  employees,
  editingId,
  editProjectIds,
  onToggleProject,
  onStartEdit,
  onSaveLinks,
  onNewMeeting,
}: MeetingsCalendarViewProps) {
  const [viewDate, setViewDate] = useState(currentDate);

  useEffect(() => {
    setViewDate(currentDate);
  }, [currentDate, timeframe]);

  const { start: startDate } = useMemo(
    () => getTimeframeRange(timeframe, viewDate),
    [timeframe, viewDate]
  );

  const title = getCalendarPeriodTitle(timeframe, viewDate);

  const handleNavigate = (direction: 'prev' | 'next') => {
    const next = navigateCalendarPeriod(timeframe, viewDate, direction);
    setViewDate(next);
    onDateChange(next);
  };

  const renderMeetingRows = (
    dayMeetings: IMeeting[],
    variant: 'default' | 'weekColumn' = 'default'
  ) => {
    if (dayMeetings.length === 0) {
      return (
        <p className={`text-sm text-text-secondary ${variant === 'weekColumn' ? 'py-1' : 'py-2'}`}>
          No meetings
        </p>
      );
    }
    return (
      <div className="divide-y divide-border min-w-0">
        {dayMeetings.map((m) => {
          const row = toMeetingRow(m);
          return (
            <MeetingAgendaRow
              key={row._id}
              meeting={row}
              employees={employees}
              projects={projects}
              isEditing={editingId === row._id}
              editProjectIds={editProjectIds}
              onToggleProject={onToggleProject}
              onStartEdit={() => onStartEdit(row._id, row.linkedProjectIds || [])}
              onSaveLinks={() => onSaveLinks(row._id)}
              variant={variant}
            />
          );
        })}
      </div>
    );
  };

  const renderTodayView = () => {
    const today = new Date(startDate);
    const dayMeetings = meetingsOnDay(meetings, today);

    return (
      <div className="p-6 min-h-[400px]">
        {dayMeetings.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <p className="text-lg mb-2">No meetings scheduled for today</p>
            <p className="text-sm">Sync your calendar or create a meeting.</p>
          </div>
        ) : (
          renderMeetingRows(dayMeetings)
        )}
      </div>
    );
  };

  const renderWeeklyView = () => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days: Date[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return (
      <>
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-text-secondary bg-background"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-border">
          {days.map((day, dayIdx) => {
            const dayMeetings = meetingsOnDay(meetings, day);
            const currentDay = isToday(day);
            return (
              <div
                key={dayIdx}
                className={`p-4 min-h-[380px] min-w-0 ${currentDay ? 'bg-primary-light' : ''}`}
              >
                <div
                  className={`text-lg font-semibold mb-3 ${
                    currentDay ? 'text-primary' : 'text-text-primary'
                  }`}
                >
                  {day.getDate()}
                </div>
                {renderMeetingRows(dayMeetings, 'weekColumn')}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderMonthlyView = () => {
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const firstDay = monthStart.getDay();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - mondayOffset);

    const lastDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const lastDay = lastDayOfMonth.getDay();
    const sundayOffset = lastDay === 0 ? 0 : 7 - lastDay;
    const calendarEnd = new Date(lastDayOfMonth);
    calendarEnd.setDate(calendarEnd.getDate() + sundayOffset);

    const days: Date[] = [];
    const cursor = new Date(calendarStart);
    while (cursor <= calendarEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const formatWeekLabel = (week: Date[]) => {
      const weekStart = week[0];
      const weekEnd = week[6];
      const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endLabel = weekEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `Week of ${startLabel} – ${endLabel}`;
    };

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weeks.map((week, weekIdx) => {
            const weekStart = new Date(week[0]);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(week[6]);
            weekEnd.setHours(23, 59, 59, 999);
            const weekMeetings = meetingsInRange(meetings, weekStart, weekEnd);

            return (
              <div
                key={weekIdx}
                className="bg-background rounded-lg border border-border p-4 min-h-[200px]"
              >
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {formatWeekLabel(week)}
                </h3>
                {weekMeetings.length === 0 ? (
                  <p className="text-sm text-text-secondary">No meetings this week</p>
                ) : (
                  <div className="space-y-2">
                    {weekMeetings.map((m) => {
                      const start = new Date(m.start);
                      const opts: Intl.DateTimeFormatOptions = {
                        hour: 'numeric',
                        minute: '2-digit',
                      };
                      return (
                        <div
                          key={m._id.toString()}
                          className="text-sm p-2 rounded border border-border bg-background-card"
                        >
                          <div className="font-medium text-text-primary truncate">{m.title}</div>
                          <div className="text-xs text-text-secondary mt-0.5">
                            {start.toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            · {start.toLocaleTimeString(undefined, opts)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQuarterlyView = () => {
    const quarter = Math.floor(viewDate.getMonth() / 3);
    const months: Array<{ start: Date; end: Date; label: string }> = [];

    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(viewDate.getFullYear(), quarter * 3 + i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      months.push({
        start: monthStart,
        end: monthEnd,
        label: monthDate.toLocaleDateString('en-US', { month: 'long' }),
      });
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {months.map(({ start, end, label }) => {
            const monthMeetings = meetingsInRange(meetings, start, end);
            return (
              <div
                key={label}
                className="bg-background rounded-lg border border-border p-4 min-h-[200px]"
              >
                <h3 className="text-lg font-semibold text-text-primary mb-3">{label}</h3>
                {monthMeetings.length === 0 ? (
                  <p className="text-sm text-text-secondary">No meetings</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {monthMeetings.map((m) => (
                      <div
                        key={m._id.toString()}
                        className="text-sm p-2 rounded border border-border bg-background-card"
                      >
                        <div className="font-medium text-text-primary truncate">{m.title}</div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          {new Date(m.start).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearlyView = () => {
    const months: Array<{ start: Date; end: Date; label: string }> = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(viewDate.getFullYear(), i, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(viewDate.getFullYear(), i + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      months.push({
        start: monthStart,
        end: monthEnd,
        label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
      });
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {months.map(({ start, end, label }) => {
            const monthMeetings = meetingsInRange(meetings, start, end);
            return (
              <div
                key={label}
                className="bg-background rounded-lg border border-border p-3 min-h-[120px]"
              >
                <h3 className="text-sm font-semibold text-text-primary mb-2">{label}</h3>
                <p className="text-xs text-text-secondary">
                  {monthMeetings.length === 0
                    ? 'No meetings'
                    : `${monthMeetings.length} meeting${monthMeetings.length === 1 ? '' : 's'}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background-card rounded-lg border border-border overflow-x-auto overflow-y-visible">
      <div className="p-4 border-b border-border">
        <CalendarPeriodHeader
          title={title}
          onPrev={() => handleNavigate('prev')}
          onNext={() => handleNavigate('next')}
          trailing={
            <Button type="button" size="sm" onClick={onNewMeeting}>
              New meeting
            </Button>
          }
        />
      </div>

      {timeframe === 'today' && renderTodayView()}
      {timeframe === 'weekly' && renderWeeklyView()}
      {timeframe === 'monthly' && renderMonthlyView()}
      {timeframe === 'quarterly' && renderQuarterlyView()}
      {timeframe === 'yearly' && renderYearlyView()}
    </div>
  );
}

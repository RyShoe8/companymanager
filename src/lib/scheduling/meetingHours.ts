import type { IMeeting } from '@/lib/models/Meeting';
import type { IEmployee } from '@/lib/models/Employee';
import { meetingInstanceDedupeKey } from '@/lib/scheduling/meetingDedupe';

export function meetingDurationHours(
  meeting: Pick<IMeeting, 'start' | 'end'>,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }

  const overlapStart = Math.max(start.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(end.getTime(), rangeEnd.getTime());
  if (overlapEnd <= overlapStart) return 0;

  const hours = (overlapEnd - overlapStart) / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

export function employeeAttendsMeeting(
  meeting: Pick<IMeeting, 'userId' | 'attendeeEmployeeIds'>,
  employee: Pick<IEmployee, '_id' | 'userId'>
): boolean {
  const employeeId = employee._id.toString();
  if (meeting.attendeeEmployeeIds?.some((id) => id.toString() === employeeId)) {
    return true;
  }
  if (employee.userId && meeting.userId?.toString() === employee.userId.toString()) {
    return true;
  }
  return false;
}

export function dedupeMeetingsForEmployee(
  meetings: IMeeting[],
  employee: Pick<IEmployee, '_id' | 'userId'>
): IMeeting[] {
  const relevant = meetings.filter((meeting) => employeeAttendsMeeting(meeting, employee));
  const deduped = new Map<string, IMeeting>();

  for (const meeting of relevant) {
    const key = meetingInstanceDedupeKey(meeting);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, meeting);
      continue;
    }
    if ((meeting.linkedProjectIds?.length || 0) > (existing.linkedProjectIds?.length || 0)) {
      deduped.set(key, meeting);
    }
  }

  return [...deduped.values()];
}

export function sumMeetingHoursForEmployee(
  meetings: IMeeting[],
  employee: Pick<IEmployee, '_id' | 'userId'>,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const deduped = dedupeMeetingsForEmployee(meetings, employee);
  const total = deduped.reduce(
    (sum, meeting) => sum + meetingDurationHours(meeting, rangeStart, rangeEnd),
    0
  );
  return Math.round(total * 100) / 100;
}

export function meetingPassesAssignmentFilter(
  meeting: Pick<IMeeting, 'userId' | 'attendeeEmployeeIds'>,
  options: {
    showOnlyMyAssignments: boolean;
    currentUserEmployeeId: string | null;
    currentUserId: string | null;
  }
): boolean {
  if (!options.showOnlyMyAssignments) return true;
  if (!options.currentUserEmployeeId && !options.currentUserId) return false;

  if (options.currentUserId && meeting.userId?.toString() === options.currentUserId) {
    return true;
  }

  if (options.currentUserEmployeeId && meeting.attendeeEmployeeIds?.length) {
    return meeting.attendeeEmployeeIds.some(
      (id) => id.toString() === options.currentUserEmployeeId
    );
  }

  return false;
}

function meetingOnViewDay(meetingStart: Date, dayStart: Date): boolean {
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  return meetingStart >= dayStart && meetingStart <= dayEnd;
}

export function meetingsForAgendaDay(
  meetings: IMeeting[],
  dayStart: Date,
  filterOptions: {
    showOnlyMyAssignments: boolean;
    currentUserEmployeeId: string | null;
    currentUserId: string | null;
  }
): IMeeting[] {
  return meetings.filter((meeting) => {
    const start = new Date(meeting.start);
    if (Number.isNaN(start.getTime()) || !meetingOnViewDay(start, dayStart)) return false;
    return meetingPassesAssignmentFilter(meeting, filterOptions);
  });
}

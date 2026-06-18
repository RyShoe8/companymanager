import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IMeeting } from '@/lib/models/Meeting';
import type { IEmployee } from '@/lib/models/Employee';
import { meetingInstanceDedupeKey, normalizeMeetingTimestampMs } from '@/lib/scheduling/meetingDedupe';
import {
  dedupeMeetingsForEmployee,
  employeeAttendsMeeting,
  meetingHoursInViewRange,
  meetingOverlapsViewRange,
  sumMeetingHoursForEmployee,
} from '@/lib/scheduling/meetingHours';

const employeeId = new Types.ObjectId();
const employeeUserId = new Types.ObjectId();

const employee = {
  _id: employeeId,
  userId: employeeUserId,
} as unknown as IEmployee;

const weekStart = new Date('2026-06-08T00:00:00.000Z');
const weekEnd = new Date('2026-06-14T23:59:59.999Z');

function meetingRow(
  partial: Partial<IMeeting> & { start: Date; end: Date }
): IMeeting {
  return {
    _id: new Types.ObjectId(),
    organizationId: 'org-1',
    userId: new Types.ObjectId(),
    title: 'Standup',
    agendaToken: 'token',
    attendeeEmployeeIds: [employeeId],
    ...partial,
  } as unknown as IMeeting;
}

describe('meetingInstanceDedupeKey', () => {
  const start = new Date('2026-06-09T14:00:00.000Z');
  const end = new Date('2026-06-09T16:30:00.000Z');

  it('uses identical keys for duplicate calendar copies without shared ids', () => {
    const keys = Array.from({ length: 10 }, (_, i) =>
      meetingInstanceDedupeKey({
        googleEventId: `user-copy-${i}`,
        start,
        end,
      })
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('uses iCalUID when present for standalone events', () => {
    const key = meetingInstanceDedupeKey({
      iCalUID: 'ical-abc',
      googleEventId: 'different-per-user',
      start,
      end,
    });
    expect(key).toBe('ical:ical-abc');
  });

  it('collapses standalone copies after a time move', () => {
    const wednesday = new Date('2026-06-10T14:00:00.000Z');
    const thursday = new Date('2026-06-11T14:00:00.000Z');
    const keyWed = meetingInstanceDedupeKey({
      iCalUID: 'ical-moved',
      start: wednesday,
      end: new Date('2026-06-10T15:00:00.000Z'),
    });
    const keyThu = meetingInstanceDedupeKey({
      iCalUID: 'ical-moved',
      start: thursday,
      end: new Date('2026-06-11T15:00:00.000Z'),
    });
    expect(keyWed).toBe(keyThu);
  });

  it('collapses copies with start/end off by seconds', () => {
    const keyA = meetingInstanceDedupeKey({
      googleEventId: 'copy-a',
      start,
      end,
    });
    const keyB = meetingInstanceDedupeKey({
      googleEventId: 'copy-b',
      start: new Date(start.getTime() + 15_000),
      end: new Date(end.getTime() + 500),
    });
    expect(keyA).toBe(keyB);
  });

  it('distinguishes recurring instances by start time', () => {
    const seriesId = 'recurring-series-1';
    const monday = new Date('2026-06-08T14:00:00.000Z');
    const tuesday = new Date('2026-06-09T14:00:00.000Z');
    const keyMon = meetingInstanceDedupeKey({
      googleRecurringEventId: seriesId,
      start: monday,
      end: new Date('2026-06-08T14:30:00.000Z'),
    });
    const keyTue = meetingInstanceDedupeKey({
      googleRecurringEventId: seriesId,
      start: tuesday,
      end: new Date('2026-06-09T14:30:00.000Z'),
    });
    expect(keyMon).not.toBe(keyTue);
  });
});

describe('sumMeetingHoursForEmployee', () => {
  it('counts 10 duplicate rows for one 2.5h meeting as 2.5h', () => {
    const start = new Date('2026-06-09T14:00:00.000Z');
    const end = new Date('2026-06-09T16:30:00.000Z');
    const meetings = Array.from({ length: 10 }, (_, i) =>
      meetingRow({
        userId: new Types.ObjectId(),
        googleEventId: `copy-${i}`,
        start,
        end,
      })
    );

    expect(sumMeetingHoursForEmployee(meetings, employee, weekStart, weekEnd)).toBe(2.5);
  });

  it('counts each recurring instance once even with duplicate rows', () => {
    const instances = [
      {
        start: new Date('2026-06-08T14:00:00.000Z'),
        end: new Date('2026-06-08T14:30:00.000Z'),
      },
      {
        start: new Date('2026-06-09T14:00:00.000Z'),
        end: new Date('2026-06-09T14:30:00.000Z'),
      },
      {
        start: new Date('2026-06-10T14:00:00.000Z'),
        end: new Date('2026-06-10T14:30:00.000Z'),
      },
      {
        start: new Date('2026-06-11T14:00:00.000Z'),
        end: new Date('2026-06-11T14:30:00.000Z'),
      },
      {
        start: new Date('2026-06-12T14:00:00.000Z'),
        end: new Date('2026-06-12T14:30:00.000Z'),
      },
    ];

    const meetings: IMeeting[] = [];
    for (const instance of instances) {
      for (let copy = 0; copy < 4; copy += 1) {
        meetings.push(
          meetingRow({
            googleRecurringEventId: 'series-standup',
            googleEventId: `instance-${instance.start.toISOString()}-copy-${copy}`,
            start: instance.start,
            end: instance.end,
          })
        );
      }
    }

    expect(sumMeetingHoursForEmployee(meetings, employee, weekStart, weekEnd)).toBe(2.5);
  });

  it('counts two different meetings at different times separately', () => {
    const meetings = [
      meetingRow({
        googleEventId: 'meeting-a-user-1',
        start: new Date('2026-06-09T10:00:00.000Z'),
        end: new Date('2026-06-09T11:00:00.000Z'),
      }),
      meetingRow({
        googleEventId: 'meeting-a-user-2',
        start: new Date('2026-06-09T10:00:00.000Z'),
        end: new Date('2026-06-09T11:00:00.000Z'),
      }),
      meetingRow({
        googleEventId: 'meeting-b-user-1',
        start: new Date('2026-06-09T15:00:00.000Z'),
        end: new Date('2026-06-09T16:00:00.000Z'),
      }),
      meetingRow({
        googleEventId: 'meeting-b-user-2',
        start: new Date('2026-06-09T15:00:00.000Z'),
        end: new Date('2026-06-09T16:00:00.000Z'),
      }),
    ];

    expect(sumMeetingHoursForEmployee(meetings, employee, weekStart, weekEnd)).toBe(2);
  });

  it('dedupes recurring copies when instance start differs by seconds', () => {
    const meetings = [
      ...Array.from({ length: 6 }, (_, i) =>
        meetingRow({
          googleRecurringEventId: 'series-standup',
          googleEventId: `copy-${i}`,
          start: new Date('2026-06-09T14:00:00.000Z'),
          end: new Date('2026-06-09T14:30:00.000Z'),
        })
      ),
      meetingRow({
        googleRecurringEventId: 'series-standup',
        googleEventId: 'copy-drift',
        start: new Date('2026-06-09T14:00:12.000Z'),
        end: new Date('2026-06-09T14:30:08.000Z'),
      }),
    ];

    expect(sumMeetingHoursForEmployee(meetings, employee, weekStart, weekEnd)).toBe(0.5);
  });
});

describe('meetingHoursInViewRange', () => {
  it('includes meetings on the viewed calendar day', () => {
    const viewDay = new Date(2026, 5, 9, 12, 0, 0);
    const viewStart = new Date(viewDay);
    viewStart.setHours(0, 0, 0, 0);
    const viewEnd = new Date(viewDay);
    viewEnd.setHours(23, 59, 59, 999);

    const meeting = meetingRow({
      start: new Date(2026, 5, 9, 14, 0, 0),
      end: new Date(2026, 5, 9, 15, 0, 0),
    });

    expect(meetingOverlapsViewRange(viewStart, viewEnd, meeting)).toBe(true);
    expect(meetingHoursInViewRange(meeting, viewStart, viewEnd)).toBe(1);
  });

  it('excludes meetings outside the viewed calendar day', () => {
    const viewDay = new Date(2026, 5, 9, 12, 0, 0);
    const viewStart = new Date(viewDay);
    viewStart.setHours(0, 0, 0, 0);
    const viewEnd = new Date(viewDay);
    viewEnd.setHours(23, 59, 59, 999);

    const meeting = meetingRow({
      start: new Date(2026, 5, 10, 14, 0, 0),
      end: new Date(2026, 5, 10, 15, 0, 0),
    });

    expect(meetingOverlapsViewRange(viewStart, viewEnd, meeting)).toBe(false);
    expect(meetingHoursInViewRange(meeting, viewStart, viewEnd)).toBe(0);
  });
});

describe('employeeAttendsMeeting', () => {
  it('matches attendee list and organizer userId', () => {
    const asAttendee = meetingRow({
      userId: new Types.ObjectId(),
      start: new Date('2026-06-09T14:00:00.000Z'),
      end: new Date('2026-06-09T15:00:00.000Z'),
    });
    const asOrganizer = meetingRow({
      userId: employeeUserId,
      attendeeEmployeeIds: [],
      start: new Date('2026-06-09T14:00:00.000Z'),
      end: new Date('2026-06-09T15:00:00.000Z'),
    });
    const unrelated = meetingRow({
      userId: new Types.ObjectId(),
      attendeeEmployeeIds: [new Types.ObjectId()],
      start: new Date('2026-06-09T14:00:00.000Z'),
      end: new Date('2026-06-09T15:00:00.000Z'),
    });

    expect(employeeAttendsMeeting(asAttendee, employee)).toBe(true);
    expect(employeeAttendsMeeting(asOrganizer, employee)).toBe(true);
    expect(employeeAttendsMeeting(unrelated, employee)).toBe(false);
  });

  it('dedupes only meetings the employee attends', () => {
    const sharedStart = new Date('2026-06-09T14:00:00.000Z');
    const sharedEnd = new Date('2026-06-09T16:30:00.000Z');
    const attended = Array.from({ length: 3 }, (_, i) =>
      meetingRow({
        googleEventId: `attended-${i}`,
        start: sharedStart,
        end: sharedEnd,
      })
    );
    const notAttended = meetingRow({
      userId: new Types.ObjectId(),
      attendeeEmployeeIds: [new Types.ObjectId()],
      googleEventId: 'other-meeting',
      start: new Date('2026-06-09T10:00:00.000Z'),
      end: new Date('2026-06-09T11:00:00.000Z'),
    });

    const deduped = dedupeMeetingsForEmployee([...attended, notAttended], employee);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].start).toEqual(sharedStart);
  });
});

import { describe, expect, it } from 'vitest';
import { assignHostRoundRobin, computeAvailableSlots } from './slotEngine';

const baseSettings = {
  durationMinutes: 30,
  minAdvanceHours: 1,
  maxAdvanceDays: 7,
  hosts: [
    {
      id: 'host-a',
      email: 'a@example.com',
      timezone: 'UTC',
      active: true,
      slots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00', enabled: true }],
      lastAssignedAt: null,
    },
    {
      id: 'host-b',
      email: 'b@example.com',
      timezone: 'UTC',
      active: true,
      slots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00', enabled: true }],
      lastAssignedAt: new Date('2020-01-01'),
    },
  ],
};

describe('computeAvailableSlots', () => {
  it('returns slots inside host windows', () => {
    const now = new Date('2026-06-08T00:00:00.000Z'); // Monday
    const slots = computeAvailableSlots(baseSettings, [], now);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.hostIds).toContain('host-a');
  });

  it('excludes booked slots', () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const slots = computeAvailableSlots(baseSettings, [], now);
    const first = slots[0];
    expect(first).toBeDefined();
    const booked = computeAvailableSlots(baseSettings, [
      {
        hostId: 'host-a',
        start: first!.start,
        end: first!.end,
        status: 'scheduled',
      },
    ], now);
    const stillHasSlot = booked.some((s) => s.start === first!.start);
    expect(stillHasSlot).toBe(true);
    expect(booked.find((s) => s.start === first!.start)?.hostIds).not.toContain('host-a');
  });
});

describe('assignHostRoundRobin', () => {
  it('picks host with oldest lastAssignedAt', () => {
    const host = assignHostRoundRobin(baseSettings.hosts, new Date());
    expect(host?.id).toBe('host-a');
  });
});

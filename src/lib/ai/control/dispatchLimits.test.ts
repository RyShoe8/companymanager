import { describe, expect, it } from 'vitest';
import { dispatchAllowed, dispatchUsageView } from './dispatchLimits';
import { defaultPlatformAiSettings, platformAiSettingsSchema } from '../settingsSchema';
import { planningRequest, buildPlanningInput } from '@nucleas/ai-core/planning';

describe('shared inference limits', () => {
  const limits = { dailyRequestLimit: 48, minimumIntervalSeconds: 300 };
  const now = new Date('2026-09-06T00:01:00Z');
  it('shows an empty snapshot without inventing a previous attempt', () => {
    expect(dispatchUsageView(null, limits, false, now)).toMatchObject({ attempts: 0, remaining: 48,
      lastAttemptAt: null, nextEligibleAt: now.toISOString(), processingEnabled: false });
  });
  it('reports a reduced ceiling without negative remaining usage', () => {
    expect(dispatchUsageView({ day: '2026-09-06', attempts: 50, lastStartedAt: now }, limits, true, now))
      .toMatchObject({ attempts: 50, remaining: 0, nextEligibleAt: '2026-09-07T00:00:00.000Z' });
  });
  it('keeps yesterday’s cooldown while reporting a fresh daily allowance', () => {
    expect(dispatchUsageView({ day: '2026-09-05', attempts: 48, lastStartedAt: new Date('2026-09-05T23:59:00Z') }, limits, true, now))
      .toMatchObject({ attempts: 0, remaining: 48, nextEligibleAt: '2026-09-06T00:04:00.000Z' });
  });
  it('preserves cooldown across UTC midnight', () => {
    expect(dispatchAllowed({ day: '2026-09-05', attempts: 48, lastStartedAt: new Date('2026-09-05T23:59:00Z') }, limits, now)).toBe(false);
  });
  it('resets daily eligibility without resetting spacing', () => {
    const usage = { day: '2026-09-05', attempts: 48, lastStartedAt: new Date('2026-09-05T23:56:00Z') };
    expect(dispatchAllowed(usage, limits, now)).toBe(true);
    expect(dispatchAllowed({ ...usage, day: '2026-09-06' }, limits, now)).toBe(false);
    expect(dispatchAllowed(null, limits, now)).toBe(true);
  });
  it('adds conservative defaults to stored legacy settings', () => {
    const legacy = { ...defaultPlatformAiSettings } as Record<string, unknown>;
    delete legacy.dailyRequestLimit; delete legacy.minimumIntervalSeconds; delete legacy.maxOutputTokens;
    expect(platformAiSettingsSchema.parse(legacy)).toMatchObject({ ...limits, maxOutputTokens: 3072 });
  });
  it.each([{ dailyRequestLimit: 0 }, { minimumIntervalSeconds: 0 }, { maxOutputTokens: 8193 }, { dailyRequestLimit: 1.5 }])('rejects invalid limits %j', value => {
    expect(platformAiSettingsSchema.safeParse({ ...defaultPlatformAiSettings, ...value }).success).toBe(false);
  });
  it('applies the output cap to the actual request and rejects out-of-range caps', () => {
    const input = buildPlanningInput({ title: 'Test', outcome: 'Test', constraints: '', acceptanceCriteria: ['Test'] });
    expect(planningRequest(input, 1024).maxOutputTokens).toBe(1024);
    expect(() => planningRequest(input, 4097)).toThrow();
  });
});

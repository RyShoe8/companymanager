import { describe, expect, it } from 'vitest';
import { aiBudgetSettingsSchema, defaultPlatformAiSettings, dollarsToMicros, microsToDollars, platformAiSettingsSchema } from './settingsSchema';

describe('AI settings input', () => {
  it('defaults to all-organization manual planning without authorizing inference spend', () => {
    expect(platformAiSettingsSchema.parse(defaultPlatformAiSettings)).toMatchObject({ planningEnabled: true, dispatchEnabled: false, reservationMicros: 0,
      codingModel: 'Qwen/Qwen2.5-Coder-14B-Instruct-AWQ', visualModel: 'Qwen/Qwen3-VL-8B-Thinking-FP8' });
  });
  it('adds routing defaults to legacy stored settings', () => {
    const { codingModel: _coding, visualModel: _visual, ...legacy } = defaultPlatformAiSettings;
    expect(platformAiSettingsSchema.parse(legacy)).toMatchObject({
      codingModel: 'Qwen/Qwen2.5-Coder-14B-Instruct-AWQ', visualModel: 'Qwen/Qwen3-VL-8B-Thinking-FP8',
    });
  });
  it.each(['http://llm.rogly.net/chat', 'https://user:secret@llm.rogly.net/chat', 'https://llm.rogly.net/chat?key=secret',
    'https://127.0.0.1/chat', 'https://[::1]/chat', 'https://host.local/chat', 'https://llm.rogly.net/chat#secret'])('rejects unsafe endpoint %s', endpoint => {
    expect(platformAiSettingsSchema.safeParse({ ...defaultPlatformAiSettings, endpoint }).success).toBe(false);
  });
  it('rejects secrets and unknown settings instead of persisting them', () => {
    expect(platformAiSettingsSchema.safeParse({ ...defaultPlatformAiSettings, bearerToken: 'secret' }).success).toBe(false);
    expect(aiBudgetSettingsSchema.safeParse({ limitMicros: 10, endpoint: 'https://evil.test' }).success).toBe(false);
  });
  it('requires positive admission budgets and consistent ceilings to dispatch', () => {
    expect(platformAiSettingsSchema.safeParse({ ...defaultPlatformAiSettings, dispatchEnabled: true }).success).toBe(false);
    expect(platformAiSettingsSchema.safeParse({ ...defaultPlatformAiSettings, projectLimitMicros: 1 }).success).toBe(false);
  });
  it.each([0, 1, 10, 999999, 1000000, 10000000, Number.MAX_SAFE_INTEGER])('round-trips exact microdollars %s', amount => {
    expect(dollarsToMicros(microsToDollars(amount))).toBe(amount);
  });
  it.each(['-1', '1e3', 'Infinity', '1.0000001', '9007199255', '', '1,000'])('rejects invalid dollar input %s', amount => {
    expect(() => dollarsToMicros(amount)).toThrow();
  });
});

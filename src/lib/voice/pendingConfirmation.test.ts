import { describe, expect, it, vi } from 'vitest';
import { consumePendingConfirmation } from './pendingConfirmation';

describe('consumePendingConfirmation', () => {
  it('returns the exact action once and clears the slot synchronously', () => {
    const action = { name: 'Create task' };
    const slot = { current: action as typeof action | null };
    expect(consumePendingConfirmation(slot)).toBe(action);
    expect(slot.current).toBeNull();
    expect(consumePendingConfirmation(slot)).toBeNull();
  });

  it('does not execute twice while the first confirmation is awaiting completion', async () => {
    const slot: { current: string | null } = { current: 'first' };
    let finish!: () => void;
    const execute = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const confirm = async () => {
      const action = consumePendingConfirmation(slot);
      if (action !== null) await execute();
    };
    const first = confirm();
    await confirm();
    expect(execute).toHaveBeenCalledTimes(1);
    slot.current = 'next';
    finish();
    await first;
    expect(consumePendingConfirmation(slot)).toBe('next');
  });

  it('does not resurrect an action when execution fails', async () => {
    const slot: { current: string | null } = { current: 'first' };
    const confirm = async () => {
      if (consumePendingConfirmation(slot)) throw new Error('Failed');
    };
    await expect(confirm()).rejects.toThrow('Failed');
    await expect(confirm()).resolves.toBeUndefined();
  });
});

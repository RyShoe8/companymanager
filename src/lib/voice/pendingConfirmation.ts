/** Consume before awaiting execution so repeated confirmation cannot reuse the same action. */
export function consumePendingConfirmation<T>(slot: { current: T | null }): T | null {
  const pending = slot.current;
  slot.current = null;
  return pending;
}

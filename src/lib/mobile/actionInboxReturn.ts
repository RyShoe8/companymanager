export const RETURN_TO_ACTION_KEY = 'nucleas:return-to-action';

export function markOpenedFromActionInbox(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RETURN_TO_ACTION_KEY, '1');
}

export function shouldReturnToActionInbox(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(RETURN_TO_ACTION_KEY) === '1';
}

export function clearReturnToActionInbox(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RETURN_TO_ACTION_KEY);
}

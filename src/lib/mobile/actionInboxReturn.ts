const RETURN_TO_ACTION_KEY = 'nucleas:return-to-action';
const ACTION_INBOX_ITEM_KEY = 'nucleas:action-inbox-item-key';

export function markOpenedFromActionInbox(itemKey: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RETURN_TO_ACTION_KEY, '1');
  sessionStorage.setItem(ACTION_INBOX_ITEM_KEY, itemKey);
}

export function shouldReturnToActionInbox(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(RETURN_TO_ACTION_KEY) === '1';
}

export function getPendingActionInboxItemKey(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACTION_INBOX_ITEM_KEY);
}

export function clearReturnToActionInbox(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RETURN_TO_ACTION_KEY);
  sessionStorage.removeItem(ACTION_INBOX_ITEM_KEY);
}

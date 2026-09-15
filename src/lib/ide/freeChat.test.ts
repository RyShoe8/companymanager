import { describe, expect, it } from 'vitest';
import {
  freeChatLedgerProjectId,
  IDE_FREE_CHAT_SCOPE,
  isIdeFreeChatScope,
} from '@/lib/ide/freeChat';

describe('freeChat scope', () => {
  it('recognizes the Free Chat sentinel', () => {
    expect(isIdeFreeChatScope(IDE_FREE_CHAT_SCOPE)).toBe(true);
    expect(isIdeFreeChatScope('a'.repeat(24))).toBe(false);
  });

  it('derives a stable ObjectId per organization', () => {
    const a = freeChatLedgerProjectId('org-a');
    const b = freeChatLedgerProjectId('org-a');
    const c = freeChatLedgerProjectId('org-b');
    expect(String(a)).toBe(String(b));
    expect(String(a)).not.toBe(String(c));
  });
});

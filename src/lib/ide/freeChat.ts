import { createHash } from 'crypto';
import { Types } from 'mongoose';

/** UI / localStorage sentinel for IDE open chat without a project. */
export const IDE_FREE_CHAT_SCOPE = '__free_chat__';

export function isIdeFreeChatScope(projectId: string | null | undefined): boolean {
  return projectId === IDE_FREE_CHAT_SCOPE;
}

/**
 * Deterministic ledger / history project id for org Free Chat.
 * Not a real Project document — always pair with organizationId filters.
 */
export function freeChatLedgerProjectId(organizationId: string): Types.ObjectId {
  const hex = createHash('sha256')
    .update(`nucleas-ide-free-chat:v1:${organizationId}`)
    .digest('hex')
    .slice(0, 24);
  return new Types.ObjectId(hex);
}

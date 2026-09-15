import 'server-only';
import { Types } from 'mongoose';
import type { IdeChatMode } from '@/lib/ide/modes';
import { isIdeDirectMode } from '@/lib/ide/modes';
import { AiIdeChatTurn } from '@/lib/models/AiIdeChatTurn';

const HISTORY_LIMIT = 50;

export type IdePersistedTurn = {
  requestId: string;
  role: 'user' | 'assistant' | 'status';
  text: string;
  failureCategory?: string | null;
  runId?: string | null;
  costMicros?: number | null;
  reservedMicros?: number | null;
  noProviderFee?: boolean;
  toolsUsed?: string[];
  artifacts?: { kind: 'image'; assetId: string; name: string; url: string }[];
  createdAt?: string | null;
};

export function ideThreadKeys(input: {
  mode: IdeChatMode;
  modelProfileId?: string;
  model?: string;
}): { mode: IdeChatMode; directProfileId: string; directModel: string } {
  if (!isIdeDirectMode(input.mode)) {
    return { mode: input.mode, directProfileId: '', directModel: '' };
  }
  return {
    mode: 'direct',
    directProfileId: input.modelProfileId?.trim() ?? '',
    directModel: input.model?.trim() ?? '',
  };
}

export async function loadIdeChatHistory(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  mode: IdeChatMode;
  modelProfileId?: string;
  model?: string;
  limit?: number;
}): Promise<IdePersistedTurn[]> {
  const keys = ideThreadKeys(input);
  if (isIdeDirectMode(keys.mode) && (!keys.directProfileId || !keys.directModel)) {
    return [];
  }
  const limit = Math.min(Math.max(input.limit ?? HISTORY_LIMIT, 1), 100);
  const rows = await AiIdeChatTurn.find({
    organizationId: input.organizationId,
    projectId: input.projectId,
    createdByUserId: new Types.ObjectId(input.userId),
    mode: keys.mode,
    directProfileId: keys.directProfileId,
    directModel: keys.directModel,
  })
    .sort({ _id: -1 })
    .limit(limit)
    .maxTimeMS(3000)
    .lean();

  return rows
    .reverse()
    .map((row) => ({
      requestId: row.requestId,
      role: row.role as IdePersistedTurn['role'],
      text: row.text,
      failureCategory: row.failureCategory ?? null,
      runId: row.runId ?? null,
      costMicros: row.costMicros ?? null,
      reservedMicros: row.reservedMicros ?? null,
      noProviderFee: row.noProviderFee ?? false,
      toolsUsed: row.toolsUsed ?? [],
      artifacts: (row.artifacts ?? []).map((item) => ({
        kind: 'image' as const,
        assetId: item.assetId,
        name: item.name,
        url: item.url,
      })),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    }));
}

export async function appendIdeChatTurns(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  mode: IdeChatMode;
  modelProfileId?: string;
  model?: string;
  turns: IdePersistedTurn[];
}): Promise<void> {
  const keys = ideThreadKeys(input);
  if (!input.turns.length) return;
  if (isIdeDirectMode(keys.mode) && (!keys.directProfileId || !keys.directModel)) return;

  const docs = input.turns.map((turn) => ({
    organizationId: input.organizationId,
    projectId: input.projectId,
    createdByUserId: new Types.ObjectId(input.userId),
    mode: keys.mode,
    directProfileId: keys.directProfileId,
    directModel: keys.directModel,
    requestId: turn.requestId,
    role: turn.role,
    text: turn.text.slice(0, 8000),
    ...(turn.failureCategory ? { failureCategory: turn.failureCategory } : {}),
    ...(turn.runId ? { runId: turn.runId } : {}),
    ...(turn.costMicros != null ? { costMicros: turn.costMicros } : {}),
    ...(turn.reservedMicros != null ? { reservedMicros: turn.reservedMicros } : {}),
    ...(turn.noProviderFee != null ? { noProviderFee: turn.noProviderFee } : {}),
    ...(turn.toolsUsed?.length ? { toolsUsed: turn.toolsUsed.slice(0, 20) } : {}),
    ...(turn.artifacts?.length
      ? {
          artifacts: turn.artifacts.slice(0, 8).map((item) => ({
            kind: 'image' as const,
            assetId: item.assetId.slice(0, 64),
            name: item.name.slice(0, 200),
            url: item.url.slice(0, 4000),
          })),
        }
      : {}),
  }));

  await AiIdeChatTurn.insertMany(docs, { ordered: false }).catch((error: { code?: number }) => {
    // Ignore duplicate requestId races; other errors rethrow.
    if (error?.code !== 11000) throw error;
  });
}

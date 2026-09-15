import 'server-only';
import { Types } from 'mongoose';
import type { IdeChatMode } from '@/lib/ide/modes';
import { isIdeDirectMode } from '@/lib/ide/modes';
import type { IdePlanDocument } from '@/lib/ide/idePlan';
import { AiIdeChatTurn } from '@/lib/models/AiIdeChatTurn';

const HISTORY_LIMIT = 50;

let indexesReady: Promise<void> | undefined;

/** Best-effort; never throw to callers. */
function ensureIdeChatIndexes(): Promise<void> {
  indexesReady ??= AiIdeChatTurn.createIndexes()
    .then(() => undefined)
    .catch(() => {
      indexesReady = undefined;
    });
  return indexesReady;
}

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
  plan?: IdePlanDocument | null;
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

function mapPlan(plan: unknown): IdePlanDocument | null {
  if (!plan || typeof plan !== 'object') return null;
  const row = plan as Record<string, unknown>;
  const title = typeof row.title === 'string' ? row.title : '';
  const summary = typeof row.summary === 'string' ? row.summary : '';
  const markdown = typeof row.markdown === 'string' ? row.markdown : '';
  const status = row.status;
  if (!title || !markdown) return null;
  if (status !== 'ready_for_review' && status !== 'approved' && status !== 'building') return null;
  const steps = Array.isArray(row.steps)
    ? row.steps.filter((item): item is string => typeof item === 'string')
    : [];
  return { title, summary, steps, markdown, status };
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
  try {
    await ensureIdeChatIndexes();
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
        plan: mapPlan(row.plan),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      }));
  } catch {
    return [];
  }
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
    ...(turn.plan
      ? {
          plan: {
            title: turn.plan.title.slice(0, 200),
            summary: turn.plan.summary.slice(0, 2000),
            steps: turn.plan.steps.slice(0, 40).map((step) => step.slice(0, 500)),
            markdown: turn.plan.markdown.slice(0, 8000),
            status: turn.plan.status,
          },
        }
      : {}),
  }));

  try {
    await ensureIdeChatIndexes();
    await AiIdeChatTurn.insertMany(docs, { ordered: false });
  } catch {
    // Soft-fail: chat reply must still return even if history cannot persist.
  }
}

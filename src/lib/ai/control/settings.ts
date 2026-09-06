import 'server-only';
import type { ClientSession } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import { AiSettings, AiSettingsAudit } from '@/lib/models/AiSettings';
import { aiBudgetSettingsSchema, defaultPlatformAiSettings, platformAiSettingsSchema } from '@/lib/ai/settingsSchema';
import { digestValue } from '@nucleas/ai-core/planning';
import { aiTransaction } from './transaction';

export const platformSettingsId = 'platform-v1';
export function budgetSettingsId(organizationId: string, projectId?: string) {
  return `budget-v1:${digestValue([organizationId, projectId ?? null])}`;
}
export async function readSettings(id: string, session?: ClientSession) {
  await connectDB();
  const existing = await AiSettings.findById(id).session(session ?? null).lean();
  if (existing) return { revision: existing.revision, value: existing.value as unknown };
  const initial = id === platformSettingsId ? defaultPlatformAiSettings : { limitMicros: null };
  const doc = await AiSettings.findOneAndUpdate({ _id: id }, { $setOnInsert: { value: initial, revision: 0, usageFence: 0 } },
    { upsert: true, new: true, session });
  return { revision: doc.revision, value: doc.value as unknown };
}
export async function readPlatformSettings(session?: ClientSession) {
  const doc = await readSettings(platformSettingsId, session);
  return { revision: doc.revision, value: platformAiSettingsSchema.parse(doc.value) };
}
export async function readBudgetSettings(organizationId: string, projectId?: string, session?: ClientSession) {
  const doc = await readSettings(budgetSettingsId(organizationId, projectId), session);
  return { revision: doc.revision, value: aiBudgetSettingsSchema.parse(doc.value) };
}
/** Contends with policy edits so an admission transaction cannot restore a stale budget ceiling. */
export async function fenceSettings(id: string, revision: number, session: ClientSession) {
  const result = await AiSettings.updateOne({ _id: id, revision }, { $inc: { usageFence: 1 } }, { session });
  if (result.matchedCount !== 1) throw new Error('Settings changed during admission.');
}
export async function saveSettings(id: string, revision: number, value: unknown, userId: string, session?: ClientSession) {
  const parsed = id === platformSettingsId ? platformAiSettingsSchema.parse(value) : aiBudgetSettingsSchema.parse(value);
  return aiTransaction(async tx => {
    const prior = await readSettings(id, tx);
    const updated = await AiSettings.findOneAndUpdate({ _id: id, revision },
      { $set: { value: parsed, updatedByUserId: userId }, $inc: { revision: 1 } }, { new: true, session: tx });
    if (!updated) return null;
    await AiSettingsAudit.create([{ settingsId: id, revision: updated.revision, userId, before: prior.value, after: parsed }], { session: tx });
    return { revision: updated.revision, value: parsed };
  }, session);
}

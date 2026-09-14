import 'server-only';
import type { ClientSession } from 'mongoose';
import { AiSettings } from '@/lib/models/AiSettings';
import { platformAiSettingsSchema } from '@/lib/ai/settingsSchema';
import { platformSettingsId, readPlatformSettings } from '@/lib/ai/control/settings';
import { aiTransaction } from '@/lib/ai/control/transaction';

/**
 * When noProviderFee settles, org ledgers record $0 but complimentary usage
 * should reduce the Nucleas free pool by the admission reservation amount.
 */
export async function decrementFreePoolRemaining(
  amountMicros: number,
  existingSession?: ClientSession
): Promise<void> {
  const amount = Math.floor(amountMicros);
  if (!Number.isFinite(amount) || amount <= 0) return;

  await aiTransaction(async (session) => {
    const current = await readPlatformSettings(session);
    const remaining = Math.max(0, current.value.freePoolRemainingMicros - amount);
    const next = platformAiSettingsSchema.parse({
      ...current.value,
      freePoolRemainingMicros: remaining,
    });
    const updated = await AiSettings.findOneAndUpdate(
      { _id: platformSettingsId, revision: current.revision },
      { $set: { value: next }, $inc: { revision: 1 } },
      { new: true, session }
    );
    if (!updated) {
      // Soft-fail: balance display may be slightly stale; never block inference settle.
      return;
    }
  }, existingSession);
}

export async function readFreePoolSnapshot(): Promise<{
  freePoolLimitMicros: number;
  freePoolRemainingMicros: number;
}> {
  const { value } = await readPlatformSettings();
  return {
    freePoolLimitMicros: value.freePoolLimitMicros,
    freePoolRemainingMicros: value.freePoolRemainingMicros,
  };
}

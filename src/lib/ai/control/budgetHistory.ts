import 'server-only';
import { AiBudget } from '@/lib/models/AiControl';
import { AiHttpError } from './access';

export async function budgetHistory(organizationId: string, projectId: string | undefined, before: string | null) {
  if (before !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(before)) throw new AiHttpError(400, 'Invalid budget history cursor.');
  const rows = await AiBudget.find({ organizationId, scopeKey: projectId ? `project:${projectId}` : 'organization',
    ...(before ? { period: { $lt: before } } : {}) })
    .select('period limitMicros spentMicros reservedMicros -_id').sort({ period: -1 }).limit(13).maxTimeMS(3000).lean();
  const items = rows.slice(0, 12).map(row => ({ period: row.period, limitMicros: row.limitMicros,
    spentMicros: row.spentMicros, reservedMicros: row.reservedMicros }));
  return { items, nextCursor: rows.length > 12 ? items[items.length - 1].period : null };
}

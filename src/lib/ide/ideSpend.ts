import 'server-only';
import { Types } from 'mongoose';
import { AiBudget, AiRun } from '@/lib/models/AiControl';

export type IdeProjectSpendSnapshot = {
  dailyEstimatedMicros: number;
  monthlyEstimatedMicros: number;
  periodMonth: string;
  asOf: string;
};

/** Project estimated spend: UTC-day run costs + current-month spent+reserved ledger. */
export async function loadIdeProjectSpend(
  organizationId: string,
  projectId: string
): Promise<IdeProjectSpendSnapshot> {
  const asOf = new Date();
  const periodMonth = asOf.toISOString().slice(0, 7);
  const dayStart = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const projectObjectId = new Types.ObjectId(projectId);

  const [dayAgg, ledger] = await Promise.all([
    AiRun.aggregate<{ total: number }>([
      {
        $match: {
          organizationId,
          projectId: projectObjectId,
          createdAt: { $gte: dayStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$costMicros', 0] } },
        },
      },
    ]).option({ maxTimeMS: 3000 }),
    AiBudget.findOne({
      organizationId,
      scopeKey: `project:${projectId}`,
      period: periodMonth,
    })
      .select('spentMicros reservedMicros -_id')
      .maxTimeMS(3000)
      .lean(),
  ]);

  const dailyEstimatedMicros = Math.max(0, Math.floor(dayAgg[0]?.total ?? 0));
  const monthlyEstimatedMicros = Math.max(
    0,
    Math.floor((ledger?.spentMicros ?? 0) + (ledger?.reservedMicros ?? 0))
  );

  return {
    dailyEstimatedMicros,
    monthlyEstimatedMicros,
    periodMonth,
    asOf: asOf.toISOString(),
  };
}

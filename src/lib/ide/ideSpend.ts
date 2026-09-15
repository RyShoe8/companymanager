import 'server-only';
import { Types } from 'mongoose';
import { AiBudget, AiRun } from '@/lib/models/AiControl';
import { loadSearchApiSpend, type SearchApiSpendSnapshot } from '@/lib/ai/tools/searchApiMeter';

export type IdeProjectSpendSnapshot = {
  dailyEstimatedMicros: number;
  monthlyEstimatedMicros: number;
  periodMonth: string;
  asOf: string;
};

export type IdeOrgSpendSnapshot = {
  dailyEstimatedMicros: number;
  monthlyEstimatedMicros: number;
  periodMonth: string;
  asOf: string;
};

export type IdeSpendBundle = {
  project: IdeProjectSpendSnapshot | null;
  organization: IdeOrgSpendSnapshot;
  searchApi: SearchApiSpendSnapshot;
  asOf: string;
  periodMonth: string;
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

/** Org estimated spend from the organization ledger (not a sum of project ledgers). */
export async function loadIdeOrgSpend(organizationId: string): Promise<IdeOrgSpendSnapshot> {
  const asOf = new Date();
  const periodMonth = asOf.toISOString().slice(0, 7);
  const dayStart = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00.000Z`);

  const [dayAgg, ledger] = await Promise.all([
    AiRun.aggregate<{ total: number }>([
      {
        $match: {
          organizationId,
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
      scopeKey: 'organization',
      period: periodMonth,
    })
      .select('spentMicros reservedMicros -_id')
      .maxTimeMS(3000)
      .lean(),
  ]);

  return {
    dailyEstimatedMicros: Math.max(0, Math.floor(dayAgg[0]?.total ?? 0)),
    monthlyEstimatedMicros: Math.max(
      0,
      Math.floor((ledger?.spentMicros ?? 0) + (ledger?.reservedMicros ?? 0))
    ),
    periodMonth,
    asOf: asOf.toISOString(),
  };
}

export async function loadIdeSpendBundle(input: {
  organizationId: string;
  projectId?: string | null;
}): Promise<IdeSpendBundle> {
  const [organization, searchApi, project] = await Promise.all([
    loadIdeOrgSpend(input.organizationId),
    loadSearchApiSpend(input.organizationId),
    input.projectId
      ? loadIdeProjectSpend(input.organizationId, input.projectId)
      : Promise.resolve(null),
  ]);
  return {
    project,
    organization,
    searchApi,
    asOf: organization.asOf,
    periodMonth: organization.periodMonth,
  };
}

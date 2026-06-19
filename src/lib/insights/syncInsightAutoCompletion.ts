import { Types } from 'mongoose';
import InsightItem from '@/lib/models/InsightItem';
import ProjectInsightState from '@/lib/models/ProjectInsightState';
import ClientInsightState from '@/lib/models/ClientInsightState';

export type InsightOwnerType = 'project' | 'client';

/** Upsert completed states for insight items matching newly linked platform category slugs. */
export async function syncInsightAutoCompletion(
  ownerType: InsightOwnerType,
  ownerId: string,
  categorySlugs: string[]
): Promise<void> {
  if (!categorySlugs.length) return;

  const uniqueSlugs = [...new Set(categorySlugs.map((s) => s.toLowerCase()))];
  const items = await InsightItem.find({
    isActive: true,
    detectsFromCategorySlug: { $in: uniqueSlugs },
  })
    .select('_id')
    .lean();

  if (!items.length) return;

  const ownerObjectId = new Types.ObjectId(ownerId);
  const ops = items.map((item) => ({
    updateOne: {
      filter:
        ownerType === 'project'
          ? { projectId: ownerObjectId, itemId: item._id }
          : { clientId: ownerObjectId, itemId: item._id },
      update: {
        $setOnInsert: {
          ...(ownerType === 'project' ? { projectId: ownerObjectId } : { clientId: ownerObjectId }),
          itemId: item._id,
          status: 'completed' as const,
        },
      },
      upsert: true,
    },
  }));

  if (ownerType === 'project') {
    await ProjectInsightState.bulkWrite(ops, { ordered: false });
  } else {
    await ClientInsightState.bulkWrite(ops, { ordered: false });
  }
}

/** Sync all linked platform slugs on a project or client (e.g. after load or bulk update). */
export async function syncAllLinkedPlatformInsights(
  ownerType: InsightOwnerType,
  ownerId: string,
  linkedSlugs: Iterable<string>
): Promise<void> {
  await syncInsightAutoCompletion(ownerType, ownerId, [...linkedSlugs]);
}

/** @deprecated Use syncAllLinkedPlatformInsights('project', projectId, linkedSlugs) */
export async function syncAllLinkedPlatformInsightsForProject(
  projectId: string,
  linkedSlugs: Iterable<string>
): Promise<void> {
  await syncAllLinkedPlatformInsights('project', projectId, linkedSlugs);
}

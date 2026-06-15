import { Types } from 'mongoose';
import InsightItem from '@/lib/models/InsightItem';
import ProjectInsightState from '@/lib/models/ProjectInsightState';

/** Upsert completed states for insight items matching newly linked platform category slugs. */
export async function syncInsightAutoCompletion(
  projectId: string,
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

  const projectObjectId = new Types.ObjectId(projectId);
  const ops = items.map((item) => ({
    updateOne: {
      filter: { projectId: projectObjectId, itemId: item._id },
      update: {
        $setOnInsert: {
          projectId: projectObjectId,
          itemId: item._id,
          status: 'completed' as const,
        },
      },
      upsert: true,
    },
  }));

  await ProjectInsightState.bulkWrite(ops, { ordered: false });
}

/** Sync all linked platform slugs on a project (e.g. after load or bulk update). */
export async function syncAllLinkedPlatformInsights(
  projectId: string,
  linkedSlugs: Iterable<string>
): Promise<void> {
  await syncInsightAutoCompletion(projectId, [...linkedSlugs]);
}

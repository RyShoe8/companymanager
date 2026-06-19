import { Types } from 'mongoose';
import InsightCategory from '@/lib/models/InsightCategory';
import InsightItem from '@/lib/models/InsightItem';
import InsightVendor from '@/lib/models/InsightVendor';
import ProjectInsightState from '@/lib/models/ProjectInsightState';
import ClientInsightState from '@/lib/models/ClientInsightState';
import Project from '@/lib/models/Project';
import Client from '@/lib/models/Client';
import { getProjectLinkedCategorySlugs } from '@/lib/insights/getProjectLinkedCategorySlugs';
import { syncAllLinkedPlatformInsights, type InsightOwnerType } from '@/lib/insights/syncInsightAutoCompletion';
import type {
  CategoryWithStatus,
  InsightItemDto,
  InsightProgress,
} from '@/lib/insights/insightDto';

export type { InsightItemDto, InsightProgress, CategoryWithStatus };

type LeanCategory = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  stageOrder: number;
  icon: string;
};

type LeanItem = {
  _id: Types.ObjectId;
  categoryId: LeanCategory | Types.ObjectId;
  title: string;
  description: string;
  itemOrder: number;
  detectsFromCategorySlug?: string;
};

type LeanVendor = {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;
  name: string;
  description: string;
  pricing: string;
  url: string;
  vendorSlug: string;
  isAffiliate: boolean;
  displayOrder: number;
};

function toCategoryDto(cat: LeanCategory) {
  return {
    id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug,
    stageOrder: cat.stageOrder,
    icon: cat.icon,
  };
}

function toVendorDto(v: LeanVendor) {
  return {
    id: v._id.toString(),
    name: v.name,
    description: v.description,
    pricing: v.pricing,
    url: v.url,
    vendorSlug: v.vendorSlug,
    isAffiliate: v.isAffiliate,
    displayOrder: v.displayOrder,
  };
}

function isItemExcluded(
  item: LeanItem,
  stateByItemId: Map<string, 'completed' | 'dismissed'>,
  linkedSlugs: Set<string>
): boolean {
  const itemId = item._id.toString();
  const state = stateByItemId.get(itemId);
  if (state === 'completed' || state === 'dismissed') return true;
  if (item.detectsFromCategorySlug && linkedSlugs.has(item.detectsFromCategorySlug)) return true;
  return false;
}

async function loadInsightContext(ownerType: InsightOwnerType, ownerId: string) {
  let linkedSlugs: Set<string>;

  if (ownerType === 'project') {
    const project = await Project.findById(ownerId).select('techStack marketingStack').lean();
    if (!project) return null;
    linkedSlugs = getProjectLinkedCategorySlugs(project);
  } else {
    const client = await Client.findById(ownerId).select('techStack marketingStack').lean();
    if (!client) return null;
    linkedSlugs = getProjectLinkedCategorySlugs(client);
  }

  await syncAllLinkedPlatformInsights(ownerType, ownerId, linkedSlugs);

  const [categories, rawItems, totalActive] = await Promise.all([
    InsightCategory.find().sort({ stageOrder: 1 }).lean(),
    InsightItem.find({ isActive: true }).sort({ itemOrder: 1 }).lean(),
    InsightItem.countDocuments({ isActive: true }),
  ]);

  const categoryById = new Map(categories.map((c) => [c._id.toString(), c]));
  const items: LeanItem[] = rawItems
    .map((item) => {
      const cat = categoryById.get(item.categoryId.toString());
      if (!cat) return null;
      return { ...item, categoryId: cat } as LeanItem;
    })
    .filter((item): item is LeanItem => item !== null)
    .sort((a, b) => {
      const catA = a.categoryId as LeanCategory;
      const catB = b.categoryId as LeanCategory;
      if (catA.stageOrder !== catB.stageOrder) return catA.stageOrder - catB.stageOrder;
      return a.itemOrder - b.itemOrder;
    });

  const stateByItemId = new Map<string, 'completed' | 'dismissed'>();
  const statesAfterSync =
    ownerType === 'project'
      ? await ProjectInsightState.find({ projectId: new Types.ObjectId(ownerId) }).lean()
      : await ClientInsightState.find({ clientId: new Types.ObjectId(ownerId) }).lean();

  for (const s of statesAfterSync) {
    stateByItemId.set(s.itemId.toString(), s.status);
  }

  const itemIds = items.map((i) => i._id);
  const vendors = await InsightVendor.find({ itemId: { $in: itemIds }, isActive: true })
    .sort({ displayOrder: 1 })
    .lean();

  const vendorsByItem = new Map<string, LeanVendor[]>();
  for (const v of vendors) {
    const key = v.itemId.toString();
    const list = vendorsByItem.get(key) ?? [];
    list.push(v);
    vendorsByItem.set(key, list);
  }

  return { items: items as LeanItem[], stateByItemId, linkedSlugs, totalActive, vendorsByItem };
}

export async function getInsightProgressForOwner(
  ownerType: InsightOwnerType,
  ownerId: string
): Promise<InsightProgress | null> {
  const ctx = await loadInsightContext(ownerType, ownerId);
  if (!ctx) return null;

  let completed = 0;
  for (const item of ctx.items) {
    if (isItemExcluded(item, ctx.stateByItemId, ctx.linkedSlugs)) {
      completed += 1;
    }
  }

  return { completed, total: ctx.totalActive };
}

export async function getInsightsForOwner(
  ownerType: InsightOwnerType,
  ownerId: string,
  limit = 3
): Promise<InsightItemDto[]> {
  const ctx = await loadInsightContext(ownerType, ownerId);
  if (!ctx) return [];

  const remaining: InsightItemDto[] = [];

  for (const item of ctx.items) {
    if (isItemExcluded(item, ctx.stateByItemId, ctx.linkedSlugs)) continue;

    const cat = item.categoryId;
    if (!cat || typeof cat === 'string' || cat instanceof Types.ObjectId) continue;

    remaining.push({
      id: item._id.toString(),
      title: item.title,
      description: item.description,
      itemOrder: item.itemOrder,
      detectsFromCategorySlug: item.detectsFromCategorySlug,
      category: toCategoryDto(cat),
      vendors: (ctx.vendorsByItem.get(item._id.toString()) ?? []).map(toVendorDto),
    });

    if (remaining.length >= limit) break;
  }

  return remaining;
}

export async function getInsightCategoriesWithStatusForOwner(
  ownerType: InsightOwnerType,
  ownerId: string
): Promise<CategoryWithStatus[]> {
  const ctx = await loadInsightContext(ownerType, ownerId);
  if (!ctx) return [];

  const categories = await InsightCategory.find().sort({ stageOrder: 1 }).lean();
  const itemsByCategory = new Map<string, LeanItem[]>();

  for (const item of ctx.items) {
    const cat = item.categoryId;
    if (!cat || typeof cat === 'string' || cat instanceof Types.ObjectId) continue;
    const catId = cat._id.toString();
    const list = itemsByCategory.get(catId) ?? [];
    list.push(item);
    itemsByCategory.set(catId, list);
  }

  return categories.map((cat) => {
    const catItems = itemsByCategory.get(cat._id.toString()) ?? [];
    const completedCount = catItems.filter((item) =>
      isItemExcluded(item, ctx.stateByItemId, ctx.linkedSlugs)
    ).length;
    return {
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
      stageOrder: cat.stageOrder,
      icon: cat.icon,
      itemCount: catItems.length,
      completedCount,
    };
  });
}

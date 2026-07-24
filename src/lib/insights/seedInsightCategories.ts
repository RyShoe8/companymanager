import InsightCategory from '@/lib/models/InsightCategory';

const SEED_CATEGORIES = [
  { name: 'Legal', slug: 'legal', stageOrder: 1, icon: 'scale', mapsToPlatformCategory: undefined },
  { name: 'Branding', slug: 'branding', stageOrder: 2, icon: 'palette', mapsToPlatformCategory: undefined },
  { name: 'Design', slug: 'design', stageOrder: 3, icon: 'pen-tool', mapsToPlatformCategory: undefined },
  { name: 'Hosting', slug: 'hosting', stageOrder: 4, icon: 'server', mapsToPlatformCategory: 'hosting' },
  { name: 'Coding', slug: 'coding', stageOrder: 5, icon: 'code', mapsToPlatformCategory: 'framework' },
  { name: 'Payments', slug: 'payments', stageOrder: 6, icon: 'credit-card', mapsToPlatformCategory: 'payments' },
  { name: 'Analytics', slug: 'analytics', stageOrder: 7, icon: 'chart', mapsToPlatformCategory: 'analytics' },
  { name: 'SEO', slug: 'seo', stageOrder: 8, icon: 'search', mapsToPlatformCategory: undefined },
  { name: 'Content', slug: 'content', stageOrder: 9, icon: 'file-text', mapsToPlatformCategory: undefined },
  { name: 'Email', slug: 'email', stageOrder: 10, icon: 'mail', mapsToPlatformCategory: 'email' },
  { name: 'Security', slug: 'security', stageOrder: 11, icon: 'shield', mapsToPlatformCategory: undefined },
  { name: 'Monitoring', slug: 'monitoring', stageOrder: 12, icon: 'activity', mapsToPlatformCategory: undefined },
  { name: 'Support', slug: 'support', stageOrder: 13, icon: 'headphones', mapsToPlatformCategory: 'crm' },
  { name: 'Automation', slug: 'automation', stageOrder: 14, icon: 'zap', mapsToPlatformCategory: undefined },
  { name: 'Data', slug: 'data', stageOrder: 15, icon: 'database', mapsToPlatformCategory: 'database' },
  { name: 'Testing', slug: 'testing', stageOrder: 16, icon: 'check-circle', mapsToPlatformCategory: undefined },
  { name: 'AI', slug: 'ai', stageOrder: 17, icon: 'sparkles', mapsToPlatformCategory: undefined },
] as const;

export async function seedInsightCategoriesIfEmpty(): Promise<void> {
  const count = await InsightCategory.countDocuments();
  if (count > 0) return;

  await InsightCategory.insertMany(
    SEED_CATEGORIES.map((c) => ({
      name: c.name,
      slug: c.slug,
      stageOrder: c.stageOrder,
      icon: c.icon,
      mapsToPlatformCategory: c.mapsToPlatformCategory,
    }))
  );
}
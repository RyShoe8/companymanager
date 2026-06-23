import PlatformStack from '@/lib/models/PlatformStack';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { SOCIAL_NETWORK_LABELS } from '@/lib/utils/socialUrls';
import type { SocialNetwork } from '@/lib/models/platformFields';

const BUILTIN_STACKS = [
  {
    slug: 'tech',
    label: 'Tech stack',
    displayOrder: 0,
    iconFolder: 'tech-stack',
    linkingMode: 'catalog' as const,
  },
  {
    slug: 'marketing',
    label: 'Marketing & Analytics',
    displayOrder: 1,
    iconFolder: 'marketing-stack',
    linkingMode: 'catalog' as const,
  },
  {
    slug: 'socials',
    label: 'Socials',
    displayOrder: 2,
    linkingMode: 'url' as const,
  },
];

export async function seedPlatformStacksIfEmpty(): Promise<void> {
  const count = await PlatformStack.countDocuments();
  if (count > 0) return;
  await PlatformStack.insertMany(BUILTIN_STACKS);
}

export async function ensureBuiltinPlatformStacks(): Promise<void> {
  for (const stack of BUILTIN_STACKS) {
    await PlatformStack.updateOne(
      { slug: stack.slug },
      { $setOnInsert: stack },
      { upsert: true }
    );
  }
}

export async function seedSocialsCatalogIfMissing(): Promise<void> {
  const socialsCategory = await PlatformCategory.findOne({ stackType: 'socials', slug: 'networks' });
  if (socialsCategory) return;

  await PlatformCategory.create({
    stackType: 'socials',
    slug: 'networks',
    label: 'Networks',
    displayOrder: 0,
    isActive: true,
  });

  const networks = Object.keys(SOCIAL_NETWORK_LABELS) as SocialNetwork[];
  const options = networks.map((network, index) => ({
    stackType: 'socials',
    optionId: network,
    categorySlug: 'networks',
    name: SOCIAL_NETWORK_LABELS[network],
    homepageUrl: `https://${network === 'x' ? 'x.com' : network === 'other' ? 'example.com' : `${network}.com`}`,
    displayOrder: index,
    isActive: true,
    iconExtension: 'svg' as const,
  }));

  await PlatformOption.insertMany(options);
}

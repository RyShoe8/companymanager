import Organization from '@/lib/models/Organization';
import { organizationSlugFromUserId } from '@/lib/utils/organizationSlug';

let migrationPromise: Promise<{ backfilled: number }> | null = null;

/**
 * Backfill missing organization slugs and sync indexes (fixes E11000 on slug: null).
 */
export async function migrateOrganizationSlugs(): Promise<{ backfilled: number }> {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    const orgs = await Organization.find({
      $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
    });

    let backfilled = 0;
    for (const org of orgs) {
      if (!org.userId) continue;
      org.slug = organizationSlugFromUserId(org.userId);
      await org.save();
      backfilled += 1;
    }

    await Organization.syncIndexes();

    return { backfilled };
  })();

  try {
    return await migrationPromise;
  } catch (err) {
    migrationPromise = null;
    throw err;
  }
}

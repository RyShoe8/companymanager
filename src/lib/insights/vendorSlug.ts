import { slugifyTitle } from '@/lib/blog/slugify';
import InsightVendor from '@/lib/models/InsightVendor';

function slugifyVendorName(name: string): string {
  const base = slugifyTitle(name) || 'vendor';
  return base.slice(0, 80);
}

export async function generateUniqueVendorSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugifyVendorName(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await InsightVendor.findOne({ vendorSlug: candidate }).select('_id').lean();
    if (!existing || (excludeId && existing._id.toString() === excludeId)) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

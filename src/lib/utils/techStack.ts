import type { IProjectTechStackItem } from '@/lib/models/Project';
import type { PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';
import { getStaticSeedSnapshot } from '@/lib/platformCatalog/staticSeedSnapshot';

export const TECH_STACK_CATEGORY_LABELS: Record<string, string> = {
  hosting: 'Hosting',
  database: 'Database',
  api: 'API',
  framework: 'Framework',
  payments: 'Payments',
};

export function getTechStackEntry(technologyId: string, catalog?: PlatformCatalogSnapshot) {
  const snap = catalog ?? getStaticSeedSnapshot();
  return snap.techOptionsById.get(technologyId);
}

function readLoginField(o: Record<string, unknown>): { login?: string } {
  const login = typeof o.login === 'string' ? o.login.trim() : undefined;
  return login ? { login } : {};
}

export function sanitizeTechStack(
  raw: unknown,
  catalog: PlatformCatalogSnapshot = getStaticSeedSnapshot()
): IProjectTechStackItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IProjectTechStackItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const technologyId = typeof o.technologyId === 'string' ? o.technologyId.trim() : '';
    const category = typeof o.category === 'string' ? o.category : '';
    if (!technologyId) continue;
    const entry = catalog.techOptionsById.get(technologyId);
    if (!entry || entry.categorySlug !== category) continue;
    if (seen.has(technologyId)) continue;
    seen.add(technologyId);
    out.push({ category: entry.categorySlug, technologyId: entry.optionId, ...readLoginField(o) });
  }
  return out;
}

export function validateTechStackUpdate(
  raw: unknown,
  catalog: PlatformCatalogSnapshot = getStaticSeedSnapshot()
): string | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return 'techStack must be an array';
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'Invalid tech stack entry';
    const o = item as Record<string, unknown>;
    const technologyId = typeof o.technologyId === 'string' ? o.technologyId.trim() : '';
    const category = o.category;
    if (!technologyId) return 'Invalid tech stack technologyId';
    if (typeof category !== 'string') return 'Invalid tech stack category';
    const entry = catalog.techOptionsById.get(technologyId);
    if (!entry) return `Unknown technology: ${technologyId}`;
    if (entry.categorySlug !== category) {
      return `Category mismatch for ${technologyId}`;
    }
    if (seen.has(technologyId)) return `Duplicate technology: ${technologyId}`;
    seen.add(technologyId);
  }
  return null;
}

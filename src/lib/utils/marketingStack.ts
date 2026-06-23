import type { IProjectMarketingStackItem } from '@/lib/models/Project';
import type { PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';
import { getStaticSeedSnapshot } from '@/lib/platformCatalog/staticSeedSnapshot';

export const MARKETING_STACK_CATEGORY_LABELS: Record<string, string> = {
  email: 'Email',
  analytics: 'Analytics',
  social: 'Social',
  crm: 'CRM',
};

export function getMarketingStackEntry(toolId: string, catalog?: PlatformCatalogSnapshot) {
  const snap = catalog ?? getStaticSeedSnapshot();
  return snap.marketingOptionsById.get(toolId);
}

function readLoginField(o: Record<string, unknown>): { login?: string } {
  const login = typeof o.login === 'string' ? o.login.trim() : undefined;
  return login ? { login } : {};
}

export function sanitizeMarketingStack(
  raw: unknown,
  catalog: PlatformCatalogSnapshot = getStaticSeedSnapshot()
): IProjectMarketingStackItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IProjectMarketingStackItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const toolId = typeof o.toolId === 'string' ? o.toolId.trim() : '';
    const category = typeof o.category === 'string' ? o.category : '';
    if (!toolId) continue;
    const entry = catalog.marketingOptionsById.get(toolId);
    if (!entry || entry.categorySlug !== category) continue;
    if (seen.has(toolId)) continue;
    seen.add(toolId);
    out.push({ category: entry.categorySlug, toolId: entry.optionId, ...readLoginField(o) });
  }
  return out;
}

export function validateMarketingStackUpdate(
  raw: unknown,
  catalog: PlatformCatalogSnapshot = getStaticSeedSnapshot()
): string | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return 'marketingStack must be an array';
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'Invalid marketing stack entry';
    const o = item as Record<string, unknown>;
    const toolId = typeof o.toolId === 'string' ? o.toolId.trim() : '';
    const category = o.category;
    if (!toolId) return 'Invalid marketing stack toolId';
    if (typeof category !== 'string') return 'Invalid marketing stack category';
    const entry = catalog.marketingOptionsById.get(toolId);
    if (!entry) return `Unknown tool: ${toolId}`;
    if (entry.categorySlug !== category) {
      return `Category mismatch for ${toolId}`;
    }
    if (seen.has(toolId)) return `Duplicate tool: ${toolId}`;
    seen.add(toolId);
  }
  return null;
}

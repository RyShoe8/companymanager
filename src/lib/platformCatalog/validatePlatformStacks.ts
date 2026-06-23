import type { IPlatformStackItem } from '@/lib/models/platformFields';
import type { PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';
import { getStaticSeedSnapshot } from '@/lib/platformCatalog/staticSeedSnapshot';
import { getStackOptionsById } from '@/lib/platformCatalog/buildSnapshot';
import { isProtectedPlatformStackSlug } from '@/lib/platformCatalog/platformStackConstants';

function readLoginField(o: Record<string, unknown>): { login?: string } {
  const login = typeof o.login === 'string' ? o.login.trim() : undefined;
  return login ? { login } : {};
}

export function sanitizePlatformStacks(
  raw: unknown,
  catalog: PlatformCatalogSnapshot = getStaticSeedSnapshot()
): Record<string, IPlatformStackItem[]> | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const out: Record<string, IPlatformStackItem[]> = {};
  const activeCatalogStacks = new Set(
    catalog.stacks
      .filter((s) => s.isActive && s.linkingMode === 'catalog' && !isProtectedPlatformStackSlug(s.slug))
      .map((s) => s.slug)
  );

  for (const [stackSlug, items] of Object.entries(raw as Record<string, unknown>)) {
    if (!activeCatalogStacks.has(stackSlug)) continue;
    if (!Array.isArray(items)) continue;
    const optionsById = getStackOptionsById(catalog, stackSlug);
    const sanitized: IPlatformStackItem[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const optionId = typeof o.optionId === 'string' ? o.optionId.trim() : '';
      const category = typeof o.category === 'string' ? o.category : '';
      if (!optionId) continue;
      const entry = optionsById.get(optionId);
      if (!entry || entry.categorySlug !== category) continue;
      if (seen.has(optionId)) continue;
      seen.add(optionId);
      sanitized.push({ category: entry.categorySlug, optionId: entry.optionId, ...readLoginField(o) });
    }
    if (sanitized.length > 0) out[stackSlug] = sanitized;
  }

  return out;
}

export function validatePlatformStacksUpdate(
  raw: unknown,
  catalog: PlatformCatalogSnapshot = getStaticSeedSnapshot()
): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return 'platformStacks must be an object';

  const activeCatalogStacks = new Set(
    catalog.stacks
      .filter((s) => s.isActive && s.linkingMode === 'catalog' && !isProtectedPlatformStackSlug(s.slug))
      .map((s) => s.slug)
  );

  for (const [stackSlug, items] of Object.entries(raw as Record<string, unknown>)) {
    if (isProtectedPlatformStackSlug(stackSlug)) {
      return `Cannot set built-in stack "${stackSlug}" via platformStacks`;
    }
    if (!activeCatalogStacks.has(stackSlug)) {
      return `Unknown or inactive platform stack: ${stackSlug}`;
    }
    if (!Array.isArray(items)) return `platformStacks.${stackSlug} must be an array`;
    const optionsById = getStackOptionsById(catalog, stackSlug);
    const seen = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== 'object') return `Invalid platformStacks.${stackSlug} entry`;
      const o = item as Record<string, unknown>;
      const optionId = typeof o.optionId === 'string' ? o.optionId.trim() : '';
      const category = o.category;
      if (!optionId) return `Invalid optionId in platformStacks.${stackSlug}`;
      if (typeof category !== 'string') return `Invalid category in platformStacks.${stackSlug}`;
      const entry = optionsById.get(optionId);
      if (!entry) return `Unknown option "${optionId}" in stack "${stackSlug}"`;
      if (entry.categorySlug !== category) return `Category mismatch for ${optionId}`;
      if (seen.has(optionId)) return `Duplicate option "${optionId}" in stack "${stackSlug}"`;
      seen.add(optionId);
    }
  }

  return null;
}

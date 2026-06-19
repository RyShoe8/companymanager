import type { IProjectTechStackItem, TechStackCategory } from '@/lib/models/Project';
import { getCatalogEntry } from '@/lib/techStack/catalog';

export const TECH_STACK_CATEGORY_LABELS: Record<TechStackCategory, string> = {
  hosting: 'Hosting',
  database: 'Database',
  api: 'API',
  framework: 'Framework',
  payments: 'Payments',
};

export function getTechStackEntry(technologyId: string) {
  return getCatalogEntry(technologyId);
}

function readLoginField(o: Record<string, unknown>): { login?: string } {
  const login = typeof o.login === 'string' ? o.login.trim() : undefined;
  return login ? { login } : {};
}

export function sanitizeTechStack(raw: unknown): IProjectTechStackItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IProjectTechStackItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const technologyId = typeof o.technologyId === 'string' ? o.technologyId.trim() : '';
    const category = o.category as TechStackCategory;
    if (!technologyId) continue;
    const entry = getCatalogEntry(technologyId);
    if (!entry || entry.category !== category) continue;
    if (seen.has(technologyId)) continue;
    seen.add(technologyId);
    out.push({ category: entry.category, technologyId: entry.id, ...readLoginField(o) });
  }
  return out;
}

export function validateTechStackUpdate(raw: unknown): string | null {
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
    const entry = getCatalogEntry(technologyId);
    if (!entry) return `Unknown technology: ${technologyId}`;
    if (entry.category !== category) {
      return `Category mismatch for ${technologyId}`;
    }
    if (seen.has(technologyId)) return `Duplicate technology: ${technologyId}`;
    seen.add(technologyId);
  }
  return null;
}

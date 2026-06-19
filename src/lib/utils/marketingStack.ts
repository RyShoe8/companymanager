import type { IProjectMarketingStackItem, MarketingStackCategory } from '@/lib/models/Project';
import { getMarketingCatalogEntry } from '@/lib/marketingStack/catalog';

export const MARKETING_STACK_CATEGORY_LABELS: Record<MarketingStackCategory, string> = {
  email: 'Email',
  analytics: 'Analytics',
  social: 'Social',
  crm: 'CRM',
};

export function getMarketingStackEntry(toolId: string) {
  return getMarketingCatalogEntry(toolId);
}

function readLoginField(o: Record<string, unknown>): { login?: string } {
  const login = typeof o.login === 'string' ? o.login.trim() : undefined;
  return login ? { login } : {};
}

export function sanitizeMarketingStack(raw: unknown): IProjectMarketingStackItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IProjectMarketingStackItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const toolId = typeof o.toolId === 'string' ? o.toolId.trim() : '';
    const category = o.category as MarketingStackCategory;
    if (!toolId) continue;
    const entry = getMarketingCatalogEntry(toolId);
    if (!entry || entry.category !== category) continue;
    if (seen.has(toolId)) continue;
    seen.add(toolId);
    out.push({ category: entry.category, toolId: entry.id, ...readLoginField(o) });
  }
  return out;
}

export function validateMarketingStackUpdate(raw: unknown): string | null {
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
    const entry = getMarketingCatalogEntry(toolId);
    if (!entry) return `Unknown tool: ${toolId}`;
    if (entry.category !== category) {
      return `Category mismatch for ${toolId}`;
    }
    if (seen.has(toolId)) return `Duplicate tool: ${toolId}`;
    seen.add(toolId);
  }
  return null;
}

import type { PlatformLinkingMode } from '@/lib/models/PlatformStack';
import type { PlatformStackSlug } from '@/lib/models/PlatformCategory';

export interface CatalogStackRow {
  id: string;
  slug: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
  iconFolder?: string;
  linkingMode: PlatformLinkingMode;
}

export interface CatalogCategoryRow {
  id: string;
  stackType: PlatformStackSlug;
  slug: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CatalogOptionRow {
  id: string;
  stackType: PlatformStackSlug;
  optionId: string;
  categorySlug: string;
  name: string;
  homepageUrl: string;
  simpleIconSlug?: string;
  iconExtension: 'svg' | 'png';
  iconUrl?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface StackCatalogSlice {
  categories: CatalogCategoryRow[];
  options: CatalogOptionRow[];
  categoryLabels: Record<string, string>;
  categorySlugs: string[];
}

export interface PlatformCatalogSnapshot {
  stacks: CatalogStackRow[];
  slices: Record<string, StackCatalogSlice>;
  optionsByStack: Record<string, Map<string, CatalogOptionRow>>;
  tech: StackCatalogSlice;
  marketing: StackCatalogSlice;
  /** All options including inactive (for validation of existing links). */
  techOptionsById: Map<string, CatalogOptionRow>;
  marketingOptionsById: Map<string, CatalogOptionRow>;
}

export interface PublicPlatformCatalog {
  stacks: CatalogStackRow[];
  catalogByStack: Record<string, StackCatalogSlice>;
  tech: StackCatalogSlice;
  marketing: StackCatalogSlice;
}

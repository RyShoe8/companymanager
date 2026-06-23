import type { PlatformStackType } from '@/lib/models/PlatformCategory';

export interface CatalogCategoryRow {
  id: string;
  stackType: PlatformStackType;
  slug: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CatalogOptionRow {
  id: string;
  stackType: PlatformStackType;
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
  tech: StackCatalogSlice;
  marketing: StackCatalogSlice;
  /** All options including inactive (for validation of existing links). */
  techOptionsById: Map<string, CatalogOptionRow>;
  marketingOptionsById: Map<string, CatalogOptionRow>;
}

export interface PublicPlatformCatalog {
  tech: StackCatalogSlice;
  marketing: StackCatalogSlice;
}

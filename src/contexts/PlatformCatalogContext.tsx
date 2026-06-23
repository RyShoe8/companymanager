'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CatalogCategoryRow, CatalogOptionRow, PublicPlatformCatalog } from '@/lib/platformCatalog/types';
import { getStaticSeedSnapshot } from '@/lib/platformCatalog/staticSeedSnapshot';
import {
  buildPlatformCatalogSnapshot,
  getStackOptionsById,
  getStackSlice,
  toPublicCatalog,
} from '@/lib/platformCatalog/buildSnapshot';
import { getCatalogByCategory, getCatalogEntry, getTechStackCategories } from '@/lib/techStack/catalog';
import {
  getMarketingCatalogByCategory,
  getMarketingCatalogEntry,
  getMarketingStackCategories,
} from '@/lib/marketingStack/catalog';
import type { PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';
import { isProtectedPlatformStackSlug } from '@/lib/platformCatalog/platformStackConstants';

type PlatformCatalogContextValue = {
  catalog: PublicPlatformCatalog | null;
  snapshot: PlatformCatalogSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const PlatformCatalogContext = createContext<PlatformCatalogContextValue | null>(null);

function rowsFromPublicCatalog(publicCatalog: PublicPlatformCatalog): {
  categories: CatalogCategoryRow[];
  options: CatalogOptionRow[];
} {
  const categories: CatalogCategoryRow[] = [];
  const options: CatalogOptionRow[] = [];
  const seenStacks = new Set<string>();

  const ingestSlice = (stackSlug: string, slice: PublicPlatformCatalog['tech']) => {
    if (seenStacks.has(stackSlug)) return;
    seenStacks.add(stackSlug);
    for (const c of slice.categories) {
      categories.push({ ...c, stackType: stackSlug });
    }
    for (const o of slice.options) {
      options.push({ ...o, stackType: stackSlug });
    }
  };

  for (const [stackSlug, slice] of Object.entries(publicCatalog.catalogByStack ?? {})) {
    ingestSlice(stackSlug, slice);
  }
  ingestSlice('tech', publicCatalog.tech);
  ingestSlice('marketing', publicCatalog.marketing);

  return { categories, options };
}

function snapshotFromPublic(publicCatalog: PublicPlatformCatalog): PlatformCatalogSnapshot {
  const { categories, options } = rowsFromPublicCatalog(publicCatalog);
  return buildPlatformCatalogSnapshot(publicCatalog.stacks ?? [], categories, options);
}

function createStackHelpers(snap: PlatformCatalogSnapshot) {
  return {
    getCustomCatalogStacks: () =>
      snap.stacks
        .filter(
          (s) => s.isActive && s.linkingMode === 'catalog' && !isProtectedPlatformStackSlug(s.slug)
        )
        .sort((a, b) => a.displayOrder - b.displayOrder),
    getStackCategories: (stackSlug: string) => getStackSlice(snap, stackSlug).categorySlugs,
    getStackByCategory: (stackSlug: string, category: string) => {
      const slice = getStackSlice(snap, stackSlug);
      return slice.options
        .filter((o) => o.categorySlug === category && o.isActive)
        .map((o) => ({ id: o.optionId, name: o.name }));
    },
    getStackEntry: (stackSlug: string, optionId: string) => {
      const row = getStackOptionsById(snap, stackSlug).get(optionId);
      if (!row) return undefined;
      return {
        id: row.optionId,
        name: row.name,
        category: row.categorySlug,
        homepageUrl: row.homepageUrl,
      };
    },
    getStackIconSrc: (stackSlug: string, optionId: string) => {
      const row = getStackOptionsById(snap, stackSlug).get(optionId);
      if (row?.iconUrl) return row.iconUrl;
      const stack = snap.stacks.find((s) => s.slug === stackSlug);
      const folder = stack?.iconFolder ?? `${stackSlug}-stack`;
      const ext = row?.iconExtension ?? 'svg';
      return `/icons/${folder}/${optionId}.${ext}`;
    },
    getStackLabel: (stackSlug: string) =>
      snap.stacks.find((s) => s.slug === stackSlug)?.label ?? stackSlug,
  };
}

export function PlatformCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<PublicPlatformCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/platform-catalog');
      if (!res.ok) throw new Error('Failed to load platform catalog');
      const data = (await res.json()) as PublicPlatformCatalog;
      setCatalog(data);
    } catch {
      setError('Failed to load platform catalog');
      setCatalog(toPublicCatalog(getStaticSeedSnapshot()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const snapshot = useMemo(
    () => (catalog ? snapshotFromPublic(catalog) : null),
    [catalog]
  );

  const value = useMemo(
    () => ({ catalog, snapshot, loading, error, refresh }),
    [catalog, snapshot, loading, error, refresh]
  );

  return (
    <PlatformCatalogContext.Provider value={value}>{children}</PlatformCatalogContext.Provider>
  );
}

export function usePlatformCatalog() {
  const ctx = useContext(PlatformCatalogContext);
  const snap = ctx?.snapshot ?? snapshotFromPublic(toPublicCatalog(getStaticSeedSnapshot()));
  const stackHelpers = useMemo(() => createStackHelpers(snap), [snap]);

  if (!ctx) {
    return {
      catalog: toPublicCatalog(getStaticSeedSnapshot()),
      snapshot: snap,
      loading: false,
      error: null,
      refresh: async () => {},
      getTechCategories: () => getTechStackCategories(snap),
      getMarketingCategories: () => getMarketingStackCategories(snap),
      getTechEntry: (id: string) => getCatalogEntry(id, snap),
      getMarketingEntry: (id: string) => getMarketingCatalogEntry(id, snap),
      getTechByCategory: (cat: string) => getCatalogByCategory(cat, snap),
      getMarketingByCategory: (cat: string) => getMarketingCatalogByCategory(cat, snap),
      getTechIconSrc: (optionId: string) => {
        const row = snap.techOptionsById.get(optionId);
        if (row?.iconUrl) return row.iconUrl;
        return `/icons/tech-stack/${optionId}.svg`;
      },
      getMarketingIconSrc: (optionId: string) => {
        const row = snap.marketingOptionsById.get(optionId);
        if (row?.iconUrl) return row.iconUrl;
        const ext = row?.iconExtension ?? 'svg';
        return `/icons/marketing-stack/${optionId}.${ext}`;
      },
      ...stackHelpers,
    };
  }

  return {
    ...ctx,
    getTechCategories: () => getTechStackCategories(snap),
    getMarketingCategories: () => getMarketingStackCategories(snap),
    getTechEntry: (id: string) => getCatalogEntry(id, snap),
    getMarketingEntry: (id: string) => getMarketingCatalogEntry(id, snap),
    getTechByCategory: (cat: string) => getCatalogByCategory(cat, snap),
    getMarketingByCategory: (cat: string) => getMarketingCatalogByCategory(cat, snap),
    getTechIconSrc: (optionId: string) => {
      const row = snap.techOptionsById.get(optionId);
      if (row?.iconUrl) return row.iconUrl;
      return `/icons/tech-stack/${optionId}.svg`;
    },
    getMarketingIconSrc: (optionId: string) => {
      const row = snap.marketingOptionsById.get(optionId);
      if (row?.iconUrl) return row.iconUrl;
      const ext = row?.iconExtension ?? 'svg';
      return `/icons/marketing-stack/${optionId}.${ext}`;
    },
    ...stackHelpers,
  };
}

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
import type { PublicPlatformCatalog } from '@/lib/platformCatalog/types';
import { getStaticSeedSnapshot } from '@/lib/platformCatalog/staticSeedSnapshot';
import { toPublicCatalog } from '@/lib/platformCatalog/buildSnapshot';
import { getCatalogByCategory, getCatalogEntry, getTechStackCategories } from '@/lib/techStack/catalog';
import {
  getMarketingCatalogByCategory,
  getMarketingCatalogEntry,
  getMarketingStackCategories,
} from '@/lib/marketingStack/catalog';
import type { PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';

type PlatformCatalogContextValue = {
  catalog: PublicPlatformCatalog | null;
  snapshot: PlatformCatalogSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const PlatformCatalogContext = createContext<PlatformCatalogContextValue | null>(null);

function snapshotFromPublic(publicCatalog: PublicPlatformCatalog): PlatformCatalogSnapshot {
  const categories = [
    ...publicCatalog.tech.categories.map((c) => ({ ...c, stackType: 'tech' as const })),
    ...publicCatalog.marketing.categories.map((c) => ({ ...c, stackType: 'marketing' as const })),
  ];
  const options = [
    ...publicCatalog.tech.options.map((o) => ({ ...o, stackType: 'tech' as const })),
    ...publicCatalog.marketing.options.map((o) => ({ ...o, stackType: 'marketing' as const })),
  ];
  const techOptionsById = new Map(publicCatalog.tech.options.map((o) => [o.optionId, { ...o, stackType: 'tech' as const }]));
  const marketingOptionsById = new Map(
    publicCatalog.marketing.options.map((o) => [o.optionId, { ...o, stackType: 'marketing' as const }])
  );
  return {
    tech: publicCatalog.tech,
    marketing: publicCatalog.marketing,
    techOptionsById,
    marketingOptionsById,
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
  if (!ctx) {
    const fallback = toPublicCatalog(getStaticSeedSnapshot());
    const snapshot = snapshotFromPublic(fallback);
    return {
      catalog: fallback,
      snapshot,
      loading: false,
      error: null,
      refresh: async () => {},
      getTechCategories: () => getTechStackCategories(snapshot),
      getMarketingCategories: () => getMarketingStackCategories(snapshot),
      getTechEntry: (id: string) => getCatalogEntry(id, snapshot),
      getMarketingEntry: (id: string) => getMarketingCatalogEntry(id, snapshot),
      getTechByCategory: (cat: string) => getCatalogByCategory(cat, snapshot),
      getMarketingByCategory: (cat: string) => getMarketingCatalogByCategory(cat, snapshot),
      getTechIconSrc: (optionId: string) => {
        const row = snapshot.techOptionsById.get(optionId);
        if (row?.iconUrl) return row.iconUrl;
        return `/icons/tech-stack/${optionId}.svg`;
      },
      getMarketingIconSrc: (optionId: string) => {
        const row = snapshot.marketingOptionsById.get(optionId);
        if (row?.iconUrl) return row.iconUrl;
        const ext = row?.iconExtension ?? 'svg';
        return `/icons/marketing-stack/${optionId}.${ext}`;
      },
    };
  }

  const snap = ctx.snapshot ?? snapshotFromPublic(toPublicCatalog(getStaticSeedSnapshot()));

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
  };
}

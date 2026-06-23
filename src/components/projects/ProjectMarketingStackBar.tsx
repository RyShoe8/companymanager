'use client';

import { useCallback, useMemo } from 'react';
import type { IProject, IProjectMarketingStackItem } from '@/lib/models/Project';
import ProjectStackBar, { type StackItem } from '@/components/projects/ProjectStackBar';
import MarketingStackIcon from '@/components/projects/MarketingStackIcon';
import { MARKETING_STACK_CATEGORY_LABELS } from '@/lib/utils/marketingStack';
import { usePlatformCatalog } from '@/contexts/PlatformCatalogContext';

interface ProjectMarketingStackBarProps {
  marketingStack: IProjectMarketingStackItem[];
  isManagerOrAdmin: boolean;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
  surface?: import('@/lib/ui/surfaceStyles').ControlSurface;
}

export default function ProjectMarketingStackBar({
  marketingStack,
  isManagerOrAdmin,
  onUpdate,
  surface = 'inspector',
}: ProjectMarketingStackBarProps) {
  const {
    snapshot,
    getMarketingCategories,
    getMarketingByCategory,
    getMarketingEntry,
    getMarketingIconSrc,
  } = usePlatformCatalog();

  const items = useMemo<StackItem<string>[]>(
    () =>
      marketingStack.map((t) => ({
        category: t.category,
        id: t.toolId,
        login: t.login,
      })),
    [marketingStack]
  );

  const config = useMemo(
    () => ({
      buttonLabel: 'Marketing & Analytics',
      itemNoun: 'tool',
      browsePrompt: 'Choose a category to browse tools.',
      modalFallbackTitle: 'Tool',
      categories: getMarketingCategories(),
      categoryLabels: {
        ...MARKETING_STACK_CATEGORY_LABELS,
        ...(snapshot?.marketing.categoryLabels ?? {}),
      },
      getCatalogByCategory: (category: string) => getMarketingByCategory(category),
      getEntry: (id: string) => getMarketingEntry(id),
      renderIcon: (id: string, size: number) => (
        <MarketingStackIcon toolId={id} size={size} iconSrc={getMarketingIconSrc(id)} />
      ),
    }),
    [snapshot, getMarketingCategories, getMarketingByCategory, getMarketingEntry, getMarketingIconSrc]
  );

  const handleSave = useCallback(
    (next: StackItem<string>[]) =>
      onUpdate({
        marketingStack: next.map((t) => ({
          category: t.category,
          toolId: t.id,
          login: t.login,
        })),
      }),
    [onUpdate]
  );

  return (
    <ProjectStackBar
      items={items}
      isManagerOrAdmin={isManagerOrAdmin}
      onSave={handleSave}
      config={config}
      surface={surface}
    />
  );
}

'use client';

import { useCallback, useMemo } from 'react';
import type { IProject, IProjectMarketingStackItem, MarketingStackCategory } from '@/lib/models/Project';
import ProjectStackBar, { type StackItem } from '@/components/projects/ProjectStackBar';
import MarketingStackIcon from '@/components/projects/MarketingStackIcon';
import { getMarketingCatalogByCategory, MARKETING_STACK_CATEGORIES } from '@/lib/marketingStack/catalog';
import { MARKETING_STACK_CATEGORY_LABELS, getMarketingStackEntry } from '@/lib/utils/marketingStack';

interface ProjectMarketingStackBarProps {
  marketingStack: IProjectMarketingStackItem[];
  isManagerOrAdmin: boolean;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
}

const CONFIG = {
  buttonLabel: <>Marketing &amp; Analytics</>,
  itemNoun: 'tool',
  browsePrompt: 'Choose a category to browse tools.',
  modalFallbackTitle: 'Tool',
  categories: MARKETING_STACK_CATEGORIES,
  categoryLabels: MARKETING_STACK_CATEGORY_LABELS,
  getCatalogByCategory: getMarketingCatalogByCategory,
  getEntry: getMarketingStackEntry,
  renderIcon: (id: string, size: number) => <MarketingStackIcon toolId={id} size={size} />,
};

export default function ProjectMarketingStackBar({
  marketingStack,
  isManagerOrAdmin,
  onUpdate,
}: ProjectMarketingStackBarProps) {
  const items = useMemo<StackItem<MarketingStackCategory>[]>(
    () => marketingStack.map((t) => ({ category: t.category, id: t.toolId })),
    [marketingStack]
  );

  const handleSave = useCallback(
    (next: StackItem<MarketingStackCategory>[]) =>
      onUpdate({
        marketingStack: next.map((t) => ({ category: t.category, toolId: t.id })),
      }),
    [onUpdate]
  );

  return (
    <ProjectStackBar
      items={items}
      isManagerOrAdmin={isManagerOrAdmin}
      onSave={handleSave}
      config={CONFIG}
    />
  );
}

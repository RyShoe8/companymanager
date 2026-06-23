'use client';

import Image from 'next/image';
import { useCallback, useMemo } from 'react';
import type { IPlatformStackItem } from '@/lib/models/platformFields';
import ProjectStackBar, { type StackItem } from '@/components/projects/ProjectStackBar';
import { usePlatformCatalog } from '@/contexts/PlatformCatalogContext';

interface ProjectPlatformStackBarProps {
  stackSlug: string;
  stackLabel: string;
  items: IPlatformStackItem[];
  isManagerOrAdmin: boolean;
  onSaveStack: (stackSlug: string, next: IPlatformStackItem[]) => Promise<void>;
  surface?: import('@/lib/ui/surfaceStyles').ControlSurface;
}

function PlatformStackOptionIcon({
  iconSrc,
  name,
  size,
}: {
  iconSrc: string;
  name: string;
  size: number;
}) {
  return (
    <Image
      src={iconSrc}
      alt={name}
      width={size}
      height={size}
      className="object-contain"
      unoptimized
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = 'none';
      }}
    />
  );
}

export default function ProjectPlatformStackBar({
  stackSlug,
  stackLabel,
  items,
  isManagerOrAdmin,
  onSaveStack,
  surface = 'inspector',
}: ProjectPlatformStackBarProps) {
  const {
    snapshot,
    getStackCategories,
    getStackByCategory,
    getStackEntry,
    getStackIconSrc,
  } = usePlatformCatalog();

  const stackItems = useMemo<StackItem<string>[]>(
    () =>
      items.map((t) => ({
        category: t.category,
        id: t.optionId,
        login: t.login,
      })),
    [items]
  );

  const slice = snapshot?.slices[stackSlug];

  const config = useMemo(
    () => ({
      buttonLabel: stackLabel,
      itemNoun: 'option',
      browsePrompt: 'Choose a category to browse options.',
      modalFallbackTitle: 'Platform',
      categories: getStackCategories(stackSlug),
      categoryLabels: slice?.categoryLabels ?? {},
      getCatalogByCategory: (category: string) => getStackByCategory(stackSlug, category),
      getEntry: (id: string) => getStackEntry(stackSlug, id),
      renderIcon: (id: string, size: number) => {
        const entry = getStackEntry(stackSlug, id);
        return (
          <PlatformStackOptionIcon
            iconSrc={getStackIconSrc(stackSlug, id)}
            name={entry?.name ?? id}
            size={size}
          />
        );
      },
    }),
    [
      stackSlug,
      stackLabel,
      slice,
      getStackCategories,
      getStackByCategory,
      getStackEntry,
      getStackIconSrc,
    ]
  );

  const handleSave = useCallback(
    (next: StackItem<string>[]) =>
      onSaveStack(
        stackSlug,
        next.map((t) => ({
          category: t.category,
          optionId: t.id,
          login: t.login,
        }))
      ),
    [onSaveStack, stackSlug]
  );

  return (
    <ProjectStackBar
      items={stackItems}
      isManagerOrAdmin={isManagerOrAdmin}
      onSave={handleSave}
      config={config}
      surface={surface}
    />
  );
}

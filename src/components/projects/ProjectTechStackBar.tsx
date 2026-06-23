'use client';

import { useCallback, useMemo } from 'react';
import type { IProject, IProjectTechStackItem } from '@/lib/models/Project';
import ProjectStackBar, { type StackItem } from '@/components/projects/ProjectStackBar';
import TechStackIcon from '@/components/projects/TechStackIcon';
import { TECH_STACK_CATEGORY_LABELS } from '@/lib/utils/techStack';
import { usePlatformCatalog } from '@/contexts/PlatformCatalogContext';

interface ProjectTechStackBarProps {
  techStack: IProjectTechStackItem[];
  isManagerOrAdmin: boolean;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
  surface?: import('@/lib/ui/surfaceStyles').ControlSurface;
}

export default function ProjectTechStackBar({
  techStack,
  isManagerOrAdmin,
  onUpdate,
  surface = 'inspector',
}: ProjectTechStackBarProps) {
  const {
    snapshot,
    getTechCategories,
    getTechByCategory,
    getTechEntry,
    getTechIconSrc,
  } = usePlatformCatalog();

  const items = useMemo<StackItem<string>[]>(
    () =>
      techStack.map((t) => ({
        category: t.category,
        id: t.technologyId,
        login: t.login,
      })),
    [techStack]
  );

  const config = useMemo(
    () => ({
      buttonLabel: 'Tech Stack',
      itemNoun: 'technology',
      browsePrompt: 'Choose a category to browse technologies.',
      modalFallbackTitle: 'Technology',
      categories: getTechCategories(),
      categoryLabels: {
        ...TECH_STACK_CATEGORY_LABELS,
        ...(snapshot?.tech.categoryLabels ?? {}),
      },
      getCatalogByCategory: (category: string) => getTechByCategory(category),
      getEntry: (id: string) => getTechEntry(id),
      renderIcon: (id: string, size: number) => (
        <TechStackIcon technologyId={id} size={size} iconSrc={getTechIconSrc(id)} />
      ),
    }),
    [snapshot, getTechCategories, getTechByCategory, getTechEntry, getTechIconSrc]
  );

  const handleSave = useCallback(
    (next: StackItem<string>[]) =>
      onUpdate({
        techStack: next.map((t) => ({
          category: t.category,
          technologyId: t.id,
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

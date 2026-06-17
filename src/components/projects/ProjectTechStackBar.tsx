'use client';

import { useCallback, useMemo } from 'react';
import type { IProject, IProjectTechStackItem, TechStackCategory } from '@/lib/models/Project';
import ProjectStackBar, { type StackItem } from '@/components/projects/ProjectStackBar';
import TechStackIcon from '@/components/projects/TechStackIcon';
import { getCatalogByCategory, TECH_STACK_CATEGORIES } from '@/lib/techStack/catalog';
import { TECH_STACK_CATEGORY_LABELS, getTechStackEntry } from '@/lib/utils/techStack';

interface ProjectTechStackBarProps {
  techStack: IProjectTechStackItem[];
  isManagerOrAdmin: boolean;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
}

const CONFIG = {
  buttonLabel: 'Tech Stack',
  itemNoun: 'technology',
  browsePrompt: 'Choose a category to browse technologies.',
  modalFallbackTitle: 'Technology',
  categories: TECH_STACK_CATEGORIES,
  categoryLabels: TECH_STACK_CATEGORY_LABELS,
  getCatalogByCategory,
  getEntry: getTechStackEntry,
  renderIcon: (id: string, size: number) => <TechStackIcon technologyId={id} size={size} />,
};

export default function ProjectTechStackBar({
  techStack,
  isManagerOrAdmin,
  onUpdate,
}: ProjectTechStackBarProps) {
  const items = useMemo<StackItem<TechStackCategory>[]>(
    () =>
      techStack.map((t) => ({
        category: t.category,
        id: t.technologyId,
        login: t.login,
        password: t.password,
      })),
    [techStack]
  );

  const handleSave = useCallback(
    (next: StackItem<TechStackCategory>[]) =>
      onUpdate({
        techStack: next.map((t) => ({
          category: t.category,
          technologyId: t.id,
          login: t.login,
          password: t.password,
        })),
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

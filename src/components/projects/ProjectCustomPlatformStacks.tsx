'use client';

import { useCallback, useMemo } from 'react';
import type { IPlatformStackItem } from '@/lib/models/platformFields';
import ProjectPlatformStackBar from '@/components/projects/ProjectPlatformStackBar';
import { usePlatformCatalog } from '@/contexts/PlatformCatalogContext';

interface ProjectCustomPlatformStacksProps {
  platformStacks?: Record<string, IPlatformStackItem[]>;
  isManagerOrAdmin: boolean;
  onUpdate: (updates: { platformStacks: Record<string, IPlatformStackItem[]> }) => Promise<void>;
  surface?: import('@/lib/ui/surfaceStyles').ControlSurface;
}

export default function ProjectCustomPlatformStacks({
  platformStacks,
  isManagerOrAdmin,
  onUpdate,
  surface = 'inspector',
}: ProjectCustomPlatformStacksProps) {
  const { getCustomCatalogStacks, getStackLabel } = usePlatformCatalog();
  const customStacks = useMemo(() => getCustomCatalogStacks(), [getCustomCatalogStacks]);

  const handleSaveStack = useCallback(
    async (stackSlug: string, next: IPlatformStackItem[]) => {
      const merged = { ...(platformStacks ?? {}) };
      if (next.length === 0) delete merged[stackSlug];
      else merged[stackSlug] = next;
      await onUpdate({ platformStacks: merged });
    },
    [onUpdate, platformStacks]
  );

  return (
    <>
      {customStacks.map((stack) => (
        <ProjectPlatformStackBar
          key={stack.slug}
          stackSlug={stack.slug}
          stackLabel={getStackLabel(stack.slug)}
          items={platformStacks?.[stack.slug] ?? []}
          isManagerOrAdmin={isManagerOrAdmin}
          onSaveStack={handleSaveStack}
          surface={surface}
        />
      ))}
    </>
  );
}

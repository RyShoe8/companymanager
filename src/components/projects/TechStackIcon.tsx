'use client';

import { getCatalogEntry } from '@/lib/techStack/catalog';
import { useInspectorLight } from '@/contexts/InspectorLightContext';
import { TECH_STACK_DARK_ICON_IDS } from '@/lib/icons/stackIconDark';

interface TechStackIconProps {
  technologyId: string;
  size?: number;
  className?: string;
}

export default function TechStackIcon({ technologyId, size = 20, className = '' }: TechStackIconProps) {
  const light = useInspectorLight();
  const entry = getCatalogEntry(technologyId);
  const label = entry?.name ?? technologyId;
  const invertDarkLogo = !light && TECH_STACK_DARK_ICON_IDS.has(technologyId);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/tech-stack/${technologyId}.svg`}
      alt={label}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${invertDarkLogo ? 'dark:invert' : ''} ${className}`}
    />
  );
}

'use client';

import { getCatalogEntry } from '@/lib/techStack/catalog';
import { useInspectorLight } from '@/contexts/InspectorLightContext';
import { usePlatformCatalog } from '@/contexts/PlatformCatalogContext';
import { TECH_STACK_DARK_ICON_IDS } from '@/lib/icons/stackIconDark';

interface TechStackIconProps {
  technologyId: string;
  size?: number;
  className?: string;
  iconSrc?: string;
}

export default function TechStackIcon({
  technologyId,
  size = 20,
  className = '',
  iconSrc: iconSrcProp,
}: TechStackIconProps) {
  const light = useInspectorLight();
  const { getTechEntry, getTechIconSrc } = usePlatformCatalog();
  const entry = getTechEntry(technologyId) ?? getCatalogEntry(technologyId);
  const label = entry?.name ?? technologyId;
  const iconSrc = iconSrcProp ?? getTechIconSrc(technologyId);
  const invertDarkLogo = !light && TECH_STACK_DARK_ICON_IDS.has(technologyId);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconSrc}
      alt={label}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${invertDarkLogo ? 'dark:invert' : ''} ${className}`}
    />
  );
}

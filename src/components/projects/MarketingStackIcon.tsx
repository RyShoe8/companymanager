'use client';

import { getMarketingCatalogEntry } from '@/lib/marketingStack/catalog';
import { useInspectorLight } from '@/contexts/InspectorLightContext';
import { usePlatformCatalog } from '@/contexts/PlatformCatalogContext';
import { MARKETING_STACK_DARK_ICON_IDS } from '@/lib/icons/stackIconDark';

interface MarketingStackIconProps {
  toolId: string;
  size?: number;
  className?: string;
  iconSrc?: string;
}

export default function MarketingStackIcon({
  toolId,
  size = 20,
  className = '',
  iconSrc: iconSrcProp,
}: MarketingStackIconProps) {
  const light = useInspectorLight();
  const { getMarketingEntry, getMarketingIconSrc } = usePlatformCatalog();
  const entry = getMarketingEntry(toolId) ?? getMarketingCatalogEntry(toolId);
  const label = entry?.name ?? toolId;
  const iconSrc = iconSrcProp ?? getMarketingIconSrc(toolId);
  const invertDarkLogo = !light && MARKETING_STACK_DARK_ICON_IDS.has(toolId);

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

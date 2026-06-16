'use client';

import { getMarketingCatalogEntry } from '@/lib/marketingStack/catalog';
import { useInspectorLight } from '@/contexts/InspectorLightContext';
import { MARKETING_STACK_DARK_ICON_IDS } from '@/lib/icons/stackIconDark';

interface MarketingStackIconProps {
  toolId: string;
  size?: number;
  className?: string;
}

export default function MarketingStackIcon({ toolId, size = 20, className = '' }: MarketingStackIconProps) {
  const light = useInspectorLight();
  const entry = getMarketingCatalogEntry(toolId);
  const label = entry?.name ?? toolId;
  const iconExtension = entry?.iconExtension ?? 'svg';
  const invertDarkLogo = !light && MARKETING_STACK_DARK_ICON_IDS.has(toolId);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/marketing-stack/${toolId}.${iconExtension}`}
      alt={label}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${invertDarkLogo ? 'dark:invert' : ''} ${className}`}
    />
  );
}

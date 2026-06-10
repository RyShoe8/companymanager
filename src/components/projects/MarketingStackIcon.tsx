'use client';

import { getMarketingCatalogEntry } from '@/lib/marketingStack/catalog';

interface MarketingStackIconProps {
  toolId: string;
  size?: number;
  className?: string;
}

export default function MarketingStackIcon({ toolId, size = 20, className = '' }: MarketingStackIconProps) {
  const entry = getMarketingCatalogEntry(toolId);
  const label = entry?.name ?? toolId;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/marketing-stack/${toolId}.svg`}
      alt={label}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}

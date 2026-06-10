'use client';

import { getCatalogEntry } from '@/lib/techStack/catalog';

interface TechStackIconProps {
  technologyId: string;
  size?: number;
  className?: string;
}

export default function TechStackIcon({ technologyId, size = 20, className = '' }: TechStackIconProps) {
  const entry = getCatalogEntry(technologyId);
  const label = entry?.name ?? technologyId;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/tech-stack/${technologyId}.svg`}
      alt={label}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}

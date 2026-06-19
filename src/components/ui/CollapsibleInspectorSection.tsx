'use client';

import type { ReactNode } from 'react';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

interface CollapsibleInspectorSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  collapsedSummary?: ReactNode;
  titleSuffix?: ReactNode;
  headerActions?: ReactNode;
  children?: ReactNode;
  /** Wrap in Insights-style card (border, padding, bg). */
  variant?: 'card' | 'nested';
  titleClassName?: string;
  className?: string;
  id?: string;
}

export default function CollapsibleInspectorSection({
  title,
  expanded,
  onToggle,
  collapsedSummary,
  titleSuffix,
  headerActions,
  children,
  variant = 'card',
  titleClassName,
  className = '',
  id,
}: CollapsibleInspectorSectionProps) {
  const light = useInspectorLight();
  const titleSize =
    variant === 'card'
      ? 'text-lg font-semibold'
      : 'text-sm font-semibold';

  const header = (
    <div
      className={`flex w-full items-center gap-2 ${expanded && children ? 'mb-3' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex flex-1 min-w-0 items-center gap-2 text-left"
      >
        <span className={`shrink-0 text-xs ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
          {expanded ? '▼' : '▶'}
        </span>
        <h3
          className={`${titleSize} ${lightSurface('text-gray-900', 'dark:text-white', light)} ${titleClassName ?? ''}`}
        >
          {title}
        </h3>
        {titleSuffix}
        {!expanded && collapsedSummary != null && (
          <span className={`ml-auto text-sm truncate ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
            {collapsedSummary}
          </span>
        )}
      </button>
      {headerActions != null && (
        <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {headerActions}
        </div>
      )}
    </div>
  );

  const body = expanded && children ? <div>{children}</div> : null;

  if (variant === 'nested') {
    return (
      <div className={className} id={id}>
        {header}
        {body}
      </div>
    );
  }

  return (
    <div
      id={id}
      className={`${lightSurface('bg-white', 'dark:bg-gray-800', light)} rounded-lg border ${lightSurface('border-gray-200', 'dark:border-gray-700', light)} p-4 ${className}`}
    >
      {header}
      {body}
    </div>
  );
}

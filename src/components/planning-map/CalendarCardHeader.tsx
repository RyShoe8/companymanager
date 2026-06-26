'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';

export function AnimatedProgressNumber({ target }: { target: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 600;
    const increment = target / (duration / 16);

    if (target === 0) {
      setValue(0);
      return;
    }

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target]);

  return <>{value}</>;
}

export function CalendarActiveStats({
  showTasks,
  showContent,
  activeTaskCount,
  activeContentCount,
  headerTextClass,
  size = 'xs',
}: {
  showTasks: boolean;
  showContent: boolean;
  activeTaskCount: number;
  activeContentCount: number;
  headerTextClass: string;
  size?: 'xs' | 'sm';
}) {
  if (!showTasks && !showContent) return null;
  const textSize = size === 'sm' ? 'text-sm' : 'text-xs';
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${textSize} font-medium ${headerTextClass}`}
    >
      {showTasks ? (
        <span className="whitespace-nowrap">
          {activeTaskCount} task{activeTaskCount === 1 ? '' : 's'}
        </span>
      ) : null}
      {showTasks && showContent ? (
        <span className="opacity-70" aria-hidden>
          ·
        </span>
      ) : null}
      {showContent ? (
        <span className="whitespace-nowrap">
          {activeContentCount} content
        </span>
      ) : null}
    </div>
  );
}

export function CalendarProgressBar({
  progressPercent,
  headerTextClass,
  className = '',
  barWidthClass = 'flex-1',
}: {
  progressPercent: number;
  headerTextClass: string;
  className?: string;
  barWidthClass?: string;
}) {
  return (
    <div className={`flex items-center gap-2 pr-2 mt-0.5 ${className}`}>
      <div className={`relative h-1 ${barWidthClass} rounded-full overflow-hidden ${headerTextClass}`}>
        <div className="absolute inset-0 bg-white opacity-20" />
        <div
          className="relative h-full transition-all duration-500"
          style={{ width: `${progressPercent}%`, backgroundColor: 'currentColor' }}
        />
      </div>
      <span className={`text-[10px] font-bold ${headerTextClass} shrink-0`}>
        <AnimatedProgressNumber target={progressPercent} />%
      </span>
    </div>
  );
}

interface CalendarCardHeaderProps {
  name: string;
  logo?: string;
  color: string;
  progressPercent: number;
  scheduledHours?: number;
  activeTaskCount: number;
  activeContentCount: number;
  showTasks: boolean;
  showContent: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTitleClick: () => void;
  statusLabel?: string;
  completed?: boolean;
  headerActions?: ReactNode;
  compact?: boolean;
  hoursInline?: boolean;
}

export default function CalendarCardHeader({
  name,
  logo,
  color,
  progressPercent,
  scheduledHours,
  activeTaskCount,
  activeContentCount,
  showTasks,
  showContent,
  isExpanded,
  onToggleExpand,
  onTitleClick,
  statusLabel,
  completed,
  headerActions,
  compact = false,
  hoursInline = false,
}: CalendarCardHeaderProps) {
  const headerTextClass = getProjectCardHeaderTextClass(color);
  const logoSize = compact ? 28 : 32;
  const titleClass = compact ? 'text-sm font-bold' : 'text-xl font-bold';

  return (
    <div className={`flex items-start justify-between gap-2 min-w-0 ${compact ? '' : ''}`}>
      <button
        type="button"
        onClick={onTitleClick}
        className="flex items-start gap-2 min-w-0 flex-1 text-left"
      >
        <div
          className={`rounded-lg flex items-center justify-center font-bold overflow-hidden shrink-0 ${logo ? '' : headerTextClass}`}
          style={{
            width: logoSize,
            height: logoSize,
            ...(logo ? {} : { backgroundColor: color }),
          }}
        >
          {logo ? (
            <Image
              src={logo}
              alt=""
              width={logoSize}
              height={logoSize}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span className={compact ? 'text-xs' : 'text-sm'}>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4
              className={`${titleClass} truncate min-w-0 ${headerTextClass} ${completed ? 'line-through opacity-60' : ''}`}
            >
              {name}
            </h4>
            {hoursInline && scheduledHours != null && scheduledHours > 0 ? (
              <span className={`text-xs whitespace-nowrap ${headerTextClass} opacity-90`}>
                {scheduledHours}h
              </span>
            ) : null}
          </div>
          {!hoursInline && scheduledHours != null && scheduledHours > 0 ? (
            <p className={`text-xs font-medium mt-0.5 ${headerTextClass} opacity-90`}>
              Hours scheduled: {scheduledHours}h
            </p>
          ) : null}
          <CalendarProgressBar progressPercent={progressPercent} headerTextClass={headerTextClass} />
          <div className="mt-1">
            <CalendarActiveStats
              showTasks={showTasks}
              showContent={showContent}
              activeTaskCount={activeTaskCount}
              activeContentCount={activeContentCount}
              headerTextClass={headerTextClass}
              size={compact ? 'xs' : 'sm'}
            />
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        {headerActions}
        {statusLabel ? (
          <span
            className={`rounded-full font-medium text-white ${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
            style={{ backgroundColor: color }}
          >
            {statusLabel}
          </span>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className={`${headerTextClass} opacity-80 hover:opacity-100 transition-opacity ${compact ? 'px-1' : ''}`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
    </div>
  );
}

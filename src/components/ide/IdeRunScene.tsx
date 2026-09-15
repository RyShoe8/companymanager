'use client';

import { useEffect, useState } from 'react';
import type { IdeRunActivity } from '@/lib/ide/idePlan';

type Props = {
  activity: IdeRunActivity;
};

/** Light office diorama — CSS-only motion, zero model usage. */
export default function IdeRunScene({ activity }: Props) {
  const active = activity.busy || activity.phase === 'plan_ready' || activity.phase === 'building';
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const screenClass =
    activity.phase === 'error'
      ? 'bg-red-100'
      : activity.phase === 'plan_ready'
        ? 'bg-emerald-100'
        : activity.busy
          ? 'bg-sky-100'
          : 'bg-amber-50';

  return (
    <div
      className="flex h-[7.5rem] shrink-0 items-stretch gap-3 border-t border-border px-3 py-2"
      style={{ background: 'linear-gradient(180deg, #f7f4ef 0%, #efe8dc 100%)' }}
      aria-live="polite"
    >
      <div className="relative w-[11rem] shrink-0 overflow-hidden rounded-md border border-[#d6cbb8] bg-[#ebe3d4] shadow-sm">
        <div className="absolute inset-x-0 top-0 h-10 bg-[#e7ddd0]" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-[#d9cbb6]" />
        <div className="absolute bottom-7 left-2 h-5 w-3 rounded-t-full bg-emerald-600/80" />
        <div className="absolute bottom-6 left-2.5 h-2 w-2 rounded-full bg-emerald-700/70" />
        <div className="absolute bottom-5 left-6 right-3 h-2 rounded-sm bg-[#b08968]" />
        <div className="absolute bottom-3 left-7 h-2 w-1 bg-[#8b6b4a]" />
        <div className="absolute bottom-3 right-4 h-2 w-1 bg-[#8b6b4a]" />
        <div className="absolute bottom-4 right-1 h-4 w-3 rounded-t bg-[#6b7280]/80" />
        <div className="absolute bottom-7 left-1/2 w-14 -translate-x-1/2 rounded-sm border border-[#4b5563] bg-[#374151] p-0.5 shadow">
          <div className={`relative h-7 overflow-hidden rounded-[2px] ${screenClass}`}>
            {!reducedMotion && activity.busy ? (
              <div className="absolute inset-x-1 top-1 space-y-0.5">
                <div className="h-0.5 animate-pulse rounded bg-sky-500/70" />
                <div className="h-0.5 w-3/4 animate-pulse rounded bg-sky-400/60 [animation-delay:150ms]" />
                <div className="h-0.5 w-1/2 animate-pulse rounded bg-sky-400/50 [animation-delay:300ms]" />
              </div>
            ) : null}
            {!reducedMotion && activity.phase === 'plan_ready' ? (
              <div className="flex h-full items-center justify-center text-[10px] font-bold text-emerald-700">
                ✓
              </div>
            ) : null}
            {activity.phase === 'idle' && !activity.busy ? (
              <div className="flex h-full items-center justify-center text-[8px] text-amber-700/70">
                zzz
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={`absolute right-2 top-1 h-2 w-2 rounded-full ${active ? 'bg-amber-300' : 'bg-amber-200/70'}`}
        />
        <div className="absolute right-2.5 top-3 h-4 w-0.5 bg-[#9ca3af]" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#8a7a63]">Office</p>
        <p className="truncate text-sm text-text-primary">{activity.label}</p>
        <p className="truncate text-[11px] text-text-secondary">
          {activity.busy
            ? 'Live request — no extra model usage for this scene'
            : 'Client-only diorama'}
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { IdeRunActivity } from '@/lib/ide/idePlan';
import type { IdeDioramaDesk } from '@/lib/ide/ideChatThreadCache';

type Props = {
  activity: IdeRunActivity;
};

function PixelDesk({
  desk,
  busy,
  reducedMotion,
}: {
  desk: IdeDioramaDesk;
  busy: boolean;
  reducedMotion: boolean;
}) {
  const typing = busy && desk.active && !reducedMotion;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <p
        className="mb-1 max-w-full truncate px-0.5 font-mono text-[9px] leading-tight text-[#3f3a32]"
        title={desk.modelLabel}
      >
        {desk.modelLabel}
      </p>
      <div
        className="relative h-[4.5rem] w-full max-w-[7.5rem] overflow-hidden rounded-sm border-2 border-[#2a2a2a]"
        style={{
          imageRendering: 'pixelated',
          background:
            'repeating-linear-gradient(0deg, #c4b59a 0 8px, #b8a88c 8px 16px), repeating-linear-gradient(90deg, #d2c4a8 0 8px, #cbb99a 8px 16px)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-8 bg-[#e8dcc8]" />
        <div className="absolute inset-x-0 top-0 h-1 bg-[#d2c2a6]" />
        <div className="absolute inset-x-0 bottom-0 h-5 bg-[#8f7352]" />
        <div
          className="absolute inset-x-0 bottom-0 h-5 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(#0000 50%, #0002 50%), linear-gradient(90deg, #0000 50%, #0002 50%)',
            backgroundSize: '8px 8px',
          }}
        />
        <div className="absolute bottom-5 left-1 h-3 w-2 bg-[#2f6b3a]" />
        <div className="absolute bottom-4 left-1.5 h-1.5 w-1 bg-[#1f4d28]" />
        <div className="absolute bottom-4 right-1 h-3 w-2.5 rounded-t-sm bg-[#4b5563]" />
        <div className="absolute bottom-4 left-3 right-3 h-1.5 bg-[#6b4423]" />
        <div className="absolute bottom-2.5 left-4 h-1.5 w-1 bg-[#4a2f18]" />
        <div className="absolute bottom-2.5 right-4 h-1.5 w-1 bg-[#4a2f18]" />
        <div className="absolute bottom-5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-sm bg-[#f0c7a0]" />
        <div
          className={`absolute bottom-3.5 left-1/2 h-2.5 w-3 -translate-x-1/2 bg-[#3b82f6] ${
            typing ? 'animate-pulse' : ''
          }`}
        />
        {typing ? (
          <>
            <div className="absolute bottom-[1.15rem] left-[42%] h-0.5 w-2 origin-left animate-bounce bg-[#f0c7a0]" />
            <div className="absolute bottom-[1.15rem] right-[42%] h-0.5 w-2 origin-right animate-bounce bg-[#f0c7a0] [animation-delay:120ms]" />
          </>
        ) : (
          <div className="absolute bottom-[1.15rem] left-1/2 h-0.5 w-3 -translate-x-1/2 bg-[#f0c7a0]" />
        )}
        <div className="absolute bottom-5 left-1/2 w-8 -translate-x-1/2 border border-[#111] bg-[#1f2937] p-px">
          <div
            className={`relative h-4 overflow-hidden ${
              typing ? 'bg-[#0ea5e9]' : desk.active ? 'bg-[#0369a1]' : 'bg-[#334155]'
            }`}
          >
            {typing ? (
              <div className="absolute inset-x-0.5 top-0.5 space-y-0.5">
                <div className="h-0.5 animate-pulse bg-white/80" />
                <div className="h-0.5 w-3/4 animate-pulse bg-white/60 [animation-delay:100ms]" />
                <div className="h-0.5 w-1/2 animate-pulse bg-white/50 [animation-delay:200ms]" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-[7px] text-white/70">
                {desk.active ? '…' : 'z'}
              </div>
            )}
          </div>
        </div>
        <div
          className={`absolute right-1 top-1 h-1.5 w-1.5 ${
            busy && desk.active ? 'bg-[#fde047]' : 'bg-[#fef3c7]'
          }`}
        />
      </div>
    </div>
  );
}

/** Pixel-art office diorama — client-only, zero model usage. */
export default function IdeRunScene({ activity }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const desks =
    activity.desks && activity.desks.length > 0
      ? activity.desks
      : [{ role: 'direct' as const, modelLabel: 'Model', active: activity.busy }];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <div
      className="flex h-36 shrink-0 flex-col border-t-2 border-[#2a2a2a] px-2 py-1.5"
      style={{
        imageRendering: 'pixelated',
        background: 'linear-gradient(180deg, #efe6d6 0%, #e4d7c2 55%, #d9cbb3 100%)',
      }}
      aria-live="polite"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[10px] font-bold uppercase tracking-wide text-[#3f3a32]">
          {desks.length > 1 ? 'Team floor' : desks[0]?.modelLabel ?? 'Desk'}
        </p>
        <p className="truncate font-mono text-[10px] text-[#5c5346]">{activity.label}</p>
      </div>
      <div className="flex min-h-0 flex-1 items-end gap-2 overflow-hidden">
        {desks.map((desk) => (
          <PixelDesk
            key={`${desk.role}-${desk.modelLabel}`}
            desk={desk}
            busy={activity.busy}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </div>
  );
}

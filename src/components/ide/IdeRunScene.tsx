'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { IdeRunActivity } from '@/lib/ide/idePlan';
import type { IdeDioramaDesk } from '@/lib/ide/ideChatThreadCache';

type Props = {
  activity: IdeRunActivity;
};

/** Isometric workstation — no window frame; sits on shared floor. */
function IsoDesk({
  desk,
  busy,
  reducedMotion,
  style,
}: {
  desk: IdeDioramaDesk;
  busy: boolean;
  reducedMotion: boolean;
  style: CSSProperties;
}) {
  const typing = busy && desk.active && !reducedMotion;
  return (
    <div className="absolute flex flex-col items-center" style={style}>
      <p
        className="mb-0.5 max-w-[5.5rem] truncate font-mono text-[8px] leading-tight text-text-secondary"
        title={desk.modelLabel}
      >
        {desk.modelLabel}
      </p>
      <div className="relative h-14 w-[4.75rem]" style={{ imageRendering: 'pixelated' }}>
        {/* Desk top (isometric parallelogram) */}
        <div
          className="absolute bottom-5 left-1 right-1 h-3 border border-border-dark bg-background-elevated"
          style={{ transform: 'skewX(-28deg)' }}
        />
        <div className="absolute bottom-2 left-2 h-3 w-1 bg-border" />
        <div className="absolute bottom-2 right-2 h-3 w-1 bg-border" />
        {/* Chair */}
        <div
          className="absolute bottom-1 left-1/2 h-2.5 w-3 -translate-x-1/2 border border-border bg-background-card"
          style={{ transform: 'translateX(-50%) skewX(-12deg)' }}
        />
        {/* Figure */}
        <div className="absolute bottom-4 left-1/2 h-2 w-2 -translate-x-1/2 rounded-sm bg-[#c9b8a0]" />
        <div
          className={`absolute bottom-2.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 bg-secondary ${
            typing ? 'animate-pulse' : ''
          }`}
        />
        {typing ? (
          <>
            <div className="absolute bottom-[0.85rem] left-[38%] h-0.5 w-1.5 origin-left animate-bounce bg-[#c9b8a0]" />
            <div className="absolute bottom-[0.85rem] right-[38%] h-0.5 w-1.5 origin-right animate-bounce bg-[#c9b8a0] [animation-delay:120ms]" />
          </>
        ) : (
          <div className="absolute bottom-[0.85rem] left-1/2 h-0.5 w-2.5 -translate-x-1/2 bg-[#c9b8a0]" />
        )}
        {/* Monitor */}
        <div className="absolute bottom-5 left-1/2 w-7 -translate-x-1/2 border border-border-dark bg-background p-px">
          <div
            className={`relative h-3.5 overflow-hidden ${
              typing ? 'bg-primary' : desk.active ? 'bg-primary-dark' : 'bg-background-elevated'
            }`}
          >
            {typing ? (
              <div className="absolute inset-x-0.5 top-0.5 space-y-0.5">
                <div className="h-0.5 animate-pulse bg-white/80" />
                <div className="h-0.5 w-3/4 animate-pulse bg-white/60 [animation-delay:100ms]" />
                <div className="h-0.5 w-1/2 animate-pulse bg-white/50 [animation-delay:200ms]" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-[6px] text-text-muted">
                {desk.active ? '…' : 'z'}
              </div>
            )}
          </div>
        </div>
        <div
          className={`absolute right-0.5 top-0 h-1.5 w-1.5 ${
            busy && desk.active ? 'bg-warning' : 'bg-text-muted'
          }`}
        />
      </div>
    </div>
  );
}

function deskPositions(count: number): CSSProperties[] {
  if (count <= 1) {
    return [{ left: '42%', bottom: '18%' }];
  }
  if (count === 2) {
    return [
      { left: '22%', bottom: '22%' },
      { left: '52%', bottom: '14%' },
    ];
  }
  return [
    { left: '10%', bottom: '26%' },
    { left: '38%', bottom: '16%' },
    { left: '64%', bottom: '24%' },
  ];
}

/** Full-bleed isometric office — client-only, zero model usage. */
export default function IdeRunScene({ activity }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const desks =
    activity.desks && activity.desks.length > 0
      ? activity.desks
      : [{ role: 'direct' as const, modelLabel: 'Model', active: activity.busy }];
  const positions = deskPositions(desks.length);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <div
      className="relative h-36 shrink-0 overflow-hidden border-t border-border bg-background-card"
      style={{ imageRendering: 'pixelated' }}
      aria-live="polite"
    >
      {/* Back wall */}
      <div
        className="absolute inset-x-0 top-0 h-[42%] bg-background"
        style={{
          backgroundImage:
            'linear-gradient(90deg, transparent 0, transparent 48%, var(--border) 48%, var(--border) 49%, transparent 49%), linear-gradient(180deg, var(--background-elevated) 0%, var(--background) 100%)',
        }}
      />
      {/* Side wall plane */}
      <div
        className="absolute left-0 top-0 h-[42%] w-[18%] border-r border-border bg-background-elevated/80"
        style={{ clipPath: 'polygon(0 0, 100% 8%, 100% 100%, 0 92%)' }}
      />
      {/* Window on back wall */}
      <div className="absolute left-[28%] top-[8%] h-7 w-16 border border-border bg-primary/10">
        <div className="absolute inset-0.5 border border-border/60" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      </div>
      <div className="absolute right-[22%] top-[10%] h-6 w-10 border border-border bg-primary/10">
        <div className="absolute inset-0.5 border border-border/60" />
      </div>

      {/* Isometric floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%] origin-bottom"
        style={{
          backgroundColor: 'var(--background-elevated)',
          backgroundImage: `
            linear-gradient(30deg, var(--border) 1px, transparent 1px),
            linear-gradient(150deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: '18px 10px',
          transform: 'perspective(220px) rotateX(48deg)',
          transformOrigin: '50% 100%',
        }}
      />

      {/* Room props */}
      <div className="absolute bottom-[28%] left-[4%] h-8 w-3 border border-border bg-background">
        <div className="absolute inset-x-0 top-1 h-px bg-border" />
        <div className="absolute inset-x-0 top-3 h-px bg-border" />
      </div>
      <div className="absolute bottom-[30%] left-[9%] h-4 w-2.5">
        <div className="absolute bottom-0 left-1/2 h-1.5 w-1 -translate-x-1/2 bg-border-dark" />
        <div className="absolute bottom-1.5 left-0 right-0 h-2.5 rounded-t-sm bg-success" />
      </div>
      <div className="absolute bottom-[32%] right-[6%] h-6 w-2 bg-border">
        <div className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-warning/80" />
      </div>

      {desks.map((desk, index) => (
        <IsoDesk
          key={`${desk.role}-${desk.modelLabel}`}
          desk={desk}
          busy={activity.busy}
          reducedMotion={reducedMotion}
          style={positions[index] ?? positions[positions.length - 1]!}
        />
      ))}

      {/* Ticker */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-2 pt-1">
        <p className="truncate font-mono text-[9px] font-semibold uppercase tracking-wide text-text-muted">
          {desks.length > 1 ? 'Team floor' : desks[0]?.modelLabel ?? 'Desk'}
        </p>
        <p className="max-w-[65%] truncate text-right font-mono text-[9px] text-text-secondary">
          {activity.label}
        </p>
      </div>
    </div>
  );
}

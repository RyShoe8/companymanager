import Image from 'next/image';
import { cn } from '@/lib/utils';
import { DEMO_ORG } from './mockData';

type MarketingChromeProps = {
  children: React.ReactNode;
  activePhase?: 'Plan' | 'Build' | 'Run';
  showLensBar?: boolean;
  className?: string;
};

const PHASES = ['Plan', 'Build', 'Run'] as const;
const LENSES = ['Schedule', 'Agenda', 'Team'];

export default function MarketingChrome({
  children,
  activePhase = 'Build',
  showLensBar = true,
  className,
}: MarketingChromeProps) {
  return (
    <div
      className={cn(
        'bg-background text-text-primary pointer-events-none select-none',
        className
      )}
      aria-hidden
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-background-card/80">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src="/images/nucleas-logo.png"
            alt=""
            width={24}
            height={24}
            className="rounded-md shrink-0"
          />
          <span className="text-xs font-semibold text-text-primary truncate">Nucleas</span>
          <span className="text-[10px] text-text-muted hidden sm:inline">·</span>
          <span className="text-[10px] text-text-secondary truncate hidden sm:inline">{DEMO_ORG}</span>
        </div>
        <div className="flex items-center gap-1">
          {PHASES.map((phase) => (
            <span
              key={phase}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-md border',
                phase === activePhase
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'text-text-muted border-transparent'
              )}
            >
              {phase}
            </span>
          ))}
        </div>
      </div>

      {showLensBar && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 bg-background/60">
          {LENSES.map((lens, i) => (
            <span
              key={lens}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-md',
                i === 0 ? 'bg-white/10 text-text-primary' : 'text-text-muted'
              )}
            >
              {lens}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-text-muted">This Week</span>
        </div>
      )}

      {children}
    </div>
  );
}

import { cn } from '@/lib/utils';
import MarketingChrome from './MarketingChrome';
import { DEMO_SMART_BUTTONS } from './mockData';

const buttonColorClasses = {
  primary: 'bg-primary/15 text-primary border-primary/30',
  secondary: 'bg-secondary/15 text-secondary border-secondary/30',
  accent: 'bg-accent/15 text-accent border-accent/30',
};

const ASSET_TYPES = [
  { label: 'Homepage mockup.png', type: 'image' },
  { label: 'Demo recording.webm', type: 'video' },
  { label: 'Launch brief.docx', type: 'doc' },
  { label: 'Analytics setup.pdf', type: 'pdf' },
];

export default function ToolsScreenshot() {
  return (
    <MarketingChrome activePhase="Build" showLensBar={false}>
      <div className="p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Screenshot capture */}
          <div className="rounded-lg border border-border bg-background-card p-3 space-y-2">
            <div className="text-[10px] font-semibold text-text-primary">Screenshot Capture</div>
            <div className="rounded-md border border-border bg-background h-20 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
              <div className="w-6 h-6 border-2 border-primary rounded-sm relative z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-primary rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <span className="flex-1 text-center text-[10px] py-1.5 rounded-lg bg-primary text-nucleas-ink font-semibold">
                Capture
              </span>
              <span className="flex-1 text-center text-[10px] py-1.5 rounded-lg border border-border text-text-secondary">
                Save to Project
              </span>
            </div>
          </div>

          {/* Recording */}
          <div className="rounded-lg border border-border bg-background-card p-3 space-y-2">
            <div className="text-[10px] font-semibold text-text-primary">Screen Recording</div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-error/20 border border-error/40 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-error" />
              </span>
              <span className="text-[11px] font-mono text-text-primary">00:01:24</span>
            </div>
            <div className="flex items-end gap-0.5 h-8">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-primary to-accent"
                  style={{ height: `${20 + Math.sin(i * 0.8) * 12 + 8}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Smart buttons */}
        <div>
          <div className="text-[10px] font-semibold text-text-primary mb-2">Smart Buttons</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {DEMO_SMART_BUTTONS.map((btn) => (
              <div
                key={btn.label}
                className={cn(
                  'rounded-lg border p-2 text-center text-[9px] font-medium',
                  buttonColorClasses[btn.color]
                )}
              >
                {btn.label}
              </div>
            ))}
          </div>
        </div>

        {/* Asset library */}
        <div>
          <div className="text-[10px] font-semibold text-text-primary mb-2">Asset Library</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ASSET_TYPES.map((asset) => (
              <div
                key={asset.label}
                className="rounded-lg border border-border bg-background p-2 flex items-center gap-2"
              >
                <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[8px] text-text-muted uppercase">
                  {asset.type.slice(0, 3)}
                </span>
                <span className="text-[9px] text-text-secondary truncate">{asset.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}

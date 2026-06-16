import MarketingChrome from './MarketingChrome';
import { Avatar, ContentStatusBadge } from './MarketingBadges';
import { DEMO_CONTENT } from './mockData';

const CHANNELS = ['Blog', 'LinkedIn', 'Instagram', 'Newsletter'];

export default function ContentScreenshot() {
  return (
    <MarketingChrome activePhase="Plan">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Content Planning</h3>
          <span className="text-[10px] text-text-muted">June 2026</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CHANNELS.map((channel) => {
            const items = DEMO_CONTENT.filter((c) => c.channel === channel);
            return (
              <div key={channel} className="min-w-0">
                <div className="text-[10px] font-semibold text-text-secondary mb-2 pb-1 border-b border-border/50">
                  {channel}
                </div>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-border bg-background-card p-2 space-y-1.5"
                    >
                      <div className="text-[10px] font-medium text-text-primary leading-tight">{item.title}</div>
                      <div className="flex items-center justify-between gap-1">
                        <ContentStatusBadge status={item.status} />
                        <Avatar initials={item.assigneeInitials} />
                      </div>
                      <div className="text-[9px] text-text-muted">{item.date}</div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-[9px] text-text-muted italic py-2">No items</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MarketingChrome>
  );
}

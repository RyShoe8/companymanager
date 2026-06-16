import MarketingChrome from './MarketingChrome';
import { Avatar, CapacityBar, RoleBadge } from './MarketingBadges';
import { CALENDAR_DAYS, DEMO_EMPLOYEES, DEMO_PROJECTS } from './mockData';

export default function HeroWorkspaceScreenshot() {
  return (
    <MarketingChrome activePhase="Build">
      <div className="flex min-h-[280px]">
        {/* Calendar area */}
        <div className="flex-1 p-3 overflow-hidden">
          <div className="grid grid-cols-5 gap-1.5">
            {CALENDAR_DAYS.map((day, colIdx) => (
              <div key={day} className="min-w-0">
                <div className="text-[9px] font-medium text-text-muted text-center mb-1.5 pb-1 border-b border-border/50">
                  {day}
                </div>
                <div className="space-y-1.5">
                  {DEMO_PROJECTS.filter((_, i) => i === colIdx % DEMO_PROJECTS.length).map((project) => (
                    <div
                      key={`${day}-${project.id}`}
                      className="rounded-lg p-2 border border-white/10 bg-background-card/80"
                      style={{ borderLeftColor: project.color, borderLeftWidth: 3 }}
                    >
                      <div className="text-[10px] font-medium text-text-primary truncate">{project.name}</div>
                      <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${project.progress}%`, backgroundColor: project.color }}
                        />
                      </div>
                      <div className="flex gap-0.5 mt-1.5">
                        {DEMO_EMPLOYEES.slice(0, 2).map((e) => (
                          <Avatar key={e.id} initials={e.initials} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee sidebar snippet */}
        <div className="w-[140px] shrink-0 border-l border-border bg-background-card/40 p-2 space-y-2 hidden sm:block">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Team</div>
          {DEMO_EMPLOYEES.slice(0, 3).map((emp) => (
            <div key={emp.id} className="rounded-lg border border-border/60 bg-background p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Avatar initials={emp.initials} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium text-text-primary truncate">{emp.name.split(' ')[0]}</div>
                  <div className="flex gap-0.5 flex-wrap mt-0.5">
                    <RoleBadge role={emp.role} />
                  </div>
                </div>
              </div>
              <CapacityBar hours={emp.weeklyHours} capacity={emp.capacity} />
            </div>
          ))}
        </div>
      </div>
    </MarketingChrome>
  );
}

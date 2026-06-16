import MarketingChrome from './MarketingChrome';
import { Avatar, CapacityBar, EmployeeTypeBadge, RoleBadge } from './MarketingBadges';
import { DEMO_EMPLOYEES } from './mockData';

export default function TeamScreenshot() {
  return (
    <MarketingChrome activePhase="Run" showLensBar={false}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Team Overview & Utilization</h3>
          <span className="text-[10px] text-text-muted">This Week</span>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Members', value: '4' },
            { label: 'Active Projects', value: '3' },
            { label: 'Weekly Capacity', value: '150h' },
            { label: 'Avg. Utilization', value: '82%' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-background-card/60 p-2 text-center">
              <div className="text-sm font-bold text-primary">{stat.value}</div>
              <div className="text-[9px] text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Employee grid */}
        <div className="grid grid-cols-2 gap-2">
          {DEMO_EMPLOYEES.map((emp) => (
            <div key={emp.id} className="rounded-lg border border-border bg-background-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Avatar initials={emp.initials} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-text-primary truncate">{emp.name}</div>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    <RoleBadge role={emp.role} />
                    <EmployeeTypeBadge type={emp.employeeType} />
                  </div>
                </div>
              </div>
              <CapacityBar hours={emp.weeklyHours} capacity={emp.capacity} />
              <div className="flex flex-wrap gap-1">
                {emp.projects.map((p) => (
                  <span
                    key={p}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-text-secondary border border-border/50 truncate max-w-full"
                  >
                    {p.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </MarketingChrome>
  );
}

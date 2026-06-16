import MarketingChrome from './MarketingChrome';
import { Avatar } from './MarketingBadges';
import { CALENDAR_DAYS, DEMO_MEETINGS, DEMO_PROJECTS } from './mockData';

const AGENDA_ITEMS = [
  'Review sprint goals and blockers',
  'Demo new homepage designs',
  'Discuss Q2 content calendar',
];

export default function MeetingsScreenshot() {
  const featured = DEMO_MEETINGS[1];

  return (
    <MarketingChrome activePhase="Run">
      <div className="flex min-h-[280px]">
        {/* Calendar */}
        <div className="flex-1 p-3">
          <div className="grid grid-cols-5 gap-1">
            {CALENDAR_DAYS.map((day) => (
              <div key={day} className="text-[9px] font-medium text-text-muted text-center pb-1 border-b border-border/50">
                {day}
              </div>
            ))}
            {CALENDAR_DAYS.map((day, i) => {
              const meeting = DEMO_MEETINGS.find((m) => m.day === ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]);
              return (
                <div key={`col-${day}`} className="min-h-[80px] p-0.5">
                  {meeting && (
                    <div
                      className="rounded-md p-1.5 text-[9px] border border-white/10"
                      style={{ backgroundColor: `${meeting.color}22`, borderLeftColor: meeting.color, borderLeftWidth: 2 }}
                    >
                      <div className="font-medium text-text-primary truncate">{meeting.title}</div>
                      <div className="text-text-muted mt-0.5">{meeting.time}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Meeting detail panel */}
        <div className="w-[160px] shrink-0 border-l border-border bg-background-card/40 p-3 space-y-3 hidden sm:block">
          <div>
            <div className="text-[11px] font-semibold text-text-primary">{featured.title}</div>
            <div className="text-[10px] text-text-muted mt-0.5">Wed · 2:00 PM</div>
          </div>
          <button
            type="button"
            className="w-full text-[10px] font-semibold py-1.5 rounded-lg bg-primary text-nucleas-ink"
            tabIndex={-1}
          >
            Join Call
          </button>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">Linked Project</div>
            <span
              className="text-[10px] px-2 py-0.5 rounded-md inline-block"
              style={{ backgroundColor: `${DEMO_PROJECTS[1].color}22`, color: DEMO_PROJECTS[1].color }}
            >
              {featured.project}
            </span>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">Attendees</div>
            <div className="flex -space-x-1">
              {['AC', 'JL', 'SR', 'PP'].map((initials) => (
                <Avatar key={initials} initials={initials} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">Agenda</div>
            <ol className="space-y-1">
              {AGENDA_ITEMS.map((item, i) => (
                <li key={item} className="text-[9px] text-text-secondary flex gap-1">
                  <span className="text-primary">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}

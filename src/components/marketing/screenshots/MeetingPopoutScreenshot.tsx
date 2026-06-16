'use client';

import Button from '@/components/ui/Button';
import MeetingProjectInsights from '@/components/scheduling/MeetingProjectInsights';
import { MARKETING_MEETING_DETAIL } from '@/lib/marketing/marketingFixtures';
import { getProjectStatusDisplayLabel } from '@/lib/utils/statusMapping';

function formatMeetingRange(start: Date, end: Date): string {
  return `${start.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export default function MeetingPopoutScreenshot() {
  const detail = MARKETING_MEETING_DETAIL;
  const meetingStart = new Date(detail.meeting.start);
  const meetingEnd = new Date(detail.meeting.end);
  const block = detail.projects[0];

  return (
    <div className="bg-background text-text-primary pointer-events-none select-none min-h-[420px] px-4 py-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="font-bold text-xl">{detail.meeting.title}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {formatMeetingRange(meetingStart, meetingEnd)}
            </p>
            <div className="mt-3 text-sm text-text-secondary">
              <p className="text-xs uppercase tracking-wide text-text-muted mb-1">Invitees</p>
              <p>{detail.invitees.employees.map((e) => e.name).join(', ')}</p>
            </div>
          </div>
          {detail.meeting.joinUrl ? (
            <Button type="button" size="sm" variant="secondary" tabIndex={-1}>
              Join Call — Google Meet
            </Button>
          ) : null}
        </header>

        {block ? (
          <section className="rounded-lg border border-border bg-background-card overflow-hidden">
            <div className="w-full flex items-center gap-3 px-4 py-3 text-left">
              {block.color ? (
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: block.color }}
                />
              ) : null}
              <span className="font-semibold flex-1">{block.name}</span>
              <span className="text-xs shrink-0 text-text-muted">
                {getProjectStatusDisplayLabel(block.resources.status)}
              </span>
            </div>
            <div className="px-4 pb-4 border-t border-border space-y-4">
              <MeetingProjectInsights resources={block.resources} />
              {block.tasks.length > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-wide mb-2 text-text-muted">Tasks</p>
                  <ul className="space-y-2">
                    {block.tasks.slice(0, 3).map((task) => (
                      <li
                        key={task.taskId}
                        className="rounded border border-border bg-background-elevated/40 px-3 py-2 text-sm"
                      >
                        {task.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {block.contentItems.length > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-wide mb-2 text-text-muted">Content</p>
                  <ul className="space-y-2">
                    {block.contentItems.slice(0, 2).map((item) => (
                      <li
                        key={item.contentItemId}
                        className="rounded border border-border bg-background-elevated/40 px-3 py-2 text-sm"
                      >
                        {item.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

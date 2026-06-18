'use client';

import type { ClientImpactReportData } from '@/lib/clients/buildClientImpactReport';
import { formatDate } from '@/lib/utils/dateUtils';

interface ClientImpactReportViewProps {
  data: ClientImpactReportData;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center print:border-gray-300">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function ClientImpactReportView({ data }: ClientImpactReportViewProps) {
  const accent = data.client.color || '#3b82f6';

  return (
    <div className="impact-report-body bg-white text-gray-900 print:bg-white">
      <header className="mb-8 pb-6 border-b border-gray-200" style={{ borderBottomColor: `${accent}33` }}>
        <div className="flex items-start gap-4">
          {data.client.logo ? (
            <img src={data.client.logo} alt="" className="h-14 w-auto object-contain" />
          ) : (
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0"
              style={{ backgroundColor: accent }}
            >
              {data.client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.client.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Impact Report · {data.periodLabel}</p>
            {data.client.domain && <p className="text-sm text-gray-400 mt-0.5">{data.client.domain}</p>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="Tasks completed" value={data.summary.tasksCompleted} />
        <StatCard label="Content published" value={data.summary.contentPublished} />
        <StatCard label="Meetings held" value={data.summary.meetingsHeld} />
        <StatCard label="Hours (est.)" value={data.summary.hoursEstimated} />
      </div>

      <section className="mb-8 print:break-inside-avoid">
        <h2 className="text-lg font-semibold mb-3" style={{ color: accent }}>
          Work completed
        </h2>
        {data.tasks.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No completed tasks this period.</p>
        ) : (
          <ul className="space-y-2">
            {data.tasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{task.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{task.projectName}</p>
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0">
                  {task.completedAt ? formatDate(task.completedAt) : '—'}
                  {task.estimatedHours != null && <div>{task.estimatedHours}h</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 print:break-inside-avoid">
        <h2 className="text-lg font-semibold mb-3" style={{ color: accent }}>
          Content delivered
        </h2>
        {data.content.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No published content this period.</p>
        ) : (
          <ul className="space-y-2">
            {data.content.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.channel} · {item.projectName}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0">
                  {item.statusPublishedAt
                    ? formatDate(item.statusPublishedAt)
                    : item.publishDate
                      ? formatDate(item.publishDate)
                      : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 print:break-inside-avoid">
        <h2 className="text-lg font-semibold mb-3" style={{ color: accent }}>
          Meetings
        </h2>
        {data.meetings.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No client meetings this period.</p>
        ) : (
          <ul className="space-y-2">
            {data.meetings.map((m) => (
              <li key={m.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="font-medium text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(m.start)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="print:break-inside-avoid">
        <h2 className="text-lg font-semibold mb-3" style={{ color: accent }}>
          Active projects
        </h2>
        {data.projects.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No active deliverable projects.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.projects.map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500 mt-1 capitalize">
                  {p.status.replace(/-/g, ' ')} · {p.category} · {p.openTaskCount} open{' '}
                  {p.openTaskCount === 1 ? 'task' : 'tasks'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

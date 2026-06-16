import { cn } from '@/lib/utils';
import type { DemoEmployee, DemoTask } from './mockData';

const badgeBase = 'text-[10px] font-medium px-1.5 py-0.5 rounded-md border shrink-0';

export function RoleBadge({ role }: { role: DemoEmployee['role'] }) {
  const cls =
    role === 'Administrator'
      ? 'bg-amber-500/25 text-amber-300 border-amber-400/40'
      : role === 'Manager'
        ? 'bg-blue-500/25 text-blue-300 border-blue-400/40'
        : 'bg-white/10 text-text-primary border-white/20';
  return <span className={cn(badgeBase, cls)}>{role}</span>;
}

export function EmployeeTypeBadge({ type }: { type: DemoEmployee['employeeType'] }) {
  const cls =
    type === 'full-time'
      ? 'bg-sky-500/25 text-sky-300 border-sky-400/40'
      : type === 'part-time'
        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40'
        : 'bg-violet-500/25 text-violet-300 border-violet-400/40';
  const label = type === 'full-time' ? 'Full-Time' : type === 'part-time' ? 'Part-Time' : 'Contractor';
  return <span className={cn(badgeBase, cls)}>{label}</span>;
}

export function TaskStatusBadge({ status }: { status: DemoTask['status'] }) {
  const cls =
    status === 'completed'
      ? 'bg-success/20 text-success border-success/30'
      : status === 'in-review'
        ? 'bg-warning/20 text-warning border-warning/30'
        : 'bg-primary/20 text-primary border-primary/30';
  const label = status === 'completed' ? 'Done' : status === 'in-review' ? 'In Review' : 'Active';
  return <span className={cn(badgeBase, cls)}>{label}</span>;
}

export function ContentStatusBadge({ status }: { status: 'planned' | 'in-progress' | 'published' }) {
  const cls =
    status === 'published'
      ? 'bg-success/20 text-success border-success/30'
      : status === 'in-progress'
        ? 'bg-secondary/20 text-secondary border-secondary/30'
        : 'bg-white/10 text-text-secondary border-white/20';
  const label = status === 'published' ? 'Published' : status === 'in-progress' ? 'In Progress' : 'Planned';
  return <span className={cn(badgeBase, cls)}>{label}</span>;
}

export function Avatar({ initials, size = 'sm' }: { initials: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary/20 text-primary font-semibold border border-primary/30',
        size === 'sm' ? 'w-5 h-5 text-[8px]' : 'w-7 h-7 text-[10px]'
      )}
    >
      {initials}
    </span>
  );
}

export function CapacityBar({ hours, capacity }: { hours: number; capacity: number }) {
  const pct = Math.min(100, Math.round((hours / capacity) * 100));
  const barColor = pct >= 95 ? 'bg-warning' : pct >= 80 ? 'bg-primary' : 'bg-success';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-text-secondary">
        <span>Weekly hours</span>
        <span>
          {hours}/{capacity}h
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

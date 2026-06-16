import MarketingChrome from './MarketingChrome';
import { Avatar, TaskStatusBadge } from './MarketingBadges';
import {
  DEMO_MARKETING_STACK,
  DEMO_PROJECTS,
  DEMO_TASKS,
  DEMO_TECH_STACK,
} from './mockData';

export default function ProjectsScreenshot() {
  const project = DEMO_PROJECTS[0];

  return (
    <MarketingChrome activePhase="Build" showLensBar={false}>
      <div className="p-4 space-y-4">
        {/* Project header */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-nucleas-ink shrink-0"
            style={{ backgroundColor: project.color }}
          >
            WR
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">{project.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">
                {project.status}
              </span>
              <span className="text-[10px] text-text-muted">{project.progress}% complete</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 max-w-xs overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Task table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-3 py-1.5 bg-background-card/60 text-[9px] font-semibold uppercase tracking-wider text-text-muted border-b border-border">
            <span>Status</span>
            <span>Task</span>
            <span className="hidden sm:inline">Assignee</span>
            <span>Hours</span>
            <span>Due</span>
          </div>
          {DEMO_TASKS.map((task) => (
            <div
              key={task.name}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-3 py-2 border-b border-border/50 last:border-0 items-center"
            >
              <TaskStatusBadge status={task.status} />
              <span className="text-[11px] text-text-primary truncate">{task.name}</span>
              <span className="hidden sm:inline">
                <Avatar initials={task.assigneeInitials} />
              </span>
              <span className="text-[10px] text-text-secondary">{task.hours}h</span>
              <span className="text-[10px] text-text-muted">{task.due}</span>
            </div>
          ))}
        </div>

        {/* Stacks */}
        <div className="flex flex-wrap gap-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Tech Stack</div>
            <div className="flex flex-wrap gap-1">
              {DEMO_TECH_STACK.map((tech) => (
                <span
                  key={tech}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-secondary/15 text-secondary border border-secondary/25"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Marketing Stack</div>
            <div className="flex flex-wrap gap-1">
              {DEMO_MARKETING_STACK.map((tool) => (
                <span
                  key={tool}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/25"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}

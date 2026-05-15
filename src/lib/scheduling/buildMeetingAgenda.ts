import { IProject, IProjectTask } from '@/lib/models/Project';

export type AgendaTaskItem = {
  taskId: string;
  taskIndex: number;
  name: string;
  status?: string;
  startDate: string;
  endDate: string;
};

export type AgendaProjectBlock = {
  projectId: string;
  name: string;
  color?: string;
  tasks: AgendaTaskItem[];
};

export type MeetingAgendaPayload = {
  meeting: {
    title: string;
    start: string;
    end: string;
    agendaUrl: string;
  };
  projects: AgendaProjectBlock[];
};

function taskOverlapsWindow(task: IProjectTask, windowStart: Date, windowEnd: Date): boolean {
  const start = new Date(task.startDate);
  const end = new Date(task.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  return start <= windowEnd && end >= windowStart;
}

export function buildMeetingAgenda(
  meeting: { title: string; start: Date; end: Date; agendaUrl: string },
  projects: IProject[]
): MeetingAgendaPayload {
  const projectsBlocks: AgendaProjectBlock[] = [];

  for (const project of projects) {
    const pid = project._id.toString();
    const tasks: AgendaTaskItem[] = [];
    (project.tasks || []).forEach((task, taskIndex) => {
      if (!taskOverlapsWindow(task, meeting.start, meeting.end)) return;
      const taskId = task._id?.toString() || `${pid}-${taskIndex}`;
      tasks.push({
        taskId,
        taskIndex,
        name: task.name || 'Untitled Task',
        status: task.status,
        startDate: new Date(task.startDate).toISOString(),
        endDate: new Date(task.endDate).toISOString(),
      });
    });
    if (tasks.length > 0 || projects.length <= 8) {
      projectsBlocks.push({
        projectId: pid,
        name: project.name,
        color: project.color,
        tasks,
      });
    }
  }

  return {
    meeting: {
      title: meeting.title,
      start: meeting.start.toISOString(),
      end: meeting.end.toISOString(),
      agendaUrl: meeting.agendaUrl,
    },
    projects: projectsBlocks,
  };
}

export function formatAgendaPlainText(payload: MeetingAgendaPayload): string {
  const lines: string[] = [];
  lines.push(`Meeting: ${payload.meeting.title}`);
  lines.push(
    `When: ${new Date(payload.meeting.start).toLocaleString()} – ${new Date(payload.meeting.end).toLocaleString()}`
  );
  lines.push('');
  lines.push('Agenda:');
  for (const p of payload.projects) {
    lines.push(`\n• ${p.name}`);
    if (p.tasks.length === 0) {
      lines.push('  (no tasks in this meeting window)');
      continue;
    }
    for (const t of p.tasks) {
      lines.push(`  - ${t.name} (${t.status || 'active'})`);
    }
  }
  lines.push('');
  lines.push(`Open interactive agenda: ${payload.meeting.agendaUrl}`);
  return lines.join('\n');
}

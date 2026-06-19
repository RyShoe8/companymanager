import { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { publishDateOnViewDay, parseDateSafe } from '@/lib/utils/dateUtils';
import { isActiveWorkspaceTask } from '@/lib/workspace/activeWorkspaceItems';

export type AgendaTaskItem = {
  taskId: string;
  taskIndex: number;
  name: string;
  status?: string;
  startDate: string;
  endDate: string;
};

export type AgendaContentItem = {
  contentItemId: string;
  title: string;
  status?: string;
  channel?: string;
  publishDate?: string;
};

export type AgendaProjectBlock = {
  projectId: string;
  name: string;
  color?: string;
  tasks: AgendaTaskItem[];
  contentItems: AgendaContentItem[];
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
  const start = parseDateSafe(task.startDate);
  const end = parseDateSafe(task.endDate);
  if (!start || !end) return false;
  return start <= windowEnd && end >= windowStart;
}

export function buildMeetingAgenda(
  meeting: { title: string; start: Date; end: Date; agendaUrl: string },
  projects: IProject[],
  contentItems: IContentItem[] = []
): MeetingAgendaPayload {
  const projectsBlocks: AgendaProjectBlock[] = [];
  const meetingDay = new Date(meeting.start);
  meetingDay.setHours(0, 0, 0, 0);

  for (const project of projects) {
    const pid = project._id.toString();
    const tasks: AgendaTaskItem[] = [];
    (project.tasks || []).forEach((task, taskIndex) => {
      if (!isActiveWorkspaceTask(task)) return;
      if (!taskOverlapsWindow(task, meeting.start, meeting.end)) return;
      const taskId = task._id?.toString() || `${pid}-${taskIndex}`;
      const taskStart = parseDateSafe(task.startDate);
      const taskEnd = parseDateSafe(task.endDate);
      if (!taskStart || !taskEnd) return;
      tasks.push({
        taskId,
        taskIndex,
        name: task.name || 'Untitled Task',
        status: task.status,
        startDate: taskStart.toISOString(),
        endDate: taskEnd.toISOString(),
      });
    });

    const projectContent: AgendaContentItem[] = [];
    for (const item of contentItems) {
      if (item.projectId?.toString() !== pid) continue;
      if (!item.publishDate) continue;
      const pub = new Date(item.publishDate);
      if (isNaN(pub.getTime()) || !publishDateOnViewDay(meetingDay, pub)) continue;
      projectContent.push({
        contentItemId: item._id.toString(),
        title: item.title,
        status: item.status,
        channel: item.channel,
        publishDate: pub.toISOString(),
      });
    }

    if (tasks.length > 0 || projectContent.length > 0 || projects.length <= 8) {
      projectsBlocks.push({
        projectId: pid,
        name: project.name,
        color: project.color,
        tasks,
        contentItems: projectContent,
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

import { IProject, IProjectTask } from '@/lib/models/Project';
import { parseDateSafe } from '@/lib/utils/dateUtils';

/** Index of `task` in `project.tasks` for deep-links and schedule clicks. */
export function resolveTaskIndexInProject(project: IProject, task: IProjectTask): number {
    const tasks = project.tasks || [];
    const oid = (task as { _id?: { toString: () => string } | string })._id;
    if (oid != null) {
        const s = typeof oid === 'string' ? oid : oid.toString();
        const i = tasks.findIndex((t) => {
            const tid = (t as { _id?: { toString: () => string } | string })._id;
            if (tid == null) return false;
            return (typeof tid === 'string' ? tid : tid.toString()) === s;
        });
        if (i !== -1) return i;
    }
    const st = parseDateSafe(task.startDate)?.getTime() ?? 0;
    return tasks.findIndex(
      (t) => t.name === task.name && (parseDateSafe(t.startDate)?.getTime() ?? 0) === st
    );
}

import { IProject, IProjectTask } from '@/lib/models/Project';

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
    const st = new Date(task.startDate).getTime();
    return tasks.findIndex((t) => t.name === task.name && new Date(t.startDate).getTime() === st);
}

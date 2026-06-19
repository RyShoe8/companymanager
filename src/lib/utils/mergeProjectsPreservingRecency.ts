import type { IProject, IProjectTask } from '@/lib/models/Project';

function toMs(d: Date | string | undefined): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function maxTaskCompletedAtMs(tasks: IProjectTask[] | undefined): number {
  if (!tasks?.length) return 0;
  let max = 0;
  for (const task of tasks) {
    const ms = toMs(task.completedAt);
    if (ms > max) max = ms;
  }
  return max;
}

function projectRecencyMs(project: IProject): number {
  return Math.max(
    toMs((project as { updatedAt?: Date }).updatedAt ?? project.createdAt),
    maxTaskCompletedAtMs(project.tasks)
  );
}

/** Merge fetched projects with local state, keeping newer recency signals and task snapshots. */
export function mergeProjectsPreservingRecency(
  previous: IProject[],
  fetched: IProject[]
): IProject[] {
  const prevById = new Map(previous.map((p) => [p._id.toString(), p]));

  return fetched.map((fetchedProject) => {
    const id = fetchedProject._id.toString();
    const prevProject = prevById.get(id);
    if (!prevProject) return fetchedProject;

    const prevRecency = projectRecencyMs(prevProject);
    const fetchedRecency = projectRecencyMs(fetchedProject);

    if (prevRecency <= fetchedRecency) {
      return fetchedProject;
    }

    const prevUpdatedAt = toMs((prevProject as { updatedAt?: Date }).updatedAt);
    const fetchedUpdatedAt = toMs((fetchedProject as { updatedAt?: Date }).updatedAt);
    const mergedUpdatedAt =
      prevUpdatedAt >= fetchedUpdatedAt
        ? (prevProject as { updatedAt?: Date }).updatedAt ?? new Date(prevUpdatedAt)
        : (fetchedProject as { updatedAt?: Date }).updatedAt;

    const prevTaskCompletedMs = maxTaskCompletedAtMs(prevProject.tasks);
    const fetchedTaskCompletedMs = maxTaskCompletedAtMs(fetchedProject.tasks);
    const mergedTasks =
      prevTaskCompletedMs > fetchedTaskCompletedMs
        ? prevProject.tasks
        : fetchedProject.tasks;

    return {
      ...fetchedProject,
      updatedAt: mergedUpdatedAt,
      tasks: mergedTasks ?? fetchedProject.tasks,
    } as IProject;
  });
}

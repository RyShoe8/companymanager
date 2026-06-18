import { Types, type HydratedDocument } from 'mongoose';
import type { IClient } from '@/lib/models/Client';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import Project from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';
import Asset from '@/lib/models/Asset';
import Comment from '@/lib/models/Comment';
import Recording from '@/lib/models/Recording';
import { resolveClientHubProject } from '@/lib/clients/resolveClientHubProject';
import { clientIdStr } from '@/lib/clients/clientApiHelpers';
import { relinkTaskAssets } from '@/lib/assets/relinkTaskAssets';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';

export type TransitionHubWorkResult = {
  skipped: boolean;
  reason?: string;
  tasksMoved: number;
  contentMoved: number;
  assetsRelinked: number;
  commentsUpdated: number;
  recordingsUpdated: number;
  hubCreated: boolean;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Find the legacy 1:1 deliverable project (same name as client, linked via clientId). */
export function findLegacyDeliverableProject(
  client: Pick<IClient, '_id' | 'name'>,
  projects: IProject[]
): IProject | null {
  const clientId = clientIdStr(client._id as Types.ObjectId | string);
  const clientName = normalizeName(client.name);
  return (
    projects.find((p) => {
      if (p.projectType !== 'client') return false;
      if (clientIdStr(p.clientId as Types.ObjectId | string | undefined) !== clientId) return false;
      return normalizeName(p.name) === clientName;
    }) ?? null
  );
}

/** Merge source tasks onto hub tasks preserving subdocument _id values. */
export function mergeTasksPreservingIds(
  hubTasks: IProjectTask[] | undefined,
  sourceTasks: IProjectTask[] | undefined
): { hubTasks: IProjectTask[]; sourceTasksCleared: IProjectTask[]; movedCount: number } {
  const existing = [...(hubTasks ?? [])];
  const toMove = (sourceTasks ?? []).map((task) => {
    const maybeDoc = task as IProjectTask & { toObject?: () => IProjectTask };
    const plain = typeof maybeDoc.toObject === 'function' ? maybeDoc.toObject() : { ...task };
    return plain as IProjectTask;
  });
  return {
    hubTasks: [...existing, ...toMove],
    sourceTasksCleared: [],
    movedCount: toMove.length,
  };
}

export function taskIdStrings(tasks: IProjectTask[] | undefined): string[] {
  const ids: string[] = [];
  for (const task of tasks ?? []) {
    const raw = task._id;
    if (!raw) continue;
    const id = typeof raw === 'string' ? raw : raw.toString();
    if (Types.ObjectId.isValid(id)) ids.push(id);
  }
  return ids;
}

export async function ensureClientHubProject(
  client: Pick<IClient, '_id' | 'name' | 'color'>,
  ownerUserId: Types.ObjectId | string,
  projects: IProject[]
): Promise<{ hub: HydratedDocument<IProject>; created: boolean }> {
  const clientId = clientIdStr(client._id as Types.ObjectId | string);
  const existing = resolveClientHubProject(clientId, projects);
  if (existing) {
    const doc = await Project.findById(existing._id);
    if (doc) return { hub: doc, created: false };
  }

  const hub = await Project.create({
    userId: ownerUserId,
    name: client.name,
    projectType: 'client-admin',
    clientId: client._id,
    status: 'planning',
    category: 'generic',
    color: client.color || '#3b82f6',
    tasks: [],
  });

  return { hub, created: true };
}

export async function transitionDeliverableWorkToHub(params: {
  sourceProject: HydratedDocument<IProject>;
  hubProject: HydratedDocument<IProject>;
  orgUserIds: (Types.ObjectId | string)[];
  dryRun?: boolean;
}): Promise<TransitionHubWorkResult> {
  const { sourceProject, hubProject, orgUserIds, dryRun = false } = params;
  const sourceId = sourceProject._id;
  const hubId = hubProject._id;

  if (sourceId.toString() === hubId.toString()) {
    return {
      skipped: true,
      reason: 'Source and hub are the same project',
      tasksMoved: 0,
      contentMoved: 0,
      assetsRelinked: 0,
      commentsUpdated: 0,
      recordingsUpdated: 0,
      hubCreated: false,
    };
  }

  const sourceTaskCount = sourceProject.tasks?.length ?? 0;
  const contentCount = await ContentItem.countDocuments({ projectId: sourceId });

  if (sourceTaskCount === 0 && contentCount === 0) {
    return {
      skipped: true,
      reason: 'No tasks or content on deliverable project',
      tasksMoved: 0,
      contentMoved: 0,
      assetsRelinked: 0,
      commentsUpdated: 0,
      recordingsUpdated: 0,
      hubCreated: false,
    };
  }

  const { hubTasks, movedCount } = mergeTasksPreservingIds(
    hubProject.tasks as IProjectTask[] | undefined,
    sourceProject.tasks as IProjectTask[] | undefined
  );
  const movedTaskIds = taskIdStrings(sourceProject.tasks as IProjectTask[] | undefined);

  if (dryRun) {
    const assetCount = await Asset.countDocuments({
      userId: { $in: orgUserIds },
      linkedProjectId: sourceId,
    });
    const commentCount = await Comment.countDocuments({
      entityType: { $in: ['projectTask', 'project'] },
      entityId: sourceId,
    });
    const recordingCount =
      movedTaskIds.length > 0
        ? await Recording.countDocuments({
            projectId: sourceId,
            taskId: { $in: movedTaskIds.map((id) => new Types.ObjectId(id)) },
          })
        : 0;

    return {
      skipped: false,
      tasksMoved: movedCount,
      contentMoved: contentCount,
      assetsRelinked: assetCount,
      commentsUpdated: commentCount,
      recordingsUpdated: recordingCount,
      hubCreated: false,
    };
  }

  hubProject.tasks = hubTasks as typeof hubProject.tasks;
  hubProject.markModified('tasks');
  sourceProject.tasks = [];
  sourceProject.markModified('tasks');

  await Promise.all([hubProject.save(), sourceProject.save()]);

  const contentResult = await ContentItem.updateMany(
    { projectId: sourceId },
    { $set: { projectId: hubId } }
  );

  const assetResult = await Asset.updateMany(
    {
      userId: { $in: orgUserIds },
      linkedProjectId: sourceId,
    },
    { $set: { linkedProjectId: hubId } }
  );

  await relinkTaskAssets(hubId.toString(), hubProject.tasks ?? []);

  const commentResult = await Comment.updateMany(
    {
      entityType: { $in: ['projectTask', 'project'] },
      entityId: sourceId,
    },
    { $set: { entityId: hubId } }
  );

  let recordingsUpdated = 0;
  if (movedTaskIds.length > 0) {
    const recordingResult = await Recording.updateMany(
      {
        projectId: sourceId,
        taskId: { $in: movedTaskIds.map((id) => new Types.ObjectId(id)) },
      },
      { $set: { projectId: hubId } }
    );
    recordingsUpdated = recordingResult.modifiedCount ?? 0;
  }

  await Promise.all([
    touchProjectActivity(sourceId.toString()),
    touchProjectActivity(hubId.toString()),
  ]);

  return {
    skipped: false,
    tasksMoved: movedCount,
    contentMoved: contentResult.modifiedCount ?? 0,
    assetsRelinked: assetResult.modifiedCount ?? 0,
    commentsUpdated: commentResult.modifiedCount ?? 0,
    recordingsUpdated,
    hubCreated: false,
  };
}

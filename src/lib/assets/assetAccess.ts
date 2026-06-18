import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import Project from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';
import Employee from '@/lib/models/Employee';
import {
  getRecordingSessionContext,
  type RecordingSessionContext,
} from '@/lib/recordings/recordingAccess';
import {
  canUserContributeToProject,
  isTaskAssignedToEmployee,
} from '@/lib/utils/projectTeam';

export type AssetAccessScope = {
  accessibleProjectIds: string[];
  accessibleClientIds: string[];
  accessibleTaskIds: string[];
  accessibleContentItemIds: string[];
  accessibleLegacyTasks: { projectId: string; taskIndex: number }[];
};

export type AssetLinkFields = {
  linkedProjectId?: string | Types.ObjectId | null;
  linkedClientId?: string | Types.ObjectId | null;
  linkedProjectTaskId?: string | Types.ObjectId | null;
  linkedProjectTaskIndex?: number | null;
  linkedContentItemId?: string | Types.ObjectId | null;
};

export type AssetAccessRecord = AssetLinkFields & {
  userId?: string | Types.ObjectId;
};

function idStr(value: string | Types.ObjectId | null | undefined): string | null {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : value.toString();
}

function isClientLevelAsset(asset: AssetLinkFields): boolean {
  return !!idStr(asset.linkedClientId) && !idStr(asset.linkedProjectId) && !idStr(asset.linkedContentItemId);
}

function isProjectLevelAsset(asset: AssetLinkFields): boolean {
  if (!idStr(asset.linkedProjectId)) return false;
  if (idStr(asset.linkedContentItemId)) return false;
  if (idStr(asset.linkedProjectTaskId)) return false;
  if (asset.linkedProjectTaskIndex != null && asset.linkedProjectTaskIndex !== undefined) {
    return false;
  }
  return true;
}

export async function getAssetSessionContext(
  userId: string
): Promise<RecordingSessionContext | NextResponse> {
  return getRecordingSessionContext(userId);
}

export async function buildAssetAccessScope(
  ctx: RecordingSessionContext
): Promise<AssetAccessScope> {
  const accessibleProjectIds: string[] = [];
  const accessibleTaskIds: string[] = [];
  const accessibleLegacyTasks: { projectId: string; taskIndex: number }[] = [];

  if (!ctx.employeeId) {
    return {
      accessibleProjectIds,
      accessibleClientIds: [],
      accessibleTaskIds,
      accessibleContentItemIds: [],
      accessibleLegacyTasks,
    };
  }

  const employee = await Employee.findById(ctx.employeeId).lean();
  if (!employee) {
    return {
      accessibleProjectIds,
      accessibleClientIds: [],
      accessibleTaskIds,
      accessibleContentItemIds: [],
      accessibleLegacyTasks,
    };
  }

  const accessibleClientIds = new Set<string>();

  const projects = await Project.find({ userId: { $in: ctx.orgUserIds } })
    .select('assignedToEmployeeIds assignedToEmployeeId tasks userId clientId')
    .lean();

  for (const project of projects) {
    if (!canUserContributeToProject(project, ctx.employeeId, false)) continue;
    accessibleProjectIds.push(project._id.toString());
    if (project.clientId) {
      accessibleClientIds.add(project.clientId.toString());
    }

    (project.tasks ?? []).forEach((task, idx) => {
      if (!isTaskAssignedToEmployee(task, employee)) return;
      const taskId = (task as { _id?: { toString(): string } })._id?.toString();
      if (taskId) {
        accessibleTaskIds.push(taskId);
      } else {
        accessibleLegacyTasks.push({ projectId: project._id.toString(), taskIndex: idx });
      }
    });
  }

  const contentItems = await ContentItem.find({
    userId: { $in: ctx.orgUserIds },
    assignedToEmployeeId: new Types.ObjectId(ctx.employeeId),
  })
    .select('_id')
    .lean();

  return {
    accessibleProjectIds,
    accessibleClientIds: [...accessibleClientIds],
    accessibleTaskIds,
    accessibleContentItemIds: contentItems.map((item) => item._id.toString()),
    accessibleLegacyTasks,
  };
}

export function canAccessAsset(
  ctx: RecordingSessionContext,
  asset: AssetAccessRecord,
  scope: AssetAccessScope
): boolean {
  if (ctx.isManagerOrAdmin) return true;

  const ownerId = idStr(asset.userId);
  if (ownerId && ownerId === ctx.userId) return true;

  const contentId = idStr(asset.linkedContentItemId);
  if (contentId && scope.accessibleContentItemIds.includes(contentId)) return true;

  const taskId = idStr(asset.linkedProjectTaskId);
  if (taskId && scope.accessibleTaskIds.includes(taskId)) return true;

  const projectId = idStr(asset.linkedProjectId);
  if (
    projectId &&
    asset.linkedProjectTaskIndex != null &&
    asset.linkedProjectTaskIndex !== undefined &&
    !taskId
  ) {
    const legacyOk = scope.accessibleLegacyTasks.some(
      (entry) =>
        entry.projectId === projectId && entry.taskIndex === asset.linkedProjectTaskIndex
    );
    if (legacyOk) return true;
  }

  const clientId = idStr(asset.linkedClientId);
  if (clientId && isClientLevelAsset(asset)) {
    return scope.accessibleClientIds.includes(clientId);
  }

  if (isProjectLevelAsset(asset)) {
    return projectId != null && scope.accessibleProjectIds.includes(projectId);
  }

  return false;
}

export function applyAssetAccessFilter(
  baseQuery: Record<string, unknown>,
  ctx: RecordingSessionContext,
  scope: AssetAccessScope
): Record<string, unknown> {
  if (ctx.isManagerOrAdmin) return baseQuery;

  const orConditions: Record<string, unknown>[] = [{ userId: new Types.ObjectId(ctx.userId) }];

  if (scope.accessibleClientIds.length > 0) {
    orConditions.push({
      linkedClientId: { $in: scope.accessibleClientIds.map((id) => new Types.ObjectId(id)) },
      $and: [
        { $or: [{ linkedProjectId: { $exists: false } }, { linkedProjectId: null }] },
        { $or: [{ linkedContentItemId: { $exists: false } }, { linkedContentItemId: null }] },
      ],
    });
  }

  if (scope.accessibleProjectIds.length > 0) {
    orConditions.push({
      linkedProjectId: { $in: scope.accessibleProjectIds.map((id) => new Types.ObjectId(id)) },
      $and: [
        { $or: [{ linkedProjectTaskId: { $exists: false } }, { linkedProjectTaskId: null }] },
        { $or: [{ linkedContentItemId: { $exists: false } }, { linkedContentItemId: null }] },
        {
          $or: [
            { linkedProjectTaskIndex: { $exists: false } },
            { linkedProjectTaskIndex: null },
          ],
        },
      ],
    });
  }

  if (scope.accessibleTaskIds.length > 0) {
    orConditions.push({
      linkedProjectTaskId: {
        $in: scope.accessibleTaskIds.map((id) => new Types.ObjectId(id)),
      },
    });
  }

  for (const legacy of scope.accessibleLegacyTasks) {
    orConditions.push({
      linkedProjectId: new Types.ObjectId(legacy.projectId),
      linkedProjectTaskIndex: legacy.taskIndex,
      $or: [{ linkedProjectTaskId: { $exists: false } }, { linkedProjectTaskId: null }],
    });
  }

  if (scope.accessibleContentItemIds.length > 0) {
    orConditions.push({
      linkedContentItemId: {
        $in: scope.accessibleContentItemIds.map((id) => new Types.ObjectId(id)),
      },
    });
  }

  return {
    ...baseQuery,
    $and: [...(Array.isArray(baseQuery.$and) ? baseQuery.$and : []), { $or: orConditions }],
  };
}

async function canLinkToTaskLive(
  ctx: RecordingSessionContext,
  links: AssetLinkFields
): Promise<boolean> {
  if (!ctx.employeeId) return false;

  const projectId = idStr(links.linkedProjectId);
  if (!projectId) return false;

  const project = await Project.findOne({
    _id: projectId,
    userId: { $in: ctx.orgUserIds },
  })
    .select('tasks')
    .lean();
  if (!project) return false;

  const employee = await Employee.findById(ctx.employeeId).lean();
  if (!employee) return false;

  const taskId = idStr(links.linkedProjectTaskId);
  let task:
    | {
        assignedTo?: string;
        assignedToEmployeeIds?: unknown[];
        assignedToEmployeeId?: unknown;
      }
    | undefined;

  if (taskId) {
    task = (project.tasks ?? []).find(
      (entry) => (entry as { _id?: { toString(): string } })._id?.toString() === taskId
    );
  } else if (links.linkedProjectTaskIndex != null && links.linkedProjectTaskIndex !== undefined) {
    task = project.tasks?.[links.linkedProjectTaskIndex];
  }

  if (!task) return false;
  return isTaskAssignedToEmployee(task, employee);
}

export async function assertCanLinkAsset(
  ctx: RecordingSessionContext,
  links: AssetLinkFields,
  scope?: AssetAccessScope
): Promise<NextResponse | null> {
  if (ctx.isManagerOrAdmin) return null;

  const builtScope = scope ?? (await buildAssetAccessScope(ctx));

  const clientId = idStr(links.linkedClientId);
  if (clientId) {
    if (links.linkedProjectId || links.linkedContentItemId || links.linkedProjectTaskId) {
      return NextResponse.json(
        { error: 'Client-linked assets cannot also link to projects, tasks, or content' },
        { status: 400 }
      );
    }
    if (!ctx.isManagerOrAdmin && !builtScope.accessibleClientIds.includes(clientId)) {
      return NextResponse.json(
        { error: 'You do not have permission to link assets to this client' },
        { status: 403 }
      );
    }
    return null;
  }

  const contentId = idStr(links.linkedContentItemId);
  if (contentId) {
    if (!builtScope.accessibleContentItemIds.includes(contentId)) {
      return NextResponse.json(
        { error: 'You do not have permission to link assets to this content item' },
        { status: 403 }
      );
    }
    return null;
  }

  const taskId = idStr(links.linkedProjectTaskId);
  if (taskId) {
    if (
      !builtScope.accessibleTaskIds.includes(taskId) &&
      !(await canLinkToTaskLive(ctx, links))
    ) {
      return NextResponse.json(
        { error: 'You do not have permission to link assets to this task' },
        { status: 403 }
      );
    }
    return null;
  }

  const projectId = idStr(links.linkedProjectId);
  if (
    projectId &&
    links.linkedProjectTaskIndex != null &&
    links.linkedProjectTaskIndex !== undefined
  ) {
    const legacyOk = builtScope.accessibleLegacyTasks.some(
      (entry) =>
        entry.projectId === projectId && entry.taskIndex === links.linkedProjectTaskIndex
    );
    if (!legacyOk && !(await canLinkToTaskLive(ctx, links))) {
      return NextResponse.json(
        { error: 'You do not have permission to link assets to this task' },
        { status: 403 }
      );
    }
    return null;
  }

  if (projectId) {
    if (!builtScope.accessibleProjectIds.includes(projectId)) {
      return NextResponse.json(
        { error: 'You do not have permission to link assets to this project' },
        { status: 403 }
      );
    }
    return null;
  }

  return null;
}

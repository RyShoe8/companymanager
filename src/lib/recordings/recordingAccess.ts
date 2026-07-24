import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import Recording from '@/lib/models/Recording';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { canUserContributeToProject } from '@/lib/utils/projectTeam';
import { isValidObjectId } from '@/lib/utils/security';
import { isManagerOrAdminRole } from '@/lib/utils/roles';
import type { IRecording } from '@/lib/models/Recording';

export type RecordingSessionContext = {
  userId: string;
  organizationId: Types.ObjectId;
  orgUserIds: Types.ObjectId[];
  employeeId: string | null;
  isManagerOrAdmin: boolean;
};

export async function getRecordingSessionContext(
  userId: string
): Promise<RecordingSessionContext | NextResponse> {
  const user = await User.findById(userId);
  if (!user?.organizationId) {
    return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
  }

  let currentUserEmployee = await Employee.findOne({
    userId,
    organizationId: user.organizationId,
  });
  if (!currentUserEmployee && user.email) {
    currentUserEmployee = await Employee.findOne({
      organizationId: user.organizationId,
      email: user.email.toLowerCase(),
    });
  }
  const isManagerOrAdmin = isManagerOrAdminRole(currentUserEmployee?.role);
  const orgUserIds = await getOrganizationUserIds(userId, user.organizationId);

  return {
    userId,
    organizationId: new Types.ObjectId(user.organizationId),
    orgUserIds,
    employeeId: currentUserEmployee?._id?.toString() ?? null,
    isManagerOrAdmin: Boolean(isManagerOrAdmin),
  };
}

export async function assertProjectRecordingAccess(
  ctx: RecordingSessionContext,
  projectId: string | null | undefined
): Promise<NextResponse | null> {
  if (!projectId) return null;
  if (!isValidObjectId(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
  }

  const project = await Project.findOne({
    _id: projectId,
    userId: { $in: ctx.orgUserIds },
  }).lean();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (
    !canUserContributeToProject(
      project,
      ctx.employeeId,
      ctx.isManagerOrAdmin
    )
  ) {
    return NextResponse.json(
      { error: 'You do not have permission to add recordings to this project' },
      { status: 403 }
    );
  }

  return null;
}

async function canAccessRecording(
  ctx: RecordingSessionContext,
  recording: Pick<IRecording, 'organizationId' | 'projectId' | 'userId'>
): Promise<boolean> {
  if (recording.organizationId.toString() !== ctx.organizationId.toString()) {
    return false;
  }

  if (recording.userId.toString() === ctx.userId) return true;
  if (ctx.isManagerOrAdmin) return true;

  if (recording.projectId) {
    const project = await Project.findById(recording.projectId).lean();
    if (!project) return false;
    const projectInOrg = ctx.orgUserIds.some(
      (id) => id.toString() === (project as { userId?: Types.ObjectId }).userId?.toString()
    );
    if (!projectInOrg) return false;
    return canUserContributeToProject(project, ctx.employeeId, ctx.isManagerOrAdmin);
  }

  return false;
}

export async function findAccessibleRecording(
  ctx: RecordingSessionContext,
  id: string
): Promise<IRecording | NextResponse> {
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid recording ID' }, { status: 400 });
  }

  const recording = await Recording.findById(id);
  if (!recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  }

  const allowed = await canAccessRecording(ctx, recording);
  if (!allowed) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  }

  return recording;
}

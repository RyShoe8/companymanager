import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { canUserContributeToProject } from '@/lib/utils/projectTeam';
import { isManagerOrAdminRole } from '@/lib/utils/roles';
import { isAiPlanningEnabled } from './config';
import { objectIdSchema } from '@nucleas/ai-contracts';

export class AiHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireAiProject(request: NextRequest, projectId: string, manage = false, allowDisabled = false) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) throw new AiHttpError(401, 'Sign in to continue.');
  if (!objectIdSchema.safeParse(projectId).success) throw new AiHttpError(404, 'Project not found.');
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    // Mutations are browser-only in this stage; there is no agent service identity bypass.
    if (!origin || origin !== new URL(request.url).origin) throw new AiHttpError(403, 'Invalid request origin.');
  }
  await connectDB();
  const user = await User.findById(session.userId).select('organizationId').lean();
  if (!user?.organizationId || (!allowDisabled && !await isAiPlanningEnabled())) throw new AiHttpError(404, 'AI planning is not enabled.');
  const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId }).lean();
  const canManage = isManagerOrAdminRole(employee?.role);
  const ownerIds = await getOrganizationUserIds(session.userId, user.organizationId);
  const project = await Project.findOne({ _id: projectId, userId: { $in: ownerIds } });
  if (!project || !canUserContributeToProject(project, employee?._id?.toString(), canManage)) {
    throw new AiHttpError(404, 'Project not found.');
  }
  if (manage && !canManage) throw new AiHttpError(403, 'A manager or administrator must approve plans.');
  return { userId: session.userId, organizationId: user.organizationId, employeeId: employee?._id, project, canManage, ownerIds };
}

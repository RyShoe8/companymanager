import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAttentionAccess } from '@/lib/ai/control/attention';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { teamHistoryFilter, teamHistorySchema } from '@/lib/ai/teamWorkspace';
import { AiTeamRequest } from '@/lib/models/AiTeamRequest';
import Project from '@/lib/models/Project';
import { canUserContributeToProject } from '@/lib/utils/projectTeam';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const access = await requireAttentionAccess(request);
    const query = teamHistorySchema.omit({ kind: true }).parse(Object.fromEntries(request.nextUrl.searchParams));
    // Bound the scan even when project access has been removed since intake was saved.
    const rows = await AiTeamRequest.find({ organizationId: access.organizationId, createdByUserId: access.userId,
      ...teamHistoryFilter(query), kind: 'task', ...(query.cursor ? { _id: { $lt: new Types.ObjectId(query.cursor) } } : {}),
    }).select('projectId employee kind text cadence status createdAt').sort({ _id: -1 }).limit(26).maxTimeMS(3000).lean();
    const page = rows.slice(0, 25);
    const projects = await Project.find({ _id: { $in: page.map(row => row.projectId) }, userId: { $in: access.ownerIds } })
      .select('name assignedToEmployeeIds assignedToEmployeeId tasks.assignedToEmployeeIds tasks.assignedToEmployeeId')
      .limit(25).maxTimeMS(3000).lean();
    const visible = new Map(projects.filter(project => canUserContributeToProject(project, access.employeeId, access.canManage))
      .map(project => [String(project._id), project.name]));
    return aiResponse({ items: page.filter(row => visible.has(String(row.projectId))).map(row => ({
      id: String(row._id), projectId: String(row.projectId), projectName: visible.get(String(row.projectId)),
      employee: row.employee, kind: row.kind, text: row.text, cadence: row.cadence, status: row.status, createdAt: row.createdAt.toISOString(),
    })), nextCursor: rows.length > 25 ? String(page[24]._id) : null });
  } catch (error) { return aiError(error); }
}

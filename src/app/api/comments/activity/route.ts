import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import User from '@/lib/models/User';
import Project from '@/lib/models/Project';
import Comment from '@/lib/models/Comment';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const projectIdsRaw = (searchParams.get('projectIds') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (projectIdsRaw.length === 0) {
      return NextResponse.json({ projectLatestComments: {} });
    }

    await connectDB();

    const user = await User.findById(session.userId).select('organizationId').lean();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const validObjectIds = projectIdsRaw.filter((id) => Types.ObjectId.isValid(id));

    if (validObjectIds.length === 0) {
      return NextResponse.json({ projectLatestComments: {} });
    }

    const authorizedProjects = await Project.find({
      _id: { $in: validObjectIds },
      userId: { $in: orgUserIds },
    })
      .select('_id')
      .lean();

    const authorizedProjectIds = authorizedProjects.map((project) => project._id.toString());
    if (authorizedProjectIds.length === 0) {
      return NextResponse.json({ projectLatestComments: {} });
    }

    const rows = await Comment.aggregate<{
      _id: Types.ObjectId;
      latestActivity: Date;
    }>([
      {
        $match: {
          entityType: 'project',
          entityId: { $in: authorizedProjectIds.map((id) => new Types.ObjectId(id)) },
        },
      },
      {
        $group: {
          _id: '$entityId',
          latestActivity: { $max: '$updatedAt' },
        },
      },
    ]);

    const projectLatestComments: Record<string, string> = {};
    for (const row of rows) {
      projectLatestComments[row._id.toString()] = row.latestActivity.toISOString();
    }

    return NextResponse.json({ projectLatestComments });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

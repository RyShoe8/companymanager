import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import User from '@/lib/models/User';
import Project from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';
import Comment from '@/lib/models/Comment';

type LeanTimestamp = { updatedAt?: Date; createdAt?: Date };

function latestMs(rows: LeanTimestamp[]): number {
  let max = 0;
  for (const row of rows) {
    const stamp = row.updatedAt ?? row.createdAt;
    if (!stamp) continue;
    const ms = new Date(stamp).getTime();
    if (Number.isFinite(ms)) max = Math.max(max, ms);
  }
  return max;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const user = await User.findById(session.userId).select('organizationId').lean();
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const [projects, contentItems, comments] = await Promise.all([
      Project.find({ userId: { $in: orgUserIds } })
        .select('_id updatedAt createdAt')
        .lean(),
      ContentItem.find({ userId: { $in: orgUserIds } })
        .select('_id updatedAt createdAt')
        .lean(),
      Comment.find({ authorId: { $in: orgUserIds } })
        .select('_id updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .limit(250)
        .lean(),
    ]);

    const projectMs = latestMs(projects);
    const contentMs = latestMs(contentItems);
    const commentMs = latestMs(comments);
    const lastActivityMs = Math.max(projectMs, contentMs, commentMs);

    return NextResponse.json({
      token: `${projects.length}:${contentItems.length}:${lastActivityMs}`,
      lastActivityMs,
      counts: {
        projects: projects.length,
        contentItems: contentItems.length,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

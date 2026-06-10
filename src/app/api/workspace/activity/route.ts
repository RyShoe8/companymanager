import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import User from '@/lib/models/User';
import Project from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';
import Comment from '@/lib/models/Comment';

type ActivityAggRow = { count?: number; maxStamp?: Date | null };

function aggMs(rows: ActivityAggRow[]): number {
  const stamp = rows[0]?.maxStamp;
  if (!stamp) return 0;
  const ms = new Date(stamp).getTime();
  return Number.isFinite(ms) ? ms : 0;
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

    // 60s polling hot path: aggregate counts + max timestamps instead of loading full collections
    const maxStampGroup = {
      _id: null as null,
      count: { $sum: 1 },
      maxStamp: { $max: { $ifNull: ['$updatedAt', '$createdAt'] } },
    };
    const [projectAgg, contentAgg, commentAgg] = await Promise.all([
      Project.aggregate<ActivityAggRow>([
        { $match: { userId: { $in: orgUserIds } } },
        { $group: maxStampGroup },
      ]),
      ContentItem.aggregate<ActivityAggRow>([
        { $match: { userId: { $in: orgUserIds } } },
        { $group: maxStampGroup },
      ]),
      Comment.aggregate<ActivityAggRow>([
        { $match: { authorId: { $in: orgUserIds } } },
        { $group: maxStampGroup },
      ]),
    ]);

    const lastActivityMs = Math.max(aggMs(projectAgg), aggMs(contentAgg), aggMs(commentAgg));
    const projectCount = projectAgg[0]?.count ?? 0;
    const contentCount = contentAgg[0]?.count ?? 0;

    return NextResponse.json({
      token: `${projectCount}:${contentCount}:${lastActivityMs}`,
      lastActivityMs,
      counts: {
        projects: projectCount,
        contentItems: contentCount,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Comment from '@/lib/models/Comment';
import ContentItem from '@/lib/models/ContentItem';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import {
  mergeCommentSummary,
  taskCommentSummaryKey,
  type CommentSummary,
} from '@/lib/comments/commentUtils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id: projectId } = await params;

    const user = await User.findById(session.userId);
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: projectId, userId: { $in: orgUserIds } }).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const contentItems = await ContentItem.find({ projectId }).select('_id').lean();
    const contentItemIds = contentItems.map((item) => item._id);

    const orConditions: Record<string, unknown>[] = [
      { entityType: 'projectTask', entityId: projectId },
    ];
    if (contentItemIds.length > 0) {
      orConditions.push({ entityType: 'contentItem', entityId: { $in: contentItemIds } });
    }

    const comments = await Comment.find({ $or: orConditions })
      .select('entityType entityId taskId taskIndex createdAt updatedAt')
      .lean();

    const tasks: Record<string, CommentSummary> = {};
    const contentItemsMap: Record<string, CommentSummary> = {};

    for (const comment of comments) {
      if (comment.entityType === 'projectTask') {
        const key = taskCommentSummaryKey(
          comment.taskId?.toString(),
          comment.taskIndex ?? undefined
        );
        tasks[key] = mergeCommentSummary(tasks[key], comment);
      } else if (comment.entityType === 'contentItem') {
        const key = comment.entityId.toString();
        contentItemsMap[key] = mergeCommentSummary(contentItemsMap[key], comment);
      }
    }

    return NextResponse.json({ tasks, contentItems: contentItemsMap });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

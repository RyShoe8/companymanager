import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Comment from '@/lib/models/Comment';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { isValidObjectId } from '@/lib/utils/security';
import { resolveProjectIdFromCommentEntity, touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import { mergeCommentSummary } from '@/lib/comments/commentUtils';

/** Verifies the comment entity resolves to a project within the caller's organization. */
async function canAccessCommentEntity(
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  if (!isValidObjectId(entityId)) return false;
  const projectId = await resolveProjectIdFromCommentEntity(entityType, entityId);
  if (!projectId) return false;
  const user = await User.findById(userId).select('organizationId').lean();
  if (!user?.organizationId) return false;
  const orgUserIds = await getOrganizationUserIds(userId, user.organizationId);
  const project = await Project.exists({ _id: projectId, userId: { $in: orgUserIds } });
  return !!project;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const taskIndex = searchParams.get('taskIndex');
    const taskId = searchParams.get('taskId');
    const summary = searchParams.get('summary') === '1';

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    if (!(await canAccessCommentEntity(session.userId, entityType, entityId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const query: any = {
      entityType,
      entityId,
    };

    if (taskId) {
      query.taskId = taskId;
    } else if (taskIndex !== null && taskIndex !== undefined) {
      query.taskIndex = parseInt(taskIndex);
    }

    const comments = await Comment.find(query)
      .sort({ createdAt: 1 })
      .lean();

    if (summary) {
      let summaryResult = { count: 0, latestActivityMs: 0 };
      for (const comment of comments) {
        summaryResult = mergeCommentSummary(summaryResult, comment);
      }
      return NextResponse.json(summaryResult);
    }

    // Build threaded structure
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create map of all comments
    comments.forEach((comment: any) => {
      commentMap.set(comment._id.toString(), {
        ...comment,
        replies: [],
      });
    });

    // Second pass: build tree structure
    comments.forEach((comment: any) => {
      const commentObj = commentMap.get(comment._id.toString());
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId.toString());
        if (parent) {
          parent.replies.push(commentObj);
        } else {
          // Parent not found, treat as root
          rootComments.push(commentObj);
        }
      } else {
        rootComments.push(commentObj);
      }
    });

    return NextResponse.json(rootComments);
  } catch (error) {
    // Get comments error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { content, parentId, entityType, entityId, taskIndex, taskId } = body;

    if (!content || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'content, entityType, and entityId are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!(await canAccessCommentEntity(session.userId, entityType, entityId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const commentData: any = {
      content,
      authorId: session.userId,
      authorName: user.name || user.email.split('@')[0],
      entityType,
      entityId,
    };

    if (parentId) {
      commentData.parentId = parentId;
    }

    // Prefer stable taskId over taskIndex
    if (taskId) {
      commentData.taskId = taskId;
    } else if (taskIndex !== undefined && taskIndex !== null) {
      commentData.taskIndex = typeof taskIndex === 'number' ? taskIndex : parseInt(taskIndex);
    }

    const comment = await Comment.create(commentData);

    const projectId = await resolveProjectIdFromCommentEntity(entityType, entityId);
    if (projectId) {
      await touchProjectActivity(projectId);
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    // Create comment error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

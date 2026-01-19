import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Comment from '@/lib/models/Comment';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const taskIndex = searchParams.get('taskIndex');

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    const query: any = {
      entityType,
      entityId,
    };

    if (taskIndex !== null && taskIndex !== undefined) {
      query.taskIndex = parseInt(taskIndex);
    }

    const comments = await Comment.find(query)
      .sort({ createdAt: 1 })
      .lean();

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
    const { content, parentId, entityType, entityId, taskIndex } = body;

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

    if (taskIndex !== undefined && taskIndex !== null) {
      commentData.taskIndex = parseInt(taskIndex);
    }

    const comment = await Comment.create(commentData);

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    // Create comment error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

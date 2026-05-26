import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Comment from '@/lib/models/Comment';
import { requireAuth } from '@/lib/auth/middleware';
import { resolveProjectIdFromCommentEntity, touchProjectActivity } from '@/lib/projects/touchProjectActivity';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { content } = body;

    await connectDB();
    const { id } = await params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only author can edit
    if (comment.authorId.toString() !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (content !== undefined) {
      comment.content = content;
    }

    await comment.save();

    const projectId = await resolveProjectIdFromCommentEntity(comment.entityType, comment.entityId.toString());
    if (projectId) {
      await touchProjectActivity(projectId);
    }

    return NextResponse.json(comment);
  } catch (error) {
    // Update comment error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only author can delete
    if (comment.authorId.toString() !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete comment and all its replies recursively
    const deleteCommentAndReplies = async (commentId: string) => {
      const replies = await Comment.find({ parentId: commentId });
      for (const reply of replies) {
        await deleteCommentAndReplies(reply._id.toString());
      }
      await Comment.findByIdAndDelete(commentId);
    };

    const projectId = await resolveProjectIdFromCommentEntity(comment.entityType, comment.entityId.toString());
    await deleteCommentAndReplies(id);
    if (projectId) {
      await touchProjectActivity(projectId);
    }

    return NextResponse.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    // Delete comment error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

'use client';

import { useState, useEffect } from 'react';
import { IComment } from '@/lib/models/Comment';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface CommentThreadProps {
  entityType: 'project' | 'projectStage' | 'operation';
  entityId: string;
  stageIndex?: number;
  currentUserId?: string;
  showHeading?: boolean;
}

interface CommentWithReplies extends IComment {
  replies?: CommentWithReplies[];
}

export default function CommentThread({ entityType, entityId, stageIndex, currentUserId, showHeading = true }: CommentThreadProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, [entityType, entityId, stageIndex]);

  const loadComments = async () => {
    try {
      const params = new URLSearchParams({
        entityType,
        entityId,
      });
      if (stageIndex !== undefined) {
        params.append('stageIndex', stageIndex.toString());
      }

      const response = await fetch(`/api/comments?${params}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent | React.MouseEvent, parentId?: string) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    try {
      const body: any = {
        content,
        entityType,
        entityId,
      };

      if (parentId) {
        body.parentId = parentId;
      }

      if (stageIndex !== undefined) {
        body.stageIndex = stageIndex;
      }

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setNewComment('');
        setReplyContent('');
        setReplyingTo(null);
        loadComments();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadComments();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderComment = (comment: CommentWithReplies, depth: number = 0) => {
    const isAuthor = currentUserId && comment.authorId.toString() === currentUserId;
    const maxDepth = 3; // Limit nesting depth

    return (
      <div key={comment._id.toString()} className={`${depth > 0 ? 'ml-6 mt-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                  {comment.authorName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
            </div>
            {isAuthor && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeleteComment(comment._id.toString())}
              >
                Delete
              </Button>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {comment.content}
          </p>
          {depth < maxDepth && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment._id.toString() ? null : comment._id.toString())}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {replyingTo === comment._id.toString() ? 'Cancel' : 'Reply'}
            </button>
          )}
        </div>

        {replyingTo === comment._id.toString() && (
          <div className="mt-2 ml-6">
            <div className="flex gap-2">
              <Input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment(e as any, comment._id.toString());
                  }
                }}
              />
              <Button 
                type="button" 
                size="sm"
                onClick={(e) => handleSubmitComment(e as any, comment._id.toString())}
              >
                Reply
              </Button>
            </div>
          </div>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Loading comments...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        {showHeading && (
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Comments</h4>
        )}
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet. Be the first to comment!</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => renderComment(comment))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment(e as any);
              }
            }}
          />
          <Button 
            type="button" 
            size="sm"
            onClick={(e) => handleSubmitComment(e as any)}
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

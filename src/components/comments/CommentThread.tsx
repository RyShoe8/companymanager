'use client';

import { useState, useEffect, useCallback } from 'react';
import { IComment } from '@/lib/models/Comment';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ScreenshotGallery from '@/components/shared/ScreenshotGallery';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

interface CommentThreadProps {
  entityType: 'project' | 'projectTask' | 'contentItem';
  entityId: string;
  taskIndex?: number;
  /** Stable task reference (prefer over taskIndex). */
  taskId?: string;
  currentUserId?: string;
  showHeading?: boolean;
  /** When set, refetch comments on this interval (ms). */
  pollIntervalMs?: number;
  /** Managers/admins can delete any asset in this thread. */
  isManagerOrAdmin?: boolean;
  /** When false, screenshot gallery is not shown (parent renders it elsewhere). */
  showScreenshotGallery?: boolean;
}

interface CommentWithReplies extends IComment {
  replies?: CommentWithReplies[];
}

export default function CommentThread({
  entityType,
  entityId,
  taskIndex,
  taskId,
  currentUserId: currentUserIdProp,
  showHeading = true,
  pollIntervalMs,
  isManagerOrAdmin = false,
  showScreenshotGallery = true,
}: CommentThreadProps) {
  const light = useInspectorLight();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchedUserId, setFetchedUserId] = useState<string | undefined>();
  const currentUserId = currentUserIdProp ?? fetchedUserId;

  useEffect(() => {
    if (currentUserIdProp == null) {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data?.id && setFetchedUserId(data.id))
        .catch(() => {});
    }
  }, [currentUserIdProp]);

  const loadComments = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        entityType,
        entityId,
      });
      if (taskId) {
        params.append('taskId', taskId);
      } else if (taskIndex !== undefined) {
        params.append('taskIndex', taskIndex.toString());
      }

      const response = await fetch(`/api/comments?${params}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch {
      // Error loading comments
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, taskIndex, taskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs < 1000) return;
    const id = setInterval(() => {
      loadComments();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs, loadComments]);

  const handleSubmitComment = async (e: React.FormEvent | React.MouseEvent, parentId?: string) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    try {
      const body: Record<string, unknown> = {
        content,
        entityType,
        entityId,
      };

      if (parentId) {
        body.parentId = parentId;
      }

      if (taskId) {
        body.taskId = taskId;
      } else if (taskIndex !== undefined) {
        body.taskIndex = taskIndex;
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
    } catch {
      // Error submitting comment
    }
  };

  const handleEditComment = async (commentId: string) => {
    const content = editContent.trim();
    if (!content) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        setEditingCommentId(null);
        setEditContent('');
        loadComments();
      }
    } catch {
      // Error editing comment
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEditingCommentId(null);
        setEditContent('');
        loadComments();
      }
    } catch {
      // Error deleting comment
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
    const maxDepth = 3;

    return (
      <div key={comment._id.toString()} className={`${depth > 0 ? lightSurface('ml-6 mt-3 border-l-2 border-gray-200 pl-4', 'dark:border-gray-700', light) : ''}`}>
        <div className={lightSurface('bg-gray-50 rounded-lg p-3', 'dark:bg-gray-800', light)}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={lightSurface('font-semibold text-sm text-gray-900', 'dark:text-white', light)}>
                  {comment.authorName}
                </span>
                <span className={lightSurface('text-xs text-gray-500', 'dark:text-gray-400', light)}>
                  {formatDate(comment.createdAt)}
                </span>
              </div>
            </div>
            {isAuthor && editingCommentId !== comment._id.toString() && (
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingCommentId(comment._id.toString());
                    setEditContent(comment.content);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteComment(comment._id.toString())}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
          {editingCommentId === comment._id.toString() ? (
            <div className="space-y-2">
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Edit comment..."
                className="w-full text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditingCommentId(null);
                    setEditContent('');
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEditComment(comment._id.toString());
                  }
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleEditComment(comment._id.toString())}>
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingCommentId(null);
                    setEditContent('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className={lightSurface('text-sm text-gray-700 whitespace-pre-wrap', 'dark:text-gray-300', light)}>
              {comment.content}
            </p>
          )}
          {depth < maxDepth && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment._id.toString() ? null : comment._id.toString())}
              className={lightSurface('mt-2 text-xs text-blue-600 hover:underline', 'dark:text-blue-400', light)}
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
                    handleSubmitComment(e as React.FormEvent, comment._id.toString());
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={(e) => handleSubmitComment(e, comment._id.toString())}
                className="h-[38px] min-h-0"
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
    return <div className={lightSurface('text-sm text-gray-500', 'dark:text-gray-400', light)}>Loading comments...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        {showHeading && (
          <h4 className={lightSurface('text-sm font-semibold text-gray-900 mb-3', 'dark:text-white', light)}>Comments</h4>
        )}
        {comments.length === 0 ? (
          <p className={lightSurface('text-sm text-gray-500', 'dark:text-gray-400', light)}>No comments yet. Be the first to comment!</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => renderComment(comment))}
          </div>
        )}
      </div>

      {showScreenshotGallery && (
        <ScreenshotGallery
          entityType={entityType}
          entityId={entityId}
          taskId={taskId}
          taskIndex={taskIndex}
          isManagerOrAdmin={isManagerOrAdmin}
          currentUserId={currentUserId}
        />
      )}

      <div className={`border-t ${lightSurface('border-gray-200', 'dark:border-gray-700', light)} pt-4`}>
        <div className="flex gap-2 mb-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment(e);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={(e) => handleSubmitComment(e)}
            className="h-[38px] min-h-0"
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { IComment } from '@/lib/models/Comment';
import Button from '@/components/ui/Button';
import EditableText from '@/components/ui/EditableText';
import ScreenshotGallery from '@/components/shared/ScreenshotGallery';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import { getCommentTreeMeta } from '@/lib/comments/commentUtils';

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
  onMetaChange?: (meta: { count: number; latestActivityMs: number }) => void;
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
  onMetaChange,
}: CommentThreadProps) {
  const light = useInspectorLight();
  const commentBodyClass = lightSurface(
    'text-sm text-gray-700 w-full block',
    'dark:text-gray-300',
    light
  );
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyComposerKey, setReplyComposerKey] = useState(0);
  const [rootComposerKey, setRootComposerKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchedUserId, setFetchedUserId] = useState<string | undefined>();
  const currentUserId = currentUserIdProp ?? fetchedUserId;
  const onMetaChangeRef = useRef(onMetaChange);
  const lastReportedMetaRef = useRef<{ count: number; latestActivityMs: number } | null>(null);

  useEffect(() => {
    onMetaChangeRef.current = onMetaChange;
  }, [onMetaChange]);

  useEffect(() => {
    lastReportedMetaRef.current = null;
  }, [entityType, entityId, taskIndex, taskId]);

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
        const serialized = JSON.stringify(data);
        setComments((prev) => (JSON.stringify(prev) === serialized ? prev : data));
        const meta = getCommentTreeMeta(data);
        const last = lastReportedMetaRef.current;
        if (
          !last ||
          last.count !== meta.count ||
          last.latestActivityMs !== meta.latestActivityMs
        ) {
          lastReportedMetaRef.current = meta;
          onMetaChangeRef.current?.(meta);
        }
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

  const postComment = useCallback(
    async (content: string, parentId?: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      try {
        const body: Record<string, unknown> = {
          content: trimmed,
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
          setReplyingTo(null);
          setReplyComposerKey((k) => k + 1);
          if (!parentId) setRootComposerKey((k) => k + 1);
          await loadComments();
        }
      } catch {
        // Error submitting comment
      }
    },
    [entityType, entityId, taskId, taskIndex, loadComments]
  );

  const updateComment = useCallback(
    async (commentId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      try {
        const response = await fetch(`/api/comments/${commentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        });

        if (response.ok) {
          await loadComments();
        }
      } catch {
        // Error editing comment
      }
    },
    [loadComments]
  );

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadComments();
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

  const toggleReplyComposer = (commentId: string) => {
    setReplyingTo((prev) => {
      if (prev === commentId) return null;
      setReplyComposerKey((k) => k + 1);
      return commentId;
    });
  };

  const renderComment = (comment: CommentWithReplies, depth: number = 0) => {
    const isAuthor = currentUserId && comment.authorId.toString() === currentUserId;
    const maxDepth = 3;
    const commentId = comment._id.toString();
    const isReplyOpen = replyingTo === commentId;

    return (
      <div
        key={commentId}
        className={`${depth > 0 ? lightSurface('ml-6 mt-3 border-l-2 border-gray-200 pl-4', 'dark:border-gray-700', light) : ''}`}
      >
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
            {isAuthor && (
              <div className="flex gap-1">
                <Button variant="danger" size="sm" onClick={() => handleDeleteComment(commentId)}>
                  Delete
                </Button>
              </div>
            )}
          </div>
          <EditableText
            value={comment.content}
            onSave={(v) => updateComment(commentId, v)}
            multiline
            disabled={!isAuthor}
            placeholder="Add comment..."
            className={lightSurface(
              'text-sm text-gray-700 w-full block',
              'dark:text-gray-300',
              light
            )}
          />
          {depth < maxDepth && (
            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={() => toggleReplyComposer(commentId)}>
                Add
              </Button>
            </div>
          )}
        </div>

        {isReplyOpen && (
          <div className="mt-2 ml-6">
            <EditableText
              key={`reply-${commentId}-${replyComposerKey}`}
              value=""
              onSave={(v) => postComment(v, commentId)}
              onEditBlur={(v) => {
                if (!v.trim()) setReplyingTo(null);
              }}
              multiline
              autoEditOnMount
              placeholder="Add a reply..."
              className={lightSurface(
                'text-sm text-gray-700 w-full block',
                'dark:text-gray-300',
                light
              )}
            />
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
          <h4 className={lightSurface('text-sm font-semibold text-gray-900 mb-3', 'dark:text-white', light)}>
            Comments
          </h4>
        )}
        {comments.length === 0 ? (
          <p className={lightSurface('text-sm text-gray-500 mb-3', 'dark:text-gray-400', light)}>
            No comments yet. Be the first to comment!
          </p>
        ) : (
          <div className="space-y-4 mb-4">
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
        <EditableText
          key={`root-${rootComposerKey}`}
          value=""
          onSave={postComment}
          multiline
          placeholder="Add a comment..."
          className={commentBodyClass}
        />
      </div>
    </div>
  );
}

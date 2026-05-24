'use client';

import { useState, useEffect, useCallback } from 'react';
import { IComment } from '@/lib/models/Comment';
import { IAsset } from '@/lib/models/Asset';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import EntityScreenshotButton from '@/components/comments/EntityScreenshotButton';

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
}: CommentThreadProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [screenshots, setScreenshots] = useState<IAsset[]>([]);
  const [fetchedUserId, setFetchedUserId] = useState<string | undefined>();
  const currentUserId = currentUserIdProp ?? fetchedUserId;

  useEffect(() => {
    if (currentUserIdProp == null) {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data?.id && setFetchedUserId(data.id))
        .catch(() => { });
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
    } catch (error) {
      // Error loading comments
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, taskIndex, taskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    loadScreenshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, taskIndex, taskId]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs < 1000) return;
    const id = setInterval(() => {
      loadComments();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs, loadComments]);

  const loadScreenshots = async () => {
    try {
      let url = '/api/assets?type=screenshot';
      if (entityType === 'project' || entityType === 'projectTask') {
        url += `&linkedProjectId=${entityId}`;
        if (taskId) {
          url += `&linkedProjectTaskId=${taskId}`;
        } else if (taskIndex !== undefined) {
          url += `&linkedProjectTaskIndex=${taskIndex}`;
        }
      } else if (entityType === 'contentItem') {
        url += `&linkedContentItemId=${entityId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setScreenshots(data);
      }
    } catch (error) {
      // Error loading screenshots
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      // Error deleting comment
    }
  };

  const openImageFullSize = (url: string) => {
    if (!url) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const escaped = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    w.document.write(
      '<!DOCTYPE html><html><head><title>Image</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a">' +
      '<img src="' + escaped + '" style="max-width:100%;max-height:100vh;object-fit:contain" alt="" /></body></html>'
    );
    w.document.close();
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
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {comment.content}
            </p>
          )}
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

      {screenshots.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Screenshots</label>
          <div className="grid grid-cols-4 gap-2">
            {screenshots.map((screenshot) => (
              <div key={screenshot._id.toString()} className="relative group">
                <img
                  src={screenshot.fileUrl}
                  alt={screenshot.name}
                  className="w-full h-20 object-cover rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => openImageFullSize(screenshot.fileUrl!)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={screenshot.name}>
                  {screenshot.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex gap-2 mb-2">
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
            className="h-[38px] min-h-0"
          >
            Post
          </Button>
          <EntityScreenshotButton
            entityType={entityType}
            entityId={entityId}
            taskIndex={taskIndex}
            taskId={taskId}
            onUploaded={loadScreenshots}
          />
        </div>
      </div>
    </div>
  );
}

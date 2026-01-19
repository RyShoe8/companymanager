'use client';

import { useState, useEffect, useCallback } from 'react';
import { IComment } from '@/lib/models/Comment';
import { IAsset } from '@/lib/models/Asset';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface CommentThreadProps {
  entityType: 'project' | 'projectTask' | 'operation';
  entityId: string;
  taskIndex?: number;
  currentUserId?: string;
  showHeading?: boolean;
}

interface CommentWithReplies extends IComment {
  replies?: CommentWithReplies[];
}

export default function CommentThread({ entityType, entityId, taskIndex, currentUserId, showHeading = true }: CommentThreadProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [screenshots, setScreenshots] = useState<IAsset[]>([]);

  useEffect(() => {
    loadComments();
    loadScreenshots();
  }, [entityType, entityId, taskIndex]);

  const loadComments = async () => {
    try {
      const params = new URLSearchParams({
        entityType,
        entityId,
      });
      if (taskIndex !== undefined) {
        params.append('taskIndex', taskIndex.toString());
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

  const loadScreenshots = async () => {
    try {
      let url = '/api/assets?type=screenshot';
      if (entityType === 'project') {
        url += `&linkedProjectId=${entityId}`;
        if (taskIndex !== undefined) {
          url += `&linkedProjectTaskIndex=${taskIndex}`;
        }
      } else if (entityType === 'operation') {
        url += `&linkedOperationId=${entityId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setScreenshots(data);
      }
    } catch (error) {
      console.error('Error loading screenshots:', error);
    }
  };

  const handleAddScreenshot = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await handleUploadScreenshots(Array.from(files));
      }
    };
    input.click();
  };

  const handleUploadScreenshots = async (files: File[]) => {
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, '') || 'Screenshot');
        formData.append('type', 'screenshot');
        
        if (entityType === 'project') {
          formData.append('linkedProjectId', entityId);
          if (taskIndex !== undefined) {
            formData.append('linkedProjectTaskIndex', taskIndex.toString());
          }
        } else if (entityType === 'operation') {
          formData.append('linkedOperationId', entityId);
        }

        const response = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        return response.json();
      });

      await Promise.all(uploadPromises);
      loadScreenshots();
    } catch (error) {
      console.error('Error uploading screenshots:', error);
      alert('Failed to upload screenshots');
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

      if (taskIndex !== undefined) {
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
                  onClick={() => window.open(screenshot.fileUrl, '_blank')}
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
          <Button 
            type="button" 
            variant="secondary"
            size="sm"
            onClick={handleAddScreenshot}
            className="h-[38px] min-h-0 whitespace-nowrap flex-shrink-0"
          >
            Add Screenshot
          </Button>
        </div>
      </div>
    </div>
  );
}

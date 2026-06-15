'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BlogPostForm from '@/components/admin/BlogPostForm';
import type { SerializedBlogPost } from '@/lib/blog/serializeBlogPost';

export default function AdminBlogEditPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const [post, setPost] = useState<SerializedBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/blog/${postId}`);
        if (res.status === 403) {
          if (!cancelled) setError('Access denied. Admin privileges required.');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError('Post not found');
          return;
        }
        const data = (await res.json()) as SerializedBlogPost;
        if (!cancelled) setPost(data);
      } catch {
        if (!cancelled) setError('Failed to load post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-text-secondary">Loading…</div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-error">{error || 'Post not found'}</div>
    );
  }

  return (
    <BlogPostForm
      mode="edit"
      postId={post.id}
      initial={{
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        bodyHtml: post.bodyHtml,
        status: post.status,
        coverImageUrl: post.coverImageUrl,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
        tags: post.tags.join(', '),
      }}
    />
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { SerializedBlogPost } from '@/lib/blog/serializeBlogPost';
import { BLOG_NAME } from '@/lib/blog/blogConstants';

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<SerializedBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/blog?${params.toString()}`);
      if (res.status === 403) {
        setError('Access denied. Admin privileges required.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      setError('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this post?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Blog</h1>
          <p className="text-sm text-text-secondary mt-1">Manage {BLOG_NAME} posts</p>
        </div>
        <Link href="/admin/blog/new">
          <Button>New post</Button>
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(['', 'draft', 'published'] as const).map((status) => (
          <button
            key={status || 'all'}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              statusFilter === status
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="text-text-secondary">Loading…</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <Card className="p-6 text-text-secondary">No posts yet.</Card>
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <Card key={post.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-text-primary truncate">{post.title}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    post.status === 'published'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-gray-500/15 text-gray-400'
                  }`}
                >
                  {post.status}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">/{post.slug}</p>
              {post.publishedAt && (
                <p className="text-xs text-text-secondary mt-1">
                  Published {new Date(post.publishedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {post.status === 'published' && (
                <Link href={`/blog/${post.slug}`} target="_blank">
                  <Button size="sm" variant="secondary">
                    View
                  </Button>
                </Link>
              )}
              <Link href={`/admin/blog/${post.id}/edit`}>
                <Button size="sm" variant="secondary">
                  Edit
                </Button>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                disabled={deletingId === post.id}
                onClick={() => void handleDelete(post.id)}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

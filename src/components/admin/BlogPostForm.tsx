'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RichTextEditor from '@/components/admin/RichTextEditor';
import { slugifyTitle } from '@/lib/blog/slugify';
import type { SerializedBlogPost } from '@/lib/blog/serializeBlogPost';

export type BlogPostFormValues = {
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  status: 'draft' | 'published';
  coverImageUrl: string;
  metaTitle: string;
  metaDescription: string;
  tags: string;
};

interface BlogPostFormProps {
  mode: 'create' | 'edit';
  postId?: string;
  initial?: Partial<BlogPostFormValues>;
}

const emptyValues: BlogPostFormValues = {
  title: '',
  slug: '',
  excerpt: '',
  bodyHtml: '<p></p>',
  status: 'draft',
  coverImageUrl: '',
  metaTitle: '',
  metaDescription: '',
  tags: '',
};

async function uploadBlogImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/admin/blog/upload', { method: 'POST', body: formData });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

export default function BlogPostForm({ mode, postId, initial }: BlogPostFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<BlogPostFormValues>({ ...emptyValues, ...initial });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (initial) {
      setValues({ ...emptyValues, ...initial });
      setSlugTouched(Boolean(initial.slug));
    }
  }, [initial]);

  const update = (patch: Partial<BlogPostFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const handleTitleChange = (title: string) => {
    update({ title });
    if (!slugTouched) {
      update({ slug: slugifyTitle(title) });
    }
  };

  const save = async (statusOverride?: 'draft' | 'published') => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: values.title.trim(),
        slug: values.slug.trim() || slugifyTitle(values.title),
        excerpt: values.excerpt.trim(),
        bodyHtml: values.bodyHtml,
        status: statusOverride ?? values.status,
        coverImageUrl: values.coverImageUrl.trim(),
        metaTitle: values.metaTitle.trim(),
        metaDescription: values.metaDescription.trim(),
        tags: values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (!payload.title) {
        setError('Title is required');
        return;
      }

      const url =
        mode === 'create' ? '/api/admin/blog' : `/api/admin/blog/${postId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 403) {
        setError('Access denied. Admin privileges required.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Failed to save');
        return;
      }

      const saved = (await res.json()) as SerializedBlogPost;
      if (mode === 'create') {
        router.push(`/admin/blog/${saved.id}/edit`);
      } else {
        router.refresh();
      }
    } catch {
      setError('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleCoverUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadBlogImage(file);
      if (url) update({ coverImageUrl: url });
    };
    input.click();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-[100px] py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/blog" className="text-sm text-text-secondary hover:text-primary">
            ← Back to blog posts
          </Link>
          <h1 className="text-2xl font-bold text-text-primary mt-2">
            {mode === 'create' ? 'New blog post' : 'Edit blog post'}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setPreview((p) => !p)}>
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => void save('draft')}>
            Save draft
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save('published')}>
            {saving ? 'Saving…' : 'Publish'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {preview ? (
        <article className="prose prose-invert max-w-none bg-background-card border border-border rounded-lg p-6">
          {values.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={values.coverImageUrl} alt="" className="w-full max-h-80 object-cover rounded-lg mb-6" />
          )}
          <h1>{values.title || 'Untitled'}</h1>
          {values.excerpt && <p className="text-text-secondary text-lg">{values.excerpt}</p>}
          <div dangerouslySetInnerHTML={{ __html: values.bodyHtml }} />
        </article>
      ) : (
        <>
          <Input
            label="Title"
            value={values.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Post title"
          />
          <Input
            label="Slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update({ slug: slugifyTitle(e.target.value) });
            }}
            placeholder="url-friendly-slug"
          />
          <Input
            label="Excerpt"
            value={values.excerpt}
            onChange={(e) => update({ excerpt: e.target.value })}
            placeholder="Short summary for the blog index"
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Body</label>
            <RichTextEditor
              content={values.bodyHtml}
              onChange={(html) => update({ bodyHtml: html })}
              onUploadImage={uploadBlogImage}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Cover image URL"
                value={values.coverImageUrl}
                onChange={(e) => update({ coverImageUrl: e.target.value })}
                placeholder="/uploads/blog/..."
              />
              <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => void handleCoverUpload()}>
                Upload cover
              </Button>
            </div>
            <Input
              label="Tags (comma-separated)"
              value={values.tags}
              onChange={(e) => update({ tags: e.target.value })}
              placeholder="productivity, teams"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Meta title"
              value={values.metaTitle}
              onChange={(e) => update({ metaTitle: e.target.value })}
            />
            <Input
              label="Meta description"
              value={values.metaDescription}
              onChange={(e) => update({ metaDescription: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

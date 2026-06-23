'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RichTextEditor from '@/components/admin/RichTextEditor';
import { slugifyTitle } from '@/lib/blog/slugify';
import { resolveBlogSeoFields } from '@/lib/blog/deriveBlogSeo';
import { coverImageUrlError, COVER_IMAGE_URL_MAX } from '@/lib/blog/coverImageUrl';
import { BLOG_PROSE_CLASS } from '@/lib/blog/blogConstants';
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

async function uploadBlogImage(file: File): Promise<{ url: string } | { error: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/admin/blog/upload', { method: 'POST', body: formData });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) {
    return { error: typeof data.error === 'string' ? data.error : 'Image upload failed' };
  }
  if (!data.url) return { error: 'Image upload failed' };
  return { url: data.url };
}

export default function BlogPostForm({ mode, postId, initial }: BlogPostFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<BlogPostFormValues>({ ...emptyValues, ...initial });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [metaTitleTouched, setMetaTitleTouched] = useState(Boolean(initial?.metaTitle));
  const [metaDescriptionTouched, setMetaDescriptionTouched] = useState(Boolean(initial?.metaDescription));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [coverError, setCoverError] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (initial) {
      setValues({ ...emptyValues, ...initial });
      setSlugTouched(Boolean(initial.slug));
      setMetaTitleTouched(Boolean(initial.metaTitle));
      setMetaDescriptionTouched(Boolean(initial.metaDescription));
    }
  }, [initial]);

  const update = (patch: Partial<BlogPostFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const suggestedSeo = useMemo(
    () =>
      resolveBlogSeoFields({
        title: values.title,
        excerpt: values.excerpt,
        bodyHtml: values.bodyHtml,
        metaTitle: metaTitleTouched ? values.metaTitle : undefined,
        metaDescription: metaDescriptionTouched ? values.metaDescription : undefined,
      }),
    [values.title, values.excerpt, values.bodyHtml, values.metaTitle, values.metaDescription, metaTitleTouched, metaDescriptionTouched]
  );

  const displayMetaTitle = metaTitleTouched ? values.metaTitle : suggestedSeo.metaTitle;
  const displayMetaDescription = metaDescriptionTouched
    ? values.metaDescription
    : suggestedSeo.metaDescription;

  const handleTitleChange = (title: string) => {
    update({ title });
    if (!slugTouched) {
      update({ slug: slugifyTitle(title) });
    }
  };

  const save = async (statusOverride?: 'draft' | 'published') => {
    setSaving(true);
    setError('');
    setCoverError('');

    const payload = {
      title: values.title.trim(),
      slug: values.slug.trim() || slugifyTitle(values.title),
      excerpt: values.excerpt.trim(),
      bodyHtml: values.bodyHtml,
      status: statusOverride ?? values.status,
      coverImageUrl: values.coverImageUrl.trim(),
      metaTitle: metaTitleTouched ? values.metaTitle.trim() : '',
      metaDescription: metaDescriptionTouched ? values.metaDescription.trim() : '',
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (!payload.title) {
      setError('Title is required');
      setSaving(false);
      return;
    }

    const coverErr = coverImageUrlError(payload.coverImageUrl);
    if (coverErr) {
      setCoverError(coverErr);
      setSaving(false);
      return;
    }

    try {
      const url = mode === 'create' ? '/api/admin/blog' : `/api/admin/blog/${postId}`;
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
      update({ bodyHtml: saved.bodyHtml, status: saved.status });
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
      setUploadingCover(true);
      setCoverError('');
      const result = await uploadBlogImage(file);
      setUploadingCover(false);
      if ('error' in result) {
        setCoverError(result.error);
        return;
      }
      update({ coverImageUrl: result.url });
    };
    input.click();
  }, []);

  const handleCoverUrlChange = (url: string) => {
    update({ coverImageUrl: url });
    const err = coverImageUrlError(url);
    setCoverError(err ?? '');
  };

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
          <Button
            type="button"
            disabled={saving || !values.title.trim()}
            onClick={() => void save('published')}
          >
            {saving ? 'Saving…' : 'Publish'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {preview ? (
        <article className={`${BLOG_PROSE_CLASS} bg-background-card border border-border rounded-lg p-6`}>
          {values.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={values.coverImageUrl}
              alt={values.title || 'Cover'}
              className="w-full max-h-80 object-cover rounded-lg mb-6"
            />
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
            placeholder="Short summary for the blog index (auto-generated from body if blank)"
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Body</label>
            <RichTextEditor
              content={values.bodyHtml}
              onChange={(html) => update({ bodyHtml: html })}
              onUploadImage={async (file) => {
                const result = await uploadBlogImage(file);
                if ('error' in result) {
                  alert(result.error);
                  return null;
                }
                return result.url;
              }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Cover image URL"
                value={values.coverImageUrl}
                onChange={(e) => handleCoverUrlChange(e.target.value)}
                placeholder="https://... or /uploads/blog/..."
              />
              <p className="text-xs text-text-muted mt-1">
                Max {COVER_IMAGE_URL_MAX} characters. Paste a URL or upload below.
              </p>
              {values.coverImageUrl && !coverError && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={values.coverImageUrl}
                  alt="Cover preview"
                  className="mt-3 w-full max-h-40 object-cover rounded-lg border border-border"
                />
              )}
              {coverError && <p className="text-xs text-error mt-2">{coverError}</p>}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                disabled={uploadingCover}
                onClick={() => void handleCoverUpload()}
              >
                {uploadingCover ? 'Uploading…' : 'Upload cover'}
              </Button>
            </div>
            <Input
              label="Tags (comma-separated)"
              value={values.tags}
              onChange={(e) => update({ tags: e.target.value })}
              placeholder="productivity, teams"
            />
          </div>
          <div className="rounded-lg border border-border bg-background-card p-4 space-y-4">
            <p className="text-sm font-medium text-text-primary">SEO (auto-generated if left blank)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Meta title"
                  value={displayMetaTitle}
                  onChange={(e) => {
                    setMetaTitleTouched(true);
                    update({ metaTitle: e.target.value });
                  }}
                  placeholder={suggestedSeo.metaTitle}
                />
                <p className="text-xs text-text-muted mt-1">{displayMetaTitle.length}/60 characters</p>
              </div>
              <div>
                <Input
                  label="Meta description"
                  value={displayMetaDescription}
                  onChange={(e) => {
                    setMetaDescriptionTouched(true);
                    update({ metaDescription: e.target.value });
                  }}
                  placeholder={suggestedSeo.metaDescription}
                />
                <p className="text-xs text-text-muted mt-1">
                  {displayMetaDescription.length}/160 characters
                </p>
              </div>
            </div>
            <div className="rounded border border-border bg-background-elevated p-3">
              <p className="text-xs uppercase tracking-wide text-text-muted mb-2">Search preview</p>
              <p className="text-primary text-lg leading-snug truncate">{displayMetaTitle || 'Post title'}</p>
              <p className="text-xs text-success truncate">nucleas.app/blog/{values.slug || 'your-slug'}</p>
              <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                {displayMetaDescription || 'Description will be generated from your excerpt or body.'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

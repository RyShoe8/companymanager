import type { IBlogPost } from '@/lib/models/BlogPost';

type BlogPostDoc = IBlogPost | Record<string, unknown>;

export function serializeBlogPost(doc: BlogPostDoc) {
  const d = doc as IBlogPost;
  return {
    id: d._id.toString(),
    slug: d.slug,
    title: d.title,
    excerpt: d.excerpt ?? '',
    bodyHtml: d.bodyHtml ?? '',
    status: d.status,
    publishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString() : null,
    authorId: d.authorId?.toString?.() ?? String(d.authorId),
    coverImageUrl: d.coverImageUrl ?? '',
    metaTitle: d.metaTitle ?? '',
    metaDescription: d.metaDescription ?? '',
    tags: Array.isArray(d.tags) ? d.tags : [],
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}

export type SerializedBlogPost = ReturnType<typeof serializeBlogPost>;

import connectDB from '@/lib/db/mongodb';
import BlogPost from '@/lib/models/BlogPost';

export async function getPublishedPosts(options?: { limit?: number; skip?: number }) {
  await connectDB();
  const limit = Math.min(options?.limit ?? 12, 50);
  const skip = Math.max(options?.skip ?? 0, 0);

  const [posts, total] = await Promise.all([
    BlogPost.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-bodyHtml')
      .lean(),
    BlogPost.countDocuments({ status: 'published' }),
  ]);

  return { posts, total, limit, skip };
}

export async function getPublishedPostBySlug(slug: string) {
  await connectDB();
  const normalized = slug.toLowerCase();
  return BlogPost.findOne({ slug: normalized, status: 'published' }).lean();
}

/** If slug is a retired slug, returns the current published post slug for redirect. */
export async function getPublishedPostRedirectSlug(slug: string): Promise<string | null> {
  await connectDB();
  const normalized = slug.toLowerCase();
  const post = await BlogPost.findOne({
    status: 'published',
    previousSlugs: normalized,
  })
    .select('slug')
    .lean();
  return post?.slug ?? null;
}

export async function getAllPublishedSlugs() {
  await connectDB();
  const posts = await BlogPost.find({ status: 'published' })
    .select('slug publishedAt updatedAt')
    .lean();
  return posts;
}

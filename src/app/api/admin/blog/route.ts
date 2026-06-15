import { NextRequest, NextResponse } from 'next/server';
import BlogPost from '@/lib/models/BlogPost';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { sanitizeBlogHtml } from '@/lib/blog/sanitizeBlogHtml';
import { slugifyTitle } from '@/lib/blog/slugify';
import { serializeBlogPost } from '@/lib/blog/serializeBlogPost';

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base || 'post';
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const query: Record<string, unknown> = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await BlogPost.findOne(query).select('_id').lean();
    if (!existing) return candidate;
    n += 1;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 200);
    const skip = Math.max(parseInt(searchParams.get('skip') || '0', 10) || 0, 0);

    const query: Record<string, unknown> = {};
    if (status === 'draft' || status === 'published') {
      query.status = status;
    }

    const [items, total] = await Promise.all([
      BlogPost.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      BlogPost.countDocuments(query),
    ]);

    return NextResponse.json({
      posts: items.map(serializeBlogPost),
      total,
      skip,
      limit,
    });
  } catch (error) {
    console.error('Admin blog list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const requestedSlug =
      typeof body.slug === 'string' && body.slug.trim()
        ? slugifyTitle(body.slug)
        : slugifyTitle(title);
    const slug = await uniqueSlug(requestedSlug);

    const status = body.status === 'published' ? 'published' : 'draft';
    const bodyHtml = sanitizeBlogHtml(typeof body.bodyHtml === 'string' ? body.bodyHtml : '');

    const post = await BlogPost.create({
      slug,
      title,
      excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim() : '',
      bodyHtml,
      status,
      publishedAt: status === 'published' ? new Date() : undefined,
      authorId: auth.user!._id,
      coverImageUrl: typeof body.coverImageUrl === 'string' ? body.coverImageUrl.trim() : '',
      metaTitle: typeof body.metaTitle === 'string' ? body.metaTitle.trim() : '',
      metaDescription: typeof body.metaDescription === 'string' ? body.metaDescription.trim() : '',
      tags: Array.isArray(body.tags)
        ? body.tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.trim())
        : [],
    });

    return NextResponse.json(serializeBlogPost(post), { status: 201 });
  } catch (error) {
    console.error('Admin blog create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BlogPost from '@/lib/models/BlogPost';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { slugifyTitle } from '@/lib/blog/slugify';
import { serializeBlogPost } from '@/lib/blog/serializeBlogPost';
import { blogApiErrorResponse, safeSanitizeBlogHtml } from '@/lib/blog/blogApiErrors';
import { applyDerivedSeoOnSave } from '@/lib/blog/deriveBlogSeo';
import { coverImageUrlError } from '@/lib/blog/coverImageUrl';

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

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    await connectDB();

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
    const { message, status } = blogApiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    await connectDB();

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const coverImageUrl =
      typeof body.coverImageUrl === 'string' ? body.coverImageUrl.trim() : '';
    const coverErr = coverImageUrlError(coverImageUrl);
    if (coverErr) {
      return NextResponse.json({ error: coverErr }, { status: 400 });
    }

    const rawBodyHtml = typeof body.bodyHtml === 'string' ? body.bodyHtml : '';
    const sanitized = safeSanitizeBlogHtml(rawBodyHtml);
    if (!sanitized.ok) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    const excerptInput = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
    const metaTitleInput = typeof body.metaTitle === 'string' ? body.metaTitle.trim() : '';
    const metaDescriptionInput =
      typeof body.metaDescription === 'string' ? body.metaDescription.trim() : '';

    const seo = applyDerivedSeoOnSave({
      title,
      excerpt: excerptInput,
      bodyHtml: sanitized.html,
      metaTitle: metaTitleInput,
      metaDescription: metaDescriptionInput,
    });

    const requestedSlug =
      typeof body.slug === 'string' && body.slug.trim()
        ? slugifyTitle(body.slug)
        : slugifyTitle(title);
    const slug = await uniqueSlug(requestedSlug);

    const status = body.status === 'published' ? 'published' : 'draft';

    const post = await BlogPost.create({
      slug,
      title,
      excerpt: seo.excerpt,
      bodyHtml: sanitized.html,
      status,
      publishedAt: status === 'published' ? new Date() : undefined,
      authorId: auth.user!._id,
      coverImageUrl,
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      tags: parseTags(body.tags),
      previousSlugs: [],
    });

    return NextResponse.json(serializeBlogPost(post), { status: 201 });
  } catch (error) {
    console.error('Admin blog create error:', error);
    const { message, status } = blogApiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

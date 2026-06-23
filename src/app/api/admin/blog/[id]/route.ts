import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import BlogPost from '@/lib/models/BlogPost';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { slugifyTitle } from '@/lib/blog/slugify';
import { serializeBlogPost } from '@/lib/blog/serializeBlogPost';
import { blogApiErrorResponse, safeSanitizeBlogHtml } from '@/lib/blog/blogApiErrors';
import { applyDerivedSeoOnSave } from '@/lib/blog/deriveBlogSeo';
import { coverImageUrlError } from '@/lib/blog/coverImageUrl';

async function uniqueSlug(base: string, excludeId: string): Promise<string> {
  let slug = base || 'post';
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await BlogPost.findOne({ slug: candidate, _id: { $ne: excludeId } })
      .select('_id')
      .lean();
    if (!existing) return candidate;
    n += 1;
  }
}

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    await connectDB();

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const post = await BlogPost.findById(id).lean();
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(serializeBlogPost(post));
  } catch (error) {
    console.error('Admin blog get error:', error);
    const { message, status } = blogApiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    await connectDB();

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const post = await BlogPost.findById(id);
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();

    if (typeof body.title === 'string' && body.title.trim()) {
      post.title = body.title.trim();
    }

    let nextBodyHtml = post.bodyHtml;
    if (typeof body.bodyHtml === 'string') {
      const sanitized = safeSanitizeBlogHtml(body.bodyHtml);
      if (!sanitized.ok) {
        return NextResponse.json({ error: sanitized.error }, { status: 400 });
      }
      nextBodyHtml = sanitized.html;
      post.bodyHtml = nextBodyHtml;
    }

    if (typeof body.coverImageUrl === 'string') {
      const coverErr = coverImageUrlError(body.coverImageUrl);
      if (coverErr) {
        return NextResponse.json({ error: coverErr }, { status: 400 });
      }
      post.coverImageUrl = body.coverImageUrl.trim();
    }

    if (Array.isArray(body.tags)) {
      post.tags = parseTags(body.tags);
    }

    const excerptInput = typeof body.excerpt === 'string' ? body.excerpt : post.excerpt ?? '';
    const metaTitleInput = typeof body.metaTitle === 'string' ? body.metaTitle : post.metaTitle ?? '';
    const metaDescriptionInput =
      typeof body.metaDescription === 'string' ? body.metaDescription : post.metaDescription ?? '';

    const seo = applyDerivedSeoOnSave({
      title: post.title,
      excerpt: excerptInput,
      bodyHtml: nextBodyHtml,
      metaTitle: metaTitleInput,
      metaDescription: metaDescriptionInput,
    });
    post.excerpt = seo.excerpt;
    post.metaTitle = seo.metaTitle;
    post.metaDescription = seo.metaDescription;

    if (typeof body.slug === 'string' && body.slug.trim()) {
      const nextSlug = await uniqueSlug(slugifyTitle(body.slug), id);
      if (nextSlug !== post.slug) {
        const history = new Set(post.previousSlugs ?? []);
        history.add(post.slug);
        post.previousSlugs = [...history];
        post.slug = nextSlug;
      }
    }

    if (body.status === 'draft' || body.status === 'published') {
      const wasPublished = post.status === 'published';
      post.status = body.status;
      if (body.status === 'published' && !wasPublished && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    await post.save();
    return NextResponse.json(serializeBlogPost(post));
  } catch (error) {
    console.error('Admin blog update error:', error);
    const { message, status } = blogApiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    await connectDB();

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const result = await BlogPost.findByIdAndDelete(id);
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Admin blog delete error:', error);
    const { message, status } = blogApiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import BlogPost from '@/lib/models/BlogPost';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { sanitizeBlogHtml } from '@/lib/blog/sanitizeBlogHtml';
import { slugifyTitle } from '@/lib/blog/slugify';
import { serializeBlogPost } from '@/lib/blog/serializeBlogPost';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

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
    if (typeof body.excerpt === 'string') {
      post.excerpt = body.excerpt.trim();
    }
    if (typeof body.bodyHtml === 'string') {
      post.bodyHtml = sanitizeBlogHtml(body.bodyHtml);
    }
    if (typeof body.coverImageUrl === 'string') {
      post.coverImageUrl = body.coverImageUrl.trim();
    }
    if (typeof body.metaTitle === 'string') {
      post.metaTitle = body.metaTitle.trim();
    }
    if (typeof body.metaDescription === 'string') {
      post.metaDescription = body.metaDescription.trim();
    }
    if (Array.isArray(body.tags)) {
      post.tags = body.tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.trim());
    }
    if (typeof body.slug === 'string' && body.slug.trim()) {
      post.slug = await uniqueSlug(slugifyTitle(body.slug), id);
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

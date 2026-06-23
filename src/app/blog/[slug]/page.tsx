import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import {
  getPublishedPostBySlug,
  getPublishedPostRedirectSlug,
} from '@/lib/blog/getPublishedPosts';
import {
  buildBlogPostMetadata,
  blogBreadcrumbStructuredData,
} from '@/lib/blog/buildBlogMetadata';
import { resolveBlogSeoFields } from '@/lib/blog/deriveBlogSeo';
import { BLOG_NAME, BLOG_PATH, SITE_LOGO_URL } from '@/lib/blog/blogConstants';
import { getBlogPostUrl, getSiteBaseUrl, toAbsoluteAssetUrl } from '@/lib/blog/getBlogShareUrl';
import BlogPostBody from '@/components/blog/BlogPostBody';
import BlogPostShareBar from '@/components/blog/BlogPostShareBar';
import { StructuredData } from '@/components/StructuredData';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: 'Post not found' };

  let authorName: string | null = null;
  if (post.authorId) {
    await connectDB();
    const author = await User.findById(post.authorId).select('name email').lean();
    authorName = author?.name || author?.email || null;
  }

  return buildBlogPostMetadata({
    ...post,
    authorName,
  });
}

function formatDate(value?: Date | string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    const redirectSlug = await getPublishedPostRedirectSlug(slug);
    if (redirectSlug) {
      redirect(`/blog/${redirectSlug}`);
    }
    notFound();
  }

  let authorName: string | null = null;
  if (post.authorId) {
    await connectDB();
    const author = await User.findById(post.authorId).select('name email').lean();
    authorName = author?.name || author?.email || null;
  }

  const postUrl = getBlogPostUrl(post.slug);
  const seo = resolveBlogSeoFields(post);
  const shareTitle = seo.seoTitle;
  const siteBase = getSiteBaseUrl();

  return (
    <article className="min-h-screen">
      <StructuredData
        type="BlogPosting"
        data={{
          headline: post.title,
          description: seo.seoDescription,
          datePublished: post.publishedAt
            ? new Date(post.publishedAt).toISOString()
            : undefined,
          dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
          image: post.coverImageUrl ? toAbsoluteAssetUrl(post.coverImageUrl) : undefined,
          url: postUrl,
          keywords: Array.isArray(post.tags) && post.tags.length ? post.tags.join(', ') : undefined,
          author: authorName
            ? { '@type': 'Person', name: authorName }
            : undefined,
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': postUrl,
          },
          publisher: {
            '@type': 'Organization',
            name: 'Nucleas',
            url: siteBase,
            logo: {
              '@type': 'ImageObject',
              url: toAbsoluteAssetUrl(SITE_LOGO_URL),
            },
          },
        }}
      />
      <StructuredData
        type="BreadcrumbList"
        data={blogBreadcrumbStructuredData([
          { name: 'Home', path: '/' },
          { name: BLOG_NAME, path: BLOG_PATH },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <header className="px-4 sm:px-6 lg:px-8 py-12 md:py-16 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <Link href={BLOG_PATH} className="text-sm text-text-secondary hover:text-primary">
            ← Back to {BLOG_NAME}
          </Link>
          {post.publishedAt && (
            <p className="text-sm text-text-muted mt-4">{formatDate(post.publishedAt)}</p>
          )}
          <h1 className="text-3xl md:text-5xl font-bold text-text-primary mt-2">{post.title}</h1>
          {post.excerpt && (
            <p className="text-lg text-text-secondary mt-4">{post.excerpt}</p>
          )}
          <BlogPostShareBar url={postUrl} title={shareTitle} />
        </div>
      </header>
      {post.coverImageUrl && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full max-h-[420px] object-cover rounded-2xl border border-border"
          />
        </div>
      )}
      <div className="px-4 sm:px-6 lg:px-8 pb-16 md:pb-24">
        <div className="max-w-3xl mx-auto">
          <BlogPostBody html={post.bodyHtml || ''} />
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-border">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-background-elevated text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

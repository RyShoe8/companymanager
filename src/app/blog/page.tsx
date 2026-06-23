import Link from 'next/link';
import { getPublishedPosts } from '@/lib/blog/getPublishedPosts';
import {
  buildBlogIndexMetadata,
  blogBreadcrumbStructuredData,
  getBlogIndexStructuredData,
} from '@/lib/blog/buildBlogMetadata';
import {
  BLOG_NAME,
  BLOG_OG_IMAGE,
  BLOG_TAGLINE,
} from '@/lib/blog/blogConstants';
import BlogPostCard from '@/components/blog/BlogPostCard';
import { StructuredData } from '@/components/StructuredData';

export const metadata = buildBlogIndexMetadata();

export default async function BlogIndexPage() {
  const { posts } = await getPublishedPosts({ limit: 24 });
  const postSummaries = posts.map((p) => ({
    title: String(p.title),
    slug: String(p.slug),
  }));

  return (
    <div className="min-h-screen">
      <StructuredData type="Blog" data={getBlogIndexStructuredData(postSummaries)} />
      <StructuredData
        type="BreadcrumbList"
        data={blogBreadcrumbStructuredData([
          { name: 'Home', path: '/' },
          { name: BLOG_NAME, path: '/blog' },
        ])}
      />
      <section className="px-4 sm:px-6 lg:px-8 py-12 md:py-16 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl border border-border mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BLOG_OG_IMAGE}
              alt={BLOG_NAME}
              className="w-full max-h-[320px] object-cover"
            />
          </div>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">{BLOG_NAME}</h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">{BLOG_TAGLINE}</p>
          </div>
        </div>
      </section>
      <section className="px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          {posts.length === 0 ? (
            <p className="text-center text-text-secondary">No posts published yet. Check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <BlogPostCard key={String(post._id)} post={post} />
              ))}
            </div>
          )}
          <p className="text-center mt-12">
            <Link href="/register" className="text-primary hover:underline">
              Start your free trial →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

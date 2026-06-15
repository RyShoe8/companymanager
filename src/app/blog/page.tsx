import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedPosts } from '@/lib/blog/getPublishedPosts';
import BlogPostCard from '@/components/blog/BlogPostCard';
import { StructuredData } from '@/components/StructuredData';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Insights on running projects, teams, and your business from the Nucleas team.',
  openGraph: {
    title: 'Blog | Nucleas',
    description: 'Insights on running projects, teams, and your business from the Nucleas team.',
  },
};

export default async function BlogIndexPage() {
  const { posts } = await getPublishedPosts({ limit: 24 });

  return (
    <div className="min-h-screen">
      <StructuredData
        type="WebPage"
        data={{
          name: 'Nucleas Blog',
          description: 'Insights on running projects, teams, and your business.',
          url: `${process.env.NEXTAUTH_URL || 'https://nucleas.app'}/blog`,
        }}
      />
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">Blog</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Practical ideas for running projects, teams, and your business from one place.
          </p>
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

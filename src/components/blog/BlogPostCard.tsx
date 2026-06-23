import Link from 'next/link';
import type { IBlogPost } from '@/lib/models/BlogPost';

function formatDate(value?: Date | string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function BlogPostCard({ post }: { post: IBlogPost | Record<string, unknown> }) {
  const p = post as IBlogPost;
  const slug = p.slug;
  const title = p.title;
  const excerpt = p.excerpt;
  const coverImageUrl = p.coverImageUrl;
  const publishedAt = p.publishedAt;

  return (
    <Link
      href={`/blog/${slug}`}
      className="group block rounded-2xl border border-border bg-background-card overflow-hidden hover:border-primary/40 transition-colors"
    >
      {coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt={title} className="w-full h-48 object-cover" />
      )}
      <div className="p-6">
        {publishedAt && (
          <p className="text-xs text-text-muted mb-2">{formatDate(publishedAt)}</p>
        )}
        <h2 className="text-xl font-semibold text-text-primary group-hover:text-primary transition-colors">
          {title}
        </h2>
        {excerpt && <p className="mt-2 text-sm text-text-secondary line-clamp-3">{excerpt}</p>}
        <span className="inline-block mt-4 text-sm text-primary">Read more →</span>
      </div>
    </Link>
  );
}

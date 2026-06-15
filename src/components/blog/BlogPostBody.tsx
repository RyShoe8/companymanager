import { sanitizeBlogHtml } from '@/lib/blog/sanitizeBlogHtml';

export default function BlogPostBody({ html }: { html: string }) {
  const safe = sanitizeBlogHtml(html);
  return (
    <div
      className="prose prose-invert max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-primary prose-img:rounded-lg"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

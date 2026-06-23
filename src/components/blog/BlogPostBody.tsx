import { sanitizeBlogHtml } from '@/lib/blog/sanitizeBlogHtml';
import { BLOG_PROSE_CLASS } from '@/lib/blog/blogConstants';

export default function BlogPostBody({ html }: { html: string }) {
  const safe = sanitizeBlogHtml(html);
  return (
    <div
      className={BLOG_PROSE_CLASS}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

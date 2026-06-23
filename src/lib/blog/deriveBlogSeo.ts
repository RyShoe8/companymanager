const META_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 160;
const EXCERPT_MAX = 300;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > max * 0.6) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

export function deriveMetaTitle(title: string): string {
  return truncateAtWord(title.trim(), META_TITLE_MAX);
}

export function deriveMetaDescription(source: string): string {
  const plain = stripHtml(source);
  if (!plain) return '';
  return truncateAtWord(plain, META_DESCRIPTION_MAX);
}

export function deriveExcerpt(bodyHtml: string): string {
  const plain = stripHtml(bodyHtml);
  if (!plain) return '';
  return truncateAtWord(plain, EXCERPT_MAX);
}

export type BlogSeoSource = {
  title: string;
  excerpt?: string | null;
  bodyHtml?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export function resolveBlogSeoFields(post: BlogSeoSource) {
  const title = post.title.trim();
  const excerptFromBody = deriveExcerpt(post.bodyHtml || '');
  const excerpt = post.excerpt?.trim() || excerptFromBody;
  const metaTitle = post.metaTitle?.trim() || deriveMetaTitle(title);
  const metaDescription =
    post.metaDescription?.trim() || deriveMetaDescription(excerpt || post.bodyHtml || title);

  return {
    excerpt,
    metaTitle,
    metaDescription,
    seoTitle: metaTitle,
    seoDescription: metaDescription,
  };
}

export function applyDerivedSeoOnSave(input: {
  title: string;
  excerpt?: string;
  bodyHtml?: string;
  metaTitle?: string;
  metaDescription?: string;
}) {
  const resolved = resolveBlogSeoFields({
    title: input.title,
    excerpt: input.excerpt,
    bodyHtml: input.bodyHtml,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
  });

  return {
    excerpt: input.excerpt?.trim() ? input.excerpt.trim() : resolved.excerpt,
    metaTitle: input.metaTitle?.trim() ? input.metaTitle.trim() : resolved.metaTitle,
    metaDescription: input.metaDescription?.trim()
      ? input.metaDescription.trim()
      : resolved.metaDescription,
  };
}

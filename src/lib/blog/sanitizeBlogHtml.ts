import sanitizeHtml from 'sanitize-html';
import { normalizeBlogBodyHtml } from '@/lib/blog/normalizeBlogBodyHtml';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
  'hr',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'];

export function sanitizeBlogHtml(html: string): string {
  if (!html) return '';
  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': ALLOWED_ATTR,
    },
  });
  return normalizeBlogBodyHtml(clean);
}

export function safeSanitizeBlogHtml(
  html: string
): { ok: true; html: string } | { ok: false; error: string } {
  try {
    return { ok: true, html: sanitizeBlogHtml(html) };
  } catch {
    return { ok: false, error: 'Could not sanitize post body' };
  }
}

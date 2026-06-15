import { BLOG_PATH } from '@/lib/blog/blogConstants';

export function getSiteBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'https://nucleas.app';
}

export function getBlogIndexUrl(): string {
  return `${getSiteBaseUrl()}${BLOG_PATH}`;
}

export function getBlogPostUrl(slug: string): string {
  return `${getSiteBaseUrl()}${BLOG_PATH}/${slug}`;
}

export function toAbsoluteAssetUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteBaseUrl()}${normalized}`;
}

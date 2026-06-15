import type { Metadata } from 'next';
import {
  BLOG_DESCRIPTION,
  BLOG_NAME,
  BLOG_OG_IMAGE,
  BLOG_OG_IMAGE_HEIGHT,
  BLOG_OG_IMAGE_WIDTH,
  BLOG_TAGLINE,
} from '@/lib/blog/blogConstants';
import {
  getBlogIndexUrl,
  getBlogPostUrl,
  getSiteBaseUrl,
  toAbsoluteAssetUrl,
} from '@/lib/blog/getBlogShareUrl';

function defaultOgImages(alt: string) {
  const url = toAbsoluteAssetUrl(BLOG_OG_IMAGE);
  return [
    {
      url,
      width: BLOG_OG_IMAGE_WIDTH,
      height: BLOG_OG_IMAGE_HEIGHT,
      alt,
    },
  ];
}

function postOgImages(coverImageUrl: string | undefined | null, alt: string) {
  const imagePath = coverImageUrl?.trim() || BLOG_OG_IMAGE;
  const url = toAbsoluteAssetUrl(imagePath);
  const isDefault = !coverImageUrl?.trim();
  return [
    {
      url,
      width: isDefault ? BLOG_OG_IMAGE_WIDTH : undefined,
      height: isDefault ? BLOG_OG_IMAGE_HEIGHT : undefined,
      alt,
    },
  ];
}

export function buildBlogIndexMetadata(): Metadata {
  const title = BLOG_NAME;
  const description = BLOG_DESCRIPTION;
  const url = getBlogIndexUrl();

  return {
    title,
    description,
    alternates: { canonical: '/blog' },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Nucleas',
      images: defaultOgImages(`${BLOG_NAME} — Nucleas`),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [toAbsoluteAssetUrl(BLOG_OG_IMAGE)],
    },
  };
}

export function buildBlogPostMetadata(post: {
  slug: string;
  title: string;
  excerpt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: Date | string | null;
}): Metadata {
  const title = post.metaTitle?.trim() || post.title;
  const description = post.metaDescription?.trim() || post.excerpt?.trim() || title;
  const url = getBlogPostUrl(post.slug);
  const images = postOgImages(post.coverImageUrl, title);

  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: 'Nucleas',
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((img) => img.url),
    },
  };
}

export function getBlogIndexStructuredData() {
  return {
    name: BLOG_NAME,
    description: BLOG_TAGLINE,
    url: getBlogIndexUrl(),
    publisher: {
      '@type': 'Organization',
      name: 'Nucleas',
      url: getSiteBaseUrl(),
    },
  };
}

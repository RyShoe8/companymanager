import type { Metadata } from 'next';
import {
  BLOG_DESCRIPTION,
  BLOG_NAME,
  BLOG_OG_IMAGE,
  BLOG_OG_IMAGE_HEIGHT,
  BLOG_OG_IMAGE_WIDTH,
  BLOG_PATH,
  BLOG_TAGLINE,
  SITE_LOGO_URL,
} from '@/lib/blog/blogConstants';
import { resolveBlogSeoFields } from '@/lib/blog/deriveBlogSeo';
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
    alternates: {
      canonical: BLOG_PATH,
      types: {
        'application/rss+xml': `${getSiteBaseUrl()}${BLOG_PATH}/feed.xml`,
      },
    },
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

export type BlogPostMetadataInput = {
  slug: string;
  title: string;
  excerpt?: string | null;
  bodyHtml?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  tags?: string[];
  authorName?: string | null;
};

export function buildBlogPostMetadata(post: BlogPostMetadataInput): Metadata {
  const seo = resolveBlogSeoFields(post);
  const url = getBlogPostUrl(post.slug);
  const images = postOgImages(post.coverImageUrl, seo.seoTitle);

  const openGraph: Metadata['openGraph'] = {
    title: seo.seoTitle,
    description: seo.seoDescription,
    url,
    type: 'article',
    siteName: 'Nucleas',
    publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    modifiedTime: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
    images,
    tags: post.tags?.length ? post.tags : undefined,
    authors: post.authorName ? [post.authorName] : undefined,
  };

  return {
    title: seo.seoTitle,
    description: seo.seoDescription,
    keywords: post.tags?.length ? post.tags : undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title: seo.seoTitle,
      description: seo.seoDescription,
      images: images.map((img) => img.url),
    },
  };
}

export function getBlogIndexStructuredData(posts?: { title: string; slug: string }[]) {
  const base = getSiteBaseUrl();
  const itemList = posts?.length
    ? {
        '@type': 'ItemList',
        itemListElement: posts.map((post, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${base}/blog/${post.slug}`,
          name: post.title,
        })),
      }
    : undefined;

  return {
    name: BLOG_NAME,
    description: BLOG_TAGLINE,
    url: getBlogIndexUrl(),
    publisher: {
      '@type': 'Organization',
      name: 'Nucleas',
      url: base,
      logo: {
        '@type': 'ImageObject',
        url: toAbsoluteAssetUrl(SITE_LOGO_URL),
      },
    },
    ...(itemList ? { hasPart: itemList } : {}),
  };
}

export function blogBreadcrumbStructuredData(
  items: { name: string; path: string }[]
) {
  const base = getSiteBaseUrl();
  return {
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  };
}

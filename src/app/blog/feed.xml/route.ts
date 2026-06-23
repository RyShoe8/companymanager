import connectDB from '@/lib/db/mongodb';
import BlogPost from '@/lib/models/BlogPost';
import { getSiteBaseUrl } from '@/lib/blog/getBlogShareUrl';
import { resolveBlogSeoFields } from '@/lib/blog/deriveBlogSeo';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  await connectDB();
  const posts = await BlogPost.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .limit(50)
    .lean();

  const base = getSiteBaseUrl();
  const items = posts
    .map((post) => {
      const seo = resolveBlogSeoFields(post);
      const link = `${base}/blog/${post.slug}`;
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date(post.updatedAt).toUTCString();
      return `
    <item>
      <title>${escapeXml(seo.seoTitle)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(seo.seoDescription)}</description>
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Builders Journal</title>
    <link>${escapeXml(`${base}/blog`)}</link>
    <description>Insights on building and running a business from the Nucleas team.</description>
    <language>en-us</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

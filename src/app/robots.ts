import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/setup-organization',
          '/planning-map',
          '/projects',
          '/workspace',
          '/billing',
          '/scheduling',
          '/assets',
          '/employees',
          '/login',
          '/register',
          '/uploads/',
          '/os',
          '/recording/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

import { Metadata } from 'next';

interface StructuredDataProps {
  type: 'Organization' | 'WebSite' | 'WebPage' | 'SoftwareApplication' | 'FAQPage' | 'BreadcrumbList' | 'BlogPosting';
  data: Record<string, any>;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

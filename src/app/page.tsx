import HomePageClient from './HomePageClient';
import { StructuredData } from '@/components/StructuredData';
import { FAQ_DATA } from '@/data/faq';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

const faqSchemaMainEntity = FAQ_DATA.map((item) => ({
  '@type': 'Question',
  name: item.question,
  acceptedAnswer: { '@type': 'Answer', text: item.answer },
}));

export const metadata = {
  title: 'Nucleas - Run Your Entire Internet Business From One Command Center',
  description: 'Stop juggling tabs, tools, and documents. Nucleas is the operating system for planning, building, and running every project you own. Free for one project.',
  keywords: ['project management', 'command center', 'plan build run', 'internet business', 'startup tools', 'project planning'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Nucleas - Run Your Entire Internet Business From One Command Center',
    description: 'Stop juggling tabs, tools, and documents. Nucleas is the operating system for planning, building, and running every project you own.',
    url: baseUrl,
    siteName: 'Nucleas',
    type: 'website',
    images: [{ url: '/images/Nucleas.png', width: 1200, height: 630, alt: 'Nucleas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nucleas - Run Your Entire Internet Business From One Command Center',
    description: 'The operating system for planning, building, and running every project you own.',
  },
};

export default function HomePage() {
  return (
    <>
      <StructuredData
        type="WebSite"
        data={{
          name: 'Nucleas',
          url: baseUrl,
          description: 'The operating system for planning, building, and running every project you own. Plan, build, and run from one command center.',
          publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl },
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/plan?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <StructuredData
        type="SoftwareApplication"
        data={{
          name: 'Nucleas',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: baseUrl,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          description: 'Run your entire internet business from one command center. Plan, build, and run every project you own.',
        }}
      />
      <StructuredData
        type="FAQPage"
        data={{ mainEntity: faqSchemaMainEntity }}
      />
      <HomePageClient />
    </>
  );
}

import '@/lib/billing-engine';
import HomePageClient from './HomePageClient';
import { StructuredData } from '@/components/StructuredData';
import { FAQ_DATA } from '@/data/faq';
import { getMarketingTrialCopy } from '@/lib/billing/marketingTrialCopy';
import { formatTrialDaysLabel } from 'billing-engine';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

const faqSchemaMainEntity = FAQ_DATA.map((item) => ({
  '@type': 'Question',
  name: item.question,
  acceptedAnswer: { '@type': 'Answer', text: item.answer },
}));

export async function generateMetadata() {
  const trial = await getMarketingTrialCopy();
  return {
    title: 'Nucleas — The Smart Operating System for Building and Running a Business',
    description: `Nucleas is the smart operating system for building and running a business. Not another project manager — the business management layer that brings projects, team, content, meetings, and tools together.${trial.metadataTrialSuffix}`,
    keywords: ['business management', 'business operating system', 'project management', 'team management', 'content planning', 'meeting scheduling', 'startup tools', 'SaaS management', 'business tools'],
    alternates: { canonical: '/' },
    openGraph: {
      title: 'Nucleas — The Smart Operating System for Building and Running a Business',
      description: 'Not another project manager. Nucleas is the business management layer that brings projects, team, content, meetings, and tools together. Build. Organize. Operate.',
      url: baseUrl,
      siteName: 'Nucleas',
      type: 'website',
      images: [{ url: '/images/nucleas-logo.png', width: 512, height: 512, alt: 'Nucleas — Business Operating System' }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: 'Nucleas — The Smart Operating System for Building and Running a Business',
      description: `The business management layer that brings it all together. Build. Organize. Operate.${trial.metadataTrialSuffix}`,
    },
  };
}

export default async function HomePage() {
  const trial = await getMarketingTrialCopy();
  const trialLabel = formatTrialDaysLabel(trial.maxTrialDays);
  const trialPricingLine = trialLabel
    ? `Start your ${trialLabel} free trial on eligible plans.`
    : 'Choose the plan that fits your team.';

  return (
    <>
      <StructuredData
        type="WebSite"
        data={{
          name: 'Nucleas',
          url: baseUrl,
          description: 'Nucleas is the smart operating system for building and running a business. The business management layer that brings projects, team, content, meetings, and tools together.',
          publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl },
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/features?q={search_term_string}` },
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
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            description: trial.heroBadge ?? 'Seat-based plans with full platform access',
          },
          description: 'The smart operating system for building and running a business. Manage projects, team, content, meetings, and tools from one place.',
          featureList: [
            'Project Management with AI Time Estimation',
            'Task Management with Recurrence',
            'Content Planning and Scheduling',
            'Meeting Management with Project Insights',
            'Team Capacity and Workload Tracking',
            'Screenshot and Recording Tools',
            'Smart Buttons for One-Click Tool Access',
            'Asset Library and File Management',
            'Role-Based Access Control',
            'Organization Branding',
          ],
        }}
      />
      <StructuredData
        type="FAQPage"
        data={{ mainEntity: faqSchemaMainEntity }}
      />
      <HomePageClient trialPricingLine={trialPricingLine} trialCtaLabel={trial.ctaButtonLabel} />
    </>
  );
}

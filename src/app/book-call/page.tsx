import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/home/MarketingPageHeader';
import { SalesCallBookingPanel } from '@/components/billing/SalesCallBookingPanel';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata: Metadata = {
  title: 'Book a Call — Talk to Our Team',
  description: 'Schedule a call with the Nucleas team to discuss Enterprise plans, custom seat counts, and dedicated support.',
  alternates: { canonical: '/book-call' },
  openGraph: {
    title: 'Book a Call | Nucleas',
    description: 'Schedule a call with the Nucleas team.',
    url: `${baseUrl}/book-call`,
    type: 'website',
  },
};

export default function BookCallPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingPageHeader
        badge="Enterprise"
        title="Book a call"
        subtitle="Pick a time to talk with our team about custom plans, seat counts, and support for your organization."
        showCta={false}
      />
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <SalesCallBookingPanel />
      </div>
    </div>
  );
}

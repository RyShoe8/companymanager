import { Metadata } from 'next';
import { StructuredData } from '@/components/StructuredData';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Nucleas. Report bugs, request features, or ask questions. We\'d love to hear from you.',
  keywords: 'contact Nucleas, support, bug report, feature request',
  openGraph: {
    title: 'Contact Us | Nucleas',
    description: 'Get in touch with Nucleas. Report bugs, request features, or ask questions.',
    type: 'website',
    url: `${baseUrl}/contact`,
  },
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StructuredData
        type="WebPage"
        data={{
          '@type': 'ContactPage',
          name: 'Contact Us | Nucleas',
          description: 'Get in touch with Nucleas. Report bugs, request features, or ask questions.',
          url: `${baseUrl}/contact`,
          mainEntity: {
            '@type': 'Organization',
            name: 'Nucleas',
            email: 'theteam@nucleas.app',
            url: baseUrl,
          },
        }}
      />
      {children}
    </>
  );
}

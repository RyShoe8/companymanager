import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us - Nucleas',
  description: 'Get in touch with Nucleas. Report bugs, request features, or ask questions. We\'d love to hear from you.',
  keywords: 'contact Nucleas, support, bug report, feature request',
  openGraph: {
    title: 'Contact Us - Nucleas',
    description: 'Get in touch with Nucleas. Report bugs, request features, or ask questions.',
    type: 'website',
    url: 'https://nucleas.app/contact',
  },
  alternates: {
    canonical: 'https://nucleas.app/contact',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

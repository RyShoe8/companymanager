import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OrganizationSetupCheck from "@/components/OrganizationSetupCheck";
import MobileBottomNav from "@/components/ui/MobileBottomNav";
import { StructuredData } from "@/components/StructuredData";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nucleas - Plan, Build and Manage Your Company",
    template: "%s | Nucleas",
  },
  description: "Plan and manage company work and assets. Visual planning map, project management, asset repository, and team management.",
  keywords: ["project management", "planning map", "team collaboration", "asset management", "company planning"],
  authors: [{ name: "Nucleas" }],
  creator: "Nucleas",
  publisher: "Nucleas",
  icons: {
    icon: [
      { url: '/images/icon.png', type: 'image/png' },
    ],
    shortcut: '/images/icon.png',
    apple: '/images/icon.png',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://nucleas.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nucleas.app',
    siteName: 'Nucleas',
    title: "Nucleas - Plan, Build and Manage Your Company",
    description: "Plan, build and manage your company. Visual planning map, project management, asset repository, and team management.",
    images: [
      {
        url: '/images/Nucleas.png',
        width: 1200,
        height: 630,
        alt: 'Nucleas Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Nucleas - Plan, Build and Manage Your Company",
    description: "Plan, build and manage your company. Visual planning map, project management, asset repository, and team management.",
    images: ['/images/Nucleas.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        <StructuredData
          type="Organization"
          data={{
            name: 'Nucleas',
            url: baseUrl,
            logo: `${baseUrl}/images/Nucleas.png`,
            description: 'The operating system for planning, building, and running every project you own. Plan, build, and run from one command center.',
            contactPoint: {
              '@type': 'ContactPoint',
              email: 'theteam@nucleas.app',
              contactType: 'Customer Service',
              url: `${baseUrl}/contact`,
            },
          }}
        />
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-C71LD7T8PT"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-C71LD7T8PT');
          `}
        </Script>
        {/* Cookie Management Platform */}
        <Script
          src="//cdn.cookie-script.com/s/59ce82450accfaf4f6d3d94203a5d496.js"
          strategy="afterInteractive"
        />
        {/* Ahrefs Analytics */}
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="D3V+ZYBYBWGuq2N1WcMRgg"
          strategy="afterInteractive"
        />
        <OrganizationSetupCheck>
          <Navigation />
          <main className="flex-1 pb-16 md:pb-0">
            {children}
          </main>
          <Footer />
          <MobileBottomNav />
        </OrganizationSetupCheck>
      </body>
    </html>
  );
}

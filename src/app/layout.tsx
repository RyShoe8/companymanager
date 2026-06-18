import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OrganizationSetupCheck from "@/components/OrganizationSetupCheck";
import MobileBottomNav from "@/components/ui/MobileBottomNav";
import { StructuredData } from "@/components/StructuredData";
import PostHogProvider from "@/components/analytics/PostHogProvider";
import PlatformGuideLayoutWrapper from "@/components/platformGuide/PlatformGuideLayoutWrapper";
import RecaptchaScript from "@/components/recaptcha/RecaptchaScript";

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
    default: "Nucleas — The Smart Operating System for Building and Running a Business",
    template: "%s | Nucleas",
  },
  description: "Nucleas is the smart operating system for building and running a business. Not another project manager — the business management layer that brings projects, team, content, meetings, and tools together. Build. Organize. Operate.",
  keywords: ["business management", "business operating system", "project management", "team management", "content planning", "meeting management", "startup tools", "business tools", "SaaS management"],
  authors: [{ name: "Nucleas" }],
  creator: "Nucleas",
  publisher: "Nucleas",
  icons: {
    icon: [{ url: '/images/nucleas-logo.png?v=5', type: 'image/png' }],
    shortcut: '/images/nucleas-logo.png?v=5',
    apple: '/images/nucleas-logo.png?v=5',
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
    title: "Nucleas — The Smart Operating System for Building and Running a Business",
    description: "Not another project manager. Nucleas is the business management layer that brings projects, team, content, meetings, and tools together. Build. Organize. Operate.",
    images: [
      {
        url: '/images/nucleas-logo.png',
        width: 512,
        height: 512,
        alt: 'Nucleas — Business Operating System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Nucleas — The Smart Operating System for Building and Running a Business",
    description: "Not another project manager. The business management layer that brings it all together. Build. Organize. Operate.",
    images: ['/images/nucleas-logo.png'],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shellHeader = (await headers()).get('x-nucleas-shell');
  const isOsShell = shellHeader === 'os';
  const isMinimalShell = shellHeader === 'minimal';
  const isBareShell = isOsShell || isMinimalShell;
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen${isOsShell ? ' nucleas-os' : ''}${isMinimalShell ? ' nucleas-minimal' : ''}`}
        suppressHydrationWarning
      >
        <StructuredData
          type="Organization"
          data={{
            name: 'Nucleas',
            url: baseUrl,
            logo: `${baseUrl}/images/nucleas-logo.png`,
            description: 'Nucleas is the smart operating system for building and running a business. The business management layer that brings projects, team, content, meetings, and tools together.',
            contactPoint: {
              '@type': 'ContactPoint',
              email: 'theteam@nucleas.app',
              contactType: 'Customer Service',
              url: `${baseUrl}/contact`,
            },
          }}
        />
        {!isMinimalShell && (
          <>
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
            {!isBareShell ? <RecaptchaScript /> : null}
          </>
        )}
        <PostHogProvider>
          <PlatformGuideLayoutWrapper>
          <OrganizationSetupCheck>
            {isBareShell ? (
              children
            ) : (
              <>
                <Navigation />
                <main className="flex-1 pb-16 md:pb-0">
                  {children}
                </main>
                <Footer />
                <MobileBottomNav />
              </>
            )}
          </OrganizationSetupCheck>
          </PlatformGuideLayoutWrapper>
        </PostHogProvider>
      </body>
    </html>
  );
}

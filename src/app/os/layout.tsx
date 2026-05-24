import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Nucleas OS',
  manifest: '/nucleas-os.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nucleas OS',
  },
  icons: {
    icon: [{ url: '/images/icon.png', type: 'image/png' }],
    apple: '/images/icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#202938',
};

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return children;
}

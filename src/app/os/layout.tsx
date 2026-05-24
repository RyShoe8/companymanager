import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

function resolveOsOrigin(headerList: Headers): string {
    const host = headerList.get('host');
    const proto = headerList.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    if (host?.startsWith('os.')) {
        return `${proto}://${host}`;
    }
    return 'https://os.nucleas.app';
}

export async function generateMetadata(): Promise<Metadata> {
    const headerList = await headers();
    const origin = resolveOsOrigin(headerList);
    const manifestUrl = `${origin}/nucleas-os.webmanifest`;

    return {
        metadataBase: new URL(origin),
        title: 'Nucleas OS',
        manifest: manifestUrl,
        appleWebApp: {
            capable: true,
            statusBarStyle: 'black-translucent',
            title: 'Nucleas OS',
        },
        icons: {
            icon: [{ url: '/icons/pwa-192.png', type: 'image/png' }],
            apple: '/icons/pwa-192.png',
        },
    };
}

export const viewport: Viewport = {
    themeColor: '#202938',
};

export default function OSLayout({ children }: { children: React.ReactNode }) {
    return children;
}

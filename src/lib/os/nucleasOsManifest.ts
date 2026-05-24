/** Shared PWA manifest fields for Nucleas OS (served dynamically with origin-specific related_applications). */
export const NUCLEAS_OS_MANIFEST_BASE = {
    id: '/',
    name: 'Nucleas OS',
    short_name: 'Nucleas OS',
    description: 'Nucleas operating system for planning and running your company workspace.',
    start_url: '/',
    scope: '/',
    display: 'standalone' as const,
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#202938',
    theme_color: '#202938',
    icons: [
        { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/images/icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    ],
};

export function buildNucleasOsManifest(origin: string) {
    const manifestUrl = `${origin.replace(/\/$/, '')}/nucleas-os.webmanifest`;
    return {
        ...NUCLEAS_OS_MANIFEST_BASE,
        related_applications: [
            {
                platform: 'webapp',
                url: manifestUrl,
            },
        ],
    };
}

/** Shared PWA manifest fields for Nucleas OS (served dynamically with origin-specific URLs). */
export const NUCLEAS_OS_MANIFEST_DISPLAY = {
    name: 'Nucleas OS',
    short_name: 'Nucleas OS',
    description: 'Nucleas operating system for planning and running your company workspace.',
    display: 'standalone' as const,
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#202938',
    theme_color: '#202938',
};

const ICON_PATHS = [
    { path: '/icons/pwa-192.png', sizes: '192x192', purpose: 'any' as const },
    { path: '/icons/pwa-512.png', sizes: '512x512', purpose: 'any' as const },
    { path: '/icons/pwa-512.png', sizes: '512x512', purpose: 'maskable' as const },
    { path: '/images/icon.png', sizes: '192x192', purpose: 'any' as const },
];

export function buildNucleasOsManifest(origin: string) {
    const base = origin.replace(/\/$/, '');
    const startUrl = `${base}/`;
    const manifestUrl = `${base}/nucleas-os.webmanifest`;

    return {
        ...NUCLEAS_OS_MANIFEST_DISPLAY,
        id: startUrl,
        start_url: startUrl,
        scope: `${base}/`,
        prefer_related_applications: false,
        icons: ICON_PATHS.map(({ path, sizes, purpose }) => ({
            src: `${base}${path}`,
            sizes,
            type: 'image/png',
            purpose,
        })),
        related_applications: [
            {
                platform: 'webapp',
                url: manifestUrl,
            },
        ],
    };
}

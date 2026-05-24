// Minimal service worker for PWA installability on os.nucleas.app.
// Pass-through only — no caching strategy yet.
// Do not call skipWaiting() on install to avoid spurious page reloads.

self.addEventListener('install', () => {
    // Stay in waiting until next navigation unless explicitly activated.
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
    // Required for install criteria; network handles all requests.
});

// Minimal service worker for PWA installability on os.nucleas.app.
// Pass-through only — no caching strategy yet.

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
    // Required for install criteria; network handles all requests.
});

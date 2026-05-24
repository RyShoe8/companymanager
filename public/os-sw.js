// Minimal service worker for PWA installability on os.nucleas.app.
// Pass-through network fetch (required for beforeinstallprompt on Chromium).

self.addEventListener('install', () => {
    // Stay in waiting until next navigation unless explicitly activated.
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

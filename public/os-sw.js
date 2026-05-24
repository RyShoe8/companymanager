// Minimal service worker for PWA installability on os.nucleas.app.
// Pass-through network fetch (required for beforeinstallprompt on Chromium).

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

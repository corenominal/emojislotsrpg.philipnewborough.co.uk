// ─── Cache version ────────────────────────────────────────────────────────────
// To push an update to users: bump this version string (e.g. v2, v3 …),
// then deploy.  The browser will install the new SW, delete the old cache,
// and serve fresh assets on the next page load.
const CACHE_NAME = 'emojislotsrpg-v1.16';

// ─── Assets to pre-cache on install ───────────────────────────────────────────
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/scenarios-rpg.json',
    '/css/main.css?v=a1ae2e90',
    '/js/main.js?v=49030db7',
    '/js/vendor/howler.js',
    '/fonts/BitcountGridSingleInk.css',
    '/fonts/BitcountGridSingleInk.woff2',
    '/fonts/BitcountGridSingleInk.woff',
    '/img/background.png',
    '/img/coin_color.svg',
    '/audio/arcade-tide.mp3',
    '/audio/coin-down.mp3',
    '/audio/coin-up.mp3',
    '/audio/game-over.mp3',
    '/audio/lose.mp3',
    '/audio/pixel-tide.mp3',
    '/audio/poop.mp3',
    '/audio/reel-stop.mp3',
    '/audio/bleep.mp3',
    '/audio/spinner.mp3',
    '/audio/spinning.mp3',
    '/audio/start.mp3',
    '/audio/win-epic.mp3',
    '/audio/win.mp3',
    '/apple-touch-icon.png',
    '/favicon.ico',
    '/icon-16x16.png',
    '/icon-32x32.png',
    '/icon-48x48.png',
    '/icon-64x64.png',
    '/icon-96x96.png',
    '/icon-128x128.png',
    '/icon-144x144.png',
    '/icon-152x152.png',
    '/icon-192x192.png',
    '/icon-256x256.png',
    '/icon-512x512.png',
    '/screenshot-mobile.png',
    '/screenshot-wide.png',
];

// ─── Install: pre-cache all assets ────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// ─── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ─── Fetch: cache-first, fall back to network ─────────────────────────────────
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                if (response.ok) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            });
        })
    );
});

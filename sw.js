/* PokéBattler 3.5.0 — service worker for the home-screen app.
   The game page is fetched fresh whenever there's a connection (so a new
   version shows up the next time the app is opened) and served from the cache
   when there isn't. Icons and the manifest come from the cache; the fonts are
   cached the first time they load, so the app looks the same offline. */
const VERSION = '3.5.0';
const CACHE = 'pokebattler-' + VERSION;
const FONTS = 'pokebattler-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith('pokebattler-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: cache first, fill the cache the first time
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if(res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }
  if(url.origin !== location.origin) return;
  // the game itself: network first (with a timeout), cache as the fallback
  if(req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')){
    e.respondWith(withTimeout(fetch(req), 4000).then(res => {
      if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html', { ignoreSearch: true }).then(hit => hit || caches.match('./'))));
    return;
  }
  // everything else we ship: cache first
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});

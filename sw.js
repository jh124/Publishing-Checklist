// Keep the installed app shell ready to open, even on a slow or absent network.
const PREFIX = `publishing-checklist:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}v4`;
const ASSETS = [
  './', './index.html', './styles.css?v=4', './core.js?v=4', './app.js?v=4',
  './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './manifest.webmanifest',
];
const SHELL_URLS = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const navigation = request.mode === 'navigate';
  if (!navigation && !SHELL_URLS.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = navigation
      ? (await cache.match('./')) || (await cache.match('./index.html'))
      : await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      return response;
    } catch { return Response.error(); }
  })());
});

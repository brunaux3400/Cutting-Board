// Cutting Board service worker
// - Network first, so new versions show right after you push to GitHub
// - Shows push notifications (with the phone's notification sound) and
//   tells an open copy of the app to refresh and chime right away
const CACHE = 'cutting-board-v4.1'; // match APP_VERSION in index.html

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./')))
  );
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Cutting Board', {
      body: d.body || '',
      tag: d.tag,
      renotify: true,          // sound/buzz again even if replacing an older one
      silent: false,           // use the phone's notification sound
      vibrate: [80, 60, 80],   // Android
      data: { url: d.url || self.registration.scope },
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(wins => wins.forEach(w => w.postMessage({ type: 'push', title: d.title, body: d.body }))),
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    for (const w of wins) if ('focus' in w) return w.focus();
    return self.clients.openWindow(e.notification.data.url);
  }));
});

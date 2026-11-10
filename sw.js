/* Service Worker — cache app shell agar bisa dibuka offline setelah kunjungan pertama. */
const CACHE = 'kasir-wifi-v1.4.1'; /* NAIKKAN tiap rilis — kalau tidak, PWA di HP bisa terus memakai file lama dari cache offline. */
const FILES = ['index.html', 'cek.html', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(() => caches.match('index.html'))));
});

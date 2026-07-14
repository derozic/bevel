/* BEVEL service worker — install shell + show agent program notifications */
const CACHE = 'bevel-shell-v3'
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Network-first; never cache HTML navigations (avoids stale dual-chrome shells)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') || Response.error()),
    )
    return
  }
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone()
        if (res.ok && (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest')) {
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => undefined)
        }
        return res
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
  )
})

/** Client → SW: show a desktop notification for agent program events */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'bevel:notify') return
  const title = data.title || 'BEVEL'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'bevel-agent',
    data: { url: data.url || '/^general' },
    renotify: Boolean(data.renotify),
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/^general'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate?.(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    }),
  )
})

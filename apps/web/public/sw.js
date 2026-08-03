/* BEVEL service worker — install shell + show agent program notifications */
const CACHE = 'bevel-shell-v4'
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

function safeResponse(value) {
  if (value instanceof Response) return value
  return new Response('', { status: 504, statusText: 'Offline' })
}

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
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return
  // Never intercept API / Next internals / auth (avoids broken RSC + opaque errors)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => safeResponse(res))
        .catch(async () => {
          const hit = await caches.match('/')
          return safeResponse(hit)
        }),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (
          res &&
          res.ok &&
          (url.pathname.startsWith('/icons/') ||
            url.pathname === '/manifest.webmanifest')
        ) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => undefined)
        }
        return safeResponse(res)
      })
      .catch(async () => {
        const hit = await caches.match(request)
        if (hit) return hit
        const home = await caches.match('/')
        return safeResponse(home)
      }),
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
    data: { url: data.url || '/me' },
    renotify: Boolean(data.renotify),
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/me'
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

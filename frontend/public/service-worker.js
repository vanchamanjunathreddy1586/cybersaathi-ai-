const CACHE_NAME = 'cybersaathi-shell-v2'
const SHELL_PATHS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/cybersaathi.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]
const STATIC_ASSET = /\.(?:css|js|mjs|svg|png|webp|woff2?)$/i

function isPublicStaticRequest(request, url) {
  return request.method === 'GET' &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/api/') &&
    !url.search &&
    !request.headers.has('authorization') &&
    STATIC_ASSET.test(url.pathname)
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const shellResponse = await fetch('/index.html', { cache: 'reload' })
    if (!shellResponse.ok) throw new Error('The app shell could not be cached.')
    await cache.put('/index.html', shellResponse.clone())
    const html = await shellResponse.text()
    const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:css|js|mjs|svg|png|webp|woff2?)(?:\?[^"]*)?)"/gi)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && !url.pathname.startsWith('/api/'))
    const shellRequests = await Promise.all(SHELL_PATHS.map(async (path) => {
      try {
        const response = await fetch(path, { cache: 'reload' })
        if (response.ok) await cache.put(path, response)
      } catch {
        if (path === '/') throw new Error('The app shell could not be cached.')
      }
    }))
    void shellRequests
    await Promise.all(assetPaths.map(async (url) => {
      try {
        const response = await fetch(url.href, { cache: 'reload' })
        if (response.ok) await cache.put(url.href, response)
      } catch {
        return
      }
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = (await caches.keys())
      .filter((key) => key.startsWith('cybersaathi-shell-'))
      .sort((first, second) => Number(second.slice('cybersaathi-shell-v'.length)) -
        Number(first.slice('cybersaathi-shell-v'.length)))
    await Promise.all(keys.slice(2).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put('/index.html', response.clone())
        }
        return response
      } catch {
        const cache = await caches.open(CACHE_NAME)
        return await cache.match('/index.html') ?? await cache.match('/offline.html')
      }
    })())
    return
  }
  if (!isPublicStaticRequest(request, url)) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    let cached = await cache.match(request, { ignoreVary: true })
    if (!cached) {
      const oldCacheNames = (await caches.keys())
        .filter((key) => key.startsWith('cybersaathi-shell-') && key !== CACHE_NAME)
      for (const name of oldCacheNames) {
        cached = await (await caches.open(name)).match(request, { ignoreVary: true })
        if (cached) break
      }
    }
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
    return response
  })())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = {}
  }
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 100) : 'CyberSaathi security update'
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 180) : 'Open CyberSaathi to review your security alerts.'
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'cybersaathi-update',
    data: { path: '/security/alerts' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const path = event.notification.data?.path
    const destination = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
      ? new URL(path, self.location.origin)
      : new URL('/security/alerts', self.location.origin)
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.navigate(destination.href)
        return client.focus()
      }
    }
    return self.clients.openWindow(destination.href)
  })())
})

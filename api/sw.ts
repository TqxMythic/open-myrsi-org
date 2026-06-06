
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generated once at server startup — changes on every redeployment to bust SW cache
const DEPLOY_ID = Date.now().toString(36);

export default async function handler(req: Request, res: Response) {
    // Single-org: read branding straight from the settings table.
    const { data } = await supabase.from('settings').select('key, value').in('key', ['brandingConfig', 'openGraphConfig']);
    const settings = (data || []).reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {});
    const branding = settings.brandingConfig || {};
    const meta = settings.openGraphConfig || {};

    const appName = branding.name || 'Operations Terminal';
    const iconUrl = meta.pwaIconUrl || branding.iconUrl || '/icon.svg';

    // These admin-controlled strings are interpolated into the service-worker
    // source. JSON.stringify produces a complete, correctly-escaped JS string
    // literal (quotes, backslashes, newlines, control chars), so it is
    // substituted WITHOUT surrounding quotes. The CSP nonce does not cover
    // /sw.js (served as JS), so this is the only defence at this sink.
    const appNameJs = JSON.stringify(appName);
    const iconUrlJs = JSON.stringify(iconUrl);

    const swCode = `
const CACHE_NAME = 'myrsi-v19-${DEPLOY_ID}';
const APP_ICON = ${iconUrlJs};

// Only pre-cache same-origin assets — external icon URLs are fetched normally by the browser.
// NEVER pre-cache index.html; it must always come from the network so deployments
// with new JS chunk hashes don't get stuck serving stale HTML.
const urlsToCache = [
  APP_ICON
].filter(url => url.startsWith('/'));

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url => {
          return cache.add(url).catch(err => console.warn('SW: Failed to cache ' + url, err));
        })
      );
    })
  );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Don't intercept API calls or cross-origin requests
  if (url.pathname.startsWith('/api/') || !url.origin.includes(self.location.hostname)) return;

  // NEVER intercept navigations — let the browser handle them directly.
  // index.html and /sw.js are served no-store and we cache no HTML, so handling
  // a navigation could only strand the page on a transient fetch failure (e.g.
  // during a SW swap or the Discord OAuth ?code= return). A registered SW with
  // this fetch handler still satisfies PWA installability.
  if (event.request.mode === 'navigate') return;

  // DO NOT cache JS/CSS chunks in the service worker. Vite chunks have content
  // hashes in their filenames, so the browser HTTP cache handles them via
  // Cache-Control. SW-level caching would serve outdated chunks as a fallback on
  // network errors after a deploy, causing version mismatches. Only static
  // assets like icons/fonts (which don't change between deploys) are cached.
  if (url.pathname.startsWith('/assets/')) return;

  // For other same-origin requests (icons, fonts, etc.) — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (event.request.method === 'GET' && response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Network failed: try cache, else Response.error(). Passing undefined to
        // respondWith throws and surfaces as a console error on every blocked
        // request; Response.error() is the SW equivalent of a NetworkError, so
        // the page sees the same outcome as if we hadn't intercepted.
        const cached = await caches.match(event.request);
        return cached || Response.error();
      })
  );
});

// --- PUSH NOTIFICATION HANDLERS ---

self.addEventListener('push', function(event) {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (err) {
        data = {
            title: ${appNameJs},
            body: event.data.text()
        };
    }
    
    if (!data) return;

    const isHighPriority = data.tag === 'high-priority' || data.tag === 'eam';

    const options = {
        body: data.body || 'Operational Alert',
        icon: data.icon || APP_ICON,
        badge: APP_ICON,
        vibrate: isHighPriority ? [300, 100, 300, 100, 300] : [100, 50, 100],
        data: data.data || { url: '/' },
        tag: data.tag || 'general-alert',
        renotify: data.renotify || isHighPriority,
        requireInteraction: data.requireInteraction || isHighPriority,
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(data.title || ${appNameJs}, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    // Prevent Cloudflare/browser from caching the SW script. It contains a
    // DEPLOY_ID that must change every deploy to purge old caches; a cached
    // response would leave users on a stale SW serving old JS chunks.
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(swCode);
}

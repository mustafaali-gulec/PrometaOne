/* ============================================================================
   M SUITE — Service Worker
   ---------------------------------------------------------------------------
   • Web Push API mesajlarını dinler
   • FCM/APN üzerinden gelen bildirimleri OS-level toast olarak gösterir
   • Bildirime tıklayınca uygulamayı uygun sayfaya yönlendirir
   • PWA cache: App shell + statik asset + API (offline-first hybrid)
   • Background sync (offline değişiklikler)
   • Otomatik güncelleme: install→skipWaiting, activate→clients.claim;
     istemci controllerchange ile sayfayı bir kez kendiliğinden yeniler.
============================================================================ */

const SW_VERSION = "1.3.0";
const APP_NAME = "M Suite";
const CACHE_VERSION = `msuite-app-v${SW_VERSION}`;
const RUNTIME_CACHE = `msuite-runtime-v${SW_VERSION}`;
const API_CACHE = `msuite-api-v${SW_VERSION}`;

// App shell — kurulumda öncelikli cache
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Service Worker yüklenince
self.addEventListener("install", (event) => {
  console.log("[SW] Installing v" + SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] Skip precache ${url}:`, err.message))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activated v" + SW_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION && k !== RUNTIME_CACHE && k !== API_CACHE)
            .map(k => {
              console.log("[SW] Delete old cache:", k);
              return caches.delete(k);
            })
      ))
      .then(() => self.clients.claim())
  );
});

// === FETCH — Cache stratejileri ===
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Sadece GET — POST/PUT/DELETE network'e gitsin
  if (req.method !== "GET") return;
  // Chrome extension, vs. protokolleri skip
  if (!url.protocol.startsWith("http")) return;

  // API çağrıları (backend ve ML) — Network-first
  if (
    url.pathname.startsWith("/v1/") ||
    url.pathname.startsWith("/api/") ||
    url.port === "3000" ||
    url.port === "8001"
  ) {
    event.respondWith(networkFirstWithFallback(req));
    return;
  }

  // Görsel/font assets — Stale-while-revalidate
  if (/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // JS/CSS bundle — Network-first (online'da daima taze; rebrand/guncellemeler
  // aninda gorunur, offline'da son cache'e duser)
  if (/\.(js|jsx|ts|tsx|css|mjs)$/i.test(url.pathname)) {
    event.respondWith(networkFirstRuntime(req));
    return;
  }

  // SPA navigation — index.html fallback (offline)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/index.html").then(r => r || new Response(
          "<html><body style='font-family:sans-serif;padding:40px;text-align:center'><h1>⚡ M Suite</h1><p>Çevrimdışı. Bağlantınızı kontrol edin.</p></body></html>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        ))
      )
    );
    return;
  }

  // Default — Cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => cached))
  );
});

async function networkFirstWithFallback(req) {
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ offline: true, error: "Network unavailable" }),
      { headers: { "Content-Type": "application/json" }, status: 503 }
    );
  }
}

async function networkFirstRuntime(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(resp => {
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// === BACKGROUND SYNC ===
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    console.log("[SW] Background sync triggered");
    event.waitUntil(notifyClientsSyncReady());
  }
});

async function notifyClientsSyncReady() {
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: "SYNC_REQUEST" }));
}

// Push mesajı geldi — bildirim göster
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("[SW] Push event without payload");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    // Düz metin geldiyse
    payload = {
      title: APP_NAME,
      body: event.data.text(),
    };
  }

  // Bildirim opsiyonları
  const title = payload.title || APP_NAME;
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/badge-72.png",
    tag: payload.tag || `msuite-${Date.now()}`,
    data: {
      url: payload.link || payload.url || "/",
      link: payload.link || null,
      notificationId: payload.notificationId,
      receivedAt: new Date().toISOString(),
    },
    requireInteraction: payload.requireInteraction || false,
    silent: payload.silent || false,
    vibrate: payload.vibrate || [200, 100, 200],
    actions: payload.actions || [
      { action: "open", title: "Aç" },
      { action: "dismiss", title: "Kapat" },
    ],
  };

  // Bildirim göster
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Bildirime tıklandı
self.addEventListener("notificationclick", (event) => {
  const notif = event.notification;
  notif.close();

  // "Kapat" aksiyonuna tıklandıysa hiçbir şey yapma
  if (event.action === "dismiss") return;

  // Hedef URL
  const targetUrl = notif.data?.url || "/";

  // Açık sekmeyi bul, varsa onu focus et + url'i değiştir
  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      // Önce uygulamanın açık sekmesini bul
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // Sekmeyi focus et + uygun mesaj gönder
          if ("focus" in client) {
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              link: notif.data?.link,
              notificationId: notif.data?.notificationId,
              url: targetUrl,
            });
            return client.focus();
          }
        }
      }
      // Açık sekme yok — yeni pencere aç
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Bildirim kapatıldı (kullanıcı manuel)
self.addEventListener("notificationclose", (event) => {
  // Backend'e telemetri gönderilebilir
  console.log("[SW] Notification dismissed:", event.notification.tag);
});

// Mesaj — uygulamadan SW'ye iletişim (skipWaiting tetikleme vb.)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CLEAR_CACHE") {
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
  if (event.data?.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: SW_VERSION });
  }
});

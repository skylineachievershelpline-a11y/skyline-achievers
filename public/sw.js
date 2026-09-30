// Service worker: makes the site installable, keeps the app working offline
// (saved screens + app files), and shows push notifications while the app is
// closed. Training media is never cached.
const CACHE = "skyline-shell-v4";
const SHELL = ["/", "/dashboard", "/beginners", "/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const MEDIA = /\.(mp4|webm|mov|m4a|mp3|ogg|wav)$/i;
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com$/;
const PAGE_NETWORK_TIMEOUT = 1500;

function saveCopy(key, response) {
  const copy = response.clone();
  void caches.open(CACHE).then((cache) => cache.put(key, copy));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Designed fonts: served instantly from storage after the first visit.
  if (FONT_HOSTS.test(url.origin)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request)
          .then((response) => {
            if (response.ok || response.type === "opaque") saveCopy(request, response);
            return response;
          })
          .catch(() => cached);
        return cached || fresh;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api")) return;
  if (MEDIA.test(url.pathname) || request.headers.has("range")) return;

  // App files (scripts, styles, fonts, images): saved once, served instantly.
  const isAsset =
    url.pathname.startsWith("/assets/") ||
    /\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) saveCopy(request, response);
            return response;
          }),
      ),
    );
    return;
  }

  // Screens: the saved copy opens instantly, a fresh copy is saved in the
  // background. With no saved copy, the network gets 1.5 seconds before we
  // fall back to the saved home screen instead of spinning.
  event.respondWith(
    (async () => {
      const cached = (await caches.match(url.pathname)) || (await caches.match(request));

      const fromNetwork = fetch(request)
        .then((response) => {
          if (response.ok && request.mode === "navigate") saveCopy(url.pathname, response);
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        // Fresh copy if the network answers fast, otherwise the saved screen.
        const quick = await Promise.race([
          fromNetwork,
          new Promise((resolve) => setTimeout(() => resolve(undefined), PAGE_NETWORK_TIMEOUT)),
        ]);
        if (quick) return quick;
        event.waitUntil(fromNetwork);
        return cached;
      }

      const guarded = await Promise.race([
        fromNetwork,
        new Promise((resolve) => setTimeout(() => resolve(undefined), PAGE_NETWORK_TIMEOUT)),
      ]);
      if (guarded) return guarded;

      const shell =
        (await caches.match("/dashboard")) || (await caches.match("/beginners")) || (await caches.match("/"));
      if (shell) return shell;

      const late = await fromNetwork;
      if (late) return late;
      return new Response("You are offline.", {
        status: 503,
        headers: { "content-type": "text/plain" },
      });
    })(),
  );
});

// ---------------------------------------------------------------------------
// Push notifications: arrive even when the app is fully closed.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: "Skyline Achievers", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Skyline Achievers";
  const path = payload.path || "/notifications";
  const isAdminAlert = path.startsWith("/admin") || payload.tag === "admin";
  const options = {
    body: payload.body || "",
    icon: isAdminAlert ? "/admin-icon-192.png" : "/app-icon-192.png",
    badge: isAdminAlert ? "/admin-icon-192.png" : "/app-icon-192.png",
    tag: payload.tag || "skyline",
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [240, 90, 240, 90, 360],
    timestamp: Date.now(),
    data: { path },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const path = (event.notification.data && event.notification.data.path) || "/notifications";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          void client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

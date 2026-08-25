// Minimal service worker: makes the site installable and serves a cached
// shell when the member is offline. Training media is never cached.
const CACHE = "skyline-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && SHELL.includes(url.pathname)) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const shell = await caches.match("/");
        if (shell) return shell;
        return new Response("You are offline.", {
          status: 503,
          headers: { "content-type": "text/plain" },
        });
      }),
  );
});

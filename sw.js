// Offline support: keeps a copy of the app on the device so it opens without internet (e.g. on a plane).
// Online  → always loads the newest version from the site (and refreshes the saved copy).
// Offline → opens the saved copy. Your progress lives on the device anyway and syncs when you're back online.
const CACHE = "m-trainer-v1";
const PAGE = "/index.html";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", PAGE])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/.netlify/")) return;  // sync/report: never cached
  const isPage = req.mode === "navigate" || url.pathname === "/" || url.pathname === PAGE;
  if (!isPage) return;
  e.respondWith((async () => {
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 4000);   // slow airport wifi → fall back after 4 s
      const fresh = await fetch(req, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (fresh.ok) { const c = await caches.open(CACHE); c.put(PAGE, fresh.clone()); }
      return fresh;
    } catch (err) {
      return (await caches.match(PAGE)) || (await caches.match("/")) || new Response("Offline and the app isn't saved yet: open it once with internet.", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});

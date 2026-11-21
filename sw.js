/* Leónida Hoy · service worker 31919ea8d4 */
const STATIC = "lh-static-31919ea8d4";
const PAGES = "lh-pages";
const CORE = ["/","/en/","/offline.html","/assets/styles.css?v=e4daf35d","/assets/app.js?v=9f9f91c7","/assets/fonts.css?v=f5e6a05c","/assets/fonts/inter-latin.woff2","/assets/fonts/anton-latin.woff2","/assets/fonts/yellowtail-latin.woff2","/assets/favicon.svg","/assets/icon-192.png","/assets/icon-maskable-192.png"];
const OFFLINE = "/offline.html";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lh-static-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => (self.registration.navigationPreload ? self.registration.navigationPreload.enable() : null))
      .then(() => self.clients.claim())
  );
});
const trim = async (name, max) => {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
};
// Páginas precargadas al tocar un enlace (Safari/Firefox): se sirven al instante si tienen menos de 90 s
const WARM = "lh-warm";
const warmPut = async (req) => {
  const res = await fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" }));
  if (res && res.ok && res.type === "basic") {
    const h = new Headers(res.headers); h.set("x-lh-at", String(Date.now()));
    const body = await res.clone().blob();
    const c = await caches.open(WARM);
    await c.put(req.url, new Response(body, { status: res.status, statusText: res.statusText, headers: h }));
    caches.open(PAGES).then((p) => p.put(req.url, res)).then(() => trim(PAGES, 60));
    trim(WARM, 12);
  }
  return new Response(null, { status: 204 });
};
const warmTake = async (url) => {
  const c = await caches.open(WARM);
  const hit = await c.match(url);
  if (!hit) return null;
  c.delete(url);
  return Date.now() - Number(hit.headers.get("x-lh-at") || 0) < 90000 ? hit : null;
};
const pageFirst = async (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    const w = await warmTake(req.url);
    if (w) { if (event.preloadResponse) event.waitUntil(event.preloadResponse.catch(() => {})); return w; }
  }
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || (await fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" })));
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.put(req.url, copy)).then(() => trim(PAGES, 60));
    }
    return res;
  } catch (err) {
    const cached = (await caches.match(req.url, { ignoreSearch: true })) || (await caches.match(OFFLINE));
    return cached || Response.error();
  }
};
const assetCache = async (req) => {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(STATIC).then((c) => c.put(req, copy));
  }
  return res;
};
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("/sw.js")) return;
  if (req.headers.get("x-lh-warm") === "1") { e.respondWith(warmPut(req).catch(() => new Response(null, { status: 204 }))); return; }
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(pageFirst(e));
    return;
  }
  if (/\.(css|js|woff2|png|svg|webmanifest)$/.test(url.pathname)) e.respondWith(assetCache(req));
});

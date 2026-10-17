// Service worker: solo cachea la carcasa de la app. Los precios siempre van a la red,
// para no enseñar nunca un precio guardado como si fuera el último.
const VERSION = "gasol-v1";
const CARCASA = [
  "./",
  "index.html",
  "privacidad.html",
  "assets/app.css",
  "assets/app.js",
  "manifest.webmanifest",
  "assets/icons/favicon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CARCASA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Red primero; la caché solo sirve si no hay conexión.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && CARCASA.some((p) => url.pathname.endsWith(p.replace("./", "/")))) {
          const copia = r.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))),
  );
});

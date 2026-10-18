// Service worker: solo cachea la carcasa de la app. Los precios siempre van a la red,
// para no enseñar nunca un precio guardado como si fuera el último.
const VERSION = "gasol-v25";
const CARCASA = [
  "./",
  "index.html",
  "inicio.html",
  "comparador.html",
  "assets/portada.css",
  "assets/img/logo.webp",
  "assets/img/logo.png",
  "privacidad.html",
  "aviso-legal.html",
  "assets/img/whitemoon-logo-3d.webp",
  "assets/img/whitemoon-logo-3d.png",
  "ruta.html",
  "cuenta.html",
  "calculadoras.html",
  "favoritas.html",
  "gastos.html",
  "ingresos.html",
  "vencimientos.html",
  "assets/app.css",
  "assets/app.js",
  "assets/nav.js",
  "assets/iconos.js",
  "assets/iconos.svg",
  "assets/config.js",
  "assets/sesion.js",
  "assets/calculos.js",
  "assets/ruta.js",
  "assets/cuenta.js",
  "assets/calculadoras.js",
  "assets/favoritas.js",
  "assets/ficha.js",
  "assets/fechas.js",
  "assets/gastos.js",
  "assets/gastos-vista.js",
  "assets/ingresos.js",
  "assets/ingresos-vista.js",
  "assets/vencimientos.js",
  "assets/vencimientos-vista.js",
  "assets/inicio.js",
  "assets/favoritas-vista.js",
  "manifest.webmanifest",
  "assets/icons/favicon-48.png",
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
    fetch(e.request, { cache: "no-cache" }) // revalida siempre: GitHub Pages sirve max-age=600
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

// Avisos push: texto corto, sin botones de acción (nada que tocar al volante).
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Gasol-IA", {
    body: d.cuerpo || "Hay cambios de precio en tu ruta.",
    icon: "assets/icons/icon-192.png",
    badge: "assets/icons/icon-192.png",
    tag: "gasol-ruta",
    renotify: false,
    silent: false,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((ws) => {
    const abierta = ws.find((w) => w.url.includes("ruta.html"));
    return abierta ? abierta.focus() : self.clients.openWindow("ruta.html");
  }));
});

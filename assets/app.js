// Gasol-IA · comparador. Vanilla JS, sin dependencias salvo Leaflet bajo demanda.
import { API as BASE, mostrarCuentas } from "./config.js";
import { botonEstrella, leerPreferencias } from "./favoritas.js";

mostrarCuentas();

const API = `${BASE}/gasol-buscar`;
const LEAFLET = {
  css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  cssSri: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
  js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  jsSri: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
};
const LIMITE = 200;

const $ = (id) => document.getElementById(id);
const form = $("filtros");
const selProvincia = $("provincia");
const selMunicipio = $("municipio");
const estado = $("estado");
const lista = $("lista");
const botonMapa = $("ver-mapa");
const contMapa = $("mapa");

const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});
const euros = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const km = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

let territorios = [];
let ultimos = [];
let mapa = null;
let capaMarcadores = null;

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const h of hijos) if (h) n.append(h);
  return n;
}

function avisar(texto, error = false) {
  estado.textContent = texto;
  estado.classList.toggle("error", error);
}

const capitalizar = (s) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// ---- Territorios -----------------------------------------------------------
async function cargarTerritorios() {
  const r = await fetch(`${API}?listado=territorios`);
  if (!r.ok) throw new Error("territorios");
  territorios = (await r.json()).territorios;
  const provincias = new Map();
  for (const t of territorios) provincias.set(t.id_provincia, t.provincia);
  selProvincia.replaceChildren(el("option", { value: "", text: "Elige provincia" }));
  [...provincias].sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([id, nombre]) => selProvincia.append(el("option", { value: id, text: capitalizar(nombre) })));
}

function rellenarMunicipios(idProvincia, seleccionado = "") {
  selMunicipio.replaceChildren(el("option", { value: "", text: "Todos los municipios" }));
  const muns = territorios.filter((t) => t.id_provincia === idProvincia)
    .sort((a, b) => a.municipio.localeCompare(b.municipio, "es"));
  for (const m of muns) {
    selMunicipio.append(el("option", { value: m.id_municipio, text: `${m.municipio} (${m.n})` }));
  }
  selMunicipio.disabled = !idProvincia;
  selMunicipio.value = seleccionado;
}

// ---- Estado en la URL (compartible, sin ubicación) -------------------------
function leerUrl() {
  const q = new URLSearchParams(location.search);
  if (q.get("modo") === "cerca") form.modo.value = "cerca";
  // La URL manda; si no trae valor, las preferencias guardadas en este navegador.
  const pref = leerPreferencias();
  const combustible = q.get("combustible") || pref.combustible;
  const radio = q.get("radio") || pref.radio;
  if (combustible) form.combustible.value = combustible;
  if (radio) form.radio.value = radio;
  form.solo24.checked = q.get("solo24") === "1";
  return { provincia: q.get("provincia") ?? "", municipio: q.get("municipio") ?? "" };
}

function escribirUrl() {
  const q = new URLSearchParams();
  q.set("modo", form.modo.value);
  if (form.modo.value === "zona") {
    if (selProvincia.value) q.set("provincia", selProvincia.value);
    if (selMunicipio.value) q.set("municipio", selMunicipio.value);
  } else {
    q.set("radio", form.radio.value);
  }
  q.set("combustible", form.combustible.value);
  if (form.solo24.checked) q.set("solo24", "1");
  history.replaceState(null, "", `?${q}`);
}

function mostrarModo() {
  const modo = form.modo.value;
  document.querySelectorAll(".campos[data-modo]").forEach((c) => { c.hidden = c.dataset.modo !== modo; });
}

// ---- Ubicación -------------------------------------------------------------
function ubicacion() {
  return new Promise((ok, ko) => {
    if (!("geolocation" in navigator)) return ko(new Error("Tu navegador no permite ubicación."));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({
        // Redondeo en el dispositivo: ~1 km. Nunca se guarda.
        lat: Math.round(p.coords.latitude * 100) / 100,
        lon: Math.round(p.coords.longitude * 100) / 100,
      }),
      (e) => ko(new Error(e.code === 1
        ? "Sin permiso de ubicación. Puedes buscar por provincia."
        : "No hemos podido obtener tu ubicación. Prueba por provincia.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

// ---- Búsqueda --------------------------------------------------------------
async function buscar() {
  const q = new URLSearchParams({ combustible: form.combustible.value });
  if (form.solo24.checked) q.set("solo24", "1");
  const cerca = form.modo.value === "cerca";

  if (cerca) {
    avisar("Obteniendo tu ubicación…");
    const { lat, lon } = await ubicacion();
    q.set("lat", lat); q.set("lon", lon); q.set("radio", form.radio.value);
  } else {
    if (!selProvincia.value) { avisar("Elige una provincia.", true); selProvincia.focus(); return; }
    q.set("provincia", selProvincia.value);
    if (selMunicipio.value) q.set("municipio", selMunicipio.value);
  }

  avisar("Buscando precios…");
  const r = await fetch(`${API}?${q}`);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || "No se pudo consultar ahora mismo.");
  pintar(datos.resultados, cerca);
}

function pintar(filas, cerca) {
  ultimos = filas;
  lista.replaceChildren();
  botonMapa.hidden = filas.length === 0;
  if (mapa && !contMapa.hidden) pintarMapa();

  if (filas.length === 0) {
    avisar(form.solo24.checked
      ? "No hay estaciones con ese combustible abiertas 24 h confirmadas en esta zona. Prueba sin el filtro."
      : "No hay estaciones con ese combustible en esta zona.");
    return;
  }
  const nombreComb = form.combustible.selectedOptions[0].textContent;
  const fechas = new Set(filas.map((f) => f.fecha_captura));
  const unaFecha = fechas.size === 1 ? ` · Captura del ${fechaHora.format(new Date(filas[0].fecha_captura))} (hora peninsular)` : "";
  avisar(`${filas.length === LIMITE ? `Las ${LIMITE} más baratas` : `${filas.length} estaciones`} · ${nombreComb}, de menor a mayor precio${unaFecha}.`);

  // Puede haber empate en el mínimo: se marcan todas las que lo comparten.
  const minimo = filas[0].precio;
  filas.forEach((f) => lista.append(tarjeta(f, f.precio === minimo, cerca)));
}

function tarjeta(f, minima, cerca) {
  const chip = f.abierta_24h === "si"
    ? el("span", { class: "chip si", text: "Abierta 24 h" })
    : f.abierta_24h === "sin_confirmar"
      ? el("span", { class: "chip duda", text: "Horario sin confirmar" })
      : null;
  const horario = el("span", { text: f.horario_texto ? `Horario oficial: ${f.horario_texto}` : "Sin horario publicado" });
  const distancia = cerca && f.distancia_km != null ? el("span", { text: `a ${km.format(f.distancia_km)} km en línea recta` }) : null;
  const enlace = el("a", {
    href: `https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lon}#map=17/${f.lat}/${f.lon}`,
    rel: "noopener", target: "_blank", text: "Ver en el mapa",
  });

  return el("li", { class: `estacion${minima ? " primera" : ""}` },
    el("h3", { text: capitalizar(f.rotulo || "Sin rótulo") }),
    el("div", { class: "precio" },
      el("strong", { text: `${euros.format(f.precio)} €` }),
      el("span", { class: "unidad", text: "por litro" })),
    el("p", { class: "dir", text: `${capitalizar(f.direccion)} · ${f.municipio} (${capitalizar(f.provincia)})` }),
    el("div", { class: "meta" },
      minima ? el("span", { class: "primera-etiqueta", text: "Precio más bajo" }) : null,
      chip, horario, distancia, enlace),
    botonEstrella(f),
    el("p", { class: "captura", text: `Precio capturado el ${fechaHora.format(new Date(f.fecha_captura))} (hora peninsular) · Fuente: MITECO` }),
  );
}

// ---- Mapa (Leaflet bajo demanda) ------------------------------------------
function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((ok, ko) => {
    const css = el("link", { rel: "stylesheet", href: LEAFLET.css, integrity: LEAFLET.cssSri, crossorigin: "" });
    const js = el("script", { src: LEAFLET.js, integrity: LEAFLET.jsSri, crossorigin: "" });
    js.onload = ok; js.onerror = () => ko(new Error("No se pudo cargar el mapa."));
    document.head.append(css, js);
  });
}

function pintarMapa() {
  capaMarcadores.clearLayers();
  const puntos = [];
  const minimo = ultimos.length ? ultimos[0].precio : null;
  ultimos.forEach((f) => {
    const m = L.circleMarker([f.lat, f.lon], {
      radius: f.precio === minimo ? 9 : 6, weight: 2, color: f.precio === minimo ? "#3ddc84" : "#a7b2bd",
      fillColor: f.precio === minimo ? "#3ddc84" : "#1e252c", fillOpacity: .9,
    });
    const div = el("div", {},
      el("strong", { text: capitalizar(f.rotulo || "Sin rótulo") }), el("br"),
      document.createTextNode(`${euros.format(f.precio)} €/l · ${fechaHora.format(new Date(f.fecha_captura))}`));
    m.bindPopup(div);
    capaMarcadores.addLayer(m);
    puntos.push([f.lat, f.lon]);
  });
  if (puntos.length) mapa.fitBounds(puntos, { padding: [24, 24], maxZoom: 14 });
}

botonMapa.addEventListener("click", async () => {
  const abrir = contMapa.hidden;
  contMapa.hidden = !abrir;
  botonMapa.setAttribute("aria-expanded", String(abrir));
  botonMapa.textContent = abrir ? "Ocultar mapa" : "Ver en mapa";
  if (!abrir) return;
  try {
    await cargarLeaflet();
    if (!mapa) {
      mapa = L.map(contMapa, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "© OpenStreetMap",
      }).addTo(mapa);
      capaMarcadores = L.layerGroup().addTo(mapa);
    }
    mapa.invalidateSize();
    pintarMapa();
  } catch (e) {
    avisar(e.message, true);
  }
});

// ---- Arranque --------------------------------------------------------------
form.addEventListener("change", (e) => {
  if (e.target.name === "modo") mostrarModo();
  if (e.target === selProvincia) rellenarMunicipios(selProvincia.value);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    escribirUrl();
    await buscar();
  } catch (err) {
    avisar(err.message || "No se pudo consultar ahora mismo.", true);
  } finally {
    boton.disabled = false;
  }
});

(async () => {
  const inicial = leerUrl();
  mostrarModo();
  try {
    await cargarTerritorios();
    if (inicial.provincia) {
      selProvincia.value = inicial.provincia;
      rellenarMunicipios(inicial.provincia, inicial.municipio);
      if (form.modo.value === "zona") form.requestSubmit();
    }
  } catch {
    avisar("No se pudieron cargar las provincias. Revisa tu conexión y recarga.", true);
  }
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

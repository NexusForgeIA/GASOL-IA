// Planificador de ruta y corredor. Solo antes de salir.
import { API, CUENTAS, mostrarCuentas } from "./config.js";
import { compararDesvio, enlaceGoogleMaps, enlaceWaze, euros, puntosIntermedios } from "./calculos.js";
import { llamar, sesion } from "./sesion.js";
import { leerPreferencias } from "./favoritas.js";
import { ficha } from "./ficha.js";

const LEAFLET = {
  css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  cssSri: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
  js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  jsSri: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
};
const MAX_PARADAS = 3;
const CLAVE_RUTAS = "gasol.rutas"; // rutas guardadas en este navegador (sin cuentas)
const MAX_RUTAS_LOCALES = 20;

const $ = (id) => document.getElementById(id);
const form = $("planificador");
const estado = $("estado");
const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const km1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

let lugares = new Map(); // "Municipio (Provincia)" -> {nombre, lat, lon}
let ubicacion = null; // origen desde "Mi ubicación"
let ultimo = null; // {peticion, respuesta, puntos}
let repostaje = null; // estación elegida para la navegación
let mapa = null, capaRuta = null;

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
const avisar = (t, error = false) => { estado.textContent = t; estado.classList.toggle("error", error); };
const capitalizar = (s) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
const horasMin = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const precio3 = (n) => `${euros(n, 3)} €/l`;

// ---- Lugares ------------------------------------------------------------------
async function cargarLugares() {
  const r = await fetch(`${API}/gasol-ruta?listado=lugares`);
  if (!r.ok) throw new Error("No se pudo cargar la lista de municipios.");
  const { lugares: filas } = await r.json();
  for (const [, municipio, provincia, lat, lon] of filas) {
    const etiqueta = `${municipio} (${capitalizar(provincia.split("/")[0].trim())})`;
    if (lugares.has(etiqueta)) continue;
    lugares.set(etiqueta, { nombre: etiqueta, lat, lon });
  }
  indice = [...lugares.keys()].map((k) => [k, norm(k)]);
}

// ---- Autocompletado (lista propia: el datalist del navegador no se ve en móvil) -------
const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
let indice = [];
let activo = null;
let opcion = -1;
const lista = $("sugerencias");

function cerrarSugerencias() {
  lista.hidden = true; lista.replaceChildren(); opcion = -1;
  if (activo) activo.setAttribute("aria-expanded", "false");
}
function elegir(valor) {
  if (!activo) return;
  activo.value = valor;
  cerrarSugerencias();
  activo.dispatchEvent(new Event("change", { bubbles: true }));
}
function mostrarSugerencias(input) {
  activo = input;
  const q = norm(input.value.trim());
  if (q.length < 2 || !indice.length) { cerrarSugerencias(); return; }
  const empieza = [], contiene = [];
  for (const [k, n] of indice) {
    if (n.startsWith(q)) empieza.push(k); else if (n.includes(q)) contiene.push(k);
    if (empieza.length >= 8) break;
  }
  const res = empieza.concat(contiene).slice(0, 8);
  lista.replaceChildren(...(res.length
    ? res.map((k, i) => el("li", { role: "option", id: `sug-${i}`, text: k }))
    : [el("li", { class: "vacio", text: "Sin coincidencias: escribe el municipio con gasolinera." })]));
  const r = input.getBoundingClientRect();
  Object.assign(lista.style, { left: `${r.left + scrollX}px`, top: `${r.bottom + scrollY + 2}px`, width: `${r.width}px` });
  lista.hidden = false; opcion = -1;
  input.setAttribute("aria-expanded", "true");
}
document.addEventListener("input", (e) => { if (e.target.matches("[data-lugar]")) mostrarSugerencias(e.target); });
document.addEventListener("focusin", (e) => { if (e.target.matches("[data-lugar]") && e.target.value.trim().length >= 2) mostrarSugerencias(e.target); });
document.addEventListener("keydown", (e) => {
  if (!e.target.matches?.("[data-lugar]") || lista.hidden) return;
  const ops = [...lista.querySelectorAll('[role="option"]')];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    opcion = (opcion + (e.key === "ArrowDown" ? 1 : -1) + ops.length) % ops.length;
    ops.forEach((o, i) => o.setAttribute("aria-selected", String(i === opcion)));
    e.target.setAttribute("aria-activedescendant", ops[opcion]?.id ?? "");
  } else if (e.key === "Enter" && opcion >= 0) { e.preventDefault(); elegir(ops[opcion].textContent); }
  else if (e.key === "Escape") cerrarSugerencias();
});
// pointerdown (no click) para que el blur del input no cierre la lista antes de elegir
lista.addEventListener("pointerdown", (e) => {
  const li = e.target.closest('[role="option"]');
  if (li) { e.preventDefault(); elegir(li.textContent); }
});
document.addEventListener("pointerdown", (e) => { if (!e.target.closest("[data-lugar], #sugerencias")) cerrarSugerencias(); });

function lugarDe(input, campo) {
  if (input.id === "origen" && ubicacion && input.value === "Mi ubicación") return ubicacion;
  const l = lugares.get(input.value.trim());
  if (!l) throw new Error(`${campo}: elige un municipio de la lista.`);
  return l;
}

// ---- Paradas ------------------------------------------------------------------
function anadirParada(valor = "") {
  const cont = $("paradas");
  const n = cont.children.length + 1;
  if (n > MAX_PARADAS) return;
  const id = `parada-${Date.now()}-${n}`;
  const input = el("input", { id, "data-lugar": "", role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false", "aria-controls": "sugerencias", autocomplete: "off", placeholder: "Municipio" });
  input.value = valor;
  const quitar = el("button", { type: "button", class: "boton-sec", text: "Quitar", "aria-label": `Quitar parada ${n}` });
  const fila = el("div", { class: "campo" },
    el("label", { for: id }, el("span", { text: `Parada ${n}` })),
    el("div", { class: "fila-campo" }, input, quitar));
  quitar.addEventListener("click", () => { fila.remove(); renumerar(); });
  cont.append(fila);
  $("anadir-parada").hidden = cont.children.length >= MAX_PARADAS;
}
function renumerar() {
  [...$("paradas").children].forEach((f, i) => { f.querySelector("span").textContent = `Parada ${i + 1}`; });
  $("anadir-parada").hidden = $("paradas").children.length >= MAX_PARADAS;
}

$("anadir-parada").addEventListener("click", () => anadirParada());
$("mi-ubicacion").addEventListener("click", () => {
  if (!("geolocation" in navigator)) { avisar("Tu navegador no permite ubicación.", true); return; }
  avisar("Obteniendo tu ubicación…");
  navigator.geolocation.getCurrentPosition((p) => {
    ubicacion = {
      nombre: "Mi ubicación",
      lat: Math.round(p.coords.latitude * 100) / 100,
      lon: Math.round(p.coords.longitude * 100) / 100,
    };
    $("origen").value = "Mi ubicación";
    avisar("Ubicación lista (redondeada a ~1 km).");
  }, (e) => avisar(e.code === 1 ? "Sin permiso de ubicación. Elige un municipio." : "No hemos podido obtener tu ubicación.", true),
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});

// ---- Cálculo ------------------------------------------------------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    const origen = lugarDe($("origen"), "Origen");
    const paradas = [...$("paradas").querySelectorAll("input")].filter((i) => i.value.trim())
      .map((i, k) => lugarDe(i, `Parada ${k + 1}`));
    const destino = lugarDe($("destino"), "Destino");
    const peticion = {
      puntos: [origen, ...paradas, destino].map(({ lat, lon }) => ({ lat, lon })),
      combustible: form.combustible.value,
      lateral_km: Number(form.lateral.value),
      solo24: form.solo24.checked,
    };
    avisar("Calculando ruta y corredor…");
    const respuesta = await llamar("gasol-ruta", peticion, { privada: CUENTAS });
    ultimo = { peticion, respuesta, origen, paradas, destino };
    repostaje = null;
    pintar();
  } catch (err) {
    avisar(err.message, true);
    if (CUENTAS && err.status === 401) $("sin-sesion").hidden = false;
  } finally {
    boton.disabled = false;
  }
});

function pintar() {
  const { respuesta: r, origen, destino } = ultimo;
  $("resultado").hidden = false;
  $("resumen-ruta").textContent =
    `${origen.nombre} → ${destino.nombre}: ${km1.format(r.distancia_km)} km y ${horasMin(r.duracion_min)} según ${r.proveedor} (estimación para turismo).`;
  $("aviso-ruta").textContent = r.aviso_ruta;
  pintarCorredor();
  pintarNavegacion();
  pintarMapa().catch(() => avisar("No se pudo cargar el mapa; el resto de la ruta sí está disponible.", true));
  $("guardar").nombre.value = `${origen.nombre.split(" (")[0]} – ${destino.nombre.split(" (")[0]}`;
  $("calc-resultado").replaceChildren();
  avisar("");
  $("resultado").focus();
}

function pintarCorredor() {
  const { respuesta: r } = ultimo;
  const lista = $("corredor");
  lista.replaceChildren();
  $("atribucion-ruta").textContent = r.atribucion;
  const est = r.estaciones;
  const nombre = form.combustible.selectedOptions[0].textContent;
  if (!est.length) {
    $("resumen-corredor").textContent = r.solo24
      ? "No hay estaciones abiertas 24 h confirmadas con ese combustible en el corredor. Prueba sin el filtro o con más distancia."
      : "No hay estaciones con ese combustible en el corredor. Prueba con más distancia a la ruta.";
    return;
  }
  const f = est[0];
  $("atribucion-ruta").textContent =
    `${r.atribucion}. Datos actualizados el ${fechaHora.format(new Date(f.fecha_captura))} (hora peninsular).`;
  $("resumen-corredor").textContent =
    `${est.length} estaciones a menos de ${r.lateral_km} km de la ruta · ${nombre}, de menor a mayor precio. ` +
    `Captura del ${fechaHora.format(new Date(f.fecha_captura))} (hora peninsular)` +
    (f.fecha_anterior ? `; ✓/✗ comparan con la captura del ${fechaHora.format(new Date(f.fecha_anterior))}.` : ". Aún no hay captura anterior para comparar.");
  const minimo = f.precio;
  est.forEach((e) => lista.append(tarjeta(e, e.precio === minimo)));
}

function tarjeta(e, minima) {
  const dif = e.precio_anterior != null ? Math.abs(e.precio - e.precio_anterior) : 0;
  const tend = e.tendencia === "baja"
    ? el("span", { class: "tendencia baja", text: `✓ Baja ${euros(dif, 3)} € desde la captura anterior` })
    : e.tendencia === "sube"
      ? el("span", { class: "tendencia sube", text: `✗ Sube ${euros(dif, 3)} € desde la captura anterior` })
      : null;
  const corto = e.desvio_km != null
    ? `desvío ${km1.format(e.desvio_km)} km ida y vuelta`
    : `a ${km1.format(e.lateral_km)} km de la ruta en línea recta`;
  const desvio = e.desvio_km != null
    ? `Desvío: ${km1.format(e.desvio_km)} km y ${e.desvio_min} min, ida y vuelta por carretera desde el punto más cercano de tu ruta`
    : `A ${km1.format(e.lateral_km)} km en línea recta de la ruta (desvío por carretera no calculado)`;

  const elegir = el("button", { type: "button", class: "boton-sec", text: "Repostar aquí", "aria-pressed": "false" });
  elegir.addEventListener("click", () => {
    repostaje = repostaje?.ideess === e.ideess ? null : e;
    document.querySelectorAll("#corredor [aria-pressed]:not(.estrella)").forEach((b) => b.setAttribute("aria-pressed", "false"));
    if (repostaje) elegir.setAttribute("aria-pressed", "true");
    pintarNavegacion();
  });

  return ficha(e, {
    combustible: form.combustible.value,
    distancia: `km ${e.km_ruta} de la ruta · ${corto}`,
    chips: [
      minima ? el("span", { class: "primera-etiqueta", text: "Precio más bajo" }) : null,
      e.mas_cercana ? el("span", { class: "chip", text: "La más cercana a la ruta" }) : null,
      tend,
    ].filter(Boolean),
    detalle: [el("p", { class: "dir", text: desvio })],
    acciones: [elegir],
    clase: [e.tendencia === "baja" ? "baja" : e.tendencia === "sube" ? "sube" : "", minima ? "primera" : ""].filter(Boolean).join(" "),
  });
}

function pintarNavegacion() {
  const { origen, paradas, destino, respuesta: r } = ultimo;
  const conKm = paradas.map((p, i) => ({ ...p, km: r.paradas_km[i] ?? i }));
  const rep = repostaje ? { nombre: repostaje.rotulo, lat: repostaje.lat, lon: repostaje.lon, km: repostaje.km_ruta } : null;
  const inter = puntosIntermedios(conKm, rep);
  const { url, recortado } = enlaceGoogleMaps(origen, inter, destino);
  $("nav-google").href = url;
  const siguiente = inter[0] ?? destino;
  $("nav-waze").href = enlaceWaze(siguiente);
  $("nav-waze").textContent = `Siguiente parada en Waze`;
  $("nav-nota").textContent =
    (rep && !recortado ? `Google Maps incluye el repostaje en ${capitalizar(rep.nombre || "la estación")}. ` : "") +
    (recortado ? "En el móvil Google Maps admite 3 paradas intermedias: hemos quitado el repostaje del enlace. " : "") +
    `Waze solo abre un destino por enlace: te lleva a ${siguiente.tipo === "repostaje" ? "la estación elegida" : siguiente.nombre}. ` +
    "Abre la navegación antes de arrancar.";
}

// ---- Mapa ---------------------------------------------------------------------
function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((ok, ko) => {
    const css = el("link", { rel: "stylesheet", href: LEAFLET.css, integrity: LEAFLET.cssSri, crossorigin: "" });
    const js = el("script", { src: LEAFLET.js, integrity: LEAFLET.jsSri, crossorigin: "" });
    js.onload = ok; js.onerror = () => ko(new Error("mapa"));
    document.head.append(css, js);
  });
}

async function pintarMapa() {
  await cargarLeaflet();
  const { respuesta: r } = ultimo;
  if (!mapa) {
    mapa = L.map($("mapa"), { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);
  }
  capaRuta?.remove();
  capaRuta = L.layerGroup().addTo(mapa);
  const linea = L.polyline(r.geometria, { color: "#3ddc84", weight: 4 }).addTo(capaRuta);
  const minimo = r.estaciones[0]?.precio;
  for (const e of r.estaciones.slice(0, 60)) {
    const color = e.tendencia === "baja" ? "#3ddc84" : e.tendencia === "sube" ? "#ff8a80" : "#a7b2bd";
    L.circleMarker([e.lat, e.lon], { radius: e.precio === minimo ? 8 : 5, color, fillColor: "#1e252c", fillOpacity: .9, weight: 2 })
      .bindPopup(el("div", {}, el("strong", { text: capitalizar(e.rotulo || "Sin rótulo") }), el("br"),
        document.createTextNode(`${precio3(e.precio)} · ${fechaHora.format(new Date(e.fecha_captura))}`)))
      .addTo(capaRuta);
  }
  mapa.invalidateSize();
  mapa.fitBounds(linea.getBounds(), { padding: [20, 20] });
}

// ---- Calculadora ----------------------------------------------------------------
$("calculadora").addEventListener("submit", (e) => {
  e.preventDefault();
  const salida = $("calc-resultado");
  salida.replaceChildren();
  const est = ultimo?.respuesta.estaciones ?? [];
  const barata = est.find((x) => x.desvio_km != null);
  const cercana = est.find((x) => x.mas_cercana);
  if (barata && cercana && barata.ideess === cercana.ideess) {
    salida.append(el("p", { text: "La más barata del corredor es también la más cercana a tu ruta: no hay nada que comparar." }));
    return;
  }
  const res = compararDesvio({ litros: e.target.litros.value, consumoL100: e.target.consumo.value, barata, cercana });
  if (res.error) { salida.append(el("p", { class: "estado error", text: res.error })); return; }
  const fila = (t, a, b) => el("tr", {}, el("th", { scope: "row", text: t }), el("td", { text: a }), el("td", { text: b }));
  const tabla = el("table", { class: "tabla-calculo" },
    el("caption", { text: `Con tus datos: ${euros(res.supuestos.litros, 1)} l a repostar y ${euros(res.supuestos.consumoL100, 1)} l/100 km` }),
    el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "" }),
      el("th", { scope: "col", text: capitalizar(barata.rotulo || "Más barata") }),
      el("th", { scope: "col", text: capitalizar(cercana.rotulo || "Más cercana") }))),
    el("tbody", {},
      fila("Precio (captura)", precio3(res.barata.precio), precio3(res.cercana.precio)),
      fila("Desvío ida y vuelta", `${km1.format(res.barata.desvio_km)} km`, `${km1.format(res.cercana.desvio_km)} km`),
      fila("Litros del desvío", euros(res.barata.litros_desvio, 1), euros(res.cercana.litros_desvio, 1)),
      fila("Coste del repostaje", `${euros(res.barata.coste_repostaje)} €`, `${euros(res.cercana.coste_repostaje)} €`),
      fila("Coste del desvío", `${euros(res.barata.coste_desvio)} €`, `${euros(res.cercana.coste_desvio)} €`),
      fila("Total", `${euros(res.barata.total)} €`, `${euros(res.cercana.total)} €`)));
  const d = res.diferencia;
  const conclusion = Math.abs(d) < 0.005
    ? "Con tus datos, las dos opciones cuestan lo mismo."
    : `Con tus datos, ${d > 0 ? capitalizar(barata.rotulo || "la más barata") : capitalizar(cercana.rotulo || "la más cercana")} sale ${euros(Math.abs(d))} € más barata.`;
  salida.append(tabla, el("p", { text: conclusion }),
    el("p", { class: "nota", text: "Supuestos: el desvío se valora al precio de esa estación y con tu consumo; no incluye peajes, tiempo ni desgaste. El desvío es el que da el proveedor de rutas para turismo." }));
});

// ---- Guardar y rutas guardadas --------------------------------------------------
// Sin cuentas (demo): localStorage de este navegador. Con cuentas: gasol-cuenta.
function rutasLocales() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_RUTAS) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function escribirRutasLocales(rutas) {
  try { localStorage.setItem(CLAVE_RUTAS, JSON.stringify(rutas)); return true; } catch { return false; }
}
const punto = ({ nombre, lat, lon }) => ({ nombre, lat, lon });

$("guardar").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ultimo) return;
  const { peticion, respuesta: r, origen, paradas, destino } = ultimo;
  const nombre = e.target.nombre.value.trim().slice(0, 80);
  if (!nombre) { avisar("Ponle un nombre a la ruta.", true); return; }
  if (!CUENTAS) {
    const rutas = rutasLocales();
    if (rutas.length >= MAX_RUTAS_LOCALES) { avisar(`Puedes guardar hasta ${MAX_RUTAS_LOCALES} rutas. Borra alguna antes.`, true); return; }
    const ruta = {
      id: crypto.randomUUID?.() ?? String(Date.now()), nombre, origen: punto(origen), destino: punto(destino),
      paradas: paradas.map(punto), combustible: peticion.combustible, solo_24h: peticion.solo24,
      lateral_km: peticion.lateral_km, creada_en: new Date().toISOString(),
    };
    if (!escribirRutasLocales([ruta, ...rutas])) { avisar("Este navegador no permite guardar datos (¿modo privado?).", true); return; }
    avisar(`Ruta «${nombre}» guardada en este navegador.`);
    pintarMisRutas();
    return;
  }
  try {
    const { ruta } = await llamar("gasol-cuenta", {
      accion: "ruta_guardar",
      ruta: {
        nombre, origen, destino, paradas, combustible: peticion.combustible,
        solo_24h: peticion.solo24, lateral_km: peticion.lateral_km, geometria: r.geometria,
        distancia_km: r.distancia_km, duracion_min: r.duracion_min, proveedor: r.proveedor,
      },
    });
    if (e.target.alertas.checked) await llamar("gasol-cuenta", { accion: "ruta_alertas", id: ruta.id, activas: true });
    avisar(`Ruta «${ruta.nombre}» guardada${e.target.alertas.checked ? " con avisos" : ""}.`);
    await pintarMisRutas();
  } catch (err) { avisar(err.message, true); }
});

async function pintarMisRutas() {
  const rutas = CUENTAS ? (await llamar("gasol-cuenta", { accion: "rutas" })).rutas : rutasLocales();
  const ul = $("lista-rutas");
  ul.replaceChildren();
  $("mis-rutas").hidden = rutas.length === 0;
  $("nota-rutas").textContent = CUENTAS ? "" : "Guardadas solo en este navegador.";
  for (const r of rutas) {
    const cargar = el("button", { type: "button", class: "boton-sec", text: "Cargar" });
    const avisos = CUENTAS
      ? el("button", { type: "button", class: "boton-sec", "aria-pressed": String(r.alertas_activas), text: r.alertas_activas ? "Avisos: sí" : "Avisos: no" })
      : null;
    const borrar = el("button", { type: "button", class: "boton-sec", text: "Borrar", "aria-label": `Borrar ${r.nombre}` });
    cargar.addEventListener("click", () => {
      $("origen").value = r.origen.nombre;
      if (r.origen.nombre === "Mi ubicación") ubicacion = r.origen;
      $("destino").value = r.destino.nombre;
      $("paradas").replaceChildren();
      r.paradas.forEach((p) => anadirParada(p.nombre));
      renumerar();
      form.combustible.value = r.combustible;
      form.lateral.value = String(Number(r.lateral_km));
      form.solo24.checked = r.solo_24h;
      form.requestSubmit();
    });
    avisos?.addEventListener("click", async () => {
      try {
        await llamar("gasol-cuenta", { accion: "ruta_alertas", id: r.id, activas: !r.alertas_activas });
        await pintarMisRutas();
      } catch (err) { avisar(err.message, true); }
    });
    borrar.addEventListener("click", async () => {
      try {
        if (CUENTAS) await llamar("gasol-cuenta", { accion: "ruta_borrar", id: r.id });
        else escribirRutasLocales(rutasLocales().filter((x) => x.id !== r.id));
        await pintarMisRutas();
        avisar("Ruta borrada.");
      } catch (err) { avisar(err.message, true); }
    });
    ul.append(el("li", { class: "ruta-guardada" },
      el("strong", { text: r.nombre }),
      el("span", { class: "nota", text: ` · ${form.combustible.querySelector(`option[value="${r.combustible}"]`)?.textContent ?? r.combustible}` }),
      el("div", { class: "botones" }, cargar, avisos, borrar)));
  }
}

// ---- Arranque --------------------------------------------------------------------
mostrarCuentas();
{
  // Valores iniciales de las preferencias de este navegador (una ruta guardada los sustituye).
  const pref = leerPreferencias();
  // La ruta trabaja en litros (calculadora de desvío): un gas de la preferencia no se aplica.
  if (pref.combustible && form.combustible.querySelector(`option[value="${pref.combustible}"]`)) form.combustible.value = pref.combustible;
  if (pref.corredor) form.lateral.value = pref.corredor;
}
if (!CUENTAS) {
  $("nota-guardar-local").hidden = false;
} else {
  $("nota-guardar-local").hidden = true;
  $("boton-guardar").textContent = "Guardar";
}
(async () => {
  try {
    await cargarLugares();
  } catch (err) { avisar(err.message, true); }
  if (!CUENTAS) { pintarMisRutas(); return; }
  if (!sesion()) { $("sin-sesion").hidden = false; return; }
  try { await pintarMisRutas(); } catch (err) {
    if (err.status === 401) $("sin-sesion").hidden = false;
  }
})();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

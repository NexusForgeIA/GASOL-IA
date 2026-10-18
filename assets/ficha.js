// Ficha de estación, común al comparador, la ruta y favoritas. Plegable: el resumen (marca,
// precio del combustible elegido, distancia) siempre se ve; el detalle se abre al tocar y pide
// a gasol-buscar?ficha= la dirección completa y los precios de todos los productos de la estación.
// Las funciones de datos no tocan el DOM y se prueban con Deno (ficha.test.js).
import { API } from "./config.js";
import { enlaceComoLlegar, enlaceWaze, euros } from "./calculos.js";
import { botonEstrella } from "./favoritas.js";

/** Productos de la ficha, en el orden de gasol-buscar (FICHA_COMBUSTIBLES). */
export const NOMBRES = {
  gasoleo_a: "Gasóleo A",
  gasoleo_premium: "Gasóleo Premium",
  diesel_renovable: "Diésel renovable",
  gasolina_95_e5: "Gasolina 95 E5",
  gasolina_95_e5_premium: "Gasolina 95 E5 Premium",
  gasolina_98_e5: "Gasolina 98 E5",
  glp: "GLP (autogás)",
  gnc: "GNC (gas natural comprimido)",
  gnl: "GNL (gas natural licuado)",
  biogas_comprimido: "Biogás comprimido",
  biogas_licuado: "Biogás licuado",
  adblue: "AdBlue",
};
/** El servicio oficial publica estos productos en €/kg; el resto, en €/l. */
const EN_KG = new Set(["gnc", "gnl", "biogas_comprimido", "biogas_licuado"]);
export const unidad = (combustible) => (EN_KG.has(combustible) ? "kg" : "l");
export const porUnidad = (combustible) => (EN_KG.has(combustible) ? "por kg" : "por litro");
export const ATRIBUCION = "Origen de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico";

export const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const fechaCorta = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});
export const capitalizar = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/**
 * Filas de la tabla de precios: solo productos conocidos con precio > 0 y fecha de captura
 * (nada estimado), en el orden de NOMBRES, con el elegido marcado.
 */
export function filasPrecios(precios, elegido) {
  if (!Array.isArray(precios)) return [];
  const orden = Object.keys(NOMBRES);
  const vistos = new Set();
  return precios
    .filter((p) => p && NOMBRES[p.combustible] && Number(p.precio) > 0 && p.fecha_captura && !Number.isNaN(Date.parse(p.fecha_captura)))
    .filter((p) => !vistos.has(p.combustible) && vistos.add(p.combustible))
    .sort((a, b) => orden.indexOf(a.combustible) - orden.indexOf(b.combustible))
    .map((p) => ({ combustible: p.combustible, nombre: NOMBRES[p.combustible], precio: Number(p.precio), fecha_captura: p.fecha_captura, elegido: p.combustible === elegido }));
}

/** «Calle X, 28901 Getafe · Getafe (Madrid)»; la localidad se omite si coincide con el municipio. */
export function direccionCompleta(f) {
  const dir = capitalizar(f.direccion);
  const cpLoc = [f.cp, capitalizar(f.localidad)].filter(Boolean).join(" ");
  const mun = f.municipio ? `${f.municipio}${f.provincia ? ` (${capitalizar(f.provincia)})` : ""}` : "";
  const mismo = f.localidad && f.municipio && f.localidad.toLowerCase() === f.municipio.toLowerCase();
  const partes = [dir, cpLoc].filter(Boolean).join(", ");
  return mismo ? [partes, f.provincia ? capitalizar(f.provincia) : ""].filter(Boolean).join(" · ")
    : [partes, mun].filter(Boolean).join(" · ");
}

// ---- Carga ----------------------------------------------------------------------------
const cache = new Map(); // ideess -> Promise<ficha | null>

/** Pide de una vez las fichas que no estén ya pedidas (máx. 50 por petición). */
export function precargarFichas(ids) {
  const nuevos = [...new Set(ids.map(String))].filter((id) => !cache.has(id));
  for (let i = 0; i < nuevos.length; i += 50) {
    const lote = nuevos.slice(i, i + 50);
    const peticion = fetch(`${API}/gasol-buscar?ficha=${lote.join(",")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ficha"))))
      .then((d) => new Map((d.fichas || []).map((f) => [f.ideess, f])));
    for (const id of lote) {
      const p = peticion.then((m) => m.get(id) ?? null);
      p.catch(() => cache.delete(id)); // si falla, se reintenta al volver a abrir
      cache.set(id, p);
    }
  }
}

export function cargarFicha(id) {
  precargarFichas([id]);
  return cache.get(String(id));
}

// ---- DOM ------------------------------------------------------------------------------
export function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const h of hijos) if (h) n.append(h);
  return n;
}

export function chip24(abierta) {
  return abierta === "si" ? el("span", { class: "chip si", text: "Abierta 24 h" })
    : abierta === "sin_confirmar" ? el("span", { class: "chip duda", text: "Horario sin confirmar" }) : null;
}

/**
 * e: fila de búsqueda (ideess, rotulo, direccion, municipio, provincia, lat, lon, precio,
 *    fecha_captura, abierta_24h, horario_texto). Puede venir sin precio (favoritas).
 * op.combustible: código elegido. op.distancia: texto o null. op.chips / op.detalle /
 * op.acciones: nodos extra. op.clase: clases del <li>. op.alQuitar(on): estrella.
 */
export function ficha(e, op = {}) {
  const nombreComb = NOMBRES[op.combustible] ?? op.nombreCombustible ?? "";
  const precio = e.precio != null
    ? el("span", { class: "precio" }, el("strong", { text: `${euros(e.precio, 3)} €` }), el("span", { class: "unidad", text: porUnidad(op.combustible) }))
    : el("span", { class: "precio sin" }, el("span", { class: "unidad", text: op.sinPrecio ?? `Sin precio de ${nombreComb}` }));
  const linea = [op.distancia, e.fecha_captura ? `capturado ${fechaHora.format(new Date(e.fecha_captura))}` : null].filter(Boolean).join(" · ");

  const resumen = el("summary", {},
    el("h3", { text: capitalizar(e.rotulo || "Sin rótulo") }),
    precio,
    linea ? el("span", { class: "ficha-linea", text: linea }) : null,
    el("span", { class: "meta" }, ...(op.chips || []), chip24(e.abierta_24h)),
    el("span", { class: "ficha-abrir", "aria-hidden": "true", text: "Ver ficha" }),
  );

  const dir = el("p", { class: "dir", text: [capitalizar(e.direccion), e.municipio].filter(Boolean).join(" · ") });
  const horario = el("p", { class: "ficha-horario" },
    chip24(e.abierta_24h), document.createTextNode(e.horario_texto ? ` Horario publicado por la estación: ${e.horario_texto}` : " Sin horario publicado"));
  const tabla = el("div", { class: "ficha-precios" }, el("p", { class: "nota", text: "Cargando los precios de esta estación…" }));
  const atrib = el("p", { class: "captura", text: e.fecha_captura
    ? `${ATRIBUCION}. Precio capturado el ${fechaHora.format(new Date(e.fecha_captura))} (hora peninsular).`
    : `${ATRIBUCION}.` });
  const llegar = el("div", { class: "botones" });
  const pintarLlegar = (p) => {
    if (!(p.lat && p.lon) || llegar.childElementCount) return;
    llegar.append(
      el("a", { class: "boton", href: enlaceComoLlegar(p), target: "_blank", rel: "noopener", text: "Cómo llegar · Google Maps" }),
      el("a", { class: "boton-sec", href: enlaceWaze(p), target: "_blank", rel: "noopener", text: "Waze" }),
    );
  };
  pintarLlegar(e);

  const detalle = el("div", { class: "ficha-detalle" },
    dir, horario, ...(op.detalle || []), tabla,
    llegar,
    el("div", { class: "botones" }, botonEstrella(e, op.alQuitar), ...(op.acciones || [])),
    atrib);

  const details = el("details", {}, resumen, detalle);
  let pedida = false;
  const abrir = resumen.querySelector(".ficha-abrir");
  details.addEventListener("toggle", async () => {
    abrir.textContent = details.open ? "Ocultar ficha" : "Ver ficha";
    if (!details.open || pedida) return;
    pedida = true;
    try {
      const f = await cargarFicha(e.ideess);
      if (!f) throw new Error("sin ficha");
      dir.textContent = direccionCompleta(f);
      pintarLlegar(f);
      tabla.replaceChildren(tablaPrecios(filasPrecios(f.precios, op.combustible)));
      const ultima = filasPrecios(f.precios).map((p) => p.fecha_captura).sort().at(-1);
      if (ultima) atrib.textContent = `${ATRIBUCION}. Datos actualizados el ${fechaHora.format(new Date(ultima))} (hora peninsular).`;
    } catch {
      pedida = false;
      tabla.replaceChildren(el("p", { class: "nota", text: "No se pudieron cargar los demás precios. Cierra y abre la ficha para reintentar." }));
    }
  });

  return el("li", { class: `estacion ficha${op.clase ? ` ${op.clase}` : ""}` }, details);
}

function tablaPrecios(filas) {
  if (!filas.length) return el("p", { class: "nota", text: "Esta estación no publica precios de estos productos en la última captura." });
  const cuerpo = el("tbody");
  for (const f of filas) {
    cuerpo.append(el("tr", { class: f.elegido ? "elegido" : "" },
      el("th", { scope: "row" }, document.createTextNode(f.nombre), f.elegido ? el("span", { class: "chip si", text: "Tu combustible" }) : null),
      el("td", { text: `${euros(f.precio, 3)} €/${unidad(f.combustible)}` }),
      el("td", {}, el("time", { datetime: f.fecha_captura, title: fechaHora.format(new Date(f.fecha_captura)), text: fechaCorta.format(new Date(f.fecha_captura)) }))));
  }
  return el("table", { class: "tabla-calculo tabla-ficha" },
    el("caption", { text: "Precios de esta estación publicados en la última captura (día/mes y hora peninsular). Los gases, por kg." }),
    el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Producto" }), el("th", { scope: "col", text: "Precio" }), el("th", { scope: "col", text: "Capturado" }))),
    cuerpo);
}

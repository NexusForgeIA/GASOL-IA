// Cálculos del planificador. Módulo ES puro (sin DOM): lo usa ruta.js y lo prueba Deno.
// Ningún número sale de aquí sin un dato del usuario o de la captura oficial.

/** Máximo de paradas intermedias que Google Maps abre en navegadores móviles. */
export const MAX_WAYPOINTS_MOVIL = 3;

const coord = (p) => `${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`;

/**
 * Ordena paradas y repostaje por su km a lo largo de la ruta.
 * paradas: [{nombre, lat, lon, km}], repostaje: {nombre, lat, lon, km} | null
 */
export function puntosIntermedios(paradas, repostaje) {
  const todos = [...paradas.map((p) => ({ ...p, tipo: "parada" }))];
  if (repostaje) todos.push({ ...repostaje, tipo: "repostaje" });
  return todos.sort((a, b) => a.km - b.km);
}

/**
 * Enlace de Google Maps (URL universal de Maps). Si hay más intermedios de los que
 * admite el móvil, se conservan las paradas del usuario y se quita el repostaje.
 */
export function enlaceGoogleMaps(origen, intermedios, destino) {
  let lista = intermedios;
  let recortado = false;
  if (lista.length > MAX_WAYPOINTS_MOVIL) {
    lista = lista.filter((p) => p.tipo !== "repostaje").slice(0, MAX_WAYPOINTS_MOVIL);
    recortado = true;
  }
  const q = new URLSearchParams({ api: "1", origin: coord(origen), destination: coord(destino), travelmode: "driving" });
  if (lista.length) q.set("waypoints", lista.map(coord).join("|"));
  return { url: `https://www.google.com/maps/dir/?${q}`, recortado };
}

/** Waze solo admite un destino por enlace: se usa para la siguiente parada. */
export function enlaceWaze(punto) {
  return `https://waze.com/ul?ll=${encodeURIComponent(coord(punto))}&navigate=yes`;
}

/**
 * Compara repostar en la más barata del corredor frente a la más cercana a la ruta.
 * Todos los datos vienen del usuario (litros, consumo) o de la captura (precio,
 * desvío). El combustible del desvío se valora al precio de esa misma estación.
 */
export function compararDesvio({ litros, consumoL100, barata, cercana }) {
  const n = (v) => Number(String(v).replace(",", "."));
  const L = n(litros), C = n(consumoL100);
  if (!(L > 0 && L <= 2000)) return { error: "Indica los litros que vas a repostar (entre 1 y 2.000)." };
  if (!(C > 0 && C <= 100)) return { error: "Indica tu consumo en litros cada 100 km (entre 1 y 100)." };
  for (const e of [barata, cercana]) {
    if (!(e && e.precio > 0 && e.desvio_km != null && e.desvio_km >= 0)) {
      return { error: "Falta el desvío por carretera de alguna de las dos estaciones." };
    }
  }
  const opcion = (e) => {
    const litrosDesvio = (e.desvio_km * C) / 100;
    const repostaje = L * e.precio;
    const desvio = litrosDesvio * e.precio;
    return { precio: e.precio, desvio_km: e.desvio_km, litros_desvio: litrosDesvio, coste_repostaje: repostaje, coste_desvio: desvio, total: repostaje + desvio };
  };
  const a = opcion(barata), b = opcion(cercana);
  return { barata: a, cercana: b, diferencia: b.total - a.total, supuestos: { litros: L, consumoL100: C } };
}

export const euros = (n, dec = 2) =>
  new Intl.NumberFormat("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);

// ---- Calculadoras (calculadoras.html) ---------------------------------------
// Todas las cifras de consumo, capacidad, km y precio habitual las pone el usuario.
// El único dato externo es el precio de la zona, que llega con su fecha de captura.
// Los límites solo descartan errores de tecleo; no son valores por defecto.

/** Lee un número escrito por el usuario (admite coma decimal). Vacío → NaN. */
export function leerNumero(v) {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return s === "" ? NaN : Number(s);
}

/** Redondeo a `dec` decimales sin el error típico de coma flotante (1,005 → 1,01). */
export function redondear(n, dec = 2) {
  const f = 10 ** dec;
  return Math.round((n + Math.sign(n) * Number.EPSILON) * f) / f;
}

const LIM = {
  litros: [0, 2000, "los litros (más de 0 y hasta 2.000)"],
  precio: [0, 10, "el precio por litro (más de 0 y hasta 10 €)"],
  consumo: [0, 100, "el consumo en litros cada 100 km (más de 0 y hasta 100)"],
  km: [0, 100000, "los km (más de 0 y hasta 100.000)"],
  kmMes: [0, 100000, "los km al mes (más de 0 y hasta 100.000)"],
  capacidad: [0, 5000, "la capacidad del depósito en litros (más de 0 y hasta 5.000)"],
};

/** Valida un campo obligatorio: > 0 (o >= 0 con cero) y dentro del límite. */
function campo(valor, tipo, { cero = false } = {}) {
  const [, max, texto] = LIM[tipo];
  const n = leerNumero(valor);
  const ok = Number.isFinite(n) && (cero ? n >= 0 : n > 0) && n <= max;
  return ok ? { n } : { error: `Indica ${texto}.` };
}

/**
 * 1 · Ahorro por repostaje: repostar en la zona elegida frente a la gasolinera habitual.
 * El desvío (km extra y consumo) es opcional; su combustible se valora al precio de la zona.
 */
export function ahorroRepostaje({ litros, precioHabitual, precioZona, kmDesvio, consumoL100 }) {
  const L = campo(litros, "litros"); if (L.error) return L;
  const H = campo(precioHabitual, "precio"); if (H.error) return { error: "Indica el precio por litro de tu gasolinera habitual (más de 0 y hasta 10 €)." };
  const Z = Number(precioZona);
  if (!(Z > 0)) return { error: "Primero consulta el precio de una zona." };
  let litrosDesvio = 0;
  if (String(kmDesvio ?? "").trim() !== "") {
    const K = campo(kmDesvio, "km", { cero: true }); if (K.error) return { error: "Indica los km extra del desvío (entre 0 y 100.000) o déjalo vacío." };
    if (K.n > 0) {
      const C = campo(consumoL100, "consumo"); if (C.error) return { error: "Para valorar el desvío, indica tu consumo en litros cada 100 km." };
      litrosDesvio = (K.n * C.n) / 100;
    }
  }
  const costeHabitual = L.n * H.n;
  const costeZona = L.n * Z;
  const costeDesvio = litrosDesvio * Z;
  const neto = costeHabitual - costeZona - costeDesvio;
  return {
    coste_habitual: redondear(costeHabitual),
    coste_zona: redondear(costeZona),
    litros_desvio: redondear(litrosDesvio),
    coste_desvio: redondear(costeDesvio),
    diferencia: redondear(neto),
    compensa: redondear(neto) > 0,
  };
}

/** 2 · Coste del viaje. */
export function costeViaje({ km, consumoL100, precio }) {
  const K = campo(km, "km"); if (K.error) return K;
  const C = campo(consumoL100, "consumo"); if (C.error) return C;
  const P = campo(precio, "precio"); if (P.error) return P;
  const litros = (K.n * C.n) / 100;
  return { litros: redondear(litros), coste: redondear(litros * P.n) };
}

/** 3 · Consumo real a partir de un llenado completo y los km desde el anterior. */
export function consumoReal({ litros, km }) {
  const L = campo(litros, "litros"); if (L.error) return L;
  const K = campo(km, "km"); if (K.error) return K;
  return { consumoL100: redondear((L.n / K.n) * 100) };
}

/** 4 · Coste por km y proyección mensual y anual (12 meses de los km que indique el usuario). */
export function costePorKm({ consumoL100, precio, kmMes }) {
  const C = campo(consumoL100, "consumo"); if (C.error) return C;
  const P = campo(precio, "precio"); if (P.error) return P;
  const M = campo(kmMes, "kmMes"); if (M.error) return M;
  const porKm = (C.n / 100) * P.n;
  return { coste_km: redondear(porKm, 3), mensual: redondear(porKm * M.n), anual: redondear(porKm * M.n * 12) };
}

/**
 * 5 · Litros por depósito. `unidad` es "pct" o "litros" y vale para el nivel actual y el
 * objetivo. Precio, consumo y objetivo son opcionales: sin ellos no se dan esas cifras.
 */
export function deposito({ capacidad, nivel, unidad = "pct", precio, consumoL100, objetivo }) {
  const Cap = campo(capacidad, "capacidad"); if (Cap.error) return Cap;
  const enLitros = (valor, que) => {
    const n = leerNumero(valor);
    if (!Number.isFinite(n)) return { error: `Indica ${que}.` };
    if (n < 0) return { error: `${que[0].toUpperCase()}${que.slice(1)} no puede ser negativo.` };
    if (unidad === "pct") {
      if (n > 100) return { error: `${que[0].toUpperCase()}${que.slice(1)} no puede superar el 100 %.` };
      return { n: (Cap.n * n) / 100 };
    }
    if (n > Cap.n) return { error: `${que[0].toUpperCase()}${que.slice(1)} no puede superar la capacidad del depósito.` };
    return { n };
  };
  const A = enLitros(nivel, "el nivel actual"); if (A.error) return A;

  const vacio = (v) => String(v ?? "").trim() === "";
  let P = null, C = null, O = null;
  if (!vacio(precio)) { P = campo(precio, "precio"); if (P.error) return P; }
  if (!vacio(consumoL100)) { C = campo(consumoL100, "consumo"); if (C.error) return C; }
  if (!vacio(objetivo)) {
    O = enLitros(objetivo, "el nivel al que quieres llegar"); if (O.error) return O;
    if (O.n < A.n) return { error: "El nivel al que quieres llegar es menor que el que ya tienes." };
  }
  const paraLlenar = Cap.n - A.n;
  return {
    litros_actuales: redondear(A.n),
    litros_para_llenar: redondear(paraLlenar),
    coste_llenar: P ? redondear(paraLlenar * P.n) : null,
    autonomia_km: C ? redondear((A.n / C.n) * 100, 0) : null,
    litros_hasta_objetivo: O ? redondear(O.n - A.n) : null,
    coste_hasta_objetivo: O && P ? redondear((O.n - A.n) * P.n) : null,
  };
}

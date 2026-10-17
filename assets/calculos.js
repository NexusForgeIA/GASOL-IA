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

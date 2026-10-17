// Geometría del corredor: funciones puras, sin red. Coordenadas [lat, lon] en grados.
// Las distancias se calculan en una proyección equirectangular local por segmento:
// error despreciable para distancias laterales de pocos km.

export type Punto = [number, number];

const R = 6371008.8; // radio medio terrestre, m
const rad = (g: number) => (g * Math.PI) / 180;

export function haversineM(a: Punto, b: Punto): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Proyección local en metros respecto a una latitud de referencia.
function xy(p: Punto, lat0: number): [number, number] {
  return [rad(p[1]) * R * Math.cos(rad(lat0)), rad(p[0]) * R];
}

/** Distancia de p al segmento a-b, en metros, y parámetro t (0..1) del punto más cercano. */
export function distanciaSegmento(p: Punto, a: Punto, b: Punto): { m: number; t: number } {
  const lat0 = (a[0] + b[0]) / 2;
  const [px, py] = xy(p, lat0);
  const [ax, ay] = xy(a, lat0);
  const [bx, by] = xy(b, lat0);
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { m: Math.hypot(px - cx, py - cy), t };
}

/** Douglas-Peucker con tolerancia en metros. Conserva primer y último punto. */
export function simplificar(puntos: Punto[], toleranciaM: number): Punto[] {
  if (puntos.length <= 2) return puntos.slice();
  const conservar = new Uint8Array(puntos.length);
  conservar[0] = conservar[puntos.length - 1] = 1;
  const pila: [number, number][] = [[0, puntos.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop()!;
    let max = -1;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanciaSegmento(puntos[k], puntos[i], puntos[j]).m;
      if (d > max) { max = d; idx = k; }
    }
    if (max > toleranciaM && idx > 0) {
      conservar[idx] = 1;
      pila.push([i, idx], [idx, j]);
    }
  }
  return puntos.filter((_, k) => conservar[k]);
}

export interface Proyeccion {
  lateralM: number; // distancia en línea recta de la estación a la ruta
  kmRuta: number; // km recorridos desde el origen hasta el punto más cercano
  punto: Punto; // punto de la ruta más cercano a la estación
}

/** Punto de la polilínea más cercano a p y su posición a lo largo de la ruta. */
export function proyectar(p: Punto, ruta: Punto[], acumulado = acumuladoM(ruta)): Proyeccion {
  let mejor = { lateralM: Infinity, kmRuta: 0, punto: ruta[0] } as Proyeccion;
  for (let i = 0; i < ruta.length - 1; i++) {
    const { m, t } = distanciaSegmento(p, ruta[i], ruta[i + 1]);
    if (m < mejor.lateralM) {
      const punto: Punto = [ruta[i][0] + t * (ruta[i + 1][0] - ruta[i][0]), ruta[i][1] + t * (ruta[i + 1][1] - ruta[i][1])];
      const seg = acumulado[i + 1] - acumulado[i];
      mejor = { lateralM: m, kmRuta: (acumulado[i] + t * seg) / 1000, punto };
    }
  }
  return mejor;
}

export function acumuladoM(ruta: Punto[]): number[] {
  const acc = [0];
  for (let i = 1; i < ruta.length; i++) acc.push(acc[i - 1] + haversineM(ruta[i - 1], ruta[i]));
  return acc;
}

/**
 * Cajas [latMin, latMax, lonMin, lonMax] que cubren la ruta en tramos de ~tramoKm,
 * ampliadas lateralKm. Sirven para pedir candidatas a la base de datos.
 */
export function cajas(ruta: Punto[], lateralKm: number, tramoKm = 50): number[][] {
  const acc = acumuladoM(ruta);
  const salida: number[][] = [];
  let inicio = 0;
  for (let i = 1; i < ruta.length; i++) {
    if (acc[i] - acc[inicio] >= tramoKm * 1000 || i === ruta.length - 1) {
      const tramo = ruta.slice(inicio, i + 1);
      const lats = tramo.map((p) => p[0]);
      const lons = tramo.map((p) => p[1]);
      const latMin = Math.min(...lats), latMax = Math.max(...lats);
      const dLat = lateralKm / 111.32;
      const dLon = lateralKm / (111.32 * Math.max(Math.cos(rad((latMin + latMax) / 2)), 0.01));
      salida.push([latMin - dLat, latMax + dLat, Math.min(...lons) - dLon, Math.max(...lons) + dLon]);
      inicio = i;
    }
  }
  return salida;
}

export type Tendencia = "baja" | "sube" | "igual" | null;

/** Compara con la captura anterior. null = no hay precio anterior con el que comparar. */
export function tendencia(precio: number, anterior: number | null | undefined): Tendencia {
  if (anterior == null) return null;
  const d = Math.round((precio - anterior) * 1000);
  return d < 0 ? "baja" : d > 0 ? "sube" : "igual";
}

export interface Candidata {
  ideess: string;
  lat: number;
  lon: number;
  precio: number;
  precio_anterior?: number | null;
  [k: string]: unknown;
}

/** Filtra candidatas a ≤ lateralKm de la ruta y añade lateral, km de ruta y tendencia. */
export function enCorredor<T extends Candidata>(cands: T[], ruta: Punto[], lateralKm: number) {
  const acc = acumuladoM(ruta);
  const salida: (T & Proyeccion & { tendencia: Tendencia })[] = [];
  for (const c of cands) {
    const pr = proyectar([c.lat, c.lon], ruta, acc);
    if (pr.lateralM <= lateralKm * 1000) {
      salida.push({ ...c, ...pr, tendencia: tendencia(c.precio, c.precio_anterior) });
    }
  }
  return salida.sort((a, b) => a.precio - b.precio || a.lateralM - b.lateralM);
}

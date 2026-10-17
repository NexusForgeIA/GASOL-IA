// Proveedor de rutas detrás de una interfaz sustituible.
// Demo: servidor público de OSRM (perfil turismo). Para producción, implementar
// ProveedorRutas con el proveedor contratado y cambiar `proveedorActivo()`.
import type { Punto } from "../_shared/corredor.ts";

export interface Ruta {
  geometria: Punto[]; // [lat, lon]
  distanciaM: number;
  duracionS: number;
}

export interface Tramo {
  distanciaM: number;
  duracionS: number;
}

export interface ProveedorRutas {
  nombre: string;
  aviso: string; // texto que se enseña siempre junto a la ruta
  ruta(puntos: Punto[]): Promise<Ruta>;
  /** Ida y vuelta desde cada punto de la ruta a su estación. null si no se puede calcular. */
  desvios(pares: { desde: Punto; hasta: Punto }[]): Promise<Tramo[] | null>;
}

const UA = { "User-Agent": "Gasol-IA/0.2 (demo; planificador antes de salir)" };
const lonlat = (p: Punto) => `${p[1].toFixed(5)},${p[0].toFixed(5)}`;

export class OsrmDemo implements ProveedorRutas {
  nombre = "OSRM (servidor de demostración)";
  aviso =
    "Ruta para turismo calculada con OSRM. No está verificada para camiones: revisa gálibos, pesos y restricciones antes de salir.";
  constructor(private base = "https://router.project-osrm.org") {}

  async ruta(puntos: Punto[]): Promise<Ruta> {
    const url = `${this.base}/route/v1/driving/${puntos.map(lonlat).join(";")}?overview=full&geometries=geojson&steps=false`;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Proveedor de rutas respondió ${r.status}`);
    const d = await r.json();
    if (d.code !== "Ok" || !d.routes?.length) throw new Error(`Sin ruta: ${d.code}`);
    const ruta = d.routes[0];
    return {
      geometria: ruta.geometry.coordinates.map(([lon, lat]: number[]) => [lat, lon] as Punto),
      distanciaM: ruta.distance,
      duracionS: ruta.duration,
    };
  }

  async desvios(pares: { desde: Punto; hasta: Punto }[]): Promise<Tramo[] | null> {
    if (!pares.length) return [];
    const n = pares.length;
    const coords = [...pares.map((p) => p.desde), ...pares.map((p) => p.hasta)];
    const todos = coords.map((_, i) => i).join(";");
    const url = `${this.base}/table/v1/driving/${coords.map(lonlat).join(";")}?sources=${todos}&destinations=${todos}&annotations=duration,distance`;
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) return null;
      const d = await r.json();
      if (d.code !== "Ok") return null;
      return pares.map((_, i) => {
        const ida = d.distances[i][n + i], vuelta = d.distances[n + i][i];
        const tIda = d.durations[i][n + i], tVuelta = d.durations[n + i][i];
        return ida == null || vuelta == null
          ? { distanciaM: NaN, duracionS: NaN }
          : { distanciaM: ida + vuelta, duracionS: tIda + tVuelta };
      });
    } catch {
      return null;
    }
  }
}

export function proveedorActivo(): ProveedorRutas {
  return new OsrmDemo();
}

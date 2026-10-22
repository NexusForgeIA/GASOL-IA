// gasol-buscar: lectura pública para la web (GET, CORS, sin clave en el cliente).
//   ?combustible=gasoleo_a&provincia=28[&municipio=4354][&solo24=1]
//   ?combustible=gasoleo_a&lat=40.42&lon=-3.70&radio=10[&solo24=1]
//   ?listado=territorios
//   ?listado=lugares   (municipios con estaciones y su centroide, para origen/destino)
//   ?combustible=gasoleo_a&ids=4375,5122   (favoritas: último precio por ID, máx. 50)
//   ?ficha=4375,5122   (ficha: datos completos y precios de los productos de FICHA_COMBUSTIBLES)
//   &limite=1..1000 (por defecto 200)
// Consulta con service_role a funciones gasol_* sin acceso público.
// RGPD: las coordenadas se redondean a 2 decimales (~1 km), no se guardan ni se
// escriben en logs, y la respuesta no se cachea.

import { ipDe, nuevoContador, superaLimite } from "../_shared/limite-cliente.ts";
import { FICHA_COMBUSTIBLES, idsValidos } from "./ids.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const COMBUSTIBLES = new Set([
  "gasoleo_a",
  "gasoleo_premium",
  "diesel_renovable",
  "adblue",
  "gasolina_95_e5",
  "gasolina_98_e5",
  "glp",
  // En €/kg (anexo de la Orden ITC/2308/2007, docs/FUENTE-DATOS.md §8).
  "gnc",
  "gnl",
  "biogas_comprimido",
  "biogas_licuado",
]);
const RADIOS = new Set([5, 10, 25, 50]);
const ATRIBUCION =
  "Origen de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
  });

async function rpc(nombre: string, args: unknown, rango = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}${rango}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${nombre} ${r.status}`);
  return r.json();
}

const redondear = (n: number) => Math.round(n * 100) / 100;

// Límite por cliente (IP, solo en memoria; ver _shared/limite-cliente.ts). Una pantalla normal hace
// pocas consultas por minuto; esto frena el bucle de un script sin molestar a nadie.
const LIMITE_MINUTO_CLIENTE = 60;
const porCliente = nuevoContador();

// Los listados casi no cambian (la carga de estaciones es diaria): se guardan en la instancia para que
// repetir ?listado=territorios no lance sus hasta 20 consultas cada vez. Si la carga falla no se guarda.
const cacheListado = new Map<string, { hasta: number; datos: Promise<unknown> }>();
function listado(nombre: string, ttlMs: number, cargar: () => Promise<unknown>) {
  const ahora = Date.now();
  const e = cacheListado.get(nombre);
  if (e && e.hasta > ahora) return e.datos;
  const datos = cargar();
  cacheListado.set(nombre, { hasta: ahora + ttlMs, datos });
  datos.catch(() => { if (cacheListado.get(nombre)?.datos === datos) cacheListado.delete(nombre); });
  return datos;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return json({ error: "Método no permitido" }, 405);
  const q = new URL(req.url).searchParams;
  const nombreListado = q.get("listado");
  const cacheado = nombreListado !== null && (cacheListado.get(nombreListado)?.hasta ?? 0) > Date.now();

  // Lo que sale de la memoria no toca la base de datos y no cuenta; el resto sí.
  if (!cacheado) {
    const espera = superaLimite(porCliente, ipDe(req), LIMITE_MINUTO_CLIENTE);
    if (espera) {
      return new Response(JSON.stringify({ error: "Demasiadas consultas seguidas. Espera un momento." }), {
        status: 429,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": String(espera) },
      });
    }
  }

  try {
    if (nombreListado === "territorios") {
      const filas = await listado("territorios", 3_600_000, async () => {
        // PostgREST devuelve como máximo 1000 filas por petición: se pagina.
        const todas: unknown[] = [];
        for (let offset = 0; offset < 20000; offset += 1000) {
          const pagina = await rpc("gasol_territorios", {}, `?limit=1000&offset=${offset}`);
          todas.push(...pagina);
          if (pagina.length < 1000) break;
        }
        return todas;
      });
      return json({ territorios: filas }, 200, "public, max-age=3600");
    }

    if (nombreListado === "lugares") {
      // Un único jsonb: [[id_municipio, municipio, provincia, lat, lon], ...]
      return json({ lugares: await listado("lugares", 3_600_000, () => rpc("gasol_lugares", {})) }, 200, "public, max-age=86400");
    }

    if (q.has("ficha")) {
      const ids = idsValidos(q.get("ficha")!);
      if (!ids) return json({ error: "IDs no válidos" }, 400);
      const fichas = await rpc("gasol_fichas", { p_ids: ids, p_combustibles: FICHA_COMBUSTIBLES });
      return json({ atribucion: ATRIBUCION, fichas }, 200, "public, max-age=600");
    }

    const combustible = q.get("combustible") ?? "gasoleo_a";
    if (!COMBUSTIBLES.has(combustible)) return json({ error: "Combustible no válido" }, 400);

    if (q.has("ids")) {
      const ids = idsValidos(q.get("ids")!);
      if (!ids) return json({ error: "IDs no válidos" }, 400);
      const filas = await rpc("gasol_estaciones_por_id", { p_ids: ids, p_combustible: combustible });
      return json({ combustible, atribucion: ATRIBUCION, resultados: filas }, 200, "public, max-age=600");
    }
    const provincia = q.get("provincia");
    const municipio = q.get("municipio");
    const lat = q.has("lat") ? Number(q.get("lat")) : null;
    const lon = q.has("lon") ? Number(q.get("lon")) : null;
    const radio = Number(q.get("radio") ?? 10);
    const limite = Number(q.get("limite") ?? 200);
    const cerca = lat !== null || lon !== null;

    if (!Number.isInteger(limite) || limite < 1 || limite > 1000) return json({ error: "Límite no válido" }, 400);
    if (provincia !== null && !/^\d{2}$/.test(provincia)) return json({ error: "Provincia no válida" }, 400);
    if (municipio !== null && !/^\d{1,6}$/.test(municipio)) return json({ error: "Municipio no válido" }, 400);
    if (cerca) {
      if (
        lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < 27 || lat > 44.5 || lon < -18.5 || lon > 4.5
      ) return json({ error: "Ubicación fuera de España o no válida" }, 400);
      if (!RADIOS.has(radio)) return json({ error: "Radio no válido" }, 400);
    } else if (!provincia && !municipio) {
      return json({ error: "Indica provincia, municipio o ubicación" }, 400);
    }

    const filas = await rpc("gasol_buscar", {
      p_combustible: combustible,
      p_id_provincia: cerca ? null : provincia,
      p_id_municipio: cerca ? null : municipio,
      p_lat: cerca ? redondear(lat!) : null,
      p_lon: cerca ? redondear(lon!) : null,
      p_radio_km: radio,
      p_solo_24h: q.get("solo24") === "1",
      p_limite: limite,
    });
    return json(
      { combustible, atribucion: ATRIBUCION, resultados: filas },
      200,
      cerca ? "no-store" : "public, max-age=600",
    );
  } catch (e) {
    // Sin parámetros en el log: pueden incluir la ubicación del usuario.
    console.error("gasol-buscar error:", e instanceof Error ? e.message : String(e));
    return json({ error: "No se pudo consultar ahora mismo" }, 502);
  }
});

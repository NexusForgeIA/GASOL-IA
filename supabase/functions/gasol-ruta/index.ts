// gasol-ruta: calcula una ruta (antes de salir) y las estaciones de su corredor.
// POST { puntos: [{lat, lon, nombre}] (2-5), combustible, solo24, lateral_km }
//   Demo (por defecto): pública, sin sesión, con topes globales por hora y por día (limites.ts).
//   GASOL_CUENTAS=1: exige sesión (Authorization: Bearer <jwt>) y limita por usuario.
// GET ?listado=lugares: municipios con estaciones y su centroide (origen/destino).
// RGPD: las coordenadas solo se usan para esta respuesta. No se guardan (salvo que el
// usuario guarde la ruta desde gasol-cuenta) ni se escriben en logs.
import { acumuladoM, cajas, enCorredor, proyectar, type Punto, simplificar } from "../_shared/corredor.ts";
import {
  ATRIBUCION, cors, ErrorHttp, respuesta, rpcServicio, tokenDe, usuario,
} from "../_shared/supa.ts";
import { contarRuta, MENSAJES_LIMITE } from "./limites.ts";
import { proveedorActivo } from "./proveedor.ts";

const CORS = cors("GET, POST");
const json = respuesta(CORS);

export const COMBUSTIBLES = new Set([
  "gasoleo_a", "gasoleo_premium", "diesel_renovable", "adblue", "gasolina_95_e5", "gasolina_98_e5", "glp",
]);
const LATERALES = new Set([1, 2, 5, 10]);
const CUENTAS = Deno.env.get("GASOL_CUENTAS") === "1";
const LIMITE_DIARIO = 30; // cálculos de ruta por usuario y día (protege al proveedor demo)
const CON_DESVIO = 25; // estaciones a las que se calcula el desvío real por carretera

function validarPunto(p: unknown): Punto {
  const q = p as { lat?: unknown; lon?: unknown };
  const lat = Number(q?.lat), lon = Number(q?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 27 || lat > 44.5 || lon < -18.5 || lon > 4.5) {
    throw new ErrorHttp(400, "Hay un punto de la ruta fuera de España o no válido.");
  }
  return [lat, lon];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET" && new URL(req.url).searchParams.get("listado") === "lugares") {
      // Un único jsonb: [[id_municipio, municipio, provincia, lat, lon], ...]
      return json({ lugares: await rpcServicio("gasol_lugares", {}) }, 200, { "Cache-Control": "public, max-age=86400" });
    }
    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
    const yo = CUENTAS ? await usuario(tokenDe(req)) : null;
    const body = await req.json().catch(() => ({}));
    const combustible = String(body.combustible ?? "gasoleo_a");
    const lateralKm = Number(body.lateral_km ?? 2);
    const solo24 = body.solo24 === true;
    if (!COMBUSTIBLES.has(combustible)) throw new ErrorHttp(400, "Combustible no válido.");
    if (!LATERALES.has(lateralKm)) throw new ErrorHttp(400, "Distancia lateral no válida.");
    if (!Array.isArray(body.puntos) || body.puntos.length < 2 || body.puntos.length > 5) {
      throw new ErrorHttp(400, "Indica origen, destino y hasta 3 paradas.");
    }
    const puntos = body.puntos.map(validarPunto);

    if (yo) {
      if (!(await rpcServicio("gasol_uso_ruta", { p_usuario: yo.id, p_limite: LIMITE_DIARIO }))) {
        throw new ErrorHttp(429, `Has llegado al límite de ${LIMITE_DIARIO} cálculos de ruta por hoy.`);
      }
    } else {
      // Tope global por hora y por día: solo contadores, sin coordenadas ni identificadores.
      const superada = await contarRuta(rpcServicio);
      if (superada) return json({ error: MENSAJES_LIMITE[superada], limite: superada }, 429);
    }

    const prov = proveedorActivo();
    const ruta = await prov.ruta(puntos);
    const geo = ruta.geometria;

    const cands = await rpcServicio("gasol_corredor_candidatas", {
      p_cajas: cajas(geo, lateralKm),
      p_combustible: combustible,
      p_solo_24h: solo24,
    });
    const corredor = enCorredor(cands, geo, lateralKm);

    // Desvío real por carretera (ida y vuelta desde el punto más cercano de la ruta)
    // para las más baratas y para la más cercana a la ruta.
    const cercana = corredor.reduce((m, e) => (m && m.lateralM <= e.lateralM ? m : e), corredor[0]);
    const elegidas = corredor.slice(0, CON_DESVIO);
    if (cercana && !elegidas.includes(cercana)) elegidas.push(cercana);
    const desvios = await prov.desvios(elegidas.map((e) => ({ desde: e.punto, hasta: [e.lat, e.lon] as Punto })));

    const salida = corredor.map((e) => {
      const i = elegidas.indexOf(e);
      const d = i >= 0 && desvios ? desvios[i] : null;
      const porCarretera = d && Number.isFinite(d.distanciaM);
      return {
        ideess: e.ideess, rotulo: e.rotulo, direccion: e.direccion, municipio: e.municipio,
        provincia: e.provincia, lat: e.lat, lon: e.lon, horario_texto: e.horario_texto,
        abierta_24h: e.abierta_24h, precio: e.precio, fecha_captura: e.fecha_captura,
        precio_anterior: e.precio_anterior ?? null, fecha_anterior: e.fecha_anterior ?? null,
        tendencia: e.tendencia,
        lateral_km: Math.round(e.lateralM / 100) / 10,
        km_ruta: Math.round(e.kmRuta),
        punto_ruta: [Number(e.punto[0].toFixed(5)), Number(e.punto[1].toFixed(5))],
        desvio_km: porCarretera ? Math.round(d!.distanciaM / 100) / 10 : null,
        desvio_min: porCarretera ? Math.round(d!.duracionS / 60) : null,
        mas_cercana: e === cercana,
      };
    });

    const acc = acumuladoM(geo);
    const paradasKm = puntos.slice(1, -1).map((p: Punto) => Math.round(proyectar(p, geo, acc).kmRuta));

    return json({
      proveedor: prov.nombre,
      aviso_ruta: prov.aviso,
      distancia_km: Math.round(ruta.distanciaM / 100) / 10,
      duracion_min: Math.round(ruta.duracionS / 60),
      paradas_km: paradasKm,
      geometria: simplificar(geo, 150).map(([la, lo]) => [Number(la.toFixed(5)), Number(lo.toFixed(5))]),
      combustible,
      lateral_km: lateralKm,
      solo24,
      atribucion: ATRIBUCION,
      estaciones: salida,
    });
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message }, e.status);
    // Sin coordenadas en el log.
    console.error("gasol-ruta error:", e instanceof Error ? e.message.slice(0, 200) : "desconocido");
    return json({ error: "No se pudo calcular la ruta ahora mismo. Inténtalo más tarde." }, 502);
  }
});

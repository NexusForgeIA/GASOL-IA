// gasol-ingest: trae el JSON oficial de precios, lo normaliza y lo carga.
// Programada una vez al día con pg_cron. Pública (--no-verify-jwt) pero exige
// la cabecera x-gasol-token, que se valida contra Vault (gasol_token_valido).
//
// Idempotente por huella: si el contenido es igual al de la última captura ok,
// solo deja un log 'duplicada'. La carga va por lotes (PostgREST corta cada
// sentencia a los 8 s) y la captura solo pasa a 'ok' al final; si algo falla,
// la última captura ok sigue siendo la que ve la web.
//
// La descarga va por pg_net (gasol_descargar): el servidor oficial solo acepta
// TLS 1.2 con intercambio RSA estático, que el fetch de Deno (rustls) no soporta.
import { FUENTE_URL, normalizar } from "./normalizar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOTE_ESTACIONES = 2000;
const LOTE_PRECIOS = 8000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-gasol-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function rpc(nombre: string, args: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${nombre} ${r.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pide la descarga a pg_net y espera el cuerpo (máx. ~130 s).
async function descargarFuente(): Promise<unknown> {
  const id = await rpc("gasol_descargar", {});
  for (let i = 0; i < 65; i++) {
    await espera(2000);
    const filas = await rpc("gasol_descarga_resultado", { p_id: id });
    if (!Array.isArray(filas) || filas.length === 0) continue;
    const [r] = filas;
    if (r.timed_out || r.error_msg) throw new Error(`Descarga fallida: ${r.error_msg ?? "timeout"}`);
    if (r.status_code !== 200) throw new Error(`Fuente respondió ${r.status_code}`);
    return JSON.parse(r.content);
  }
  throw new Error("La descarga no terminó a tiempo");
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function* lotes<T>(lista: T[], n: number) {
  for (let i = 0; i < lista.length; i += n) yield lista.slice(i, i + n);
}

async function tokenValido(recibido: string | null): Promise<boolean> {
  if (!recibido || recibido.length < 32 || recibido.length > 128) return false;
  return (await rpc("gasol_token_valido", { p_token: recibido })) === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!(await tokenValido(req.headers.get("x-gasol-token")))) return json({ error: "No autorizado" }, 401);

  const inicio = Date.now();
  let capturaId: number | null = null;
  try {
    const datos = normalizar(await descargarFuente());
    const huella = await sha256(JSON.stringify([datos.estaciones, datos.precios]));

    const ini = await rpc("gasol_captura_iniciar", {
      p_fuente: FUENTE_URL,
      p_fecha_fuente: datos.fechaFuente,
      p_huella: huella,
      p_avisos: datos.avisos,
    });
    if (ini.estado === "duplicada") {
      return json({ ...ini, fecha_fuente: datos.fechaFuente, ms: Date.now() - inicio });
    }
    capturaId = ini.captura_id;

    let estacionesCambiadas = 0;
    for (const lote of lotes(datos.estaciones, LOTE_ESTACIONES)) {
      estacionesCambiadas += await rpc("gasol_estaciones_upsert", { p_estaciones: lote });
    }
    for (const lote of lotes(datos.precios, LOTE_PRECIOS)) {
      await rpc("gasol_precios_insertar", { p_captura_id: capturaId, p_precios: lote });
    }
    const fin = await rpc("gasol_captura_cerrar", {
      p_captura_id: capturaId,
      p_n_estaciones: datos.estaciones.length,
      p_n_precios: datos.precios.length,
    });
    return json({
      ...fin,
      estaciones_cambiadas: estacionesCambiadas,
      fecha_fuente: datos.fechaFuente,
      ms: Date.now() - inicio,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("gasol-ingest error:", error);
    try {
      if (capturaId !== null) {
        await rpc("gasol_captura_fallida", { p_captura_id: capturaId, p_error: error });
      } else {
        await rpc("gasol_captura_error", { p_fuente: FUENTE_URL, p_error: error });
      }
    } catch (logErr) {
      console.error("gasol-ingest no pudo registrar el error:", logErr);
    }
    return json({ estado: "error", error }, 502);
  }
});

// gasol-visita: cuenta una apertura de la app. POST {pagina, modo} (texto JSON, sin preflight).
// Se cuentan aperturas, no personas: no se lee ni se guarda la IP, ni cabeceras, ni nada que
// identifique al dispositivo. Responde 204 (también con el tope de la hora lleno) o 400.
import { cors, rpcServicio } from "../_shared/supa.ts";
import { contarVisita, leerVisita } from "./limites.ts";

const CORS = cors("POST");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: CORS });
  const visita = leerVisita(await req.text().catch(() => ""));
  if (!visita) return new Response(null, { status: 400, headers: CORS });
  try {
    await contarVisita(rpcServicio, visita);
  } catch (e) {
    console.error("gasol-visita:", e instanceof Error ? e.message.slice(0, 120) : "error");
  }
  return new Response(null, { status: 204, headers: { ...CORS, "Cache-Control": "no-store" } });
});

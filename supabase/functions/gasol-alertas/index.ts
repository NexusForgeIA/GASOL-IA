// gasol-alertas: tras cada ingesta, compara la última captura con la anterior en el
// corredor de cada ruta con avisos activos, encola un aviso por ruta y captura, y
// envía los pendientes por web push. Programada con pg_cron después de gasol-ingest.
// POST con cabecera x-gasol-token (token interno en Vault).
// Textos cortos y sin acciones: se pueden leer sin tocar el móvil.
import webpush from "npm:web-push@3.6.7";
import { cajas, enCorredor, type Punto } from "../_shared/corredor.ts";
import { cors, respuesta, restServicio, rpcServicio, tokenInternoValido } from "../_shared/supa.ts";
import { textoAviso } from "./texto.ts";

const CORS = cors("POST");
const json = respuesta(CORS);

async function encolar(): Promise<number> {
  const [ultima] = await restServicio("gasol_capturas?estado=eq.ok&select=id,fecha_fuente&order=fecha_fuente.desc,id.desc&limit=1");
  if (!ultima) return 0;
  const rutas = await restServicio(
    "gasol_rutas?alertas_activas=eq.true&geometria=not.is.null&select=id,usuario_id,nombre,combustible,solo_24h,lateral_km,geometria",
  );
  let n = 0;
  for (const r of rutas) {
    const geo = r.geometria as Punto[];
    const lateral = Number(r.lateral_km);
    const cands = await rpcServicio("gasol_corredor_candidatas", {
      p_cajas: cajas(geo, lateral), p_combustible: r.combustible, p_solo_24h: r.solo_24h,
    });
    const corredor = enCorredor(cands, geo, lateral);
    const bajan = corredor.filter((e) => e.tendencia === "baja");
    if (!bajan.length) continue;
    const { titulo, cuerpo } = textoAviso(r.nombre, r.combustible, bajan.length, corredor[0].precio, ultima.fecha_fuente);
    // unique (ruta_id, captura_id): repetir el proceso no duplica avisos.
    await restServicio("gasol_avisos", {
      method: "POST",
      body: JSON.stringify({ usuario_id: r.usuario_id, ruta_id: r.id, captura_id: ultima.id, titulo, cuerpo }),
      prefer: "resolution=ignore-duplicates,return=minimal",
    });
    n++;
  }
  return n;
}

async function enviar(): Promise<{ enviados: number; sin_destino: number; errores: number }> {
  const pub = await rpcServicio("gasol_secreto", { p_nombre: "gasol_vapid_publica" });
  const priv = await rpcServicio("gasol_secreto", { p_nombre: "gasol_vapid_privada" });
  webpush.setVapidDetails("mailto:comercial@whitemoon.es", pub, priv);

  const avisos = await restServicio("gasol_avisos?estado=eq.pendiente&select=id,usuario_id,titulo,cuerpo&order=id&limit=500");
  const res = { enviados: 0, sin_destino: 0, errores: 0 };
  for (const a of avisos) {
    const subs = await restServicio(`gasol_push_suscripciones?usuario_id=eq.${a.usuario_id}&select=id,endpoint,p256dh,auth`);
    let ok = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo }),
          { TTL: 6 * 3600, urgency: "low" },
        );
        ok++;
      } catch (e) {
        const st = (e as { statusCode?: number }).statusCode;
        // Suscripción caducada o revocada por el navegador: se elimina.
        if (st === 404 || st === 410) {
          await restServicio(`gasol_push_suscripciones?id=eq.${s.id}`, { method: "DELETE", prefer: "return=minimal" });
        }
      }
    }
    const estado = ok > 0 ? "enviado" : subs.length ? "error" : "sin_destino";
    await restServicio(`gasol_avisos?id=eq.${a.id}`, {
      method: "PATCH", body: JSON.stringify({ estado, enviado_en: new Date().toISOString() }), prefer: "return=minimal",
    });
    if (estado === "enviado") res.enviados++;
    else if (estado === "sin_destino") res.sin_destino++;
    else res.errores++;
  }
  return res;
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
    if (!(await tokenInternoValido(req.headers.get("x-gasol-token")))) return json({ error: "No autorizado" }, 401);
    try {
      const encolados = await encolar();
      const envio = await enviar();
      return json({ encolados, ...envio });
    } catch (e) {
      console.error("gasol-alertas error:", e instanceof Error ? e.message.slice(0, 200) : "desconocido");
      return json({ estado: "error" }, 502);
    }
  });
}

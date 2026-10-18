// gasol-resumen: una vez al día (cron a las 08:00 de Madrid) envía por Telegram el resumen de ayer:
// aperturas (no personas) por modo, páginas más abiertas, cálculos de ruta y si se llegó al tope.
// Exige la cabecera x-gasol-clave: GASOL_RESUMEN_CLAVE (Secrets) o la clave del cron (Vault, que se
// comprueba en la base sin leerla). Ni los secretos ni los datos van a los logs.
import { cors, respuesta, rpcServicio } from "../_shared/supa.ts";
import { LIMITE_VISITAS_HORA } from "../gasol-visita/limites.ts";
import { ayerMadrid, claveIgual, componerResumen, type DatosResumen } from "./mensaje.ts";

const CORS = cors("POST");
const json = respuesta(CORS);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const clave = Deno.env.get("GASOL_RESUMEN_CLAVE");
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!clave || !token || !chat) return json({ error: "Configuración incompleta." }, 500);

  try {
    const recibida = req.headers.get("x-gasol-clave") ?? "";
    const valida = recibida !== "" &&
      ((await claveIgual(recibida, clave)) || (await rpcServicio("gasol_resumen_clave_valida", { p_clave: recibida })) === true);
    if (!valida) return json({ error: "No autorizado." }, 401);

    const dia = ayerMadrid();
    const datos = await rpcServicio("gasol_datos_resumen", { p_dia: dia, p_limite_hora: LIMITE_VISITAS_HORA }) as DatosResumen;
    const texto = componerResumen(dia, datos);
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      console.error("gasol-resumen: Telegram respondió", r.status);
      return json({ error: "No se pudo enviar el resumen." }, 502);
    }
    return json({ enviado: true, dia });
  } catch {
    console.error("gasol-resumen: error al preparar o enviar el resumen");
    return json({ error: "No se pudo enviar el resumen." }, 500);
  }
});

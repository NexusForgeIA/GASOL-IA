// Límite de uso por cliente, en memoria. Complementa los topes globales: que una sola persona (o un
// script) no agote lo de todos. RGPD: la IP solo vive en la memoria de la instancia durante la
// ventana (1 minuto); no se escribe en la base de datos, ni en logs, ni se envía a ningún sitio.
// Es un freno de mejor esfuerzo: cada instancia de la función cuenta por separado y se reinicia
// con ella. Frena el abuso simple, no sustituye a un límite en el borde (Cloudflare/WAF).

export const VENTANA_MS = 60_000;
const MAX_CLAVES = 5000;

export type Contador = Map<string, { n: number; ini: number }>;
export const nuevoContador = (): Contador => new Map();

/** IP del cliente tal como la informa el proxy de Supabase; null si no consta. */
export function ipDe(req: Request): string | null {
  const h = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
  const ip = h?.split(",")[0]?.trim();
  return ip ? ip.slice(0, 64) : null;
}

/**
 * Cuenta una petición de `clave` y devuelve los segundos que faltan para poder reintentar si ya
 * ha pasado `max` en la ventana; null si puede seguir. Sin clave (IP desconocida) no limita:
 * mejor dejar pasar que bloquear a todos los que comparten esa ausencia.
 */
export function superaLimite(c: Contador, clave: string | null, max: number, ahora = Date.now()): number | null {
  if (!clave) return null;
  if (c.size >= MAX_CLAVES) {
    for (const [k, v] of c) if (ahora - v.ini >= VENTANA_MS) c.delete(k);
    if (c.size >= MAX_CLAVES) c.clear(); // sigue lleno de ventanas vivas: se reinicia antes que crecer sin fin
  }
  const e = c.get(clave);
  if (!e || ahora - e.ini >= VENTANA_MS) {
    c.set(clave, { n: 1, ini: ahora });
    return null;
  }
  e.n++;
  return e.n > max ? Math.max(1, Math.ceil((VENTANA_MS - (ahora - e.ini)) / 1000)) : null;
}

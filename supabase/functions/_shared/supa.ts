// Utilidades comunes de las Edge Functions gasol-*.
// - rpcServicio: llamadas con service_role (solo funciones gasol_* de servidor).
// - usuario / restUsuario: validan y reenvían el JWT del usuario a Auth y PostgREST,
//   de modo que las políticas RLS se aplican fila a fila. La clave anon vive aquí,
//   en el servidor; el cliente no lleva ninguna.

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export function cors(metodos: string) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-gasol-token",
    "Access-Control-Allow-Methods": `${metodos}, OPTIONS`,
  };
}

export function respuesta(cabeceras: Record<string, string>) {
  return (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cabeceras, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
    });
}

export class ErrorHttp extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

export async function rpcServicio(nombre: string, args: unknown, rango = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}${rango}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${nombre} ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

/** PostgREST con service_role (procesos de servidor: alertas, envíos). */
export async function restServicio(ruta: string, init: RequestInit & { prefer?: string } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta.split("?")[0]} ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

export function tokenDe(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  if (!m) throw new ErrorHttp(401, "Inicia sesión para continuar.");
  return m[1];
}

export interface Usuario {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
}

/** Valida el JWT contra Auth (no solo su firma: también que la sesión siga viva). */
export async function usuario(token: string): Promise<Usuario> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new ErrorHttp(401, "Tu sesión ha caducado. Vuelve a entrar.");
  return await r.json();
}

/** PostgREST con el JWT del usuario: RLS decide qué filas ve y toca. */
export async function restUsuario(token: string, ruta: string, init: RequestInit & { prefer?: string } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta.split("?")[0]} ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

/** Auth (GoTrue) con la clave anon del servidor. */
export async function auth(ruta: string, init: RequestInit = {}, ipCliente?: string | null) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      ...(ipCliente ? { "X-Forwarded-For": ipCliente } : {}),
      ...(init.headers ?? {}),
    },
  });
  const texto = await r.text();
  return { ok: r.ok, status: r.status, datos: texto ? JSON.parse(texto) : null };
}

/** Auth admin con service_role (solo para metadatos de origen y borrado de cuenta). */
export async function authAdmin(ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/${ruta}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`auth admin ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

/** Token interno de los procesos programados (Vault: gasol_ingest_token). */
export async function tokenInternoValido(recibido: string | null): Promise<boolean> {
  if (!recibido || recibido.length < 32 || recibido.length > 128) return false;
  return (await rpcServicio("gasol_token_valido", { p_token: recibido })) === true;
}

export const ATRIBUCION =
  "Origen de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico";

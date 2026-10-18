// Sesión del usuario en el navegador. Solo guarda el token de sesión del propio
// usuario (no hay claves de proyecto en el cliente). Todo pasa por gasol-cuenta.
import { API } from "./config.js";

const CLAVE = "gasol.sesion";

export function sesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch { return null; }
}

function guardar(s) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
    else localStorage.removeItem(CLAVE);
  } catch { /* modo privado: la sesión dura lo que la pestaña */ }
}

async function post(funcion, body, token) {
  const r = await fetch(`${API}/${funcion}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const datos = await r.json().catch(() => ({}));
  return { r, datos };
}

async function refrescar(s) {
  const { r, datos } = await post("gasol-cuenta", { accion: "refrescar", refresh_token: s.refresh_token });
  if (!r.ok) { guardar(null); return null; }
  guardar(datos.sesion);
  return datos.sesion;
}

/**
 * Llama a una Edge Function con la sesión del usuario. Renueva el token si ha
 * caducado (una vez) y lanza Error con el mensaje del servidor si falla.
 */
export async function llamar(funcion, body, { privada = true } = {}) {
  let s = sesion();
  if (privada && !s) throw Object.assign(new Error("Inicia sesión para continuar."), { status: 401 });
  if (s && s.expires_at && s.expires_at * 1000 < Date.now() + 30_000) s = await refrescar(s);
  if (privada && !s) throw Object.assign(new Error("Tu sesión ha caducado. Vuelve a entrar."), { status: 401 });
  let { r, datos } = await post(funcion, body, s?.access_token);
  if (r.status === 401 && s) {
    s = await refrescar(s);
    if (s) ({ r, datos } = await post(funcion, body, s.access_token));
  }
  if (!r.ok) throw Object.assign(new Error(datos.error || "No se pudo completar ahora mismo."), { status: r.status, limite: datos.limite });
  return datos;
}

export async function entrar(accion, email, password) {
  const d = await llamar("gasol-cuenta", { accion, email, password }, { privada: false });
  if (d.sesion) guardar(d.sesion);
  return d;
}

export async function salir() {
  try { await llamar("gasol-cuenta", { accion: "salir" }); } catch { /* ya caducada */ }
  guardar(null);
}

export function olvidarSesion() { guardar(null); }

/** true si la PWA está instalada (pantalla completa / standalone). */
export function pwaInstalada() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

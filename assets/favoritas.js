// Favoritas y preferencias. Se guardan solo en este navegador (localStorage), sin cuenta ni
// servidor y sin ubicación: de cada estación solo su ID y lo necesario para mostrarla.
// Módulo ES: la parte de datos no toca el DOM y se prueba con Deno (favoritas.test.js).
import { CUENTAS } from "./config.js";
import { icono } from "./iconos.js";

export const CLAVE_FAVORITAS = "gasol.favoritas";
export const CLAVE_PREFERENCIAS = "gasol.preferencias";
export const MAX_FAVORITAS = 50; // el mismo máximo que acepta gasol-buscar?ids=

export const COMBUSTIBLES = ["gasoleo_a", "gasoleo_premium", "diesel_renovable", "adblue", "gasolina_95_e5", "gasolina_98_e5", "glp", "gnc", "gnl", "biogas_comprimido", "biogas_licuado"];
export const RADIOS = ["5", "10", "25", "50"]; // comparador, «Cerca de mí»
export const CORREDORES = ["1", "2", "5", "10"]; // ruta, km a cada lado

/** localStorage envuelto: si está bloqueado o lleno, la app sigue funcionando sin guardar. */
export const almacen = {
  get(k) { try { return globalThis.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { globalThis.localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { globalThis.localStorage.removeItem(k); return true; } catch { return false; } },
};

function leerJson(store, clave) {
  try { return JSON.parse(store.get(clave)); } catch { return null; }
}

const texto = (v) => (typeof v === "string" ? v.slice(0, 200) : "");
const idValido = (v) => typeof v === "string" && /^\d{1,8}$/.test(v);

/** Solo los campos que se guardan; nunca coordenadas. */
function limpiar(e) {
  return {
    ideess: String(e.ideess),
    rotulo: texto(e.rotulo),
    direccion: texto(e.direccion),
    municipio: texto(e.municipio),
    provincia: texto(e.provincia),
  };
}

/** Lista guardada, descartando lo corrupto y los duplicados. */
export function leerFavoritas(store = almacen) {
  const datos = leerJson(store, CLAVE_FAVORITAS);
  if (!Array.isArray(datos)) return [];
  const vistas = new Set();
  const lista = [];
  for (const e of datos) {
    if (!e || typeof e !== "object" || !idValido(e.ideess) || vistas.has(e.ideess)) continue;
    vistas.add(e.ideess);
    lista.push(limpiar(e));
    if (lista.length === MAX_FAVORITAS) break;
  }
  return lista;
}

function escribirFavoritas(store, lista) {
  return store.set(CLAVE_FAVORITAS, JSON.stringify(lista));
}

export const esFavorita = (ideess, store = almacen) => leerFavoritas(store).some((e) => e.ideess === String(ideess));

/** Añade (sin duplicar). Devuelve {ok, error?}. */
export function anadirFavorita(estacion, store = almacen) {
  if (!estacion || !idValido(String(estacion.ideess ?? ""))) return { ok: false, error: "Estación no válida." };
  const lista = leerFavoritas(store);
  if (lista.some((e) => e.ideess === String(estacion.ideess))) return { ok: true };
  if (lista.length >= MAX_FAVORITAS) return { ok: false, error: `Puedes guardar hasta ${MAX_FAVORITAS} favoritas.` };
  lista.push(limpiar(estacion));
  return escribirFavoritas(store, lista) ? { ok: true } : { ok: false, error: "Este navegador no permite guardar datos." };
}

export function quitarFavorita(ideess, store = almacen) {
  const lista = leerFavoritas(store).filter((e) => e.ideess !== String(ideess));
  return escribirFavoritas(store, lista);
}

/** Preferencias validadas: lo que no sea un valor admitido se ignora. */
export function leerPreferencias(store = almacen) {
  const d = leerJson(store, CLAVE_PREFERENCIAS);
  const p = {};
  if (!d || typeof d !== "object" || Array.isArray(d)) return p;
  if (COMBUSTIBLES.includes(d.combustible)) p.combustible = d.combustible;
  if (RADIOS.includes(String(d.radio))) p.radio = String(d.radio);
  if (CORREDORES.includes(String(d.corredor))) p.corredor = String(d.corredor);
  return p;
}

export function guardarPreferencias(p, store = almacen) {
  const limpio = leerPreferencias({ get: () => JSON.stringify(p) });
  return store.set(CLAVE_PREFERENCIAS, JSON.stringify(limpio));
}

/** «Borrar mis datos»: favoritas y preferencias. */
export function borrarMisDatos(store = almacen) {
  const a = store.del(CLAVE_FAVORITAS);
  const b = store.del(CLAVE_PREFERENCIAS);
  return a && b;
}

/**
 * Sincronización con cuenta (fase de pago). Desactivada mientras CUENTAS = false: no envía
 * nada. `enviar(local)` será la llamada autenticada que devuelva las favoritas del servidor;
 * se unen por ID sin duplicar y se guardan aquí.
 */
export async function sincronizarFavoritas(enviar, store = almacen, activa = CUENTAS) {
  if (!activa) return null;
  const local = leerFavoritas(store);
  const remotas = await enviar(local);
  const unidas = leerFavoritas({ get: () => JSON.stringify([...local, ...(Array.isArray(remotas) ? remotas : [])]) });
  escribirFavoritas(store, unidas);
  return unidas;
}

// ---- Botón de estrella (comparador y ruta) ------------------------------------------
/** Botón accesible con aria-pressed. `alCambiar(estado)` es opcional. */
export function botonEstrella(estacion, alCambiar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "estrella";
  const nombre = estacion.rotulo ? estacion.rotulo.toLowerCase() : "esta estación";
  b.setAttribute("aria-label", `Favorita: ${nombre}, ${estacion.municipio || ""}`.replace(/, $/, ""));
  const pintar = (on) => {
    b.setAttribute("aria-pressed", String(on));
    b.replaceChildren(icono(on ? "favorita-llena" : "favorita"), document.createTextNode("Favorita"));
  };
  pintar(esFavorita(estacion.ideess));
  b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    const r = on ? anadirFavorita(estacion) : { ok: quitarFavorita(estacion.ideess) };
    if (r.ok) pintar(on);
    alCambiar?.(r.ok ? on : !on, r.error);
  });
  return b;
}

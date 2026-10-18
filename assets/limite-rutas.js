// Tope de cálculos de ruta por dispositivo (cortesía con el servidor de rutas; la protección real
// está en gasol-ruta). Solo guarda el día y el número, en gasol.rutas.uso. Módulo ES sin DOM: lo usa
// ruta.js y lo prueba Deno (limite-rutas.test.js).
import { hoyMadrid } from "./fechas.js";
import { almacen } from "./favoritas.js";
import { LIMITE_RUTAS_DISPOSITIVO_DIA } from "./config.js";

export const CLAVE_USO_RUTAS = "gasol.rutas.uso";
export const AVISO_LIMITE_RUTAS = "Has llegado al límite de cálculos de hoy en esta versión beta. Vuelve mañana.";

/** Cálculos hechos hoy (día de Madrid) en este dispositivo. Lo que no se entiende cuenta como 0. */
export function usoDeHoy(store = almacen, hoy = hoyMadrid()) {
  try {
    const d = JSON.parse(store.get(CLAVE_USO_RUTAS));
    return d && d.dia === hoy && Number.isInteger(d.n) && d.n >= 0 ? d.n : 0;
  } catch {
    return 0;
  }
}

export const quedanHoy = (store = almacen, hoy = hoyMadrid(), tope = LIMITE_RUTAS_DISPOSITIVO_DIA) => Math.max(0, tope - usoDeHoy(store, hoy));

/** Suma un cálculo de hoy. Sin almacenamiento no se cuenta (el servidor sigue protegiendo). */
export function contarUso(store = almacen, hoy = hoyMadrid()) {
  const n = usoDeHoy(store, hoy) + 1;
  store.set(CLAVE_USO_RUTAS, JSON.stringify({ dia: hoy, n }));
  return n;
}

/** ¿Ha pasado la pausa mínima desde la última pulsación? */
export const pausaCumplida = (ultima, ahora, pausaMs) => ultima == null || ahora - ultima >= pausaMs;

// Facturación: carreras que apunta el usuario, solo en este navegador (localStorage). Todas las
// cifras salen de sus datos; nada fiscal. Los límites solo frenan errores de tecleo. Módulo ES sin
// DOM: lo usa ingresos-vista.js y lo prueba Deno (ingresos.test.js).
import { diasDelMes, esFechaISO, hoyMadrid, sumarDias } from "./fechas.js";
import { redondear } from "./calculos.js";
import { almacen } from "./favoritas.js";
import { celdaCSV } from "./gastos.js";

export const CLAVE_INGRESOS = "gasol.ingresos";
export const CLAVE_RESPALDO = "gasol.ingresos.respaldo";
export const VERSION_DATOS = 1;
export const MAX_CARRERAS = 20000;
export const MAX_APPS = 30;
const LIM = { importe: 10000, app: 40, nota: 80 };

export const CANALES = { calle: "Calle", app: "Aplicación" };
/** Formas de cobro por canal. En la aplicación, «app» = lo cobra la aplicación. */
export const METODOS = {
  calle: { efectivo: "Efectivo", tarjeta: "Tarjeta" },
  app: { app: "Cobrado por la app", efectivo: "Efectivo en mano" },
};
/** Las cuatro columnas de la tabla, en orden. */
export const COLUMNAS = [
  ["calle_efectivo", "Calle efectivo"],
  ["calle_tarjeta", "Calle tarjeta"],
  ["app_cobrado", "App cobrado por la app"],
  ["app_efectivo", "App efectivo"],
];
const columna = (c) => (c.canal === "calle" ? (c.metodo === "efectivo" ? "calle_efectivo" : "calle_tarjeta") : (c.metodo === "app" ? "app_cobrado" : "app_efectivo"));

const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const limpio = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

/** Importe escrito por el usuario: cifras con un solo separador decimal (coma o punto), hasta 2 decimales. */
export function leerImporte(v) {
  const s = String(v ?? "").replace(/\s|€/g, "");
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(s)) return NaN;
  return Number(s.replace(",", "."));
}

/**
 * Valida una carrera. Devuelve {carrera} o {error, campo}.
 * datos: {fecha, hora?, sinDetalle?, canal, metodo, app?, importe, nota?}
 * Sin hora (sinDetalle) es un total del turno sin detallar.
 */
export function validarCarrera(datos, hoy = hoyMadrid()) {
  const d = datos || {};
  if (!esFechaISO(d.fecha) || d.fecha < "2000-01-01" || d.fecha > sumarDias(hoy, 1)) return { error: "La fecha no es válida.", campo: "fecha" };
  if (!Object.hasOwn(CANALES, d.canal)) return { error: "Elige Calle o Aplicación.", campo: "canal" };
  if (!Object.hasOwn(METODOS[d.canal], d.metodo)) return { error: d.canal === "calle" ? "Elige efectivo o tarjeta." : "Elige si lo cobra la app o es efectivo en mano.", campo: "metodo" };
  const app = d.canal === "app" ? limpio(d.app) : "";
  if (d.canal === "app" && !app) return { error: "Escribe el nombre de la aplicación.", campo: "app" };
  if (app.length > LIM.app) return { error: "El nombre de la aplicación admite hasta 40 caracteres.", campo: "app" };
  const importe = typeof d.importe === "number" ? d.importe : leerImporte(d.importe);
  if (!(Number.isFinite(importe) && importe >= 0 && importe <= LIM.importe)) return { error: "Escribe el importe con un solo separador decimal (p. ej. 12,50), sin negativos y hasta 10.000 €.", campo: "importe" };
  const sinDetalle = d.sinDetalle === true || d.sinDetalle === "on" || d.hora === null;
  let hora = null;
  if (!sinDetalle) {
    hora = String(d.hora ?? "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return { error: "Indica la hora (HH:MM).", campo: "hora" };
  }
  const nota = limpio(d.nota);
  if (nota.length > LIM.nota) return { error: "La nota admite hasta 80 caracteres.", campo: "nota" };
  return { carrera: { fecha: d.fecha, hora, canal: d.canal, metodo: d.metodo, app, importe: redondear(importe, 2), nota } };
}

// ---- Almacenamiento con versión -------------------------------------------------------------
// Formato v1: {v: 1, carreras: [...], apps: [...]}. También se lee una lista suelta de carreras
// (formato sin versión). Si lo guardado no se entiende (corrupto o de una versión futura), se
// copia tal cual a CLAVE_RESPALDO antes de escribir encima: no se pierde nada.

function cargar(store) {
  const bruto = store.get(CLAVE_INGRESOS);
  if (bruto == null) return { carreras: [], apps: [], entendido: true };
  let datos;
  try { datos = JSON.parse(bruto); } catch { return { carreras: [], apps: [], entendido: false, bruto }; }
  let carreras, apps = [];
  if (Array.isArray(datos)) carreras = datos;
  else if (datos && typeof datos === "object" && datos.v === VERSION_DATOS && Array.isArray(datos.carreras)) {
    carreras = datos.carreras;
    apps = Array.isArray(datos.apps) ? datos.apps : [];
  } else return { carreras: [], apps: [], entendido: false, bruto };
  const vistos = new Set();
  const lista = [];
  for (const c of carreras) {
    if (!c || typeof c !== "object" || typeof c.id !== "string" || vistos.has(c.id)) continue;
    const v = validarCarrera(c, "9999-12-30");
    if (v.error) continue;
    vistos.add(c.id);
    lista.push({ id: c.id, ...v.carrera });
    if (lista.length === MAX_CARRERAS) break;
  }
  const nombres = [...new Set(apps.filter((a) => typeof a === "string").map(limpio).filter((a) => a && a.length <= LIM.app))].slice(0, MAX_APPS);
  return { carreras: ordenar(lista), apps: nombres, entendido: true };
}

/** Por fecha y hora; los totales sin detallar, al final del día. */
const ordenar = (l) => l.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "99").localeCompare(b.hora ?? "99"));

function guardar(store, carreras, apps) {
  const previo = cargar(store);
  if (!previo.entendido && store.get(CLAVE_RESPALDO) == null && !store.set(CLAVE_RESPALDO, previo.bruto)) return false;
  return store.set(CLAVE_INGRESOS, JSON.stringify({ v: VERSION_DATOS, carreras: ordenar([...carreras]), apps }));
}

/** Carreras guardadas, por fecha y hora. Descarta lo corrupto sin romper. */
export const leerCarreras = (store = almacen) => cargar(store).carreras;
/** Aplicaciones que ha escrito el usuario (ninguna preinstalada). */
export const leerApps = (store = almacen) => cargar(store).apps;

const SIN_GUARDAR = { error: "Este navegador no permite guardar datos." };

function recordarApp(apps, app) {
  if (!app || apps.some((a) => a.toLocaleLowerCase("es") === app.toLocaleLowerCase("es"))) return apps;
  return apps.length >= MAX_APPS ? apps : [...apps, app];
}

export function anadirCarrera(datos, store = almacen, hoy) {
  const v = validarCarrera(datos, hoy);
  if (v.error) return v;
  const { carreras, apps } = cargar(store);
  if (carreras.length >= MAX_CARRERAS) return { error: `Puedes guardar hasta ${MAX_CARRERAS} carreras. Exporta y borra las antiguas.` };
  const carrera = { id: nuevoId(), ...v.carrera };
  return guardar(store, [...carreras, carrera], recordarApp(apps, carrera.app)) ? { carrera } : SIN_GUARDAR;
}

export function editarCarrera(id, datos, store = almacen, hoy) {
  const v = validarCarrera(datos, hoy);
  if (v.error) return v;
  const { carreras, apps } = cargar(store);
  const i = carreras.findIndex((c) => c.id === id);
  if (i < 0) return { error: "Esa carrera ya no existe." };
  carreras[i] = { id, ...v.carrera };
  return guardar(store, carreras, recordarApp(apps, carreras[i].app)) ? { carrera: carreras[i] } : SIN_GUARDAR;
}

/** Vuelve a poner una carrera borrada, con su mismo id (para «Deshacer»). */
export function restaurarCarrera(carrera, store = almacen) {
  const { carreras, apps } = cargar(store);
  if (carreras.some((c) => c.id === carrera.id)) return true;
  return guardar(store, [...carreras, carrera], apps);
}

export function borrarCarrera(id, store = almacen) {
  const { carreras, apps } = cargar(store);
  return guardar(store, carreras.filter((c) => c.id !== id), apps);
}

export function anadirApp(nombre, store = almacen) {
  const app = limpio(nombre);
  if (!app) return { error: "Escribe el nombre de la aplicación." };
  if (app.length > LIM.app) return { error: "El nombre admite hasta 40 caracteres." };
  const { carreras, apps } = cargar(store);
  if (apps.length >= MAX_APPS) return { error: `Puedes guardar hasta ${MAX_APPS} aplicaciones.` };
  return guardar(store, carreras, recordarApp(apps, app)) ? { app } : SIN_GUARDAR;
}

/** Quita el nombre de la lista; las carreras ya apuntadas con él no cambian. */
export function quitarApp(nombre, store = almacen) {
  const { carreras, apps } = cargar(store);
  return guardar(store, carreras, apps.filter((a) => a !== nombre));
}

/** Borra carreras y aplicaciones (y el respaldo, si lo hay). */
export const borrarIngresos = (store = almacen) => store.del(CLAVE_INGRESOS) && store.del(CLAVE_RESPALDO);

// ---- Cálculos (todo con los datos del usuario) --------------------------------------------

const vacio = () => ({ calle_efectivo: 0, calle_tarjeta: 0, app_cobrado: 0, app_efectivo: 0, total: 0, carreras: 0, lineas: 0 });

function sumarA(t, c) {
  t[columna(c)] += c.importe;
  t.total += c.importe;
  t.lineas += 1;
  if (c.hora != null) t.carreras += 1; // un total sin detallar no es una carrera
}

function cerrar(t) {
  for (const [k] of COLUMNAS) t[k] = redondear(t[k]);
  t.total = redondear(t.total);
  t.efectivo_en_mano = redondear(t.calle_efectivo + t.app_efectivo);
  t.cobrado_banco_app = redondear(t.calle_tarjeta + t.app_cobrado);
  return t;
}

/** Totales de una lista de carreras: las cuatro columnas, total, nº de carreras y subtotales. */
export function totalesCarreras(carreras) {
  const t = vacio();
  for (const c of carreras) sumarA(t, c);
  return cerrar(t);
}

/**
 * Tabla de un mes "AAAA-MM": una fila por día (también los días sin carreras), con sus carreras
 * en `lista` y sus totales, y la fila de totales del mes.
 */
export function tablaMensual(carreras, mes) {
  const n = diasDelMes(mes);
  const dias = Array.from({ length: n }, (_, i) => ({ fecha: `${mes}-${String(i + 1).padStart(2, "0")}`, lista: [] }));
  const delMes = carreras.filter((c) => c.fecha.startsWith(`${mes}-`));
  for (const c of delMes) dias[Number(c.fecha.slice(8)) - 1].lista.push(c);
  return {
    mes,
    dias: dias.map((d) => ({ fecha: d.fecha, lista: ordenar(d.lista), ...totalesCarreras(d.lista) })),
    total: totalesCarreras(delMes),
  };
}

/**
 * Cruce con el control de gastos, solo con datos del usuario. `gastoCombustible` es lo pagado en
 * repostajes del mes; `km` los recorridos según el cuentakilómetros (null si no hay lecturas).
 */
export function cruce(facturacion, gastoCombustible, km) {
  return {
    menos_combustible: redondear(facturacion - gastoCombustible),
    por_km: km > 0 ? redondear(facturacion / km, 3) : null,
  };
}

// ---- CSV -----------------------------------------------------------------------------------

const coma = (n) => n.toFixed(2).replace(".", ",");

/** CSV del mes: una fila por carrera; canal, aplicación y método en columnas separadas. */
export function aCSV(carreras) {
  const filas = [["fecha", "hora", "canal", "aplicacion", "metodo", "importe_eur", ...COLUMNAS.map(([k]) => `${k}_eur`), "nota"]];
  for (const c of ordenar([...carreras])) {
    const col = columna(c);
    filas.push([c.fecha, c.hora ?? "total sin detallar", CANALES[c.canal], c.app, METODOS[c.canal][c.metodo], coma(c.importe),
      ...COLUMNAS.map(([k]) => (k === col ? coma(c.importe) : "")), c.nota]);
  }
  return filas.map((f) => f.map(celdaCSV).join(";")).join("\r\n") + "\r\n";
}

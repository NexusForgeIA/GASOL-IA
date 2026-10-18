// Control de costes: repostajes que registra el usuario, solo en este navegador (localStorage).
// Todas las cifras salen de sus datos. Los límites solo frenan errores de tecleo; no son reglas
// de negocio. Módulo ES sin DOM: lo usa gastos-vista.js y lo prueba Deno (gastos.test.js).
import { esFechaISO, hoyMadrid, sumarDias } from "./fechas.js";
import { leerNumero, redondear } from "./calculos.js";
import { almacen } from "./favoritas.js";

export const CLAVE_GASTOS = "gasol.gastos";
export const MAX_REGISTROS = 5000;
export const COMBUSTIBLES_GASTO = {
  gasoleo_a: "Gasóleo A",
  gasoleo_premium: "Gasóleo Premium",
  diesel_renovable: "Diésel renovable",
  gasolina_95_e5: "Gasolina 95 E5",
  gasolina_98_e5: "Gasolina 98 E5",
  glp: "GLP (autogás)",
  adblue: "AdBlue",
  otro: "Otro",
};
const LIM = { litros: 2000, importe: 10000, km: 9999999, etiqueta: 40 };
export const SIN_ETIQUETA = "";

const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/**
 * Valida lo que escribe el usuario. Devuelve {registro} o {error, campo}.
 * datos: {fecha, litros, importe, combustible, km?, etiqueta?}
 */
export function validarRegistro(datos, hoy = hoyMadrid()) {
  const d = datos || {};
  if (!esFechaISO(d.fecha)) return { error: "Indica una fecha válida.", campo: "fecha" };
  if (d.fecha < "2000-01-01" || d.fecha > sumarDias(hoy, 1)) return { error: "La fecha no puede ser futura ni anterior al año 2000.", campo: "fecha" };
  const litros = leerNumero(d.litros);
  if (!(litros > 0 && litros <= LIM.litros)) return { error: "Indica los litros (más de 0 y hasta 2.000).", campo: "litros" };
  const importe = leerNumero(d.importe);
  if (!(importe > 0 && importe <= LIM.importe)) return { error: "Indica el importe pagado (más de 0 y hasta 10.000 €).", campo: "importe" };
  if (!Object.hasOwn(COMBUSTIBLES_GASTO, d.combustible)) return { error: "Elige el combustible.", campo: "combustible" };
  let km = null;
  if (String(d.km ?? "").trim() !== "") {
    km = leerNumero(String(d.km).replace(/\./g, "")); // admite 123.456 como separador de miles
    if (!(Number.isFinite(km) && km >= 0 && km <= LIM.km)) return { error: "El cuentakilómetros debe ser un número entre 0 y 9.999.999, o déjalo vacío.", campo: "km" };
    km = Math.round(km);
  }
  const etiqueta = String(d.etiqueta ?? "").trim().replace(/\s+/g, " ");
  if (etiqueta.length > LIM.etiqueta) return { error: "El turno o vehículo admite hasta 40 caracteres.", campo: "etiqueta" };
  return { registro: { fecha: d.fecha, litros: redondear(litros, 2), importe: redondear(importe, 2), combustible: d.combustible, km, etiqueta } };
}

/** Registros guardados; descarta lo corrupto sin romper. */
export function leerRegistros(store = almacen) {
  let datos;
  try { datos = JSON.parse(store.get(CLAVE_GASTOS)); } catch { return []; }
  if (!Array.isArray(datos)) return [];
  const vistos = new Set();
  const lista = [];
  for (const r of datos) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || vistos.has(r.id)) continue;
    const v = validarRegistro(r, "9999-12-30");
    if (v.error) continue;
    vistos.add(r.id);
    lista.push({ id: r.id, ...v.registro });
    if (lista.length === MAX_REGISTROS) break;
  }
  return ordenar(lista);
}

/** Más reciente primero; a igual fecha, mayor cuentakilómetros primero. */
const ordenar = (l) => l.sort((a, b) => (b.fecha.localeCompare(a.fecha)) || ((b.km ?? -1) - (a.km ?? -1)));

const escribir = (store, lista) => store.set(CLAVE_GASTOS, JSON.stringify(lista));

export function anadirRegistro(datos, store = almacen, hoy) {
  const v = validarRegistro(datos, hoy);
  if (v.error) return v;
  const lista = leerRegistros(store);
  if (lista.length >= MAX_REGISTROS) return { error: `Puedes guardar hasta ${MAX_REGISTROS} repostajes. Exporta y borra los antiguos.` };
  const registro = { id: nuevoId(), ...v.registro };
  lista.push(registro);
  return escribir(store, lista) ? { registro } : { error: "Este navegador no permite guardar datos." };
}

export function editarRegistro(id, datos, store = almacen, hoy) {
  const v = validarRegistro(datos, hoy);
  if (v.error) return v;
  const lista = leerRegistros(store);
  const i = lista.findIndex((r) => r.id === id);
  if (i < 0) return { error: "Ese repostaje ya no existe." };
  lista[i] = { id, ...v.registro };
  return escribir(store, lista) ? { registro: lista[i] } : { error: "Este navegador no permite guardar datos." };
}

export function borrarRegistro(id, store = almacen) {
  return escribir(store, leerRegistros(store).filter((r) => r.id !== id));
}

export const borrarGastos = (store = almacen) => store.del(CLAVE_GASTOS);

// ---- Cálculos (todo con los datos del usuario) -------------------------------------------

/**
 * Coste por km de un grupo (mismo vehículo o turno): entre la primera y la última lectura del
 * cuentakilómetros, suma de los importes de los repostajes posteriores a la primera lectura
 * dividida entre los km recorridos. Los repostajes sin lectura no entran. null si no hay al
 * menos dos lecturas distintas.
 */
export function costePorKm(registros) {
  const conKm = registros.filter((r) => r.km != null).sort((a, b) => (a.km - b.km) || a.fecha.localeCompare(b.fecha));
  if (conKm.length < 2) return null;
  const km = conKm.at(-1).km - conKm[0].km;
  if (!(km > 0)) return null;
  const importe = conKm.slice(1).reduce((s, r) => s + r.importe, 0);
  return { km, importe: redondear(importe), coste_km: redondear(importe / km, 3), lecturas: conKm.length };
}

function sumar(lista) {
  const litros = lista.reduce((s, r) => s + r.litros, 0);
  const importe = lista.reduce((s, r) => s + r.importe, 0);
  return { repostajes: lista.length, litros: redondear(litros), importe: redondear(importe), precio_medio: litros > 0 ? redondear(importe / litros, 3) : null };
}

/** Totales de una lista: repostajes, litros, gasto y precio medio pagado. */
export const totales = (registros) => sumar(registros);

function agrupar(registros, clave) {
  const m = new Map();
  for (const r of registros) {
    const k = clave(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

/** Resumen por mes ("AAAA-MM"), el más reciente primero. */
export function resumenMensual(registros) {
  return [...agrupar(registros, (r) => r.fecha.slice(0, 7))]
    .map(([mes, l]) => ({ mes, ...sumar(l) }))
    .sort((a, b) => b.mes.localeCompare(a.mes));
}

/** Gasto por día, el más reciente primero. `mes` ("AAAA-MM") filtra si se indica. */
export function porDia(registros, mes) {
  const l = mes ? registros.filter((r) => r.fecha.startsWith(mes)) : registros;
  return [...agrupar(l, (r) => r.fecha)].map(([fecha, g]) => ({ fecha, ...sumar(g) })).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Por turno o vehículo (la etiqueta que pone el usuario), con su coste por km si se puede. */
export function porEtiqueta(registros) {
  return [...agrupar(registros, (r) => r.etiqueta || SIN_ETIQUETA)]
    .map(([etiqueta, l]) => ({ etiqueta, ...sumar(l), km: costePorKm(l) }))
    .sort((a, b) => b.importe - a.importe || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/** Etiquetas usadas, para sugerirlas al escribir. */
export const etiquetas = (registros) => [...new Set(registros.map((r) => r.etiqueta).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

// ---- CSV -------------------------------------------------------------------------------

/** Una celda segura: sin fórmulas al abrirla en una hoja de cálculo y con comillas escapadas. */
export function celdaCSV(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const coma = (n, dec) => (n == null ? "" : n.toFixed(dec).replace(".", ","));

/** CSV con «;» y coma decimal (lo que abre bien una hoja de cálculo en español). */
export function aCSV(registros) {
  const filas = [["fecha", "litros", "importe_eur", "precio_eur_litro", "combustible", "cuentakilometros", "turno_o_vehiculo"]];
  for (const r of [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha) || ((a.km ?? -1) - (b.km ?? -1)))) {
    filas.push([r.fecha, coma(r.litros, 2), coma(r.importe, 2), coma(r.importe / r.litros, 3), COMBUSTIBLES_GASTO[r.combustible], r.km ?? "", r.etiqueta]);
  }
  return filas.map((f) => f.map(celdaCSV).join(";")).join("\r\n") + "\r\n";
}

// Vencimientos que apunta el usuario (ITV, seguro, taxímetro, licencia…), solo en este navegador.
// La fecha la pone él: la app no afirma ni calcula plazos legales, solo compara con hoy (Madrid).
// Módulo ES sin DOM: lo usan vencimientos-vista.js e inicio.js y lo prueba Deno.
import { diasEntre, esFechaISO, hoyMadrid } from "./fechas.js";
import { almacen } from "./favoritas.js";
import { celdaCSV } from "./gastos.js";

export const CLAVE_VENCIMIENTOS = "gasol.vencimientos";
export const MAX_VENCIMIENTOS = 500;
export const TIPOS = {
  itv: "ITV",
  seguro: "Seguro",
  taximetro: "Revisión del taxímetro",
  licencia: "Licencia o autorización",
  otro: "Otro",
};
/** Con cuántos días de antelación marcarlo como próximo: lo elige el usuario. */
export const ANTELACIONES = [7, 15, 30, 60];
export const ANTELACION_POR_DEFECTO = 30;

const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const texto = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** {vencimiento} o {error, campo}. datos: {tipo, fecha, nota?, vehiculo?, antelacion?} */
export function validarVencimiento(datos) {
  const d = datos || {};
  if (!Object.hasOwn(TIPOS, d.tipo)) return { error: "Elige el tipo.", campo: "tipo" };
  if (!esFechaISO(d.fecha) || d.fecha < "2000-01-01" || d.fecha > "2100-12-31") return { error: "Indica una fecha válida.", campo: "fecha" };
  if (String(d.nota ?? "").trim().length > 60) return { error: "La descripción admite hasta 60 caracteres.", campo: "nota" };
  if (String(d.vehiculo ?? "").trim().length > 40) return { error: "El vehículo admite hasta 40 caracteres.", campo: "vehiculo" };
  const antelacion = Number(d.antelacion ?? ANTELACION_POR_DEFECTO);
  if (!ANTELACIONES.includes(antelacion)) return { error: "Elige con cuántos días de antelación avisar.", campo: "antelacion" };
  if (d.tipo === "otro" && !texto(d.nota, 60)) return { error: "Para «Otro», escribe qué vence.", campo: "nota" };
  return { vencimiento: { tipo: d.tipo, fecha: d.fecha, nota: texto(d.nota, 60), vehiculo: texto(d.vehiculo, 40), antelacion } };
}

/** Estado frente a hoy: vencido, hoy, proximo (dentro de la antelación elegida) o al_dia. */
export function estado(v, hoy = hoyMadrid()) {
  const dias = diasEntre(hoy, v.fecha);
  const clase = dias < 0 ? "vencido" : dias === 0 ? "hoy" : dias <= v.antelacion ? "proximo" : "al_dia";
  return { dias, clase };
}

/** Texto del estado, sin hablar de plazos legales. */
export function textoEstado({ dias, clase }) {
  if (clase === "vencido") return dias === -1 ? "Venció ayer" : `Venció hace ${-dias} días`;
  if (clase === "hoy") return "Vence hoy";
  return dias === 1 ? "Vence mañana" : `Vence en ${dias} días`;
}

/** Por fecha (la más cercana o la más vencida primero). */
const ordenar = (l) => l.sort((a, b) => a.fecha.localeCompare(b.fecha) || TIPOS[a.tipo].localeCompare(TIPOS[b.tipo], "es"));

export function leerVencimientos(store = almacen) {
  let datos;
  try { datos = JSON.parse(store.get(CLAVE_VENCIMIENTOS)); } catch { return []; }
  if (!Array.isArray(datos)) return [];
  const vistos = new Set();
  const lista = [];
  for (const r of datos) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || vistos.has(r.id)) continue;
    const v = validarVencimiento(r);
    if (v.error) continue;
    vistos.add(r.id);
    lista.push({ id: r.id, ...v.vencimiento });
    if (lista.length === MAX_VENCIMIENTOS) break;
  }
  return ordenar(lista);
}

const escribir = (store, lista) => store.set(CLAVE_VENCIMIENTOS, JSON.stringify(lista));

export function anadirVencimiento(datos, store = almacen) {
  const v = validarVencimiento(datos);
  if (v.error) return v;
  const lista = leerVencimientos(store);
  if (lista.length >= MAX_VENCIMIENTOS) return { error: `Puedes guardar hasta ${MAX_VENCIMIENTOS} vencimientos.` };
  const vencimiento = { id: nuevoId(), ...v.vencimiento };
  lista.push(vencimiento);
  return escribir(store, lista) ? { vencimiento } : { error: "Este navegador no permite guardar datos." };
}

export function editarVencimiento(id, datos, store = almacen) {
  const v = validarVencimiento(datos);
  if (v.error) return v;
  const lista = leerVencimientos(store);
  const i = lista.findIndex((r) => r.id === id);
  if (i < 0) return { error: "Ese vencimiento ya no existe." };
  lista[i] = { id, ...v.vencimiento };
  return escribir(store, lista) ? { vencimiento: lista[i] } : { error: "Este navegador no permite guardar datos." };
}

export const borrarVencimiento = (id, store = almacen) => escribir(store, leerVencimientos(store).filter((r) => r.id !== id));
export const borrarVencimientos = (store = almacen) => store.del(CLAVE_VENCIMIENTOS);

/** Los que piden atención al abrir la app: vencidos, de hoy y próximos, por fecha. */
export function avisos(lista, hoy = hoyMadrid()) {
  return lista.map((v) => ({ ...v, ...estado(v, hoy) })).filter((v) => v.clase !== "al_dia");
}

export const nombreVencimiento = (v) => (v.tipo === "otro" ? v.nota : TIPOS[v.tipo] + (v.nota ? ` (${v.nota})` : ""));

export function aCSV(lista) {
  const filas = [["fecha", "tipo", "descripcion", "vehiculo", "avisar_dias_antes"]];
  for (const v of lista) filas.push([v.fecha, TIPOS[v.tipo], v.nota, v.vehiculo, v.antelacion]);
  return filas.map((f) => f.map(celdaCSV).join(";")).join("\r\n") + "\r\n";
}

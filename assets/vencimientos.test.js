import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  aCSV, anadirVencimiento, avisos, borrarVencimiento, borrarVencimientos, CLAVE_VENCIMIENTOS, editarVencimiento, estado,
  leerVencimientos, nombreVencimiento, textoEstado, validarVencimiento,
} from "./vencimientos.js";
import { hoyMadrid } from "./fechas.js";

function memoria(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => (m.set(k, v), true), del: (k) => (m.delete(k), true) };
}
const V = (o) => ({ tipo: "itv", fecha: "2026-11-01", nota: "", vehiculo: "", antelacion: "30", ...o });

Deno.test("validación: tipo, fecha real y textos", () => {
  assert(validarVencimiento(V({})).vencimiento);
  for (const [campo, malo] of [["tipo", "carnet"], ["fecha", "2026-02-30"], ["fecha", "01/11/2026"], ["fecha", ""], ["fecha", "2101-01-01"],
    ["nota", "x".repeat(61)], ["vehiculo", "x".repeat(41)], ["antelacion", "10"]]) {
    assertEquals(validarVencimiento(V({ [campo]: malo })).campo, campo, `${campo}=${malo}`);
  }
  assertEquals(validarVencimiento(V({ tipo: "otro", nota: "" })).campo, "nota");
  assert(validarVencimiento(V({ tipo: "otro", nota: "Tarjeta de transporte" })).vencimiento);
  // Las fechas pasadas se admiten: sirven para ver lo vencido.
  assert(validarVencimiento(V({ fecha: "2020-01-01" })).vencimiento);
});

Deno.test("estado: vencido, hoy, próximo según la antelación elegida y al día", () => {
  const hoy = "2026-10-18";
  assertEquals(estado(V({ fecha: "2026-10-17", antelacion: 30 }), hoy), { dias: -1, clase: "vencido" });
  assertEquals(estado(V({ fecha: "2026-10-18", antelacion: 30 }), hoy), { dias: 0, clase: "hoy" });
  assertEquals(estado(V({ fecha: "2026-11-17", antelacion: 30 }), hoy), { dias: 30, clase: "proximo" });
  assertEquals(estado(V({ fecha: "2026-11-18", antelacion: 30 }), hoy), { dias: 31, clase: "al_dia" });
  assertEquals(estado(V({ fecha: "2026-10-26", antelacion: 7 }), hoy).clase, "al_dia");
  assertEquals(textoEstado({ dias: -1, clase: "vencido" }), "Venció ayer");
  assertEquals(textoEstado({ dias: -12, clase: "vencido" }), "Venció hace 12 días");
  assertEquals(textoEstado({ dias: 0, clase: "hoy" }), "Vence hoy");
  assertEquals(textoEstado({ dias: 1, clase: "proximo" }), "Vence mañana");
  assertEquals(textoEstado({ dias: 45, clase: "al_dia" }), "Vence en 45 días");
});

Deno.test("zona horaria Europe/Madrid: el día cambia a medianoche peninsular, no UTC", () => {
  const v = V({ fecha: "2026-10-18", antelacion: 7 });
  // 21:59 UTC del 17/10 = 23:59 en Madrid: aún falta un día.
  assertEquals(estado(v, hoyMadrid(new Date("2026-10-17T21:59:00Z"))).dias, 1);
  // 22:00 UTC del 17/10 = 00:00 del 18/10 en Madrid: vence hoy.
  assertEquals(estado(v, hoyMadrid(new Date("2026-10-17T22:00:00Z"))).clase, "hoy");
  // En invierno (UTC+1): 23:00 UTC del 18/12 ya es 19/12 en Madrid.
  assertEquals(estado(V({ fecha: "2026-12-18", antelacion: 7 }), hoyMadrid(new Date("2026-12-18T23:00:00Z"))).clase, "vencido");
  // Cambio de hora (25/10): siguen siendo días de calendario.
  assertEquals(estado(V({ fecha: "2026-10-26" }), "2026-10-24").dias, 2);
});

Deno.test("guardar, ordenar por fecha, editar, borrar y avisos", () => {
  const s = memoria();
  const a = anadirVencimiento(V({ tipo: "seguro", fecha: "2026-12-01" }), s).vencimiento;
  const b = anadirVencimiento(V({ tipo: "itv", fecha: "2026-10-01", vehiculo: "Taxi 1" }), s).vencimiento;
  anadirVencimiento(V({ tipo: "taximetro", fecha: "2026-10-25", antelacion: "7" }), s);
  assertEquals(leerVencimientos(s).map((v) => v.tipo), ["itv", "taximetro", "seguro"]);
  assertEquals(avisos(leerVencimientos(s), "2026-10-18").map((v) => [v.tipo, v.clase]), [["itv", "vencido"], ["taximetro", "proximo"]]);
  assert(editarVencimiento(a.id, V({ tipo: "seguro", fecha: "2026-10-20" }), s).vencimiento);
  assertEquals(avisos(leerVencimientos(s), "2026-10-18").length, 3);
  assert(editarVencimiento("x", V({}), s).error);
  borrarVencimiento(b.id, s);
  assertEquals(leerVencimientos(s).length, 2);
  borrarVencimientos(s);
  assertEquals(s.get(CLAVE_VENCIMIENTOS), null);
});

Deno.test("datos corruptos: se ignoran sin romper", () => {
  for (const malo of ["{roto", "null", "1", "{}", "[1,null,\"x\"]", '[{"id":"a","tipo":"itv","fecha":"mañana"}]', '[{"id":3,"tipo":"itv","fecha":"2026-10-01"}]']) {
    assertEquals(leerVencimientos(memoria({ [CLAVE_VENCIMIENTOS]: malo })), [], malo);
  }
  const ok = { id: "a", tipo: "itv", fecha: "2026-10-01", antelacion: 30 };
  assertEquals(leerVencimientos(memoria({ [CLAVE_VENCIMIENTOS]: JSON.stringify([ok, ok, { ...ok, id: "b", tipo: "x" }]) })).map((v) => v.id), ["a"]);
  const c = memoria({ [CLAVE_VENCIMIENTOS]: "{roto" });
  assert(anadirVencimiento(V({}), c).vencimiento);
  const lleno = { get: () => null, set: () => false, del: () => false };
  assert(anadirVencimiento(V({}), lleno).error);
});

Deno.test("nombre y CSV", () => {
  assertEquals(nombreVencimiento({ tipo: "otro", nota: "Tarjeta de transporte" }), "Tarjeta de transporte");
  assertEquals(nombreVencimiento({ tipo: "seguro", nota: "Mapfre" }), "Seguro (Mapfre)");
  const csv = aCSV([{ fecha: "2026-11-01", tipo: "itv", nota: "", vehiculo: "=Taxi", antelacion: 30 }]).split("\r\n");
  assertEquals(csv[0], "fecha;tipo;descripcion;vehiculo;avisar_dias_antes");
  assertEquals(csv[1], "2026-11-01;ITV;;'=Taxi;30");
});

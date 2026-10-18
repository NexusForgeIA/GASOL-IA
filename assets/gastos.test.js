import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  aCSV, anadirRegistro, borrarGastos, borrarRegistro, celdaCSV, CLAVE_GASTOS, costePorKm, editarRegistro, leerRegistros,
  porDia, porEtiqueta, resumenMensual, totales, validarRegistro,
} from "./gastos.js";

function memoria(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => (m.set(k, v), true), del: (k) => (m.delete(k), true) };
}
const HOY = "2026-10-18";
const R = (o) => ({ fecha: "2026-10-01", litros: "50", importe: "80", combustible: "gasoleo_a", km: "", etiqueta: "", ...o });

Deno.test("validación: frena errores de tecleo", () => {
  assert(validarRegistro(R({}), HOY).registro);
  assertEquals(validarRegistro(R({ litros: "50,5", importe: "81,25" }), HOY).registro.litros, 50.5);
  for (const [campo, malo] of [["fecha", "2026-02-30"], ["fecha", "2026-10-20"], ["fecha", "1999-12-31"], ["fecha", ""],
    ["litros", "0"], ["litros", "-5"], ["litros", "2001"], ["litros", ""], ["importe", "0"], ["importe", "10001"], ["importe", "abc"],
    ["combustible", "queroseno"], ["km", "-1"], ["km", "10000000"], ["etiqueta", "x".repeat(41)]]) {
    const r = validarRegistro(R({ [campo]: malo }), HOY);
    assertEquals(r.campo, campo, `${campo}=${malo}`);
  }
  // Mañana se admite (holgura de zona horaria); el cuentakilómetros admite punto de miles.
  assert(validarRegistro(R({ fecha: "2026-10-19" }), HOY).registro);
  assertEquals(validarRegistro(R({ km: "123.456" }), HOY).registro.km, 123456);
  assertEquals(validarRegistro(R({ etiqueta: "  Taxi   1 " }), HOY).registro.etiqueta, "Taxi 1");
});

Deno.test("guardar, editar y borrar", () => {
  const s = memoria();
  const a = anadirRegistro(R({ fecha: "2026-10-02" }), s, HOY).registro;
  const b = anadirRegistro(R({ fecha: "2026-10-05", importe: "90" }), s, HOY).registro;
  assertEquals(leerRegistros(s).map((r) => r.id), [b.id, a.id]); // más reciente primero
  assert(editarRegistro(a.id, R({ fecha: "2026-10-02", importe: "70" }), s, HOY).registro);
  assertEquals(leerRegistros(s).find((r) => r.id === a.id).importe, 70);
  assert(editarRegistro("no-existe", R({}), s, HOY).error);
  assert(editarRegistro(a.id, R({ litros: "-1" }), s, HOY).error);
  borrarRegistro(b.id, s);
  assertEquals(leerRegistros(s).length, 1);
  borrarGastos(s);
  assertEquals(s.get(CLAVE_GASTOS), null);
});

Deno.test("datos corruptos: se ignoran sin romper", () => {
  for (const malo of ["{roto", "null", "7", '"x"', "{}", "[null,1,\"a\"]", '[{"id":5}]', '[{"id":"a","fecha":"x","litros":1,"importe":1,"combustible":"gasoleo_a"}]']) {
    assertEquals(leerRegistros(memoria({ [CLAVE_GASTOS]: malo })), [], malo);
  }
  const ok = { id: "a", fecha: "2026-10-01", litros: 40, importe: 60, combustible: "gasoleo_a", km: null, etiqueta: "" };
  const s = memoria({ [CLAVE_GASTOS]: JSON.stringify([ok, ok, { ...ok, id: "b", litros: -3 }, { ...ok, id: "c", importe: "1e9" }]) });
  assertEquals(leerRegistros(s).map((r) => r.id), ["a"]);
  // Se puede seguir guardando encima de datos corruptos.
  const c = memoria({ [CLAVE_GASTOS]: "{roto" });
  assert(anadirRegistro(R({}), c, HOY).registro);
  assertEquals(leerRegistros(c).length, 1);
  const lleno = { get: () => null, set: () => false, del: () => false };
  assert(anadirRegistro(R({}), lleno, HOY).error);
});

const lista = (...rs) => rs.map((r, i) => ({ id: String(i), ...validarRegistro(R(r), HOY).registro }));

Deno.test("coste por km entre lecturas del cuentakilómetros", () => {
  const l = lista({ km: "10000", importe: "80" }, { km: "10500", importe: "75", fecha: "2026-10-05" }, { km: "11000", importe: "85", fecha: "2026-10-09" }, { km: "", importe: "50" });
  // El primer repostaje no cuenta (llena antes de medir); el que no tiene lectura tampoco.
  assertEquals(costePorKm(l), { km: 1000, importe: 160, coste_km: 0.16, lecturas: 3 });
  assertEquals(costePorKm(lista({ km: "1000" })), null);
  assertEquals(costePorKm(lista({ km: "1000" }, { km: "1000" })), null); // sin km recorridos: no divide entre 0
  assertEquals(costePorKm([]), null);
});

Deno.test("resumen mensual, por día y por turno o vehículo", () => {
  const l = lista(
    { fecha: "2026-09-30", litros: "40", importe: "64", etiqueta: "Taxi 1", km: "1000" },
    { fecha: "2026-10-01", litros: "50", importe: "80", etiqueta: "Taxi 1", km: "1400" },
    { fecha: "2026-10-01", litros: "10", importe: "15", etiqueta: "Noche" },
    { fecha: "2026-10-03", litros: "20,5", importe: "33,33" },
  );
  assertEquals(resumenMensual(l).map((m) => [m.mes, m.repostajes, m.litros, m.importe]), [["2026-10", 3, 80.5, 128.33], ["2026-09", 1, 40, 64]]);
  assertEquals(resumenMensual(l)[0].precio_medio, 1.594);
  assertEquals(porDia(l, "2026-10").map((d) => [d.fecha, d.importe]), [["2026-10-03", 33.33], ["2026-10-01", 95]]);
  const e = porEtiqueta(l);
  assertEquals(e.map((g) => [g.etiqueta, g.importe]), [["Taxi 1", 144], ["", 33.33], ["Noche", 15]]);
  assertEquals(e[0].km.coste_km, 0.2);
  assertEquals(e[1].km, null);
  assertEquals(resumenMensual([]), []);
});

Deno.test("CSV: separador ;, coma decimal y sin fórmulas", () => {
  const l = lista({ fecha: "2026-10-02", litros: "50", importe: "80", km: "1234", etiqueta: '=HYPERLINK("x")' }, { fecha: "2026-10-01", etiqueta: "Furgo; 2" });
  const csv = aCSV(l).split("\r\n");
  assertEquals(csv[0], "fecha;litros;importe_eur;precio_eur_litro;combustible;cuentakilometros;turno_o_vehiculo");
  assertEquals(csv[1], "2026-10-01;50,00;80,00;1,600;Gasóleo A;;\"Furgo; 2\"");
  assertEquals(csv[2], "2026-10-02;50,00;80,00;1,600;Gasóleo A;1234;\"'=HYPERLINK(\"\"x\"\")\"");
  assertEquals(celdaCSV("-3"), "'-3");
  assertEquals(celdaCSV("normal"), "normal");
});

Deno.test("totales: precio medio pagado y lista vacía", () => {
  const l = lista({ litros: "40", importe: "60" }, { litros: "10", importe: "17" });
  assertEquals(totales(l), { repostajes: 2, litros: 50, importe: 77, precio_medio: 1.54 });
  assertEquals(totales([]), { repostajes: 0, litros: 0, importe: 0, precio_medio: null });
});

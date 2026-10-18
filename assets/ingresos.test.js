import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  aCSV, anadirApp, anadirCarrera, borrarCarrera, borrarIngresos, CLAVE_INGRESOS, CLAVE_RESPALDO, cruce, editarCarrera, leerApps,
  etiquetaDia, leerCarreras, leerImporte, quitarApp, restaurarCarrera, tablaMensual, totalCompacto, totalesCarreras, validarCarrera,
} from "./ingresos.js";
import { cuadriculaMes, diaSemana, diasDelMes, fechaLarga, horaMadrid, hoyMadrid, sumarMeses } from "./fechas.js";

function memoria(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => (m.set(k, v), true), del: (k) => (m.delete(k), true) };
}
const HOY = "2026-10-18";
const C = (o) => ({ fecha: "2026-10-18", hora: "10:00", canal: "calle", metodo: "efectivo", app: "", importe: "10", nota: "", ...o });
const lista = (...cs) => cs.map((c, i) => ({ id: String(i), ...validarCarrera(C(c), "9999-12-30").carrera }));

Deno.test("importe: un solo separador decimal, sin negativos", () => {
  assertEquals(leerImporte("12,50"), 12.5);
  assertEquals(leerImporte("12.5"), 12.5);
  assertEquals(leerImporte(" 8 € "), 8);
  assertEquals(leerImporte("0"), 0);
  for (const malo of ["", "-3", "1,2,3", "1.2.3", "1.234,50", "12,505", "abc", "1e3", "100000"]) assert(Number.isNaN(leerImporte(malo)), malo);
});

Deno.test("validación: canal, método, aplicación, hora y textos", () => {
  assert(validarCarrera(C({}), HOY).carrera);
  assertEquals(validarCarrera(C({ importe: "0,01" }), HOY).carrera.importe, 0.01);
  assert(validarCarrera(C({ importe: "0" }), HOY).error.includes("mayor que 0"));
  for (const [o, campo] of [[{ canal: "bus" }, "canal"], [{ metodo: "app" }, "metodo"], [{ canal: "app", metodo: "tarjeta", app: "X" }, "metodo"],
    [{ canal: "app", metodo: "app", app: "  " }, "app"], [{ canal: "app", metodo: "app", app: "x".repeat(41) }, "app"],
    [{ importe: "-1" }, "importe"], [{ importe: "0" }, "importe"], [{ importe: "0,00" }, "importe"], [{ importe: "10001" }, "importe"], [{ hora: "24:00" }, "hora"], [{ hora: "" }, "hora"],
    [{ fecha: "2026-10-20" }, "fecha"], [{ fecha: "2026-02-30" }, "fecha"], [{ nota: "x".repeat(81) }, "nota"]]) {
    assertEquals(validarCarrera(C(o), HOY).campo, campo, JSON.stringify(o));
  }
  // Calle no guarda aplicación; total sin detallar va sin hora.
  assertEquals(validarCarrera(C({ app: "Algo" }), HOY).carrera.app, "");
  assertEquals(validarCarrera(C({ sinDetalle: "on", hora: "" }), HOY).carrera.hora, null);
  assertEquals(validarCarrera(C({ canal: "app", metodo: "efectivo", app: "  Mi   app " }), HOY).carrera.app, "Mi app");
});

// Caso a mano: día con calle efectivo y tarjeta y dos apps con las dos formas de cobro.
//  calle efectivo 12,50 + 7,30 = 19,80 · calle tarjeta 15,00 · App A cobrado 20,00 · App A efectivo 9,40
//  App B cobrado 11,25 · App B efectivo 6,00 · total sin detallar calle efectivo 30,00 (no cuenta como carrera)
//  calle_efectivo 49,80 · calle_tarjeta 15,00 · app_cobrado 31,25 · app_efectivo 15,40 · total 111,45
//  efectivo en mano 49,80 + 15,40 = 65,20 · cobrado por banco/datáfono/app 15,00 + 31,25 = 46,25 · 7 carreras
Deno.test("día con calle (efectivo y tarjeta) y dos apps con las dos formas de cobro", () => {
  const l = lista(
    { hora: "08:10", importe: "12,50" },
    { hora: "09:00", importe: "7.30" },
    { hora: "09:40", metodo: "tarjeta", importe: "15" },
    { hora: "11:00", canal: "app", metodo: "app", app: "App A", importe: "20" },
    { hora: "12:15", canal: "app", metodo: "efectivo", app: "App A", importe: "9,40" },
    { hora: "13:30", canal: "app", metodo: "app", app: "App B", importe: "11,25" },
    { hora: "14:05", canal: "app", metodo: "efectivo", app: "App B", importe: "6" },
    { sinDetalle: "on", hora: "", importe: "30" },
  );
  const t = totalesCarreras(l);
  assertEquals(t, { calle_efectivo: 49.8, calle_tarjeta: 15, app_cobrado: 31.25, app_efectivo: 15.4, total: 111.45, carreras: 7, lineas: 8,
    efectivo_en_mano: 65.2, cobrado_banco_app: 46.25 });
  const dia = tablaMensual(l, "2026-10").dias[17];
  assertEquals(dia.fecha, "2026-10-18");
  assertEquals(dia.total, 111.45);
  assertEquals(dia.lista.at(-1).hora, null); // el total sin detallar, al final del día
});

Deno.test("mes con días sin carreras y cambio de mes", () => {
  const l = lista(
    { fecha: "2026-09-30", hora: "23:50", importe: "18" },
    { fecha: "2026-10-01", hora: "00:20", importe: "22" },
    { fecha: "2026-10-01", hora: "06:00", canal: "app", metodo: "app", app: "App A", importe: "14,60" },
    { fecha: "2026-10-31", hora: "21:00", metodo: "tarjeta", importe: "9,90" },
  );
  const oct = tablaMensual(l, "2026-10");
  assertEquals(oct.dias.length, 31);
  assertEquals(oct.dias.filter((d) => d.lineas === 0).length, 29);
  assertEquals(oct.dias[1], { fecha: "2026-10-02", lista: [], calle_efectivo: 0, calle_tarjeta: 0, app_cobrado: 0, app_efectivo: 0, total: 0,
    carreras: 0, lineas: 0, efectivo_en_mano: 0, cobrado_banco_app: 0 });
  assertEquals([oct.total.total, oct.total.carreras, oct.total.efectivo_en_mano, oct.total.cobrado_banco_app], [46.5, 3, 22, 24.5]);
  // La carrera de las 23:50 del 30/09 es de septiembre aunque se cobre al cambiar de mes.
  const sep = tablaMensual(l, "2026-09");
  assertEquals(sep.dias.length, 30);
  assertEquals([sep.total.total, sep.total.carreras], [18, 1]);
  assertEquals(tablaMensual(l, "2026-11").total.total, 0);
  assertEquals(tablaMensual([], "2026-02").dias.length, 28);
  assertEquals(tablaMensual([], "2028-02").dias.length, 29);
});

Deno.test("fechas: meses, días y hora en Madrid", () => {
  assertEquals(sumarMeses("2026-12", 1), "2027-01");
  assertEquals(sumarMeses("2026-01", -1), "2025-12");
  assertEquals(diasDelMes("2026-10"), 31);
  assertEquals(diaSemana("2026-10-18"), "dom 18");
  assertEquals(horaMadrid(new Date("2026-10-18T22:30:00Z")), "00:30"); // verano: UTC+2
  assertEquals(horaMadrid(new Date("2026-12-01T08:05:00Z")), "09:05"); // invierno: UTC+1
});

Deno.test("guardar, editar, borrar, deshacer y aplicaciones del usuario", () => {
  const s = memoria();
  assertEquals(leerApps(s), []); // sin marcas preinstaladas
  const a = anadirCarrera(C({ canal: "app", metodo: "app", app: "App A" }), s, HOY).carrera;
  const b = anadirCarrera(C({ hora: "09:00" }), s, HOY).carrera;
  assertEquals(leerCarreras(s).map((c) => c.id), [b.id, a.id]); // por hora
  assertEquals(leerApps(s), ["App A"]);
  anadirCarrera(C({ canal: "app", metodo: "app", app: "app a" }), s, HOY); // misma app, otra mayúscula
  assertEquals(leerApps(s), ["App A"]);
  assert(editarCarrera(b.id, C({ hora: "09:00", importe: "11" }), s, HOY).carrera);
  assertEquals(leerCarreras(s).find((c) => c.id === b.id).importe, 11);
  assert(editarCarrera("no", C({}), s, HOY).error);
  assert(borrarCarrera(b.id, s));
  assertEquals(leerCarreras(s).length, 2);
  const borrada = { id: b.id, ...validarCarrera(C({ hora: "09:00", importe: "11" }), HOY).carrera };
  assert(restaurarCarrera(borrada, s));
  assert(restaurarCarrera(borrada, s)); // dos veces no la duplica
  assertEquals(leerCarreras(s).length, 3);
  assert(anadirApp("Otra", s).app);
  assert(quitarApp("App A", s));
  assertEquals(leerApps(s), ["Otra"]);
  assertEquals(leerCarreras(s).filter((c) => c.app.toLowerCase() === "app a").length, 2); // quitar el nombre no toca las carreras
  borrarIngresos(s);
  assertEquals(s.get(CLAVE_INGRESOS), null);
});

Deno.test("migración sin pérdida: lista sin versión, corrupto y versión futura", () => {
  const vieja = [{ id: "x", fecha: "2026-10-01", hora: "10:00", canal: "calle", metodo: "tarjeta", app: "", importe: 12, nota: "" }];
  const s = memoria({ [CLAVE_INGRESOS]: JSON.stringify(vieja), "gasol.gastos": "[1]" });
  assertEquals(leerCarreras(s).map((c) => c.id), ["x"]);
  anadirCarrera(C({}), s, HOY);
  const guardado = JSON.parse(s.get(CLAVE_INGRESOS));
  assertEquals([guardado.v, guardado.carreras.length], [1, 2]);
  assertEquals(s.get(CLAVE_RESPALDO), null); // se entendía: no hace falta respaldo
  assertEquals(s.get("gasol.gastos"), "[1]"); // no toca otras claves

  for (const raro of ["{roto", '{"v":2,"carreras":[]}']) {
    const r = memoria({ [CLAVE_INGRESOS]: raro });
    assertEquals(leerCarreras(r), []);
    assert(anadirCarrera(C({}), r, HOY).carrera);
    assertEquals(r.get(CLAVE_RESPALDO), raro); // lo que no se entiende se guarda aparte, intacto
    anadirCarrera(C({}), r, HOY);
    assertEquals(r.get(CLAVE_RESPALDO), raro);
    assertEquals(leerCarreras(r).length, 2);
  }
  const corrupta = memoria({ [CLAVE_INGRESOS]: JSON.stringify({ v: 1, carreras: [null, { id: 3 }, { ...vieja[0], importe: -1 }, vieja[0], vieja[0]], apps: [5, " A ", "A"] }) });
  assertEquals(leerCarreras(corrupta).length, 1);
  assertEquals(leerApps(corrupta), ["A"]);
  const bloqueado = { get: () => null, set: () => false, del: () => false };
  assert(anadirCarrera(C({}), bloqueado, HOY).error);
});

Deno.test("cruce con tus datos: menos combustible y por km", () => {
  assertEquals(cruce(1200, 310.45, 2500), { menos_combustible: 889.55, por_km: 0.48 });
  assertEquals(cruce(100, 0, null), { menos_combustible: 100, por_km: null });
  assertEquals(cruce(0, 50, 0).por_km, null);
});

Deno.test("CSV: una fila por carrera, canal, aplicación y método en columnas", () => {
  const l = lista({ hora: "09:00", canal: "app", metodo: "efectivo", app: "=App", importe: "9,4", nota: "aeropuerto; T4" }, { hora: "08:00", metodo: "tarjeta", importe: "15" },
    { sinDetalle: "on", hora: "", importe: "30" });
  const csv = aCSV(l).split("\r\n");
  assertEquals(csv[0], "fecha;hora;canal;aplicacion;metodo;importe_eur;calle_efectivo_eur;calle_tarjeta_eur;app_cobrado_eur;app_efectivo_eur;nota");
  assertEquals(csv[1], "2026-10-18;08:00;Calle;;Tarjeta;15,00;;15,00;;;");
  assertEquals(csv[2], "2026-10-18;09:00;Aplicación;'=App;Efectivo en mano;9,40;;;;9,40;\"aeropuerto; T4\"");
  assertEquals(csv[3], "2026-10-18;total sin detallar;Calle;;Efectivo;30,00;30,00;;;;");
});

// ---- Calendario --------------------------------------------------------------------------
const dias = (mes) => cuadriculaMes(mes).flat().filter(Boolean);

Deno.test("calendario: meses de 28, 29, 30 y 31 días, de lunes a domingo", () => {
  for (const [mes, n] of [["2026-02", 28], ["2028-02", 29], ["2026-11", 30], ["2026-10", 31]]) {
    const c = cuadriculaMes(mes);
    assertEquals(dias(mes).length, n, mes);
    assert(c.every((s) => s.length === 7), mes);
    assertEquals(dias(mes)[0], `${mes}-01`);
    assertEquals(dias(mes).at(-1), `${mes}-${n}`);
  }
  // Octubre de 2026 empieza en jueves: 3 huecos (L, M, X); el 31 es sábado: 1 hueco al final.
  const oct = cuadriculaMes("2026-10");
  assertEquals(oct[0], [null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  assertEquals(oct.at(-1), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
  assertEquals(oct.length, 5);
  // Febrero de 2026: 28 días que empiezan en domingo (6 huecos) → 5 semanas.
  const feb = cuadriculaMes("2026-02");
  assertEquals(feb[0], [null, null, null, null, null, null, "2026-02-01"]);
  assertEquals(feb.length, 5);
  assertEquals(feb.at(-1), ["2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", null]);
  // Marzo de 2026 (31 días, empieza en domingo) necesita 6 semanas.
  assertEquals(cuadriculaMes("2026-03").length, 6);
  assertEquals(cuadriculaMes("2026-03")[0][6], "2026-03-01");
  // Febrero de 2027 empieza en lunes y cabe en 4 semanas exactas.
  assertEquals(cuadriculaMes("2027-02").length, 4);
});

Deno.test("calendario: cambio a hora de invierno (25-26 de octubre de 2026) en Madrid", () => {
  // 25/10 a las 03:00 (CEST) los relojes vuelven a las 02:00 (CET): el día dura 25 horas.
  assertEquals(hoyMadrid(new Date("2026-10-24T22:30:00Z")), "2026-10-25"); // 00:30 CEST
  assertEquals(hoyMadrid(new Date("2026-10-25T00:30:00Z")), "2026-10-25"); // 02:30 CEST
  assertEquals(horaMadrid(new Date("2026-10-25T00:30:00Z")), "02:30");
  assertEquals(horaMadrid(new Date("2026-10-25T01:30:00Z")), "02:30"); // 02:30 CET, la hora repetida
  assertEquals(hoyMadrid(new Date("2026-10-25T22:59:00Z")), "2026-10-25"); // 23:59 CET
  assertEquals(hoyMadrid(new Date("2026-10-25T23:00:00Z")), "2026-10-26"); // 00:00 CET
  // La cuadrícula no depende de horas: el 25 es domingo y el 26 lunes, en semanas distintas.
  const oct = cuadriculaMes("2026-10");
  assertEquals(oct[3][6], "2026-10-25");
  assertEquals(oct[4][0], "2026-10-26");
  assertEquals(fechaLarga("2026-10-25"), "domingo 25 de octubre");
  assertEquals(fechaLarga("2026-10-26"), "lunes 26 de octubre");
  // Fin de mes: 31/10 a las 23:30 en Madrid ya es 1/11 en UTC+0 al día siguiente, pero el día es el de Madrid.
  assertEquals(hoyMadrid(new Date("2026-10-31T22:30:00Z")), "2026-10-31");
  assertEquals(hoyMadrid(new Date("2026-10-31T23:30:00Z")), "2026-11-01");
  // Una carrera de la hora repetida queda en el 25, y una de las 00:10 del 26 en el 26.
  const l = lista({ fecha: "2026-10-25", hora: "02:30", importe: "10" }, { fecha: "2026-10-25", hora: "02:45", importe: "5" }, { fecha: "2026-10-26", hora: "00:10", importe: "7" });
  const t = tablaMensual(l, "2026-10");
  assertEquals([t.dias[24].total, t.dias[24].carreras, t.dias[25].total], [15, 2, 7]);
});

Deno.test("celda: total en euros enteros y etiqueta con el importe exacto", () => {
  assertEquals(totalCompacto(112.45), "112 €");
  assertEquals(totalCompacto(112.5), "113 €");
  assertEquals(totalCompacto(0.45), "<1 €"); // solo céntimos: se marca que hay datos
  assertEquals(totalCompacto(0.99), "1 €");
  assertEquals(totalCompacto(1234.56), "1235 €");
  assertEquals(totalCompacto(0), "");
  const d = tablaMensual(lista({ fecha: "2026-10-14", hora: "08:00", importe: "100" }, { fecha: "2026-10-14", hora: "09:00", importe: "12,45" },
    { fecha: "2026-10-14", hora: "10:00", importe: "0,01" }, { fecha: "2026-10-14", sinDetalle: "on", hora: "", importe: "0,05" }), "2026-10").dias[13];
  assertEquals(d.total, 112.51);
  assertEquals(totalCompacto(d.total), "113 €");
  assertEquals(etiquetaDia(d), "miércoles 14 de octubre, 3 carreras y 1 total sin detallar, total 112,51 €");
  const c = tablaMensual(lista({ fecha: "2026-10-13", hora: "08:00", importe: "0,45" }), "2026-10").dias[12];
  assertEquals(etiquetaDia(c, { hoy: true }), "martes 13 de octubre, hoy, 1 carrera, total 0,45 €");
  assertEquals(etiquetaDia(tablaMensual([], "2026-10").dias[0]), "jueves 1 de octubre, sin carreras");
  assertEquals(etiquetaDia(tablaMensual([], "2026-10").dias[30], { futuro: true }), "sábado 31 de octubre, día futuro");
});

import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { fechaFuenteAIso, normalizar } from "./normalizar.ts";
import muestra from "./fixtures/muestra.json" with { type: "json" };

Deno.test("fecha de la fuente en hora peninsular (CEST) -> UTC", () => {
  assertEquals(fechaFuenteAIso("17/10/2026 21:54:46"), "2026-10-17T19:54:46.000Z");
});

Deno.test("fecha de la fuente en invierno (CET) -> UTC", () => {
  assertEquals(fechaFuenteAIso("15/01/2027 08:00:00"), "2027-01-15T07:00:00.000Z");
});

Deno.test("normaliza estaciones reales: coma decimal, horario y precios", () => {
  const r = normalizar(muestra, 1);
  assertEquals(r.estaciones.length, 3);
  const e = r.estaciones.find((x) => x.ideess === "4375")!;
  assertEquals(e.lat, 39.211417);
  assertEquals(e.lon, -1.539167);
  assertEquals(e.horario_texto, "L-D: 07:00-22:00");
  assertEquals(e.abierta_24h, "no");
  assertEquals(r.estaciones.find((x) => x.ideess === "5245")!.abierta_24h, "si");
  const ga = r.precios.find((p) => p.ideess === "4375" && p.combustible === "gasoleo_a");
  assertEquals(ga?.precio, 1.799);
  // Los campos vacíos no generan fila de precio.
  assertEquals(r.precios.some((p) => p.ideess === "4375" && p.combustible === "adblue"), false);
  assertEquals(r.avisos, []);
});

Deno.test("rechaza respuestas incompletas o con error", () => {
  assertThrows(() => normalizar(muestra), Error, "incompleta");
  assertThrows(() => normalizar({ ResultadoConsulta: "KO" }, 1), Error, "OK");
  assertThrows(() => normalizar({ ResultadoConsulta: "OK" }, 1), Error, "ListaEESSPrecio");
});

Deno.test("descarta duplicados y avisa de campos de precio nuevos", () => {
  const base = muestra.ListaEESSPrecio[0];
  const r = normalizar({
    ...muestra,
    ListaEESSPrecio: [base, base, { ...base, IDEESS: "9", "Precio Combustible Nuevo": "1,234" }],
  }, 1);
  assertEquals(r.estaciones.length, 2);
  assertEquals(r.precios.some((p) => p.combustible === "combustible_nuevo"), true);
  assertEquals(r.avisos.length, 2);
});

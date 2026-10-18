import { assertEquals } from "jsr:@std/assert@1.0.13";
import { AVISO_LIMITE_RUTAS, CLAVE_USO_RUTAS, contarUso, pausaCumplida, quedanHoy, usoDeHoy } from "./limite-rutas.js";
import { LIMITE_RUTAS_DISPOSITIVO_DIA, PAUSA_RUTAS_MS } from "./config.js";

function memoria(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => (m.set(k, v), true), del: (k) => (m.delete(k), true) };
}

Deno.test("tope por dispositivo: cuenta por día de Madrid y se reinicia al día siguiente", () => {
  const s = memoria();
  assertEquals(quedanHoy(s, "2026-10-18"), LIMITE_RUTAS_DISPOSITIVO_DIA);
  for (let i = 0; i < LIMITE_RUTAS_DISPOSITIVO_DIA; i++) contarUso(s, "2026-10-18");
  assertEquals(quedanHoy(s, "2026-10-18"), 0);
  assertEquals(quedanHoy(s, "2026-10-19"), LIMITE_RUTAS_DISPOSITIVO_DIA);
  assertEquals(JSON.parse(s.get(CLAVE_USO_RUTAS)), { dia: "2026-10-18", n: LIMITE_RUTAS_DISPOSITIVO_DIA }); // solo día y número
});

Deno.test("tope por dispositivo: datos raros cuentan como 0 y no tocan otras claves", () => {
  for (const raro of ["{roto", "null", '{"dia":"2026-10-18","n":-3}', '{"dia":"2026-10-18","n":"x"}']) {
    assertEquals(usoDeHoy(memoria({ [CLAVE_USO_RUTAS]: raro }), "2026-10-18"), 0, raro);
  }
  const s = memoria({ "gasol.rutas": "[1]" });
  contarUso(s, "2026-10-18");
  assertEquals(s.get("gasol.rutas"), "[1]");
});

Deno.test("pausa entre pulsaciones y aviso", () => {
  assertEquals(PAUSA_RUTAS_MS, 5000);
  assertEquals(pausaCumplida(null, 1000, PAUSA_RUTAS_MS), true);
  assertEquals(pausaCumplida(1000, 5999, PAUSA_RUTAS_MS), false);
  assertEquals(pausaCumplida(1000, 6000, PAUSA_RUTAS_MS), true);
  assertEquals(AVISO_LIMITE_RUTAS, "Has llegado al límite de cálculos de hoy en esta versión beta. Vuelve mañana.");
});

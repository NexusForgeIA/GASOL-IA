import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { diasEntre, esFechaISO, fechaCorta, hoyMadrid, nombreMes, sumarDias } from "./fechas.js";

Deno.test("hoy en Madrid, no en UTC", () => {
  // 23:30 UTC del 17/10 ya es 18/10 en Madrid (UTC+2 en verano).
  assertEquals(hoyMadrid(new Date("2026-10-17T23:30:00Z")), "2026-10-18");
  // 23:30 UTC del 31/12 es 1/1 en Madrid (UTC+1 en invierno).
  assertEquals(hoyMadrid(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  assertEquals(hoyMadrid(new Date("2026-12-31T22:59:00Z")), "2026-12-31");
});

Deno.test("fechas de calendario válidas", () => {
  assert(esFechaISO("2028-02-29"));
  assert(!esFechaISO("2026-02-29"));
  assert(!esFechaISO("2026-13-01"));
  assert(!esFechaISO("18/10/2026"));
  assert(!esFechaISO(null));
});

Deno.test("días entre fechas, también con cambio de hora", () => {
  assertEquals(diasEntre("2026-10-18", "2026-10-25"), 7); // la noche del 25/10 cambia la hora
  assertEquals(diasEntre("2026-03-28", "2026-03-30"), 2);
  assertEquals(diasEntre("2026-10-18", "2026-10-17"), -1);
  assertEquals(sumarDias("2026-12-31", 1), "2027-01-01");
  assertEquals(sumarDias("2028-03-01", -1), "2028-02-29");
});

Deno.test("formato para mostrar", () => {
  assertEquals(fechaCorta("2026-10-05"), "05/10/2026");
  assertEquals(nombreMes("2026-10"), "octubre de 2026");
});

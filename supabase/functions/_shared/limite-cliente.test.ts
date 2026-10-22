import { strictEqual as assertEquals } from "node:assert/strict";
import { ipDe, nuevoContador, superaLimite, VENTANA_MS } from "./limite-cliente.ts";

Deno.test("deja pasar hasta el máximo y luego frena con segundos de espera", () => {
  const c = nuevoContador();
  for (let i = 0; i < 5; i++) assertEquals(superaLimite(c, "1.1.1.1", 5, 1000), null);
  assertEquals(superaLimite(c, "1.1.1.1", 5, 1000 + 10_000), 50);
});
Deno.test("un cliente no gasta el cupo de otro", () => {
  const c = nuevoContador();
  for (let i = 0; i < 9; i++) superaLimite(c, "a", 5, 0);
  assertEquals(superaLimite(c, "b", 5, 0), null);
});
Deno.test("la ventana se reinicia", () => {
  const c = nuevoContador();
  for (let i = 0; i < 9; i++) superaLimite(c, "a", 5, 0);
  assertEquals(superaLimite(c, "a", 5, VENTANA_MS), null);
});
Deno.test("sin IP no limita", () => {
  assertEquals(superaLimite(nuevoContador(), null, 1), null);
});
Deno.test("la memoria no crece sin fin", () => {
  const c = nuevoContador();
  for (let i = 0; i < 12_000; i++) superaLimite(c, `ip${i}`, 5, 0);
  assertEquals(c.size <= 5000, true);
});
Deno.test("ipDe toma la primera de x-forwarded-for", () => {
  assertEquals(ipDe(new Request("http://x", { headers: { "x-forwarded-for": "2.2.2.2, 10.0.0.1" } })), "2.2.2.2");
  assertEquals(ipDe(new Request("http://x")), null);
});

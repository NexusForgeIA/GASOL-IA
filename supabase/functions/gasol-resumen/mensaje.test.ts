import { assertEquals } from "jsr:@std/assert@1.0.13";
import { ayerMadrid, claveIgual, componerResumen } from "./mensaje.ts";

Deno.test("resumen sin datos: «sin datos», sin cifras inventadas", () => {
  assertEquals(componerResumen("2026-10-17", { visitas: [], horas_tope: 0, rutas: null }), [
    "Gasol-IA · resumen de ayer (17/10/2026)",
    "Aperturas, no personas.",
    "Aperturas: sin datos",
    "Páginas más abiertas: sin datos",
    "Cálculos de ruta pedidos: sin datos",
  ].join("\n"));
});

Deno.test("resumen con datos: total, modos, tres páginas más abiertas, rutas y tope", () => {
  const texto = componerResumen("2026-10-18", {
    visitas: [
      { pagina: "inicio", modo: "navegador", recuento: 900 },
      { pagina: "inicio", modo: "instalada", recuento: 300 },
      { pagina: "ruta", modo: "navegador", recuento: 40 },
      { pagina: "comparador", modo: "instalada", recuento: 40 },
      { pagina: "gastos", modo: "navegador", recuento: 5 },
    ],
    horas_tope: 2,
    rutas: 8,
  });
  assertEquals(texto, [
    "Gasol-IA · resumen de ayer (18/10/2026)",
    "Aperturas, no personas.",
    "Aperturas: 1285 (navegador 945 · instalada 340)",
    "Páginas más abiertas: inicio 1200 · comparador 40 · ruta 40",
    "Cálculos de ruta pedidos: 8",
    "Dato orientativo: tope alcanzado en 2 horas.",
  ].join("\n"));
});

Deno.test("resumen con un modo que falta: ese modo vale 0; una hora de tope en singular", () => {
  const texto = componerResumen("2026-10-18", { visitas: [{ pagina: "privacidad", modo: "navegador", recuento: 2 }], horas_tope: 1, rutas: 0 });
  assertEquals(texto.split("\n").slice(2), [
    "Aperturas: 2 (navegador 2 · instalada 0)",
    "Páginas más abiertas: privacidad 2",
    "Cálculos de ruta pedidos: 0",
    "Dato orientativo: tope alcanzado en 1 hora.",
  ]);
});

Deno.test("ayer en Madrid, también con el cambio de hora del 25/10/2026", () => {
  assertEquals(ayerMadrid(new Date("2026-10-18T06:00:00Z")), "2026-10-17"); // 08:00 CEST
  assertEquals(ayerMadrid(new Date("2026-10-26T07:00:00Z")), "2026-10-25"); // 08:00 CET, primer día de invierno
  assertEquals(ayerMadrid(new Date("2026-10-31T23:30:00Z")), "2026-10-31"); // ya es 1/11 en Madrid
});

Deno.test("claves: comparación por SHA-256 en tiempo constante", async () => {
  assertEquals(await claveIgual("abc", "abc"), true);
  assertEquals(await claveIgual("abc", "abd"), false);
  assertEquals(await claveIgual("abc", ""), false);
  assertEquals(await claveIgual("a".repeat(64), "a".repeat(63)), false);
});

import { assertEquals } from "jsr:@std/assert@1.0.13";
import { clasificarHorario } from "./horario.ts";

// Casos reales tomados de la muestra del 17/10/2026 (ver docs/FUENTE-DATOS.md).
const casos: [string | null, string][] = [
  // 24 h sin ambigüedad
  ["L-D: 24H", "si"],
  ["l-d: 24h", "si"],
  ["  L-D:   24H ", "si"],
  ["L-D: 00:00-23:59", "si"],
  ["L-D: 00:00-24:00", "si"],
  ["L-V: 24H; S-D: 24H", "si"],
  ["L-V: 00:00-23:59; S-D: 24H", "si"],
  ["L: 06:00-23:59; M-V: 24H; S-D: 06:00-22:00", "no"],

  // Horario parcial bien formado
  ["L-D: 06:00-22:00", "no"],
  ["L-D: 7:00-23:00", "no"],
  ["L-V: 06:00-22:00; S-D: 07:00-22:00", "no"],
  ["L-J: 06:00-01:00; V-S: 24H; D: 06:00-01:00", "no"],
  ["L-V: 08:00-13:00 y 15:00-19:00; S-D: 24H", "no"],
  ["L-D: 00:00-23:59 y 00:00-23:59", "no"],
  ["L-S: 08:00-22:00; D: 24H", "no"],
  ["L-S: 06:00-22:00", "no"], // domingo sin dato, pero ya no es 24 h
  ["L: 06:00-22:00", "no"],

  // Dudosos: no cubren los 7 días, repiten días o no se entienden
  ["L: 24H", "sin_confirmar"],
  ["L-S: 24H", "sin_confirmar"],
  ["S-D: 24H", "sin_confirmar"],
  ["L-M: 24H; J-D: 24H", "sin_confirmar"], // falta el miércoles (X)
  ["L-D: 24H; D: 24H", "sin_confirmar"], // domingo dos veces
  ["L-D: 00:00-00:00", "sin_confirmar"], // ¿cerrada o 24 h? ambiguo
  ["24 HORAS", "sin_confirmar"],
  ["L-D: 24 HORAS", "sin_confirmar"],
  ["D-L: 24H", "sin_confirmar"],
  ["L-D: 25:00-26:00", "sin_confirmar"],
  ["", "sin_confirmar"],
  [null, "sin_confirmar"],
];

for (const [texto, esperado] of casos) {
  Deno.test(`horario ${JSON.stringify(texto)} -> ${esperado}`, () => {
    assertEquals(clasificarHorario(texto), esperado);
  });
}

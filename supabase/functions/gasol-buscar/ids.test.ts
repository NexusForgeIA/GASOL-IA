import { assertEquals } from "jsr:@std/assert@1.0.13";
import { FICHA_COMBUSTIBLES, idsValidos, MAX_IDS } from "./ids.ts";

Deno.test("ids de favoritas: limpia, quita duplicados y valida", () => {
  assertEquals(idsValidos("4375, 5122,4375,"), ["4375", "5122"]);
  assertEquals(idsValidos(""), null);
  assertEquals(idsValidos("12,abc"), null);
  assertEquals(idsValidos("1;DROP"), null);
  assertEquals(idsValidos(Array.from({ length: MAX_IDS + 1 }, (_, i) => String(i + 1)).join(",")), null);
});

Deno.test("ficha: sin hidrógeno ni gasóleo B; con los gases de unidad confirmada", () => {
  for (const dentro of ["gnc", "gnl", "biogas_comprimido", "biogas_licuado"]) assertEquals(FICHA_COMBUSTIBLES.includes(dentro), true, dentro);
  for (const fuera of ["hidrogeno", "gasoleo_b", "metanol", "amoniaco"]) {
    assertEquals(FICHA_COMBUSTIBLES.includes(fuera), false, fuera);
  }
  assertEquals(new Set(FICHA_COMBUSTIBLES).size, FICHA_COMBUSTIBLES.length);
});

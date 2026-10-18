import { assertEquals } from "jsr:@std/assert@1.0.13";
import { idsValidos, MAX_IDS } from "./ids.ts";

Deno.test("ids de favoritas: limpia, quita duplicados y valida", () => {
  assertEquals(idsValidos("4375, 5122,4375,"), ["4375", "5122"]);
  assertEquals(idsValidos(""), null);
  assertEquals(idsValidos("12,abc"), null);
  assertEquals(idsValidos("1;DROP"), null);
  assertEquals(idsValidos(Array.from({ length: MAX_IDS + 1 }, (_, i) => String(i + 1)).join(",")), null);
});

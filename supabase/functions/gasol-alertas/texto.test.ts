import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { textoAviso } from "./texto.ts";

Deno.test("aviso corto, con fecha de captura y sin promesas", () => {
  const { titulo, cuerpo } = textoAviso("Madrid - Zaragoza", "gasoleo_a", 3, 1.659, "2026-10-18T04:15:30Z");
  assertEquals(titulo, "Madrid - Zaragoza");
  assertEquals(cuerpo, "Gasóleo A: 3 bajan en tu ruta. Más barata del corredor: 1,659 €/l (captura 18/10, 06:15).");
  assert(cuerpo.length <= 160);
});

Deno.test("singular y límites de longitud", () => {
  const { titulo, cuerpo } = textoAviso("R".repeat(90), "adblue", 1, 0.6, "2026-01-15T07:00:00Z");
  assertEquals(titulo.length, 60);
  assert(cuerpo.startsWith("AdBlue: 1 baja en tu ruta."));
  assert(cuerpo.includes("(captura 15/01, 08:00)"));
});

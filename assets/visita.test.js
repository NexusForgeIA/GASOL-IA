import { assertEquals } from "jsr:@std/assert@1.0.13";
import { paginaDe } from "./visita.js";

Deno.test("página de la ruta de la URL, sin parámetros ni nada más", () => {
  assertEquals(paginaDe("/GASOL-IA/"), "portada");
  assertEquals(paginaDe("/GASOL-IA/index.html"), "portada");
  assertEquals(paginaDe("/GASOL-IA/ruta.html"), "ruta");
  assertEquals(paginaDe("/aviso-legal.html"), "aviso-legal");
});

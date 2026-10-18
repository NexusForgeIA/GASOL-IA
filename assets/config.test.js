import { assertEquals } from "jsr:@std/assert@1.0.13";
import { CORREO_CONTACTO, enlaceOpinion } from "./config.js";

Deno.test("enviar opinión: solo correo, con el asunto de la beta", () => {
  assertEquals(CORREO_CONTACTO, "comercial@whitemoon.es");
  assertEquals(enlaceOpinion(), "mailto:comercial@whitemoon.es?subject=Opini%C3%B3n%20Gasol-IA%20beta");
});

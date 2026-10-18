import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { AVISO_BETA, CORREO_CONTACTO, enlaceOpinion } from "./config.js";

Deno.test("enviar opinión: solo correo, con el asunto de la beta", () => {
  assertEquals(CORREO_CONTACTO, "comercial@whitemoon.es");
  assertEquals(enlaceOpinion(), "mailto:comercial@whitemoon.es?subject=Opini%C3%B3n%20Gasol-IA%20beta");
});

Deno.test("nota de beta: sin «en vivo» ni «tiempo real»", () => {
  assert(!/en vivo|tiempo real/i.test(AVISO_BETA));
  assert(AVISO_BETA.includes("beta gratuita"));
});

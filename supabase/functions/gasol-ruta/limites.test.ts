import { assertEquals } from "jsr:@std/assert@1.0.13";
import { contarRuta, LIMITE_RUTAS_DIA, LIMITE_RUTAS_HORA, MENSAJES_LIMITE } from "./limites.ts";

/** Imita gasol_contar_ruta: contadores por hora y por día (día de Madrid), sin nada más. */
function contadorFalso(reloj: { ahora: Date }) {
  const tabla = new Map<string, number>();
  const llamadas: unknown[] = [];
  const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
  const rpc = (nombre: string, args: Record<string, number>) => {
    llamadas.push({ nombre, args });
    const h = `hora:${reloj.ahora.toISOString().slice(0, 13)}`;
    const d = `dia:${dia(reloj.ahora)}`;
    tabla.set(h, (tabla.get(h) ?? 0) + 1);
    tabla.set(d, (tabla.get(d) ?? 0) + 1);
    if (tabla.get(d)! > args.p_limite_dia) return Promise.resolve("dia");
    if (tabla.get(h)! > args.p_limite_hora) return Promise.resolve("hora");
    return Promise.resolve("ok");
  };
  return { rpc, tabla, llamadas };
}

Deno.test("contador: tope por hora y nueva ventana a la hora siguiente", async () => {
  const reloj = { ahora: new Date("2026-10-18T10:05:00Z") };
  const { rpc } = contadorFalso(reloj);
  for (let i = 0; i < LIMITE_RUTAS_HORA; i++) assertEquals(await contarRuta(rpc), null);
  assertEquals(await contarRuta(rpc), "hora"); // el 61
  reloj.ahora = new Date("2026-10-18T11:00:00Z"); // ventana nueva
  assertEquals(await contarRuta(rpc), null);
});

Deno.test("contador: tope diario con el día de Madrid", async () => {
  const reloj = { ahora: new Date("2026-10-17T00:00:00Z") };
  const { rpc } = contadorFalso(reloj);
  let ultima = null;
  for (let i = 0; i < LIMITE_RUTAS_DIA; i++) {
    reloj.ahora = new Date(Date.UTC(2026, 9, 17, Math.floor(i / LIMITE_RUTAS_HORA), i % 60)); // nunca supera el tope por hora
    ultima = await contarRuta(rpc);
  }
  assertEquals(ultima, null); // el 500 todavía entra
  assertEquals(await contarRuta(rpc), "dia");
  // 17/10 a las 22:30 UTC ya es 18/10 en Madrid (00:30 CEST): día nuevo.
  reloj.ahora = new Date("2026-10-17T22:30:00Z");
  assertEquals(await contarRuta(rpc), null);
});

Deno.test("429: cada ventana tiene su mensaje legible", async () => {
  assertEquals(await contarRuta(() => Promise.resolve("dia")), "dia");
  assertEquals(await contarRuta(() => Promise.resolve("hora")), "hora");
  assertEquals(await contarRuta(() => Promise.resolve("ok")), null);
  assertEquals(MENSAJES_LIMITE.dia, "Has llegado al límite de cálculos de hoy en esta versión beta. Vuelve mañana.");
});

Deno.test("la carga útil del contador no lleva coordenadas ni identificadores", async () => {
  const reloj = { ahora: new Date("2026-10-18T10:05:00Z") };
  const { rpc, llamadas, tabla } = contadorFalso(reloj);
  await contarRuta(rpc);
  assertEquals(llamadas, [{ nombre: "gasol_contar_ruta", args: { p_limite_hora: LIMITE_RUTAS_HORA, p_limite_dia: LIMITE_RUTAS_DIA } }]);
  const texto = JSON.stringify(llamadas) + JSON.stringify([...tabla]);
  assertEquals(/lat|lon|punto|ip|usuario|\d+\.\d{3,}/i.test(texto), false);
});

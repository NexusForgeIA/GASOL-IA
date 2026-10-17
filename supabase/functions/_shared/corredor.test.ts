import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.13";
import { cajas, distanciaSegmento, enCorredor, haversineM, type Punto, proyectar, simplificar, tendencia } from "./corredor.ts";

// Madrid (Puerta del Sol) – Zaragoza (Pilar): ~ 274 km en línea recta.
const MAD: Punto = [40.4168, -3.7038];
const ZGZ: Punto = [41.6567, -0.8792];

Deno.test("haversine Madrid-Zaragoza ~ 274 km", () => {
  assertAlmostEquals(haversineM(MAD, ZGZ) / 1000, 274, 3);
});

Deno.test("distancia a un segmento: perpendicular y extremos", () => {
  // Segmento horizontal a lo largo del ecuador, punto 0,01º al norte del centro ≈ 1.112 m.
  const { m, t } = distanciaSegmento([0.01, 0.5], [0, 0], [0, 1]);
  assertAlmostEquals(m, 1112, 5);
  assertAlmostEquals(t, 0.5, 1e-6);
  // Más allá del extremo: t se recorta a 1 y la distancia es al extremo.
  assertEquals(distanciaSegmento([0, 2], [0, 0], [0, 1]).t, 1);
});

Deno.test("simplificar conserva extremos y quita puntos alineados", () => {
  const recta: Punto[] = Array.from({ length: 50 }, (_, i) => [40, -3 + i * 0.01]);
  const s = simplificar(recta, 50);
  assertEquals(s.length, 2);
  assertEquals(s[0], recta[0]);
  assertEquals(s[1], recta[49]);
  // Un pico de ~1 km no se pierde con tolerancia de 100 m.
  const pico: Punto[] = [[40, -3], [40.01, -2.99], [40, -2.98]];
  assertEquals(simplificar(pico, 100).length, 3);
});

Deno.test("proyectar da lateral y km a lo largo de la ruta", () => {
  const ruta: Punto[] = [[40, -3], [40, -2]]; // ~85 km hacia el este
  const p = proyectar([40.009, -2.5], ruta);
  assertAlmostEquals(p.lateralM, 1000, 10);
  assertAlmostEquals(p.kmRuta, 42.6, 0.5);
});

Deno.test("cajas cubren toda la ruta ampliadas el margen lateral", () => {
  const ruta: Punto[] = Array.from({ length: 101 }, (_, i) => [40, -4 + i * 0.03]); // ~255 km
  const cs = cajas(ruta, 5, 50);
  assert(cs.length >= 5);
  for (const p of ruta) {
    assert(cs.some(([a, b, c, d]) => p[0] >= a && p[0] <= b && p[1] >= c && p[1] <= d));
  }
  assert(cs[0][0] < 40 - 5 / 111.32 + 1e-9);
});

Deno.test("tendencia respecto a la captura anterior", () => {
  assertEquals(tendencia(1.659, 1.689), "baja");
  assertEquals(tendencia(1.699, 1.689), "sube");
  assertEquals(tendencia(1.689, 1.689), "igual");
  assertEquals(tendencia(1.689, null), null);
  // Ruido de coma flotante no cuenta como cambio.
  assertEquals(tendencia(0.1 + 0.2, 0.3), "igual");
});

Deno.test("enCorredor filtra por lateral y ordena por precio", () => {
  const ruta: Punto[] = [[40, -3], [40, -2]];
  const est = [
    { ideess: "lejos", lat: 40.1, lon: -2.5, precio: 1.5 }, // ~11 km
    { ideess: "cara", lat: 40.005, lon: -2.5, precio: 1.8, precio_anterior: 1.7 },
    { ideess: "barata", lat: 39.99, lon: -2.2, precio: 1.6, precio_anterior: 1.65 },
  ];
  const r = enCorredor(est, ruta, 2);
  assertEquals(r.map((x) => x.ideess), ["barata", "cara"]);
  assertEquals(r[0].tendencia, "baja");
  assertEquals(r[1].tendencia, "sube");
});

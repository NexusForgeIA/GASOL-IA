import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.13";
import { compararDesvio, enlaceGoogleMaps, enlaceWaze, puntosIntermedios } from "./calculos.js";

const O = { nombre: "Madrid", lat: 40.4168, lon: -3.7038 };
const D = { nombre: "Zaragoza", lat: 41.6567, lon: -0.8792 };

Deno.test("intermedios ordenados por km de ruta", () => {
  const r = puntosIntermedios(
    [{ nombre: "Guadalajara", lat: 40.63, lon: -3.16, km: 60 }, { nombre: "Calatayud", lat: 41.35, lon: -1.64, km: 235 }],
    { nombre: "Estación", lat: 41.0, lon: -2.5, km: 140 },
  );
  assertEquals(r.map((p) => p.tipo), ["parada", "repostaje", "parada"]);
});

Deno.test("enlace de Google Maps con paradas", () => {
  const { url, recortado } = enlaceGoogleMaps(O, [{ lat: 41, lon: -2.5, tipo: "repostaje" }], D);
  const q = new URL(url).searchParams;
  assertEquals(new URL(url).origin + new URL(url).pathname, "https://www.google.com/maps/dir/");
  assertEquals(q.get("api"), "1");
  assertEquals(q.get("origin"), "40.41680,-3.70380");
  assertEquals(q.get("destination"), "41.65670,-0.87920");
  assertEquals(q.get("waypoints"), "41.00000,-2.50000");
  assertEquals(q.get("travelmode"), "driving");
  assertEquals(recortado, false);
});

Deno.test("más de 3 intermedios: se quita el repostaje y se avisa", () => {
  const inter = [
    { lat: 40.6, lon: -3.1, tipo: "parada" }, { lat: 41.0, lon: -2.5, tipo: "repostaje" },
    { lat: 41.2, lon: -2.0, tipo: "parada" }, { lat: 41.4, lon: -1.6, tipo: "parada" },
  ];
  const { url, recortado } = enlaceGoogleMaps(O, inter, D);
  assert(recortado);
  assertEquals(new URL(url).searchParams.get("waypoints").split("|").length, 3);
  assert(!new URL(url).searchParams.get("waypoints").includes("41.00000,-2.50000"));
});

Deno.test("Waze: un solo destino con navigate=yes", () => {
  assertEquals(enlaceWaze(D), "https://waze.com/ul?ll=41.65670%2C-0.87920&navigate=yes");
});

Deno.test("calculadora de desvío con los datos del usuario", () => {
  const r = compararDesvio({
    litros: "300", consumoL100: "32",
    barata: { precio: 1.659, desvio_km: 6 },
    cercana: { precio: 1.699, desvio_km: 0.4 },
  });
  assertAlmostEquals(r.barata.litros_desvio, 1.92, 1e-9);
  assertAlmostEquals(r.barata.total, 300 * 1.659 + 1.92 * 1.659, 1e-9);
  assertAlmostEquals(r.cercana.total, 300 * 1.699 + 0.128 * 1.699, 1e-9);
  assertAlmostEquals(r.diferencia, r.cercana.total - r.barata.total, 1e-9);
  assertEquals(r.supuestos, { litros: 300, consumoL100: 32 });
});

Deno.test("calculadora: acepta coma decimal y rechaza datos vacíos", () => {
  assertEquals(compararDesvio({ litros: "50,5", consumoL100: "8,2", barata: { precio: 1.6, desvio_km: 1 }, cercana: { precio: 1.7, desvio_km: 0 } }).supuestos.litros, 50.5);
  assert(compararDesvio({ litros: "", consumoL100: "30", barata: {}, cercana: {} }).error);
  assert(compararDesvio({ litros: "100", consumoL100: "30", barata: { precio: 1.6, desvio_km: null }, cercana: { precio: 1.7, desvio_km: 0 } }).error);
});

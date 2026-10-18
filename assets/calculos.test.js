import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  ahorroRepostaje, compararDesvio, consumoReal, costePorKm, costeViaje, deposito, enlaceGoogleMaps, enlaceWaze,
  leerNumero, puntosIntermedios, redondear,
} from "./calculos.js";

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

// ---- Calculadoras -----------------------------------------------------------

Deno.test("leerNumero: coma decimal, espacios y vacío", () => {
  assertEquals(leerNumero("1,459"), 1.459);
  assertEquals(leerNumero(" 300 "), 300);
  assert(Number.isNaN(leerNumero("")));
  assert(Number.isNaN(leerNumero(null)));
  assert(Number.isNaN(leerNumero("abc")));
});

Deno.test("redondear: sin error de coma flotante", () => {
  assertEquals(redondear(1.005, 2), 1.01);
  assertEquals(redondear(0.1 + 0.2, 2), 0.3);
  assertEquals(redondear(2.5, 0), 3);
  assertEquals(redondear(-1.005, 2), -1.01);
  assertEquals(redondear(0.0455, 3), 0.046);
});

Deno.test("ahorro por repostaje sin desvío", () => {
  const r = ahorroRepostaje({ litros: "100", precioHabitual: "1,5", precioZona: 1.4, kmDesvio: "" });
  assertEquals(r.coste_habitual, 150);
  assertEquals(r.coste_zona, 140);
  assertEquals(r.coste_desvio, 0);
  assertEquals(r.diferencia, 10);
  assertEquals(r.compensa, true);
});

Deno.test("ahorro por repostaje: el desvío se resta y puede dejar de compensar", () => {
  const r = ahorroRepostaje({ litros: "50", precioHabitual: "1.50", precioZona: 1.48, kmDesvio: "10", consumoL100: "30" });
  assertEquals(r.litros_desvio, 3);
  assertEquals(r.coste_desvio, 4.44);
  assertEquals(r.diferencia, redondear(75 - 74 - 4.44));
  assertEquals(r.compensa, false);
  // Empate exacto: no compensa.
  assertEquals(ahorroRepostaje({ litros: "10", precioHabitual: "1.4", precioZona: 1.4 }).compensa, false);
});

Deno.test("ahorro por repostaje: campos vacíos o sin zona dan error", () => {
  assert(ahorroRepostaje({ litros: "", precioHabitual: "1.5", precioZona: 1.4 }).error);
  assert(ahorroRepostaje({ litros: "50", precioHabitual: "", precioZona: 1.4 }).error);
  assert(ahorroRepostaje({ litros: "50", precioHabitual: "1.5", precioZona: null }).error);
  assert(ahorroRepostaje({ litros: "50", precioHabitual: "1.5", precioZona: 1.4, kmDesvio: "5", consumoL100: "" }).error);
  assert(ahorroRepostaje({ litros: "50", precioHabitual: "1.5", precioZona: 1.4, kmDesvio: "-2" }).error);
  // Desvío de 0 km no exige consumo.
  assertEquals(ahorroRepostaje({ litros: "50", precioHabitual: "1.5", precioZona: 1.4, kmDesvio: "0" }).coste_desvio, 0);
});

Deno.test("coste del viaje", () => {
  const r = costeViaje({ km: "353", consumoL100: "31,5", precio: "1,459" });
  assertEquals(r.litros, 111.2);
  assertEquals(r.coste, redondear(111.195 * 1.459));
  assert(costeViaje({ km: "", consumoL100: "30", precio: "1.4" }).error);
  assert(costeViaje({ km: "100", consumoL100: "0", precio: "1.4" }).error);
});

Deno.test("consumo real y división por cero", () => {
  assertEquals(consumoReal({ litros: "95", km: "310" }).consumoL100, 30.65);
  assert(consumoReal({ litros: "95", km: "0" }).error);
  assert(consumoReal({ litros: "", km: "310" }).error);
  assert(consumoReal({ litros: "0", km: "310" }).error);
});

Deno.test("coste por km y proyección", () => {
  const r = costePorKm({ consumoL100: "30", precio: "1.5", kmMes: "8000" });
  assertEquals(r.coste_km, 0.45);
  assertEquals(r.mensual, 3600);
  assertEquals(r.anual, 43200);
  assertEquals(costePorKm({ consumoL100: "7,3", precio: "1,623", kmMes: "1" }).coste_km, 0.118);
  assert(costePorKm({ consumoL100: "30", precio: "1.5", kmMes: "" }).error);
});

Deno.test("depósito en %: 0 %, 100 % y nivel intermedio", () => {
  const cero = deposito({ capacidad: "400", nivel: "0", unidad: "pct", precio: "1.5", consumoL100: "30" });
  assertEquals(cero.litros_para_llenar, 400);
  assertEquals(cero.coste_llenar, 600);
  assertEquals(cero.autonomia_km, 0);
  const lleno = deposito({ capacidad: "400", nivel: "100", unidad: "pct", precio: "1.5", consumoL100: "30" });
  assertEquals(lleno.litros_para_llenar, 0);
  assertEquals(lleno.coste_llenar, 0);
  assertEquals(lleno.autonomia_km, 1333);
  const r = deposito({ capacidad: "400", nivel: "25", unidad: "pct", precio: "1.5", consumoL100: "30", objetivo: "75" });
  assertEquals(r.litros_actuales, 100);
  assertEquals(r.litros_hasta_objetivo, 200);
  assertEquals(r.coste_hasta_objetivo, 300);
});

Deno.test("depósito en litros y opcionales vacíos", () => {
  const r = deposito({ capacidad: "60", nivel: "12,5", unidad: "litros" });
  assertEquals(r.litros_para_llenar, 47.5);
  assertEquals(r.coste_llenar, null);
  assertEquals(r.autonomia_km, null);
  assertEquals(r.litros_hasta_objetivo, null);
  assertEquals(deposito({ capacidad: "60", nivel: "12", unidad: "litros", objetivo: "40" }).coste_hasta_objetivo, null);
});

Deno.test("depósito: nivel mayor que la capacidad, negativo o vacío", () => {
  assert(deposito({ capacidad: "60", nivel: "61", unidad: "litros" }).error);
  assert(deposito({ capacidad: "60", nivel: "101", unidad: "pct" }).error);
  assert(deposito({ capacidad: "60", nivel: "-1", unidad: "pct" }).error);
  assert(deposito({ capacidad: "60", nivel: "", unidad: "pct" }).error);
  assert(deposito({ capacidad: "", nivel: "50", unidad: "pct" }).error);
  assert(deposito({ capacidad: "0", nivel: "0", unidad: "pct" }).error);
  assert(deposito({ capacidad: "60", nivel: "50", unidad: "pct", objetivo: "120" }).error);
  assert(deposito({ capacidad: "60", nivel: "50", unidad: "pct", objetivo: "40" }).error);
  assert(deposito({ capacidad: "60", nivel: "50", unidad: "pct", consumoL100: "0" }).error);
});

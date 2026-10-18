import { assertEquals } from "jsr:@std/assert@1.0.13";
import { direccionCompleta, filasPrecios, porUnidad, unidad } from "./ficha.js";

const F = "2026-10-17T21:12:57+00:00";

Deno.test("tabla de precios: orden fijo, elegido marcado, solo precios verificados", () => {
  const filas = filasPrecios([
    { combustible: "adblue", precio: 1.2, fecha_captura: F },
    { combustible: "gasoleo_a", precio: 1.779, fecha_captura: F },
    { combustible: "gnc", precio: 1.3, fecha_captura: F }, // €/kg confirmado: dentro
    { combustible: "hidrogeno", precio: 25, fecha_captura: F }, // dos estaciones muy dispares: fuera
    { combustible: "gasoleo_b", precio: 1.1, fecha_captura: F }, // agrícola: fuera
    { combustible: "gasolina_95_e5", precio: 0, fecha_captura: F }, // sin precio: fuera
    { combustible: "gasolina_98_e5", precio: 1.9, fecha_captura: null }, // sin fecha: fuera
    { combustible: "gasoleo_a", precio: 9, fecha_captura: F }, // duplicado: fuera
    null,
  ], "adblue");
  assertEquals(filas.map((f) => [f.combustible, f.precio, f.elegido]), [["gasoleo_a", 1.779, false], ["gnc", 1.3, false], ["adblue", 1.2, true]]);
  assertEquals(filas[2].nombre, "AdBlue");
});

Deno.test("tabla de precios: datos ausentes o corruptos", () => {
  assertEquals(filasPrecios(null, "gasoleo_a"), []);
  assertEquals(filasPrecios("x", "gasoleo_a"), []);
  assertEquals(filasPrecios([{ combustible: "gasoleo_a", precio: "1,7", fecha_captura: F }]), []);
  assertEquals(filasPrecios([{ combustible: "gasoleo_a", precio: "1.7", fecha_captura: "no-fecha" }]), []);
});

Deno.test("dirección completa con C.P., localidad, municipio y provincia", () => {
  assertEquals(direccionCompleta({ direccion: "CARRETERA MADRID TOLEDO KM. 12", cp: "28901", localidad: "GETAFE", municipio: "Getafe", provincia: "MADRID" }),
    "Carretera Madrid Toledo Km. 12, 28901 Getafe · Madrid");
  assertEquals(direccionCompleta({ direccion: "CALLE MAYOR, 1", cp: "28340", localidad: "EL ESPARTAL", municipio: "Valdemoro", provincia: "MADRID" }),
    "Calle Mayor, 1, 28340 El Espartal · Valdemoro (Madrid)");
  assertEquals(direccionCompleta({ direccion: "CALLE X", municipio: "Getafe" }), "Calle X · Getafe");
});

Deno.test("unidades: gases en kg y el resto en litros", () => {
  for (const g of ["gnc", "gnl", "biogas_comprimido", "biogas_licuado"]) assertEquals([unidad(g), porUnidad(g)], ["kg", "por kg"]);
  for (const l of ["gasoleo_a", "glp", "adblue", undefined]) assertEquals([unidad(l), porUnidad(l)], ["l", "por litro"]);
});

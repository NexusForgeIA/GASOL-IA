import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  anadirFavorita, borrarMisDatos, CLAVE_FAVORITAS, CLAVE_PREFERENCIAS, esFavorita, guardarPreferencias, leerFavoritas,
  leerPreferencias, MAX_FAVORITAS, quitarFavorita, sincronizarFavoritas,
} from "./favoritas.js";

/** Almacén en memoria con la misma interfaz que el envoltorio de localStorage. */
function memoria(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => (m.set(k, v), true), del: (k) => (m.delete(k), true) };
}
const E = { ideess: "4375", rotulo: "BALLENOIL", direccion: "CALLE X, 1", municipio: "Getafe", provincia: "MADRID", lat: 40.3, lon: -3.7, precio: 1.759 };

Deno.test("guardar: solo ID y datos de la estación, nunca coordenadas ni precio", () => {
  const s = memoria();
  assert(anadirFavorita(E, s).ok);
  assertEquals(JSON.parse(s.get(CLAVE_FAVORITAS)), [{ ideess: "4375", rotulo: "BALLENOIL", direccion: "CALLE X, 1", municipio: "Getafe", provincia: "MADRID" }]);
  assert(esFavorita("4375", s));
  assert(!s.get(CLAVE_FAVORITAS).includes("lat"));
});

Deno.test("duplicados: añadir dos veces no duplica y la lectura descarta repetidos", () => {
  const s = memoria();
  anadirFavorita(E, s); anadirFavorita({ ...E, rotulo: "OTRO" }, s);
  assertEquals(leerFavoritas(s).length, 1);
  const s2 = memoria({ [CLAVE_FAVORITAS]: JSON.stringify([E, E, { ...E, ideess: "5" }]) });
  assertEquals(leerFavoritas(s2).map((e) => e.ideess), ["4375", "5"]);
});

Deno.test("quitar y borrar mis datos", () => {
  const s = memoria();
  anadirFavorita(E, s); anadirFavorita({ ...E, ideess: "5" }, s);
  quitarFavorita("4375", s);
  assertEquals(leerFavoritas(s).map((e) => e.ideess), ["5"]);
  guardarPreferencias({ combustible: "adblue", radio: "25" }, s);
  assert(borrarMisDatos(s));
  assertEquals(s.get(CLAVE_FAVORITAS), null);
  assertEquals(s.get(CLAVE_PREFERENCIAS), null);
  assertEquals(leerFavoritas(s), []);
  assertEquals(leerPreferencias(s), {});
});

Deno.test("datos corruptos en localStorage: no rompen y se ignoran", () => {
  for (const malo of ["{no json", "null", "42", '"texto"', '{"a":1}', "[null, 3, \"x\", {}]", '[{"ideess":"12; DROP"}]', '[{"ideess":7}]']) {
    assertEquals(leerFavoritas(memoria({ [CLAVE_FAVORITAS]: malo })), [], malo);
    assertEquals(leerPreferencias(memoria({ [CLAVE_PREFERENCIAS]: malo })), {}, malo);
  }
  // Mezcla de válidas y corruptas: se quedan las válidas.
  const s = memoria({ [CLAVE_FAVORITAS]: JSON.stringify([null, { ideess: "9", rotulo: 5 }, "x"]) });
  assertEquals(leerFavoritas(s), [{ ideess: "9", rotulo: "", direccion: "", municipio: "", provincia: "" }]);
  // Se puede seguir guardando encima de datos corruptos.
  const c = memoria({ [CLAVE_FAVORITAS]: "{roto" });
  assert(anadirFavorita(E, c).ok);
  assertEquals(leerFavoritas(c).length, 1);
});

Deno.test("preferencias: solo valores admitidos", () => {
  const s = memoria();
  guardarPreferencias({ combustible: "gasoleo_a", radio: 25, corredor: "5", otra: "x" }, s);
  assertEquals(leerPreferencias(s), { combustible: "gasoleo_a", radio: "25", corredor: "5" });
  guardarPreferencias({ combustible: "queroseno", radio: "7" }, s);
  assertEquals(leerPreferencias(s), {});
});

Deno.test("límite de favoritas y estación no válida", () => {
  const s = memoria();
  for (let i = 1; i <= MAX_FAVORITAS; i++) assert(anadirFavorita({ ...E, ideess: String(i) }, s).ok);
  assert(anadirFavorita({ ...E, ideess: "999" }, s).error);
  assert(anadirFavorita({ ideess: "abc" }, memoria()).error);
  assert(anadirFavorita(null, memoria()).error);
});

Deno.test("almacenamiento bloqueado: se informa sin lanzar", () => {
  const lleno = { get: () => null, set: () => false, del: () => false };
  assert(anadirFavorita(E, lleno).error);
  assertEquals(leerFavoritas(lleno), []);
});

Deno.test("sincronización: desactivada no llama al servidor; activa une sin duplicar", async () => {
  const s = memoria();
  anadirFavorita(E, s);
  let llamadas = 0;
  assertEquals(await sincronizarFavoritas(() => { llamadas++; return []; }, s), null);
  assertEquals(llamadas, 0);
  const r = await sincronizarFavoritas(async () => [{ ...E }, { ...E, ideess: "77" }], s, true);
  assertEquals(r.map((e) => e.ideess), ["4375", "77"]);
  assertEquals(leerFavoritas(s).length, 2);
});

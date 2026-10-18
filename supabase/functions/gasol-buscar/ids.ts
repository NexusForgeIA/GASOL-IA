// Validación de la lista de IDs de favoritas (sin acceso a red ni entorno: se prueba con Deno).
export const MAX_IDS = 50;
/** "4375,5122" → ["4375","5122"]; null si hay alguno no numérico, ninguno o más de MAX_IDS. */
export function idsValidos(texto: string): string[] | null {
  const ids = [...new Set(texto.split(",").map((t) => t.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_IDS || !ids.every((i) => /^\d{1,8}$/.test(i))) return null;
  return ids;
}

/**
 * Productos de la ficha, en este orden. Solo los de unidad confirmada (€/l). Fuera: Gasóleo B
 * (agrícola) y GNC, GNL, biogás e hidrógeno hasta confirmar sus unidades (docs/FUENTE-DATOS.md).
 */
export const FICHA_COMBUSTIBLES = [
  "gasoleo_a",
  "gasoleo_premium",
  "diesel_renovable",
  "gasolina_95_e5",
  "gasolina_95_e5_premium",
  "gasolina_98_e5",
  "glp",
  "adblue",
];

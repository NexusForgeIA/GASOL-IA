// Validación de la lista de IDs de favoritas (sin acceso a red ni entorno: se prueba con Deno).
export const MAX_IDS = 50;
/** "4375,5122" → ["4375","5122"]; null si hay alguno no numérico, ninguno o más de MAX_IDS. */
export function idsValidos(texto: string): string[] | null {
  const ids = [...new Set(texto.split(",").map((t) => t.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_IDS || !ids.every((i) => /^\d{1,8}$/.test(i))) return null;
  return ids;
}

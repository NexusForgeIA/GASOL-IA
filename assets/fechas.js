// Fechas de calendario (AAAA-MM-DD) en hora peninsular. Sin horas: un día es un día, aunque
// cambie la hora de verano. Módulo ES puro: lo usan gastos y vencimientos y lo prueba Deno.

const enMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });

/** Día de hoy en Madrid como "AAAA-MM-DD" (en-CA da ese formato). */
export const hoyMadrid = (ahora = new Date()) => enMadrid.format(ahora);

/** "AAAA-MM-DD" que existe de verdad en el calendario (no 2026-02-30). */
export function esFechaISO(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Días de calendario de a a b (b - a); negativo si b es anterior. */
export function diasEntre(a, b) {
  const t = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

/** Suma días a una fecha "AAAA-MM-DD". */
export function sumarDias(s, n) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const fmt = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const fmtMes = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", month: "long", year: "numeric" });
/** "2026-10-18" → "18/10/2026". */
export const fechaCorta = (s) => { const [y, m, d] = s.split("-").map(Number); return fmt.format(new Date(Date.UTC(y, m - 1, d))); };
/** "2026-10" → "octubre de 2026". */
export const nombreMes = (s) => { const [y, m] = s.split("-").map(Number); return fmtMes.format(new Date(Date.UTC(y, m - 1, 1))); };

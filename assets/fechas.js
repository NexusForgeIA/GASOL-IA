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

const horaEnMadrid = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Hora de ahora en Madrid como "HH:MM". */
export const horaMadrid = (ahora = new Date()) => horaEnMadrid.format(ahora);

/** Días que tiene un mes "AAAA-MM" (28 a 31). */
export const diasDelMes = (mes) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/** Suma meses a "AAAA-MM": ("2026-12", 1) → "2027-01". */
export function sumarMeses(mes, n) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const fmtDia = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric" });
/** "2026-10-18" → "dom 18". */
export const diaSemana = (s) => { const [y, m, d] = s.split("-").map(Number); return fmtDia.format(new Date(Date.UTC(y, m - 1, d))).replace(/[.,]/g, ""); };

/**
 * Semanas de un mes "AAAA-MM", de lunes a domingo: cada semana son 7 casillas con la fecha
 * "AAAA-MM-DD" o null (huecos antes del día 1 y después del último). Solo calendario, sin horas.
 */
export function cuadriculaMes(mes) {
  const [y, m] = mes.split("-").map(Number);
  const hueco = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const casillas = [...Array(hueco).fill(null), ...Array.from({ length: diasDelMes(mes) }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  while (casillas.length % 7) casillas.push(null);
  return Array.from({ length: casillas.length / 7 }, (_, i) => casillas.slice(i * 7, i * 7 + 7));
}

const fmtLargo = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
/** "2026-10-14" → "miércoles 14 de octubre". */
export const fechaLarga = (s) => { const [y, m, d] = s.split("-").map(Number); return fmtLargo.format(new Date(Date.UTC(y, m - 1, d))).replace(",", ""); };

// Única URL de backend del cliente. No contiene claves: las Edge Functions son públicas
// y las que manejan datos de usuario exigen su sesión.
export const API = "https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1";

// Cuentas, rutas en servidor y avisos push (VAPID). Desactivado en la demo pública:
// las rutas se guardan solo en este navegador. Se activa con el proyecto Supabase propio
// (y GASOL_CUENTAS=1 en gasol-ruta).
export const CUENTAS = false;

/** Enseña los enlaces y bloques marcados con data-cuentas si la bandera está activa. */
export function mostrarCuentas() {
  if (CUENTAS) document.querySelectorAll("[data-cuentas]").forEach((n) => { n.hidden = false; });
}

// Cálculos de ruta por dispositivo y día, y pausa mínima entre pulsaciones. Son una cortesía con el
// servidor de rutas (la protección real son los topes de gasol-ruta/limites.ts), no cifras de
// rendimiento. Decisión 109.
export const LIMITE_RUTAS_DISPOSITIVO_DIA = 20;
export const PAUSA_RUTAS_MS = 5000;

// Contacto para opiniones de la beta: solo correo (sin WhatsApp). Mismo titular que whitemoon.es.
export const CORREO_CONTACTO = "comercial@whitemoon.es";
export const ASUNTO_OPINION = "Opinión Gasol-IA beta";
// Nota de beta: la portada la lleva escrita en el HTML (sin JS); un test comprueba que es la misma.
export const AVISO_BETA = "Versión beta gratuita en pruebas. Puede haber errores. Los precios son los oficiales del Ministerio en la fecha de captura indicada.";
export const enlaceOpinion = () => `mailto:${CORREO_CONTACTO}?subject=${encodeURIComponent(ASUNTO_OPINION)}`;

// Los enlaces «Enviar opinión» del HTML ya llevan el mailto; aquí se rehacen desde la constante
// para que haya una sola fuente. Sin DOM (Deno, tests) no hace nada.
if (typeof document !== "undefined") {
  document.querySelectorAll("a[data-opinion]").forEach((a) => { a.href = enlaceOpinion(); });
}

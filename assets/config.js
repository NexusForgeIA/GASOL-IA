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

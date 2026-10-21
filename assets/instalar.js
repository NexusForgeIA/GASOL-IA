// Guía de instalación. Sin JS se ven los dos bloques (Android e iPhone); con JS se pone primero el
// del sistema del móvil y, si la app ya se abre desde su icono, se cambia la guía por un aviso.
import "./nav.js";
import { mostrarCuentas } from "./config.js";
import { contarInstalacion } from "./visita.js";

mostrarCuentas();

const $ = (id) => document.getElementById(id);

/** iPhone, iPad o iPod (los iPad recientes se presentan como Mac con pantalla táctil). */
const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (esIOS) $("pasos").prepend($("ios"));

const instalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (instalada) {
  $("pasos").hidden = true;
  $("ya-instalada").hidden = false;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// Boton "Instalar" (solo si el navegador lo permite: Chrome y Edge en Android y ordenador). En iPhone no
// existe; ahi se siguen los pasos de la guia. Se cuenta el clic (recuento anonimo) y el navegador pregunta.
let oferta = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  oferta = e;
  const caja = $("instalar-directo");
  if (caja && !instalada) caja.hidden = false;
});
$("boton-instalar")?.addEventListener("click", async () => {
  if (!oferta) return;
  contarInstalacion("instalar-clic");
  const o = oferta;
  oferta = null;
  $("instalar-directo").hidden = true;
  try { await o.prompt(); } catch (err) { console.warn("Instalar:", err.message); }
});

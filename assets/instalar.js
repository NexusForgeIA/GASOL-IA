// Guía de instalación. Sin JS se ven los dos bloques (Android e iPhone); con JS se pone primero el
// del sistema del móvil y, si la app ya se abre desde su icono, se cambia la guía por un aviso.
import "./nav.js";
import { mostrarCuentas } from "./config.js";

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

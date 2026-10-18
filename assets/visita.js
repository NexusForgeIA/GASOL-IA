// Contador de aperturas (decisión 113): en cada carga avisa a gasol-visita de qué página se abre y
// si es desde la app instalada o desde el navegador. Se cuentan aperturas, no personas: no se envía
// ni se guarda nada que identifique el dispositivo (ni localStorage, ni cookies). Sin esperar
// respuesta; si falla, solo un aviso en la consola.
import { API } from "./config.js";

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/;

/** "ruta.html" → "ruta"; la raíz o index.html → "portada". El servidor valida la lista cerrada. */
export function paginaDe(pathname) {
  const f = pathname.split("/").pop() || "index.html";
  return f === "index.html" ? "portada" : f.replace(/\.html$/, "");
}

function enviar() {
  const modo = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true ? "instalada" : "navegador";
  const cuerpo = JSON.stringify({ pagina: paginaDe(location.pathname), modo });
  const url = `${API}/gasol-visita`;
  try {
    // text/plain: petición simple, sin preflight.
    if (navigator.sendBeacon?.(url, new Blob([cuerpo], { type: "text/plain;charset=UTF-8" }))) return;
    fetch(url, { method: "POST", body: cuerpo, keepalive: true, credentials: "omit" }).catch((e) => console.warn("Contador de aperturas:", e.message));
  } catch (e) {
    console.warn("Contador de aperturas:", e.message);
  }
}

if (typeof document !== "undefined" && !LOCAL.test(location.hostname)) {
  if (document.prerendering) {
    // Página precargada: solo cuenta si de verdad se abre.
    document.addEventListener("prerenderingchange", enviar, { once: true });
  } else if (document.visibilityState !== "visible") {
    // Abierta en una pestaña en segundo plano: cuenta cuando se mira por primera vez.
    const alVer = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", alVer); enviar(); } };
    document.addEventListener("visibilitychange", alVer);
  } else {
    enviar();
  }
}

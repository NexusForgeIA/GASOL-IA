// Contador de aperturas (decisión 113): en cada carga avisa a gasol-visita de qué página se abre y
// si es desde la app instalada o desde el navegador. Se cuentan aperturas, no personas: no se envía
// ni se guarda nada que identifique el dispositivo (ni cookies; solo una marca local «ya contado» para contar una vez cada móvil instalado, que no se envía). Sin esperar
// respuesta; si falla, solo un aviso en la consola.
import { API } from "./config.js";

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/;

/** "ruta.html" → "ruta"; la raíz o index.html → "portada". El servidor valida la lista cerrada. */
export function paginaDe(pathname) {
  const f = pathname.split("/").pop() || "index.html";
  return f === "index.html" ? "portada" : f.replace(/\.html$/, "");
}

const MARCA = "gasol.instalada-contada";

/** true solo la primera vez en este dispositivo. La marca se queda en el móvil: no se envía ni identifica a nadie. */
function esPrimeraVez() {
  try {
    if (localStorage.getItem(MARCA)) return false;
    localStorage.setItem(MARCA, "1");
    return true;
  } catch {
    return false;
  }
}

function enviar(pagina = paginaDe(location.pathname), modoFijo) {
  const modo = modoFijo || (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true ? "instalada" : "navegador");
  // Primera vez que este móvil abre la app desde su icono (también en iPhone, donde Safari no avisa de la instalación).
  if (!modoFijo && modo === "instalada" && esPrimeraVez()) enviar("primera-instalada", "instalada");
  const cuerpo = JSON.stringify({ pagina, modo });
  const url = `${API}/gasol-visita`;
  try {
    // text/plain: petición simple, sin preflight.
    if (navigator.sendBeacon?.(url, new Blob([cuerpo], { type: "text/plain;charset=UTF-8" }))) return;
    fetch(url, { method: "POST", body: cuerpo, keepalive: true, credentials: "omit" }).catch((e) => console.warn("Contador de aperturas:", e.message));
  } catch (e) {
    console.warn("Contador de aperturas:", e.message);
  }
}

/** Cuenta un hecho de la instalación ("instalar-clic" o "instalacion"). Anónimo, igual que las aperturas. */
export function contarInstalacion(pagina) {
  if (typeof document !== "undefined" && !LOCAL.test(location.hostname)) enviar(pagina, "navegador");
}

if (typeof document !== "undefined" && !LOCAL.test(location.hostname)) {
  // Chrome y Edge (Android y ordenador) avisan cuando la app queda instalada. Safari en iPhone no avisa.
  window.addEventListener("appinstalled", () => enviar("instalacion", "navegador"));
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

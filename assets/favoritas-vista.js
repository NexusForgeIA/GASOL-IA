// Gasol-IA · página de favoritas y preferencias. Los datos viven en este navegador
// (favoritas.js); al servidor solo se piden los precios por ID de estación.
import "./nav.js";
import { API, mostrarCuentas } from "./config.js";
import { ficha, precargarFichas } from "./ficha.js";
import { borrarMisDatos, guardarPreferencias, leerFavoritas, leerPreferencias } from "./favoritas.js";

mostrarCuentas();

const $ = (id) => document.getElementById(id);
const estado = $("estado");
const lista = $("lista");
const selComb = $("f-combustible");
const formPref = $("f-pref");
const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const avisar = (t, error = false) => { estado.textContent = t; estado.classList.toggle("error", error); };

// ---- Lista -----------------------------------------------------------------------
async function pintarFavoritas() {
  const favs = leerFavoritas();
  lista.replaceChildren();
  $("atribucion").hidden = true;
  $("vacio").hidden = true;
  if (!favs.length) {
    avisar("Aún no tienes favoritas. Márcalas con «Favorita» en el comparador o en la ruta.");
    $("vacio").hidden = false;
    return;
  }
  avisar("Consultando el último precio…");
  const q = new URLSearchParams({ combustible: selComb.value, ids: favs.map((f) => f.ideess).join(",") });
  let filas = [];
  let error = false;
  try {
    const r = await fetch(`${API}/gasol-buscar?${q}`);
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error);
    filas = datos.resultados;
  } catch {
    error = true;
  }
  const porId = new Map(filas.map((f) => [f.ideess, f]));
  precargarFichas(favs.map((f) => f.ideess)); // una petición para todas las fichas
  const nombreComb = selComb.selectedOptions[0].textContent;
  favs.forEach((fav) => lista.append(tarjeta(fav, porId.get(fav.ideess), nombreComb, error)));

  const fechas = filas.filter((f) => f.fecha_captura).map((f) => f.fecha_captura).sort();
  if (error) {
    avisar("No se pudo consultar el precio ahora mismo. Tus favoritas siguen guardadas.", true);
  } else {
    avisar(`${favs.length} ${favs.length === 1 ? "favorita" : "favoritas"} · ${nombreComb}, último precio capturado.`);
  }
  if (fechas.length) {
    $("atribucion").textContent = `Origen de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico. Datos actualizados el ${fechaHora.format(new Date(fechas.at(-1)))} (hora peninsular).`;
    $("atribucion").hidden = false;
  }
}

function tarjeta(fav, f, nombreComb, error) {
  // Datos de la última captura si llegan; si no, lo guardado para poder reconocerla.
  const sinPrecio = error ? "Precio no disponible ahora mismo"
    : !f ? "No aparece en la última captura oficial"
      : f.precio == null ? `Sin precio de ${nombreComb} en la última captura` : null;
  const li = ficha({ ...fav, ...(f || {}) }, {
    combustible: selComb.value,
    sinPrecio,
    alQuitar: (on) => {
      if (on) return;
      li.remove();
      avisar("Quitada de tus favoritas.");
      estado.focus();
      if (!leerFavoritas().length) pintarFavoritas();
    },
  });
  return li;
}

// ---- Preferencias ------------------------------------------------------------------
function pintarPreferencias() {
  const p = leerPreferencias();
  formPref.combustible.value = p.combustible ?? "";
  formPref.radio.value = p.radio ?? "";
  formPref.corredor.value = p.corredor ?? "";
  selComb.value = p.combustible ?? "gasoleo_a";
}

formPref.addEventListener("submit", (e) => {
  e.preventDefault();
  const ok = guardarPreferencias(Object.fromEntries(new FormData(formPref)));
  $("estado-pref").textContent = ok ? "Preferencias guardadas en este navegador." : "Este navegador no permite guardar datos.";
});

// ---- Borrar mis datos (con confirmación en la página, sin diálogos del navegador) ----
const [bBorrar, bSi, bNo] = [$("borrar"), $("borrar-si"), $("borrar-no")];
const confirmar = (on) => {
  bBorrar.hidden = on; bSi.hidden = !on; bNo.hidden = !on;
  $("estado-borrar").textContent = on ? "¿Seguro? Se borrarán tus favoritas y tus preferencias de este navegador." : "";
  (on ? bSi : bBorrar).focus();
};
bBorrar.addEventListener("click", () => confirmar(true));
bNo.addEventListener("click", () => confirmar(false));
bSi.addEventListener("click", () => {
  const ok = borrarMisDatos();
  confirmar(false);
  $("estado-borrar").textContent = ok ? "Hecho: favoritas y preferencias borradas." : "No se pudieron borrar: el navegador bloquea el almacenamiento.";
  pintarPreferencias();
  pintarFavoritas();
});

// ---- Arranque ----------------------------------------------------------------------
selComb.addEventListener("change", pintarFavoritas);
pintarPreferencias();
pintarFavoritas();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

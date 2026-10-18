// Gasol-IA · calculadoras. Todo se calcula en el navegador; solo se consulta al servidor
// el precio oficial de la zona, que se enseña siempre con su fecha de captura.
import "./nav.js";
import { API, mostrarCuentas } from "./config.js";
import { ahorroRepostaje, consumoReal, costePorKm, costeViaje, deposito, euros, leerNumero } from "./calculos.js";

mostrarCuentas();

const BUSCAR = `${API}/gasol-buscar`;
const CLAVE = "gasol.calculadoras";
const ATRIBUCION = "Origen de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico";

const $ = (id) => document.getElementById(id);
const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});
const num = (n, dec = 2) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: dec }).format(n);
const capitalizar = (s) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const h of hijos) if (h) n.append(h);
  return n;
}

// ---- Memoria local (solo comodidad: si falla, la página funciona igual) -----
function leerMemoria() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}
function guardarMemoria(cambio) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...leerMemoria(), ...cambio })); } catch { /* sin almacenamiento */ }
}

// ---- Precio de la zona -------------------------------------------------------
const fZona = $("f-zona");
const selProv = $("z-provincia");
const selMun = $("z-municipio");
const selComb = $("z-combustible");
const zonaRes = $("zona-resultado");
let territorios = [];
let zona = null; // { precio, rotulo, lugar, combustible, fecha }

function rellenarMunicipios(idProvincia, seleccionado = "") {
  selMun.replaceChildren(el("option", { value: "", text: "Todos los municipios" }));
  territorios.filter((t) => t.id_provincia === idProvincia)
    .sort((a, b) => a.municipio.localeCompare(b.municipio, "es"))
    .forEach((m) => selMun.append(el("option", { value: m.id_municipio, text: m.municipio })));
  selMun.disabled = !idProvincia;
  selMun.value = seleccionado;
}

async function cargarTerritorios() {
  const r = await fetch(`${BUSCAR}?listado=territorios`);
  if (!r.ok) throw new Error("territorios");
  territorios = (await r.json()).territorios;
  const provincias = new Map(territorios.map((t) => [t.id_provincia, t.provincia]));
  selProv.replaceChildren(el("option", { value: "", text: "Elige provincia" }));
  [...provincias].sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([id, nombre]) => selProv.append(el("option", { value: id, text: capitalizar(nombre) })));
}

const textoCaptura = (z) => `capturado el ${fechaHora.format(new Date(z.fecha))} (hora peninsular)`;
const lineaAtribucion = (z) => el("p", { class: "captura", text: `${ATRIBUCION}. Datos actualizados el ${fechaHora.format(new Date(z.fecha))} (hora peninsular).` });

async function consultarZona() {
  if (!selProv.value) { zonaRes.replaceChildren(el("p", { class: "error", text: "Elige una provincia." })); selProv.focus(); return; }
  const q = new URLSearchParams({ combustible: selComb.value, provincia: selProv.value });
  if (selMun.value) q.set("municipio", selMun.value);
  guardarMemoria({ zona: { provincia: selProv.value, municipio: selMun.value, combustible: selComb.value } });
  zonaRes.replaceChildren(el("p", { class: "nota", text: "Consultando…" }));
  const r = await fetch(`${BUSCAR}?${q}`);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || "No se pudo consultar ahora mismo.");
  const f = datos.resultados?.[0];
  const lugar = selMun.value ? selMun.selectedOptions[0].textContent : capitalizar(selProv.selectedOptions[0].textContent);
  const combustible = selComb.selectedOptions[0].textContent;
  if (!f) {
    zona = null;
    zonaRes.replaceChildren(el("p", { class: "nota", text: `No hay estaciones con ${combustible} en ${lugar}.` }));
  } else {
    zona = { precio: f.precio, rotulo: capitalizar(f.rotulo || "Sin rótulo"), municipio: f.municipio, lugar, combustible, fecha: f.fecha_captura };
    zonaRes.replaceChildren(
      el("p", {}, el("strong", { class: "cifra", text: `${euros(zona.precio, 3)} €/l` }),
        document.createTextNode(` · ${combustible}, precio más bajo en ${lugar} (${zona.rotulo}, ${zona.municipio}).`)),
      el("p", { class: "captura", text: `Precio ${textoCaptura(zona)}. Puede haber cambiado desde entonces.` }),
      lineaAtribucion(zona),
    );
  }
  pintarSugerencias();
}

function pintarSugerencias() {
  document.querySelectorAll("[data-precio-zona]").forEach((p) => {
    p.textContent = zona
      ? `Precio de la zona: ${euros(zona.precio, 3)} €/l (${zona.combustible}, ${zona.lugar}), ${textoCaptura(zona)}.`
      : "Precio de la zona: consulta una zona arriba.";
  });
  document.querySelectorAll("[data-sugerencia]").forEach((caja) => {
    caja.hidden = !zona;
    if (!zona) return caja.replaceChildren();
    const input = caja.closest("form").elements.precio;
    const boton = el("button", { type: "button", class: "boton-sec", text: "Usar este precio" });
    boton.addEventListener("click", () => {
      input.value = euros(zona.precio, 3);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    caja.replaceChildren(
      el("p", { class: "nota", text: `Sugerencia: ${euros(zona.precio, 3)} €/l, el más bajo de ${zona.lugar} (${zona.combustible}), ${textoCaptura(zona)}.` }),
      boton,
    );
  });
}

/** Si el precio que usa el cálculo es el de la zona, la vista lleva su fecha y la atribución. */
function notaPrecio(precio) {
  const p = leerNumero(precio);
  if (zona && Math.abs(p - zona.precio) < 1e-9) {
    return [el("p", { class: "captura", text: `Precio de ${zona.lugar}, ${textoCaptura(zona)}.` }), lineaAtribucion(zona)];
  }
  return [el("p", { class: "captura", text: "Precio por litro indicado por ti." })];
}

// ---- Resultados --------------------------------------------------------------
function filas(pares) {
  const dl = el("dl", { class: "cifras" });
  for (const [k, v] of pares) if (v != null) dl.append(el("dt", { text: k }), el("dd", { text: v }));
  return dl;
}

function pintar(form, r, construir) {
  const caja = form.nextElementSibling;
  if (r.error) {
    caja.replaceChildren(el("p", { class: "error", text: r.error }));
    return;
  }
  caja.replaceChildren(...construir(r), el("p", { class: "nota", text: "Calculado con tus datos." }));
}

const valores = (form) => Object.fromEntries(new FormData(form));

const CALCULOS = {
  "f-ahorro": (form) => {
    const v = valores(form);
    pintar(form, ahorroRepostaje({ ...v, precioZona: zona?.precio }), (r) => [
      el("p", { class: `veredicto ${r.compensa ? "si" : "no"}`, text: r.compensa
        ? `Con tus datos compensa: ${euros(r.diferencia)} € menos que en tu gasolinera habitual.`
        : `Con tus datos no compensa: ${euros(Math.abs(r.diferencia))} € ${r.diferencia === 0 ? "de diferencia" : "más que en tu gasolinera habitual"}.` }),
      filas([
        ["En tu gasolinera habitual", `${euros(r.coste_habitual)} €`],
        [`En ${zona.lugar}`, `${euros(r.coste_zona)} €`],
        ["Combustible del desvío", r.litros_desvio > 0 ? `${num(r.litros_desvio)} l · ${euros(r.coste_desvio)} €` : "Sin desvío"],
      ]),
      ...notaPrecio(zona.precio),
    ]);
  },
  "f-viaje": (form) => {
    const v = valores(form);
    pintar(form, costeViaje(v), (r) => [
      el("p", { class: "veredicto", text: `${euros(r.coste)} € de combustible` }),
      filas([["Litros", `${num(r.litros)} l`]]),
      ...notaPrecio(v.precio),
    ]);
  },
  "f-consumo": (form) => {
    pintar(form, consumoReal(valores(form)), (r) => [
      el("p", { class: "veredicto", text: `${num(r.consumoL100)} l/100 km` }),
    ]);
  },
  "f-km": (form) => {
    const v = valores(form);
    pintar(form, costePorKm(v), (r) => [
      el("p", { class: "veredicto", text: `${euros(r.coste_km, 3)} € por km` }),
      filas([["Al mes", `${euros(r.mensual)} €`], ["Al año (12 meses así)", `${euros(r.anual)} €`]]),
      ...notaPrecio(v.precio),
    ]);
  },
  "f-deposito": (form) => {
    const v = valores(form);
    pintar(form, deposito(v), (r) => [
      el("p", { class: "veredicto", text: `${num(r.litros_para_llenar)} l para llenarlo` }),
      filas([
        ["Llevas", `${num(r.litros_actuales)} l`],
        ["Coste de llenarlo", r.coste_llenar != null ? `${euros(r.coste_llenar)} €` : null],
        ["Autonomía con lo que llevas", r.autonomia_km != null ? `${num(r.autonomia_km, 0)} km` : null],
        ["Litros hasta el nivel elegido", r.litros_hasta_objetivo != null ? `${num(r.litros_hasta_objetivo)} l` : null],
        ["Coste hasta el nivel elegido", r.coste_hasta_objetivo != null ? `${euros(r.coste_hasta_objetivo)} €` : null],
      ]),
      ...(r.coste_llenar != null ? notaPrecio(v.precio) : []),
    ]);
  },
};

// ---- Arranque ----------------------------------------------------------------
const memoria = leerMemoria();
const campos = memoria.campos || {};

for (const [id, calcular] of Object.entries(CALCULOS)) {
  const form = $(id);
  for (const input of form.querySelectorAll("input")) {
    const k = `${id}.${input.name}`;
    if (input.type === "radio") input.checked = campos[k] ? campos[k] === input.value : input.checked;
    else if (campos[k] != null) input.value = campos[k];
  }
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.type === "radio" && !t.checked) return;
    campos[`${id}.${t.name}`] = t.value;
    guardarMemoria({ campos });
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); calcular(form); });
}

selProv.addEventListener("change", () => rellenarMunicipios(selProv.value));
fZona.addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = fZona.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    await consultarZona();
  } catch (err) {
    zonaRes.replaceChildren(el("p", { class: "error", text: err.message || "No se pudo consultar ahora mismo." }));
  } finally {
    boton.disabled = false;
  }
});

(async () => {
  try {
    await cargarTerritorios();
    const z = memoria.zona;
    if (z?.combustible) selComb.value = z.combustible;
    if (z?.provincia) {
      selProv.value = z.provincia;
      rellenarMunicipios(z.provincia, z.municipio || "");
      fZona.requestSubmit();
    }
  } catch {
    zonaRes.replaceChildren(el("p", { class: "error", text: "No se pudieron cargar las provincias. Las calculadoras funcionan igual con tu precio." }));
  }
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

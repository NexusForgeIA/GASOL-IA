// Gasol-IA · control de gastos. Sin cuenta ni servidor: los repostajes viven en este navegador.
import "./nav.js";
import { mostrarCuentas } from "./config.js";
import { euros } from "./calculos.js";
import { fechaCorta, hoyMadrid, nombreMes } from "./fechas.js";
import { leerPreferencias } from "./favoritas.js";
import {
  aCSV, anadirRegistro, borrarGastos, borrarRegistro, COMBUSTIBLES_GASTO, editarRegistro, etiquetas, leerRegistros,
  porDia, porEtiqueta, resumenMensual, totales,
} from "./gastos.js";

mostrarCuentas();

const $ = (id) => document.getElementById(id);
const form = $("f-gasto");
const selPeriodo = $("periodo");
const num = (n, dec = 2) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: dec }).format(n);
const kmFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
let editando = null; // id del registro que se edita
let ultimoBorrado = null;

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

function tabla(t, cabecera, filas) {
  t.replaceChildren(
    el("thead", {}, el("tr", {}, ...cabecera.map((c) => el("th", { scope: "col", text: c })))),
    el("tbody", {}, ...filas.map((f) => el("tr", {}, el("th", { scope: "row", text: f[0] }), ...f.slice(1).map((c) => (typeof c === "string" ? el("td", { text: c }) : el("td", {}, ...c)))))),
  );
}

// ---- Formulario ----------------------------------------------------------------------
function limpiarFormulario() {
  form.reset();
  form.fecha.value = hoyMadrid();
  form.fecha.max = hoyMadrid();
  const pref = leerPreferencias().combustible;
  if (pref && COMBUSTIBLES_GASTO[pref]) form.combustible.value = pref;
  editando = null;
  $("guardar").textContent = "Añadir repostaje";
  $("cancelar").hidden = true;
  $("t-form").textContent = "Añadir repostaje";
  form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(form));
  const r = editando ? editarRegistro(editando, datos) : anadirRegistro(datos);
  form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  if (r.error) {
    $("estado-form").textContent = r.error;
    $("estado-form").classList.add("error");
    if (r.campo && form[r.campo]) { form[r.campo].setAttribute("aria-invalid", "true"); form[r.campo].focus(); }
    return;
  }
  $("estado-form").classList.remove("error");
  $("estado-form").textContent = editando ? "Repostaje actualizado." : "Repostaje añadido.";
  limpiarFormulario();
  pintar();
});

$("cancelar").addEventListener("click", () => { limpiarFormulario(); $("estado-form").textContent = "Edición cancelada."; });

function editar(r) {
  editando = r.id;
  form.fecha.value = r.fecha;
  form.litros.value = String(r.litros).replace(".", ",");
  form.importe.value = String(r.importe).replace(".", ",");
  form.combustible.value = r.combustible;
  form.km.value = r.km ?? "";
  form.etiqueta.value = r.etiqueta;
  $("guardar").textContent = "Guardar cambios";
  $("cancelar").hidden = false;
  $("t-form").textContent = "Editar repostaje";
  $("t-form").scrollIntoView({ block: "start" });
  form.litros.focus();
}

// ---- Resumen y lista ---------------------------------------------------------------------
function pintar() {
  const todos = leerRegistros();
  $("etiquetas").replaceChildren(...etiquetas(todos).map((t) => el("option", { value: t })));

  // Periodos: todo + meses con datos (se conserva la elección si sigue existiendo).
  const meses = resumenMensual(todos).map((m) => m.mes);
  const antes = selPeriodo.value;
  selPeriodo.replaceChildren(el("option", { value: "", text: "Todo" }), ...meses.map((m) => el("option", { value: m, text: nombreMes(m) })));
  selPeriodo.value = meses.includes(antes) ? antes : "";

  const periodo = selPeriodo.value;
  const lista = periodo ? todos.filter((r) => r.fecha.startsWith(periodo)) : todos;
  $("vacio").hidden = todos.length > 0;
  $("resumen").hidden = lista.length === 0;

  if (lista.length) {
    const tot = totales(lista);
    const dias = porDia(lista);
    const kmTotal = porEtiqueta(lista).filter((g) => g.km).reduce((s, g) => s + g.km.km, 0);
    $("totales").replaceChildren(
      el("dt", { text: "Repostajes" }), el("dd", { text: String(tot.repostajes) }),
      el("dt", { text: "Litros" }), el("dd", { text: `${num(tot.litros)} l` }),
      el("dt", { text: "Gasto" }), el("dd", { text: `${euros(tot.importe)} €` }),
      el("dt", { text: "Precio medio pagado" }), el("dd", { text: `${euros(tot.precio_medio, 3)} €/l` }),
      el("dt", { text: "Gasto medio por día con repostaje" }), el("dd", { text: `${euros(tot.importe / dias.length)} €` }),
      kmTotal ? el("dt", { text: "Km medidos con el cuentakilómetros" }) : null, kmTotal ? el("dd", { text: `${kmFmt.format(kmTotal)} km` }) : null,
    );
    tabla($("t-etiquetas"), ["Turno o vehículo", "Nº", "Gasto", "€/km"],
      porEtiqueta(lista).map((g) => [g.etiqueta || "Sin indicar", String(g.repostajes), `${euros(g.importe)} €`,
        g.km ? [el("span", { class: "celda-linea", text: `${euros(g.km.coste_km, 3)} €` }), el("span", { class: "celda-linea nota", text: `${kmFmt.format(g.km.km)} km` })]
          : [el("span", { class: "nota", text: "Faltan lecturas" })]]));
    tabla($("t-dias"), ["Día", "Nº", "Litros", "Gasto"],
      dias.map((d) => [fechaCorta(d.fecha), String(d.repostajes), `${num(d.litros)} l`, `${euros(d.importe)} €`]));
    tabla($("t-meses"), ["Mes", "Nº", "Litros", "Gasto", "€/l"],
      resumenMensual(todos).map((m) => [nombreMes(m.mes), String(m.repostajes), `${num(m.litros)} l`, `${euros(m.importe)} €`, euros(m.precio_medio, 3)]));
  }

  $("lista").replaceChildren(...lista.map((r) => {
    const bEditar = el("button", { type: "button", class: "boton-sec", text: "Editar", "aria-label": `Editar repostaje del ${fechaCorta(r.fecha)}` });
    const bBorrar = el("button", { type: "button", class: "boton-peligro", text: "Borrar", "aria-label": `Borrar repostaje del ${fechaCorta(r.fecha)}` });
    bEditar.addEventListener("click", () => editar(r));
    bBorrar.addEventListener("click", () => {
      borrarRegistro(r.id);
      ultimoBorrado = r;
      if (editando === r.id) limpiarFormulario();
      pintar();
      const deshacer = el("button", { type: "button", class: "boton-sec", text: "Deshacer" });
      deshacer.addEventListener("click", () => {
        if (ultimoBorrado) anadirRegistro({ ...ultimoBorrado, litros: String(ultimoBorrado.litros), importe: String(ultimoBorrado.importe), km: ultimoBorrado.km ?? "" }, undefined, "9999-12-30");
        ultimoBorrado = null;
        $("estado-lista").textContent = "Repostaje recuperado.";
        pintar();
      });
      $("estado-lista").replaceChildren(document.createTextNode(`Borrado el repostaje del ${fechaCorta(r.fecha)}. `), deshacer);
    });
    return el("li", { class: "ruta-guardada" },
      el("strong", { text: `${fechaCorta(r.fecha)} · ${euros(r.importe)} €` }),
      document.createTextNode(` · ${num(r.litros)} l de ${COMBUSTIBLES_GASTO[r.combustible]} (${euros(r.importe / r.litros, 3)} €/l)`),
      r.km != null ? document.createTextNode(` · ${kmFmt.format(r.km)} km`) : null,
      r.etiqueta ? document.createTextNode(` · ${r.etiqueta}`) : null,
      el("div", { class: "botones" }, bEditar, bBorrar));
  }));
}

selPeriodo.addEventListener("change", pintar);

// ---- Exportar y borrar ----------------------------------------------------------------
$("exportar").addEventListener("click", () => {
  const todos = leerRegistros();
  if (!todos.length) { $("estado-datos").textContent = "No hay repostajes que exportar."; return; }
  const blob = new Blob(["﻿", aCSV(todos)], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `gasol-gastos-${hoyMadrid()}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $("estado-datos").textContent = `Exportados ${todos.length} repostajes.`;
});

const [bBorrar, bSi, bNo] = [$("borrar"), $("borrar-si"), $("borrar-no")];
const confirmar = (on) => {
  bBorrar.hidden = on; bSi.hidden = !on; bNo.hidden = !on;
  $("estado-datos").textContent = on ? "¿Seguro? Se borrarán todos tus repostajes de este navegador. Si los quieres conservar, expórtalos antes." : "";
  (on ? bSi : bBorrar).focus();
};
bBorrar.addEventListener("click", () => confirmar(true));
bNo.addEventListener("click", () => confirmar(false));
bSi.addEventListener("click", () => {
  const ok = borrarGastos();
  confirmar(false);
  limpiarFormulario();
  ultimoBorrado = null;
  $("estado-lista").textContent = "";
  $("estado-datos").textContent = ok ? "Hecho: repostajes borrados." : "No se pudieron borrar: el navegador bloquea el almacenamiento.";
  pintar();
});

limpiarFormulario();
pintar();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

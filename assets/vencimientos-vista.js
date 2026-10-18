// Gasol-IA · vencimientos. Sin cuenta ni servidor: viven en este navegador.
import { mostrarCuentas } from "./config.js";
import { fechaCorta, hoyMadrid } from "./fechas.js";
import {
  aCSV, anadirVencimiento, borrarVencimiento, borrarVencimientos, editarVencimiento, estado, leerVencimientos,
  nombreVencimiento, textoEstado,
} from "./vencimientos.js";

mostrarCuentas();

const $ = (id) => document.getElementById(id);
const form = $("f-venc");
let editando = null;
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

function limpiarFormulario() {
  form.reset();
  editando = null;
  $("guardar").textContent = "Añadir vencimiento";
  $("t-form").textContent = "Añadir vencimiento";
  $("cancelar").hidden = true;
  form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(form));
  const r = editando ? editarVencimiento(editando, datos) : anadirVencimiento(datos);
  form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  const aviso = $("estado-form");
  if (r.error) {
    aviso.textContent = r.error;
    aviso.classList.add("error");
    if (r.campo && form[r.campo]) { form[r.campo].setAttribute("aria-invalid", "true"); form[r.campo].focus(); }
    return;
  }
  aviso.classList.remove("error");
  aviso.textContent = editando ? "Vencimiento actualizado." : "Vencimiento añadido.";
  limpiarFormulario();
  pintar();
});
$("cancelar").addEventListener("click", () => { limpiarFormulario(); $("estado-form").textContent = "Edición cancelada."; });

function editar(v) {
  editando = v.id;
  form.tipo.value = v.tipo;
  form.fecha.value = v.fecha;
  form.nota.value = v.nota;
  form.vehiculo.value = v.vehiculo;
  form.antelacion.value = String(v.antelacion);
  $("guardar").textContent = "Guardar cambios";
  $("t-form").textContent = "Editar vencimiento";
  $("cancelar").hidden = false;
  $("t-form").scrollIntoView({ block: "start" });
  form.fecha.focus();
}

function pintar() {
  const hoy = hoyMadrid();
  const lista = leerVencimientos();
  const conEstado = lista.map((v) => ({ ...v, ...estado(v, hoy) }));
  const vencidos = conEstado.filter((v) => v.clase === "vencido").length;
  const proximos = conEstado.filter((v) => v.clase === "hoy" || v.clase === "proximo").length;
  $("estado-lista").textContent = !lista.length
    ? "Aún no tienes vencimientos. Añade el primero abajo."
    : [vencidos ? `${vencidos} vencido${vencidos > 1 ? "s" : ""}` : null, proximos ? `${proximos} próximo${proximos > 1 ? "s" : ""}` : null]
      .filter(Boolean).join(" · ") || "Todo al día con las fechas que has apuntado.";

  $("lista").replaceChildren(...conEstado.map((v) => {
    const bEditar = el("button", { type: "button", class: "boton-sec", text: "Editar", "aria-label": `Editar ${nombreVencimiento(v)}` });
    const bBorrar = el("button", { type: "button", class: "boton-peligro", text: "Borrar", "aria-label": `Borrar ${nombreVencimiento(v)}` });
    bEditar.addEventListener("click", () => editar(v));
    bBorrar.addEventListener("click", () => {
      borrarVencimiento(v.id);
      ultimoBorrado = v;
      if (editando === v.id) limpiarFormulario();
      pintar();
      const deshacer = el("button", { type: "button", class: "boton-sec", text: "Deshacer" });
      deshacer.addEventListener("click", () => {
        if (ultimoBorrado) anadirVencimiento(ultimoBorrado);
        ultimoBorrado = null;
        pintar();
        $("estado-form").textContent = "Vencimiento recuperado.";
      });
      $("estado-form").replaceChildren(document.createTextNode(`Borrado: ${nombreVencimiento(v)}. `), deshacer);
    });
    return el("li", { class: `vencimiento ${v.clase}` },
      el("span", { class: `etiqueta-estado ${v.clase}`, text: textoEstado(v) }),
      el("strong", { text: nombreVencimiento(v) }),
      document.createTextNode(` · ${fechaCorta(v.fecha)}${v.vehiculo ? ` · ${v.vehiculo}` : ""}`),
      el("span", { class: "nota", text: ` · aviso ${v.antelacion} días antes` }),
      el("div", { class: "botones" }, bEditar, bBorrar));
  }));
}

$("exportar").addEventListener("click", () => {
  const lista = leerVencimientos();
  if (!lista.length) { $("estado-datos").textContent = "No hay vencimientos que exportar."; return; }
  const a = el("a", { href: URL.createObjectURL(new Blob(["﻿", aCSV(lista)], { type: "text/csv;charset=utf-8" })), download: `gasol-vencimientos-${hoyMadrid()}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $("estado-datos").textContent = `Exportados ${lista.length} vencimientos.`;
});

const [bBorrar, bSi, bNo] = [$("borrar"), $("borrar-si"), $("borrar-no")];
const confirmar = (on) => {
  bBorrar.hidden = on; bSi.hidden = !on; bNo.hidden = !on;
  $("estado-datos").textContent = on ? "¿Seguro? Se borrarán todos tus vencimientos de este navegador." : "";
  (on ? bSi : bBorrar).focus();
};
bBorrar.addEventListener("click", () => confirmar(true));
bNo.addEventListener("click", () => confirmar(false));
bSi.addEventListener("click", () => {
  const ok = borrarVencimientos();
  confirmar(false);
  limpiarFormulario();
  ultimoBorrado = null;
  $("estado-datos").textContent = ok ? "Hecho: vencimientos borrados." : "No se pudieron borrar: el navegador bloquea el almacenamiento.";
  pintar();
});

limpiarFormulario();
pintar();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// Gasol-IA · facturación. Sin cuenta ni servidor: las carreras viven en este navegador.
import { mostrarCuentas } from "./config.js";
import { euros } from "./calculos.js";
import { diaSemana, fechaCorta, horaMadrid, hoyMadrid, nombreMes, sumarMeses } from "./fechas.js";
import { leerRegistros, porEtiqueta, totales } from "./gastos.js";
import {
  aCSV, anadirApp, anadirCarrera, borrarCarrera, borrarIngresos, CANALES, COLUMNAS, cruce, editarCarrera, leerApps, leerCarreras,
  METODOS, quitarApp, restaurarCarrera, tablaMensual,
} from "./ingresos.js";

mostrarCuentas();

const $ = (id) => document.getElementById(id);
const form = $("f-carrera");
// El formulario se mueve al día desplegado (y sale del documento si no hay ninguno): sus nodos
// se guardan aquí, porque getElementById no los encuentra fuera del documento.
const F = Object.fromEntries(["g-calle", "g-app", "c-hora", "guardar", "cancelar", "t-form", "estado-form", "apps-lista", "apps-rapidas"].map((id) => [id, $(id)]));
const kmFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const MES_HOY = hoyMadrid().slice(0, 7);
let mes = MES_HOY;
let abierto = null; // fecha del día desplegado
let editando = null; // id de la carrera que se edita
let aviso = null; // {fecha, nodos}: mensaje del día (p. ej. «Deshacer»)

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const h of hijos) if (h != null) n.append(h);
  return n;
}

const eur = (n) => `${euros(n)} €`;
const nCarreras = (d) => `${d.carreras} ${d.carreras === 1 ? "carrera" : "carreras"}`;
const textoCarrera = (c) => [c.hora ?? "Total sin detallar", c.canal === "app" ? c.app : CANALES.calle, METODOS[c.canal][c.metodo]].join(" · ");

// ---- Formulario «+ Carrera» -----------------------------------------------------------------
function mostrarGrupos() {
  const canal = form.canal.value;
  F["g-calle"].hidden = canal !== "calle";
  F["g-app"].hidden = canal !== "app";
  F["c-hora"].hidden = form.sinDetalle.checked;
  F["guardar"].textContent = editando ? "Guardar cambios" : form.sinDetalle.checked ? "Guardar total" : "Guardar carrera";
}

function apuntarApps() {
  const apps = leerApps();
  F["apps-lista"].replaceChildren(...apps.map((a) => el("option", { value: a })));
  F["apps-rapidas"].replaceChildren(...apps.map((a) => {
    const b = el("button", { type: "button", class: "chip-boton", text: a, "aria-pressed": String(form.app.value === a) });
    b.addEventListener("click", () => { form.app.value = a; apuntarApps(); form.importe.focus(); });
    return b;
  }));
  $("apps").replaceChildren(...apps.map((a) => {
    const b = el("button", { type: "button", class: "boton-sec", text: "Quitar", "aria-label": `Quitar ${a} de tus aplicaciones` });
    b.addEventListener("click", () => { quitarApp(a); $("estado-apps").textContent = `Quitada: ${a}.`; apuntarApps(); });
    return el("li", { class: "chip-app" }, el("span", { text: a }), b);
  }));
  if (!apps.length) $("apps").replaceChildren(el("li", { class: "nota", text: "Aún no has añadido ninguna. Se guardan también al apuntar una carrera de aplicación." }));
}

/** Deja el formulario listo para la siguiente carrera; conserva canal, cobro y aplicación. */
function siguiente() {
  editando = null;
  form.importe.value = "";
  form.nota.value = "";
  form.sinDetalle.checked = false;
  form.hora.value = horaMadrid();
  F["cancelar"].hidden = true;
  F["t-form"].textContent = "+ Carrera";
  form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  mostrarGrupos();
}

function datosFormulario() {
  const canal = form.canal.value;
  return {
    fecha: abierto, canal, hora: form.hora.value, sinDetalle: form.sinDetalle.checked,
    metodo: canal === "calle" ? form.metodo_calle.value : canal === "app" ? form.metodo_app.value : "",
    app: form.app.value, importe: form.importe.value, nota: form.nota.value,
  };
}

form.addEventListener("change", (e) => { if (e.target.name === "canal" || e.target.name === "sinDetalle") mostrarGrupos(); });
form.app.addEventListener("input", apuntarApps);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const r = editando ? editarCarrera(editando, datosFormulario()) : anadirCarrera(datosFormulario());
  form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  const estado = F["estado-form"];
  if (r.error) {
    estado.textContent = r.error;
    estado.classList.add("error");
    const campo = { canal: form.querySelector("[name=canal]"), metodo: form.querySelector(`[name=metodo_${form.canal.value}]`) }[r.campo] ?? form[r.campo];
    if (campo) { if (campo.type !== "radio") campo.setAttribute("aria-invalid", "true"); campo.focus(); }
    return;
  }
  estado.classList.remove("error");
  const c = r.carrera;
  const texto = `${editando ? "Actualizada" : "Guardada"}: ${textoCarrera(c)} · ${eur(c.importe)}.`;
  siguiente();
  apuntarApps();
  pintar();
  estado.textContent = texto;
  form.importe.focus();
});

F["cancelar"].addEventListener("click", () => { siguiente(); F["estado-form"].textContent = "Edición cancelada."; });

function editar(c) {
  editando = c.id;
  form.canal.value = c.canal;
  if (c.canal === "calle") form.metodo_calle.value = c.metodo;
  else { form.metodo_app.value = c.metodo; form.app.value = c.app; }
  form.importe.value = c.importe.toFixed(2).replace(".", ",");
  form.sinDetalle.checked = c.hora == null;
  form.hora.value = c.hora ?? horaMadrid();
  form.nota.value = c.nota;
  F["cancelar"].hidden = false;
  F["t-form"].textContent = c.hora == null ? "Editar total sin detallar" : `Editar carrera de las ${c.hora}`;
  F["estado-form"].textContent = "";
  mostrarGrupos();
  apuntarApps();
  F["t-form"].scrollIntoView({ block: "start" });
  form.importe.focus();
}

function borrar(c) {
  borrarCarrera(c.id);
  if (editando === c.id) siguiente();
  const deshacer = el("button", { type: "button", class: "boton-sec", text: "Deshacer" });
  deshacer.addEventListener("click", () => {
    restaurarCarrera(c);
    aviso = { fecha: c.fecha, nodos: ["Carrera recuperada."] };
    pintar();
  });
  aviso = { fecha: c.fecha, nodos: [`Borrada: ${textoCarrera(c)} · ${eur(c.importe)}. `, deshacer] };
  pintar();
  deshacer.focus();
}

// ---- Tabla mensual -----------------------------------------------------------------------
function celdas(d) {
  return COLUMNAS.map(([k, nombre]) => el("span", { class: `dia-col${d[k] ? "" : " cero"}` }, el("span", { class: "lbl", text: nombre }), el("span", { class: "val", text: euros(d[k]) })));
}

function panelDia(d) {
  const lista = el("ul", { class: "carreras" }, ...d.lista.map((c) => {
    const bE = el("button", { type: "button", class: "boton-sec", text: "Editar", "aria-label": `Editar ${textoCarrera(c)}, ${eur(c.importe)}` });
    const bB = el("button", { type: "button", class: "boton-peligro", text: "Borrar", "aria-label": `Borrar ${textoCarrera(c)}, ${eur(c.importe)}` });
    bE.addEventListener("click", () => editar(c));
    bB.addEventListener("click", () => borrar(c));
    return el("li", { class: c.hora == null ? "sin-detalle" : null },
      el("span", { class: "carrera-linea" }, el("span", { text: textoCarrera(c) }), el("strong", { text: eur(c.importe) })),
      c.nota ? el("span", { class: "nota", text: c.nota }) : null,
      el("span", { class: "botones" }, bE, bB));
  }));
  if (!d.lista.length) lista.append(el("li", { class: "nota", text: "Sin carreras este día." }));
  const estado = el("p", { class: "nota", role: "status", "aria-live": "polite" }, ...(aviso?.fecha === d.fecha ? aviso.nodos : []));
  return [lista, estado, form];
}

function pintar() {
  const t = tablaMensual(leerCarreras(), mes);
  const hoy = hoyMadrid();
  $("t-mes").textContent = nombreMes(mes).replace(/^./, (l) => l.toUpperCase());
  $("mes-sig").disabled = mes >= MES_HOY;
  $("mes-ant").disabled = mes <= "2000-01";

  $("dias").replaceChildren(...t.dias.map((d) => {
    const esHoy = d.fecha === hoy;
    const li = el("li", { class: `dia${esHoy ? " hoy" : ""}${d.lineas ? "" : " vacio"}` });
    const fecha = el("span", { class: "dia-fecha" }, el("span", { text: diaSemana(d.fecha) }), esHoy ? el("span", { class: "chip si", text: "Hoy" }) : null);
    if (d.fecha > hoy) {
      li.append(el("div", { class: "dia-fila futuro" }, fecha, el("span", { class: "dia-total nota", text: "—" })));
      return li;
    }
    const abiertoAqui = d.fecha === abierto;
    const idP = `p-${d.fecha}`;
    const boton = el("button", { type: "button", class: "dia-fila", id: `b-${d.fecha}`, "aria-expanded": String(abiertoAqui), "aria-controls": idP },
      fecha,
      ...(d.lineas ? celdas(d) : []),
      el("span", { class: "dia-total" }, el("span", { class: "lbl", text: "Total " }), d.lineas ? eur(d.total) : el("span", { class: "nota", text: "—" })),
      el("span", { class: "dia-n" }, d.lineas ? nCarreras(d) : ""),
      el("span", { class: "visualmente-oculto", text: `, ${fechaCorta(d.fecha)}` }));
    boton.addEventListener("click", () => abrir(abiertoAqui ? null : d.fecha));
    const panel = el("div", { class: "dia-panel", id: idP, role: "region", "aria-labelledby": `b-${d.fecha}` });
    panel.hidden = !abiertoAqui;
    if (abiertoAqui) panel.append(...panelDia(d));
    li.append(el("h3", { class: "dia-h" }, boton), panel);
    return li;
  }));

  const m = t.total;
  const par = (dt, dd, cls) => [el("dt", { class: cls, text: dt }), el("dd", { class: cls, text: dd })];
  $("totales").replaceChildren(
    ...COLUMNAS.flatMap(([k, nombre]) => par(nombre, eur(m[k]))),
    ...par("Total del mes", eur(m.total), "fuerte"),
    ...par("Nº de carreras", String(m.carreras)),
    ...par("Efectivo en mano (calle + app)", eur(m.efectivo_en_mano)),
    ...par("Cobrado por banco, datáfono o app", eur(m.cobrado_banco_app)),
  );

  // Cruce con el control de gastos: solo con tus datos.
  const gastosMes = leerRegistros().filter((r) => r.fecha.startsWith(`${mes}-`));
  const km = porEtiqueta(gastosMes).filter((g) => g.km).reduce((s, g) => s + g.km.km, 0) || null;
  const x = cruce(m.total, totales(gastosMes).importe, km);
  $("cruce").replaceChildren(
    ...par("Facturación del mes", eur(m.total)),
    ...par("Combustible del mes (tus repostajes)", gastosMes.length ? eur(totales(gastosMes).importe) : "Sin repostajes"),
    ...(gastosMes.length ? par("Facturación menos combustible", eur(x.menos_combustible), "fuerte") : []),
    ...(km ? par("Km medidos con el cuentakilómetros", `${kmFmt.format(km)} km`) : []),
    ...(x.por_km != null ? par("Facturación por km", `${euros(x.por_km, 3)} €/km`) : []),
  );
  $("cruce-nota").textContent = km
    ? "Km entre la primera y la última lectura del cuentakilómetros de este mes en cada vehículo o turno."
    : "Para la facturación por km, apunta el cuentakilómetros en al menos dos repostajes del mes.";
}

function abrir(fecha, enfocar = "boton") {
  const previo = abierto;
  if (fecha !== abierto) { aviso = null; F["estado-form"].textContent = ""; siguiente(); }
  abierto = fecha;
  pintar();
  const boton = $(`b-${fecha ?? previo}`);
  if (enfocar === "importe" && fecha) { boton.scrollIntoView({ block: "start" }); form.importe.focus(); } else boton?.focus();
}

function cambiarMes(n) {
  mes = sumarMeses(mes, n);
  abierto = null;
  aviso = null;
  pintar();
}
$("mes-ant").addEventListener("click", () => cambiarMes(-1));
$("mes-sig").addEventListener("click", () => cambiarMes(1));
$("ir-hoy").addEventListener("click", () => { mes = MES_HOY; abrir(hoyMadrid(), "importe"); });

// ---- Aplicaciones ---------------------------------------------------------------------------
$("f-app").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const r = anadirApp(f.app.value);
  $("estado-apps").textContent = r.error ?? `Añadida: ${r.app}.`;
  if (!r.error) f.reset();
  apuntarApps();
});

// ---- Exportar y borrar ----------------------------------------------------------------------
$("exportar").addEventListener("click", () => {
  const delMes = leerCarreras().filter((c) => c.fecha.startsWith(`${mes}-`));
  if (!delMes.length) { $("estado-datos").textContent = `No hay carreras en ${nombreMes(mes)}.`; return; }
  const blob = new Blob(["﻿", aCSV(delMes)], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `gasol-facturacion-${mes}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $("estado-datos").textContent = `Exportadas ${delMes.length} líneas de ${nombreMes(mes)}.`;
});

const [bBorrar, bSi, bNo] = [$("borrar"), $("borrar-si"), $("borrar-no")];
const confirmar = (on) => {
  bBorrar.hidden = on; bSi.hidden = !on; bNo.hidden = !on;
  $("estado-datos").textContent = on ? "¿Seguro? Se borrarán todas tus carreras (de todos los meses) y tus aplicaciones de este navegador. Si las quieres conservar, exporta antes cada mes." : "";
  (on ? bSi : bBorrar).focus();
};
bBorrar.addEventListener("click", () => confirmar(true));
bNo.addEventListener("click", () => confirmar(false));
bSi.addEventListener("click", () => {
  const ok = borrarIngresos();
  confirmar(false);
  form.reset();
  aviso = null;
  siguiente();
  apuntarApps();
  pintar();
  $("estado-datos").textContent = ok ? "Hecho: facturación borrada." : "No se pudo borrar: el navegador bloquea el almacenamiento.";
});

siguiente();
apuntarApps();
abierto = hoyMadrid();
pintar();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// Navegación común a todas las páginas con cabecera (no la portada). Es el único componente de
// menú: cada página lo carga (import "./nav.js" o <script src="assets/nav.js">) y aquí se inyecta.
// - Desde 900 px: barra superior en una fila; se centra la página actual y un degradado marca el
//   lado por el que hay más secciones.
// - Por debajo: barra fija inferior (Inicio, Comparador, Ruta, Facturación y Más) y el panel «Más»
//   con el resto. Sin JS, el CSS (scripting: none) deja visibles los enlaces de la barra superior.
import { enlaceOpinion } from "./config.js";
import { icono } from "./iconos.js";

// ---- Barra superior (pantallas anchas) ------------------------------------------------------
const nav = document.querySelector(".navegacion");

function bordes() {
  const max = nav.scrollWidth - nav.clientWidth;
  nav.classList.toggle("mas-izq", nav.scrollLeft > 4);
  nav.classList.toggle("mas-der", nav.scrollLeft < max - 4);
}

if (nav) {
  const actual = nav.querySelector('[aria-current="page"]');
  if (actual) nav.scrollLeft = actual.offsetLeft - (nav.clientWidth - actual.offsetWidth) / 2;
  bordes();
  nav.addEventListener("scroll", bordes, { passive: true });
  window.addEventListener("resize", bordes);
}

// ---- Barra inferior y panel «Más» (móvil) ---------------------------------------------------
const PRINCIPALES = [["inicio.html", "inicio", "Inicio"], ["comparador.html", "comparador", "Comparador"], ["ruta.html", "ruta", "Ruta"], ["ingresos.html", "facturacion", "Facturación"]];
const EN_MAS = [["gastos.html", "gastos", "Gastos"], ["calculadoras.html", "calculadora", "Calculadoras"], ["favoritas.html", "favorita", "Favoritas"], ["vencimientos.html", "vencimientos", "Vencimientos"]];
const LEGALES = [["privacidad.html", "Privacidad"], ["aviso-legal.html", "Aviso legal"]];
const pagina = location.pathname.split("/").pop() || "index.html";

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

function actual(a, href) {
  if (href === pagina) a.setAttribute("aria-current", "page");
  return a;
}

function menuApp() {
  const enMas = EN_MAS.some(([h]) => h === pagina) || LEGALES.some(([h]) => h === pagina);
  const item = ([href, ic, texto]) => el("li", {}, actual(el("a", { href, class: "barra-item" },
    el("span", { class: "barra-icono" }, icono(ic)), el("span", { class: "barra-texto", text: texto })), href));
  const boton = el("button", { type: "button", class: `barra-item${enMas ? " activo" : ""}`, "aria-expanded": "false", "aria-controls": "mas-panel", "aria-haspopup": "dialog" },
    el("span", { class: "barra-icono" }, icono("mas")), el("span", { class: "barra-texto", text: "Más" }),
    enMas ? el("span", { class: "visualmente-oculto", text: " (estás en una de sus secciones)" }) : null);
  const barra = el("nav", { class: "barra-app", "aria-label": "Menú principal" }, el("ul", {}, ...PRINCIPALES.map(item), el("li", {}, boton)));

  const fila = ([href, ic, texto]) => el("li", {}, actual(el("a", { href, class: "mas-fila" },
    el("span", { class: "tarjeta-icono" }, icono(ic)), el("span", { class: "mas-fila-texto", text: texto }), icono("chevron", "tarjeta-chevron")), href));
  const cerrarB = el("button", { type: "button", class: "boton-sec mas-cerrar", "aria-label": "Cerrar menú" }, icono("cerrar"));
  const legales = el("p", { class: "enlaces-pie" });
  LEGALES.forEach(([href, texto], i) => legales.append(...(i ? [" · "] : []), actual(el("a", { href, text: texto }), href)));
  const panel = el("div", { id: "mas-panel", class: "mas-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "mas-titulo" },
    el("div", { class: "mas-cabecera" }, el("h2", { id: "mas-titulo", text: "Más" }), cerrarB),
    el("ul", { class: "mas-lista" }, ...EN_MAS.map(fila)),
    el("p", { class: "mas-opinion" }, el("a", { class: "boton-sec opinion", href: enlaceOpinion(), "data-opinion": "" }, icono("correo"), "Enviar opinión")),
    legales);
  const fondo = el("div", { class: "mas-fondo" });
  panel.hidden = true;
  fondo.hidden = true;
  document.body.append(barra, fondo, panel);

  const enfocables = () => [...panel.querySelectorAll("a[href], button:not([disabled])")];
  const abrir = () => {
    panel.hidden = false;
    fondo.hidden = false;
    boton.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("menu-abierto");
    panel.querySelector(".mas-fila").focus();
  };
  const cerrar = (devolverFoco = true) => {
    if (panel.hidden) return;
    panel.hidden = true;
    fondo.hidden = true;
    boton.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("menu-abierto");
    if (devolverFoco) boton.focus();
  };

  boton.addEventListener("click", () => (panel.hidden ? abrir() : cerrar()));
  cerrarB.addEventListener("click", () => cerrar());
  fondo.addEventListener("click", () => cerrar());
  // Al navegar desde el panel se cierra (y al volver atrás con la página en caché, también).
  panel.addEventListener("click", (e) => { if (e.target.closest("a[href]")) cerrar(false); });
  window.addEventListener("pageshow", () => cerrar(false));
  // Foco atrapado en el panel; Escape cierra.
  document.addEventListener("keydown", (e) => {
    if (panel.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
    if (e.key !== "Tab") return;
    const f = enfocables();
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  });
  // Si la pantalla pasa a ancha con el panel abierto, se cierra (allí no hay barra inferior).
  window.matchMedia("(min-width: 56.25rem)").addEventListener("change", (m) => { if (m.matches) cerrar(false); });
}

if (document.querySelector(".cabecera")) menuApp();

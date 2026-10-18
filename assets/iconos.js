// Iconos del sprite assets/iconos.svg para el DOM que se crea desde JS. Siempre decorativos
// (aria-hidden): el nombre accesible lo pone el texto o la etiqueta del control.
const NS = "http://www.w3.org/2000/svg";

export function icono(nombre, clase = "") {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", `icono ${clase}`.trim());
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `assets/iconos.svg#${nombre}`);
  svg.append(use);
  return svg;
}

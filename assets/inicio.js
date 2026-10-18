// Inicio: avisos de vencimientos al abrir la app (sin push ni servidor) y registro del SW.
import "./nav.js";
import { fechaCorta } from "./fechas.js";
import { avisos, leerVencimientos, migrarVencimientos, nombreVencimiento, textoEstado } from "./vencimientos.js";

migrarVencimientos(); // tipos de versiones anteriores (decisión 100)

const caja = document.getElementById("avisos-vencimientos");
const lista = avisos(leerVencimientos());
if (lista.length) {
  const ul = document.createElement("ul");
  for (const v of lista.slice(0, 5)) {
    const li = document.createElement("li");
    li.className = `vencimiento ${v.clase}`;
    const estado = document.createElement("strong");
    estado.textContent = `${textoEstado(v)}: `;
    li.append(estado, document.createTextNode(`${nombreVencimiento(v)} (${fechaCorta(v.fecha)}${v.vehiculo ? `, ${v.vehiculo}` : ""})`));
    ul.append(li);
  }
  caja.insertBefore(ul, caja.querySelector("p"));
  if (lista.length > 5) caja.querySelector("p").prepend(document.createTextNode(`Y ${lista.length - 5} más. `));
  caja.hidden = false;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

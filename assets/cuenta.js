// Página de cuenta: acceso, perfil, avisos push, exportación y borrado.
import { CUENTAS } from "./config.js";
import { entrar, llamar, olvidarSesion, pwaInstalada, salir, sesion } from "./sesion.js";

const $ = (id) => document.getElementById(id);
const estado = $("estado");
const avisar = (t, error = false) => { estado.textContent = t; estado.classList.toggle("error", error); };
const fecha = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

function mostrar(conSesion) {
  $("acceso").hidden = conSesion;
  $("panel").hidden = !conSesion;
}

async function cargarPanel() {
  const { usuario, perfil } = await llamar("gasol-cuenta", { accion: "yo" });
  $("quien").textContent = perfil?.alias || usuario.email;
  $("form-perfil").alias.value = perfil?.alias || "";
  mostrar(true);
  await Promise.all([pintarAvisos(), pintarPush()]);
}

async function pintarAvisos() {
  const { avisos } = await llamar("gasol-cuenta", { accion: "avisos" });
  const ul = $("avisos");
  ul.replaceChildren();
  if (!avisos.length) {
    ul.append(Object.assign(document.createElement("li"), { textContent: "Todavía no hay avisos." }));
    return;
  }
  for (const a of avisos) {
    const li = document.createElement("li");
    const t = document.createElement("strong");
    t.textContent = a.titulo;
    li.append(t, document.createTextNode(` · ${a.cuerpo} (${fecha.format(new Date(a.creado_en))})`));
    ul.append(li);
  }
}

// ---- Web push: solo en la PWA instalada y con permiso explícito --------------
const base64aUint8 = (b64) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function suscripcionActual() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function pintarPush() {
  const txt = $("push-estado"), btn = $("push-boton");
  btn.hidden = true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    txt.textContent = "Este navegador no admite avisos.";
    return;
  }
  if (!pwaInstalada()) {
    txt.textContent = "Los avisos solo funcionan con la app instalada. Usa «Añadir a pantalla de inicio» y abre Gasol-IA desde el icono.";
    return;
  }
  if (Notification.permission === "denied") {
    txt.textContent = "Has bloqueado las notificaciones. Puedes permitirlas en los ajustes del móvil.";
    return;
  }
  const sub = await suscripcionActual();
  txt.textContent = sub
    ? "Avisos activados en este dispositivo. Son textos cortos, sin botones: no hace falta tocar el móvil al volante."
    : "Recibe un aviso corto cuando bajen precios en el corredor de tus rutas con avisos activos.";
  btn.textContent = sub ? "Desactivar avisos aquí" : "Activar avisos";
  btn.hidden = false;
}

$("push-boton").addEventListener("click", async () => {
  try {
    const sub = await suscripcionActual();
    if (sub) {
      await llamar("gasol-cuenta", { accion: "push_baja", endpoint: sub.endpoint });
      await sub.unsubscribe();
      avisar("Avisos desactivados en este dispositivo.");
    } else {
      // El permiso se pide solo al pulsar el botón (consentimiento explícito).
      if ((await Notification.requestPermission()) !== "granted") {
        avisar("Sin permiso no podemos enviarte avisos.", true);
      } else {
        const { clave } = await llamar("gasol-cuenta", { accion: "vapid" }, { privada: false });
        const reg = await navigator.serviceWorker.ready;
        const nueva = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64aUint8(clave) });
        await llamar("gasol-cuenta", { accion: "push_alta", suscripcion: nueva.toJSON() });
        avisar("Avisos activados en este dispositivo.");
      }
    }
  } catch (e) {
    avisar(e.message || "No se pudo cambiar el estado de los avisos.", true);
  }
  pintarPush();
});

// ---- Formularios ------------------------------------------------------------
$("form-acceso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const accion = e.submitter?.value === "registro" ? "registro" : "login";
  try {
    avisar(accion === "registro" ? "Creando tu cuenta…" : "Entrando…");
    const d = await entrar(accion, f.email.value, f.password.value);
    f.password.value = "";
    if (d.estado === "confirmar_email") { avisar(d.mensaje); return; }
    avisar("");
    await cargarPanel();
  } catch (err) {
    avisar(err.message, true);
  }
});

$("form-perfil").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await llamar("gasol-cuenta", { accion: "perfil", alias: e.target.alias.value.trim() });
    $("quien").textContent = e.target.alias.value.trim() || sesion()?.usuario?.email || "";
    avisar("Alias guardado.");
  } catch (err) { avisar(err.message, true); }
});

$("exportar").addEventListener("click", async () => {
  try {
    const datos = await llamar("gasol-cuenta", { accion: "exportar" });
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "gasol-ia-mis-datos.json" });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    avisar("Descarga preparada.");
  } catch (err) { avisar(err.message, true); }
});

$("salir").addEventListener("click", async () => {
  await salir();
  mostrar(false);
  avisar("Sesión cerrada.");
});

$("form-borrar").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const sub = await (("serviceWorker" in navigator) ? suscripcionActual().catch(() => null) : null);
    const d = await llamar("gasol-cuenta", { accion: "borrar_cuenta", confirmacion: e.target.confirmacion.value.trim() });
    if (sub) await sub.unsubscribe().catch(() => {});
    olvidarSesion();
    mostrar(false);
    avisar(d.cuenta_borrada ? "Cuenta borrada." : d.mensaje);
  } catch (err) { avisar(err.message, true); }
});

(async () => {
  // Demo sin cuentas: no se ofrece acceso ni registro.
  if (!CUENTAS) { $("desactivada").hidden = false; return; }
  if (!sesion()) { mostrar(false); return; }
  try { await cargarPanel(); } catch (err) {
    if (err.status === 401) olvidarSesion();
    mostrar(false);
    avisar(err.message, true);
  }
})();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// gasol-cuenta: proxy de Auth y de los datos del usuario. El cliente no lleva claves:
// esta función añade la clave anon en el servidor y reenvía el JWT del usuario a
// PostgREST, así RLS ("cada usuario solo lo suyo") protege cada fila.
// POST { accion, ... }. Las acciones privadas exigen Authorization: Bearer <jwt>.
import {
  auth, authAdmin, cors, ErrorHttp, respuesta, restServicio, restUsuario, rpcServicio, tokenDe, usuario,
} from "../_shared/supa.ts";

const CORS = cors("POST");
const json = respuesta(CORS);
const enc = encodeURIComponent;

// Tablas del usuario, en orden de borrado (hijas antes que padres).
const TABLAS_USUARIO = [
  { tabla: "gasol_avisos", columna: "usuario_id" },
  { tabla: "gasol_push_suscripciones", columna: "usuario_id" },
  { tabla: "gasol_rutas", columna: "usuario_id" },
  { tabla: "gasol_perfiles", columna: "id" },
];

function sesion(d: Record<string, unknown>) {
  const u = d.user as { id: string; email: string };
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at,
    usuario: { id: u.id, email: u.email },
  };
}

function credenciales(body: Record<string, unknown>) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    throw new ErrorHttp(400, "Escribe un email válido.");
  }
  if (password.length < 8 || password.length > 72) {
    throw new ErrorHttp(400, "La contraseña debe tener entre 8 y 72 caracteres.");
  }
  return { email, password };
}

function texto(v: unknown, max: number, campo: string): string {
  const s = String(v ?? "").trim();
  if (!s || s.length > max) throw new ErrorHttp(400, `${campo} no válido.`);
  return s;
}

function lugar(v: unknown, campo: string) {
  const p = v as { nombre?: unknown; lat?: unknown; lon?: unknown };
  const lat = Number(p?.lat), lon = Number(p?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 27 || lat > 44.5 || lon < -18.5 || lon > 4.5) {
    throw new ErrorHttp(400, `${campo} no válido.`);
  }
  return { nombre: texto(p.nombre, 120, campo), lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
}

function geometria(v: unknown) {
  if (v == null) return null;
  if (!Array.isArray(v) || v.length < 2 || v.length > 3000) throw new ErrorHttp(400, "Geometría no válida.");
  return v.map((p) => {
    const lat = Number(p?.[0]), lon = Number(p?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new ErrorHttp(400, "Geometría no válida.");
    return [Number(lat.toFixed(5)), Number(lon.toFixed(5))];
  });
}

async function publicas(accion: string, body: Record<string, unknown>, ip: string | null) {
  switch (accion) {
    case "registro": {
      const { email, password } = credenciales(body);
      const r = await auth("signup", { method: "POST", body: JSON.stringify({ email, password }) }, ip);
      if (!r.ok) {
        if (r.status === 429) throw new ErrorHttp(429, "Demasiados intentos. Prueba en unos minutos.");
        throw new ErrorHttp(400, "No se ha podido crear la cuenta. Si ya tienes una, entra con tu contraseña.");
      }
      const u = (r.datos.user ?? r.datos) as { id?: string; created_at?: string };
      // Marca de origen (app_metadata, que el usuario no puede editar): solo si la
      // cuenta se acaba de crear aquí. Sirve para saber si al borrar la cuenta se
      // puede borrar también el usuario de Auth, compartido con otros productos.
      if (u?.id && u.created_at && Date.now() - Date.parse(u.created_at) < 60_000) {
        await authAdmin(`users/${u.id}`, { method: "PUT", body: JSON.stringify({ app_metadata: { gasol_origen: true } }) })
          .catch(() => {});
      }
      if (!r.datos.access_token) {
        return { estado: "confirmar_email", mensaje: "Te hemos enviado un email para confirmar la cuenta." };
      }
      return { estado: "ok", sesion: sesion(r.datos) };
    }
    case "login": {
      const { email, password } = credenciales(body);
      const r = await auth("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) }, ip);
      if (!r.ok) {
        if (r.status === 429) throw new ErrorHttp(429, "Demasiados intentos. Prueba en unos minutos.");
        throw new ErrorHttp(401, "Email o contraseña incorrectos, o cuenta sin confirmar.");
      }
      return { estado: "ok", sesion: sesion(r.datos) };
    }
    case "refrescar": {
      const refresh = texto(body.refresh_token, 200, "Sesión");
      const r = await auth("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refresh }) }, ip);
      if (!r.ok) throw new ErrorHttp(401, "Tu sesión ha caducado. Vuelve a entrar.");
      return { estado: "ok", sesion: sesion(r.datos) };
    }
    case "vapid":
      // Clave pública de web push (pública por diseño: la necesita el navegador).
      return { clave: await rpcServicio("gasol_secreto", { p_nombre: "gasol_vapid_publica" }) };
  }
  return null;
}

async function privadas(accion: string, body: Record<string, unknown>, token: string) {
  const yo = await usuario(token);
  const uid = enc(yo.id);
  switch (accion) {
    case "yo": {
      await restUsuario(token, "gasol_perfiles", {
        method: "POST", body: JSON.stringify({ id: yo.id }), prefer: "resolution=ignore-duplicates,return=minimal",
      });
      const [perfil] = await restUsuario(token, `gasol_perfiles?id=eq.${uid}&select=alias,creado_en`);
      return { usuario: { id: yo.id, email: yo.email }, perfil };
    }
    case "perfil": {
      const alias = body.alias == null || body.alias === "" ? null : texto(body.alias, 40, "Alias");
      await restUsuario(token, `gasol_perfiles?id=eq.${uid}`, {
        method: "PATCH", body: JSON.stringify({ alias, actualizado_en: new Date().toISOString() }), prefer: "return=minimal",
      });
      return { estado: "ok" };
    }
    case "salir":
      await auth("logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      return { estado: "ok" };
    case "rutas":
      return {
        rutas: await restUsuario(token,
          "gasol_rutas?select=id,nombre,origen,destino,paradas,combustible,solo_24h,lateral_km,distancia_km,duracion_min,alertas_activas,creada_en&order=creada_en.desc"),
      };
    case "ruta_guardar": {
      const r = body.ruta as Record<string, unknown>;
      const paradas = Array.isArray(r?.paradas) ? r.paradas : [];
      if (paradas.length > 3) throw new ErrorHttp(400, "Máximo 3 paradas.");
      const fila = {
        nombre: texto(r?.nombre, 80, "Nombre"),
        origen: lugar(r?.origen, "Origen"),
        destino: lugar(r?.destino, "Destino"),
        paradas: paradas.map((p, i) => lugar(p, `Parada ${i + 1}`)),
        combustible: texto(r?.combustible, 30, "Combustible"),
        solo_24h: r?.solo_24h === true,
        lateral_km: Number(r?.lateral_km ?? 2),
        geometria: geometria(r?.geometria),
        distancia_km: Number(r?.distancia_km) || null,
        duracion_min: Number(r?.duracion_min) || null,
        proveedor: r?.proveedor ? texto(r.proveedor, 60, "Proveedor") : null,
      };
      const [creada] = await restUsuario(token, "gasol_rutas?select=id,nombre", {
        method: "POST", body: JSON.stringify(fila), prefer: "return=representation",
      });
      return { ruta: creada };
    }
    case "ruta_alertas": {
      const id = texto(body.id, 40, "Ruta");
      const filas = await restUsuario(token, `gasol_rutas?id=eq.${enc(id)}&select=id,alertas_activas`, {
        method: "PATCH",
        body: JSON.stringify({ alertas_activas: body.activas === true, actualizada_en: new Date().toISOString() }),
        prefer: "return=representation",
      });
      if (!filas.length) throw new ErrorHttp(404, "Ruta no encontrada.");
      return { ruta: filas[0] };
    }
    case "ruta_borrar": {
      const id = texto(body.id, 40, "Ruta");
      await restUsuario(token, `gasol_rutas?id=eq.${enc(id)}`, { method: "DELETE", prefer: "return=minimal" });
      return { estado: "ok" };
    }
    case "push_alta": {
      const s = body.suscripcion as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const endpoint = texto(s?.endpoint, 1000, "Suscripción");
      if (!endpoint.startsWith("https://")) throw new ErrorHttp(400, "Suscripción no válida.");
      await restUsuario(token, "gasol_push_suscripciones", {
        method: "POST",
        body: JSON.stringify({ endpoint, p256dh: texto(s?.keys?.p256dh, 200, "Clave"), auth: texto(s?.keys?.auth, 100, "Clave") }),
        prefer: "resolution=ignore-duplicates,return=minimal",
      });
      return { estado: "ok" };
    }
    case "push_baja": {
      const endpoint = texto(body.endpoint, 1000, "Suscripción");
      await restUsuario(token, `gasol_push_suscripciones?endpoint=eq.${enc(endpoint)}`, { method: "DELETE", prefer: "return=minimal" });
      return { estado: "ok" };
    }
    case "avisos":
      return { avisos: await restUsuario(token, "gasol_avisos?select=titulo,cuerpo,estado,creado_en&order=creado_en.desc&limit=20") };
    case "exportar": {
      const datos: Record<string, unknown> = {
        exportado_en: new Date().toISOString(),
        cuenta: { id: yo.id, email: yo.email },
      };
      for (const { tabla } of TABLAS_USUARIO) datos[tabla] = await restUsuario(token, `${tabla}?select=*`);
      return datos;
    }
    case "borrar_cuenta": {
      if (body.confirmacion !== "BORRAR") throw new ErrorHttp(400, "Escribe BORRAR para confirmar.");
      for (const { tabla, columna } of TABLAS_USUARIO) {
        await restUsuario(token, `${tabla}?${columna}=eq.${uid}`, { method: "DELETE", prefer: "return=minimal" });
      }
      await restServicio(`gasol_uso?usuario_id=eq.${uid}`, { method: "DELETE", prefer: "return=minimal" });
      // El usuario de Auth es compartido con otros productos: solo se borra si se creó aquí.
      if (yo.app_metadata?.gasol_origen === true) {
        await authAdmin(`users/${uid}`, { method: "DELETE" });
        return { estado: "ok", cuenta_borrada: true };
      }
      return {
        estado: "ok", cuenta_borrada: false,
        mensaje: "Hemos borrado todos tus datos de Gasol-IA. Tu acceso se usa también en otro servicio y se mantiene.",
      };
    }
  }
  throw new ErrorHttp(400, "Acción no válida.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const accion = String(body.accion ?? "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const pub = await publicas(accion, body, ip);
    if (pub) return json(pub);
    return json(await privadas(accion, body, tokenDe(req)));
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message }, e.status);
    console.error("gasol-cuenta error:", e instanceof Error ? e.message.slice(0, 200) : "desconocido");
    return json({ error: "No se pudo completar ahora mismo." }, 502);
  }
});

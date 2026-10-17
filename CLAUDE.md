# CLAUDE.md — Gasol-IA

App para transportistas autónomos (camión y furgoneta de reparto): gasolineras
más baratas en su ruta, con filtro de abiertas 24 h.

## Stack
- Cliente: HTML/CSS/JS vanilla, PWA instalable. Sin frameworks ni npm en el cliente.
- Scripts de build: Python (solo librería estándar salvo que se justifique).
- Hosting: GitHub Pages.
- Backend: Supabase (proyecto `mlaqtniujnvfxcvcourm`, compartido con otros productos).
  - Tablas con prefijo `gasol_*`. Edge Functions con prefijo `gasol-*`.
  - Antes de crear nada, consultar el esquema real. No tocar nada que no sea `gasol*`.
  - RLS en todas las tablas. Lectura pública solo donde haga falta; escritura
    solo `service_role` o `authenticated`.
  - Toda VIEW con `security_invoker = on`.
  - Secretos en Supabase Secrets / Vault. Nunca claves en el cliente.
  - Edge Functions públicas, con CORS:
    `supabase functions deploy <nombre> --no-verify-jwt --project-ref mlaqtniujnvfxcvcourm`

## Datos y claims
- Sin datos inventados: ninguna cifra de ahorro, rendimiento ni testimonio.
- Los números de las calculadoras los pone el usuario y se etiquetan como suyos.
- Todo precio se muestra con la fecha y hora de su captura y su fuente.
  Nunca "en vivo" ni "tiempo real". No se prometen predicciones de precio.
- Datos oficiales: no se afirma licencia comercial hasta confirmarla. Si no
  consta, se anota como pendiente y se pregunta al organismo
  (estado actual en `docs/FUENTE-DATOS.md`).
- Atribución obligatoria en toda vista con datos: "Origen de los datos: Ministerio
  para la Transición Ecológica y el Reto Demográfico" + fecha de actualización.
  No sugerir que el Ministerio participa, patrocina o apoya la app.

## Límites del producto
- No prometer "ruta segura para camión".
- Sin WhatsApp Business API.
- Sin consejo fiscal ni legal.
- Aviso de IA visible donde se use IA.
- Seguridad al volante: se planifica antes de salir; en marcha, solo avisos
  cortos sin interacción.

## RGPD
- Ubicación y rutas son datos personales: lo mínimo necesario, nada de usarlos
  para otra cosa.
- La ubicación de "cerca de mí" se redondea en el navegador y no se guarda ni se
  registra en logs.
- Cuando haya cuentas: exportar datos y borrar cuenta desde la app.

## Git
- Ramas + PR: `feat/`, `fix/`, `docs/`, `refactor/`. Un PR, una cosa.
- Nunca push a `main` para cambios grandes.

## Diseño
- Mobile-first y accesible. Lighthouse móvil >= 85. Cero errores de consola.
  Sin desbordamiento horizontal a 390 px. Respetar `prefers-reduced-motion`.
- Identidad provisional sobria: fondo oscuro + un acento verde para
  "precio a la baja". Se definirá después.

## Verificación antes de cada PR con cambios de datos o UI
- `deno test supabase/functions` (parser de horarios y normalización).
- Capturas en móvil (390 px), Lighthouse móvil, consola sin errores.
- Contraste manual de una muestra de gasolineras contra la fuente oficial.

# Decisiones — Fases 0 y 1

Tomadas al construir la fase 0-1. Las marcadas con **[revisar]** necesitan tu visto bueno.

## Datos y backend

1. **Descarga vía pg_net, no `fetch` en la Edge Function.** El servidor oficial solo
   acepta TLS 1.2 con RSA estático, que rustls (Deno) no soporta. `gasol-ingest` pide la
   descarga con `gasol_descargar()` (URL fija, sin parámetros, sin riesgo de SSRF) y recoge
   el cuerpo. Normalización, parser y carga siguen en la función.
2. **Idempotencia por huella SHA-256 del contenido**, no por la `Fecha` del JSON (que es
   la hora de la respuesta). Repetir la carga sin cambios en la fuente deja un log
   `duplicada` y no crea captura.
3. **Carga por lotes** (estaciones de 2.000 en 2.000, precios de 8.000 en 8.000) porque
   PostgREST corta cada sentencia a los 8 s (`statement_timeout` del rol `authenticator`,
   compartido con otros proyectos: no se toca). La captura solo pasa a `ok` al final, con
   el recuento verificado. La web solo lee la última captura `ok`: una carga fallida o a
   medias nunca sustituye a la buena (probado: el primer intento falló por timeout y la
   captura anterior siguió vigente).
4. **Sin lectura pública de tablas.** RLS activado sin políticas; toda lectura pasa por
   `gasol-buscar`, que usa `service_role` en el servidor. El cliente no lleva ninguna clave,
   ni siquiera la anon. Todas las funciones `gasol_*` solo las ejecuta `service_role`
   (comprobado con `has_function_privilege`).
5. **Token de `gasol-ingest` en Supabase Vault** (`gasol_ingest_token`), validado con
   `gasol_token_valido()`. El conector de Supabase falló al crear el secreto de Edge
   Function, y Vault además lo necesita el cron.
6. **Cron diario a las 04:15 UTC** (06:15 en verano, 05:15 en invierno, hora peninsular).
   **[revisar]** Los precios cambian durante el día. Si se quiere más frescura, basta con
   cambiar el `schedule`: la carga tarda unos 18 s y deja de duplicar cuando no hay cambios.
7. **Geolocalización sin PostGIS.** Índice btree `(lat, lon)`, caja delimitadora y
   distancia haversine en SQL. Así no hay que instalar extensiones en un proyecto compartido.
8. **Clasificación 24 h** (detalle en `docs/FUENTE-DATOS.md` §3): `L-D: 00:00-23:59`
   cuenta como 24 h; `L: 24H` queda «sin confirmar». **[revisar]** si prefieres que
   `00:00-23:59` también quede como dudoso (afecta a 78 estaciones).
9. **Retención y limpieza (aplicadas el 2026-10-17).** El conector MCP no pudo confirmar
   sentencias con `DELETE`/`DROP`; se aplicaron desde el SQL Editor con confirmación humana
   (`supabase/migrations/20261018000000_...`): retención de 14 capturas (cron
   `gasol-retencion-diaria`, 04:45), borrado de precios huérfanos de cargas fallidas y
   eliminación de restos de la primera versión (`gasol_ingestar`, `ultima_captura_id`, un
   índice). Verificado en la base: función y cron existen, restos eliminados.

## Web

10. **Combustibles en el comparador**: Gasóleo A (por defecto), Gasóleo Premium, Diésel
    renovable, AdBlue, Gasolina 95/98 E5 y GLP. **Fuera**: Gasóleo B (agrícola, no apto para
    circular) y los gases por kg (GNC, GNL, biogás, hidrógeno) hasta confirmar las unidades.
11. **«Precio más bajo» en todas las empatadas**, no «la más barata» en una sola: en
    Madrid hay varias estaciones al mismo precio mínimo.
12. **Máximo 200 resultados** en el comparador, y el resumen lo dice («Las 200 más baratas»).
13. **«Cerca de mí»**: la ubicación se redondea a 2 decimales (~1 km) en el móvil, el
    servidor la vuelve a redondear, no se guarda, no se registra y la respuesta va con
    `no-store`. Radios: 5, 10, 25 y 50 km. La distancia se indica «en línea recta».
14. **Mapa con Leaflet 1.9.4** (unpkg, con SRI) y teselas de OpenStreetMap, cargado solo al
    pulsar «Ver en mapa». **[revisar]** La política de uso de las teselas de OSM no admite
    tráfico alto. Para producción conviene un proveedor de teselas con condiciones claras.
15. **CSP en `<meta>`** (GitHub Pages no permite cabeceras): solo `self`, unpkg, las
    teselas de OSM y la Edge Function.
16. **Service worker de red primero**: cachea solo la carcasa. Los precios nunca salen de
    caché, para no enseñar un precio guardado como si fuera el último.
17. **noindex en todo el sitio**, comparador incluido, no solo en las estáticas.
    **[revisar]** cuando decidas indexar: `GASOL_INDEXAR=1` en el generador y quitar el meta
    del `index.html`.

## Páginas estáticas

18. **Generadas en `gasolineras/` y `sitemap.xml`, sin commitear** (`.gitignore`): 3.290
    páginas, 24 MB, con precios que caducan. **[revisar]** El despliegue:
    - GitHub Pages **no funciona con un repo privado en una cuenta sin plan de pago**
      (NexusForgeIA no tiene plan). Opciones: hacer público el repo, pasar a un plan de pago
      o usar Cloudflare Pages, como `cdn.whitemoon.es`.
    - Lo natural es regenerarlas cada día en CI después del cron. Queda fuera de esta fase.
19. **`GASOL_BASE_URL` por defecto `https://nexusforgeia.github.io/GASOL-IA`** para el
    canonical y el sitemap. **[revisar]** cuando haya dominio.
20. **JSON-LD**: `BreadcrumbList` + `ItemList` de `GasStation` (nombre, dirección y
    coordenadas). `openingHours` solo en las abiertas 24 h confirmadas. **Sin precios en el
    JSON-LD**: caducan y los repetirían buscadores y asistentes.
21. **Slugs**: los nombres bilingües usan la primera parte (`VALENCIA / VALÈNCIA` →
    `valencia`) y el artículo va delante (`CORUÑA (A)` → `a-coruna`). Si dos municipios
    colisionan, se añade el ID.
22. **Hora peninsular calculada con la regla de la UE** en el generador, porque Python en
    Windows no trae `tzdata` y no queremos dependencias. Tiene test del cambio de hora.

# Decisiones — Fase 2 en demo (18/10/2026)

23. **Demo sin cuentas.** El repo es público y el proyecto Supabase propio aún no existe: no se
    crean usuarios en el Auth compartido. Las rutas se guardan en `localStorage`; cuentas, rutas
    en servidor y avisos push quedan detrás de `CUENTAS` (cliente) y `GASOL_CUENTAS` (servidor).
24. **Límite global de 500 cálculos de ruta al día** en la demo, en vez de por usuario o por IP:
    no guarda datos personales y protege al servidor público de OSRM. **[revisar]** si se queda
    corto.
25. **La lista de municipios la sirve `gasol-ruta`** (`GET ?listado=lugares`) para desplegar una
    sola función; `gasol-buscar` también la tiene en el repo, pero la versión desplegada no.
26. **Atribución con fecha junto al corredor** («Datos actualizados el …»), además del pie.

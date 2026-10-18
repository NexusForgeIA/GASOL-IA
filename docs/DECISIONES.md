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

# Decisiones — Calculadoras (18/10/2026)

27. **Precio de referencia = el más bajo de la zona** (provincia o municipio y combustible) en la
    última captura, con estación, fecha y atribución. Sin medias: el más bajo es comprobable en el
    comparador. En el ahorro por repostaje no se edita; en las demás es sugerencia editable.
28. **El combustible del desvío se valora al precio de la zona**, como en la calculadora de ruta.
29. **Límites de validación** (p. ej. hasta 2.000 l, 10 €/l, 100 l/100 km, 5.000 l de depósito):
    solo descartan errores de tecleo; no son valores por defecto ni se muestran como datos.
30. **AdBlue fuera de las calculadoras**: no se consume en l/100 km como el combustible.

# Decisiones — Inicio y favoritas (18/10/2026)

31. **Favoritas solo en el navegador** y sin coordenadas: se guarda el ID oficial y lo justo para
    reconocer la estación si no llega su precio. Máximo 50 (lo que acepta `gasol-buscar?ids=`).
32. **Precio de favoritas por ID en el servidor** (`gasol_estaciones_por_id`, solo `service_role`,
    vía `gasol-buscar`, desplegada v4): las estaciones de la ruta no traen municipio, y así la
    lógica de 24 h es la misma del comparador. Estación sin ese combustible → «Sin precio de … en
    la última captura»; estación que ya no aparece → se avisa y se mantiene en la lista.
33. **Preferencias como valor inicial**, nunca forzado: en el comparador manda la URL compartida y
    en la ruta, una ruta guardada. La distancia a la ruta (1/2/5/10 km) es una preferencia aparte
    del radio de «Cerca de mí» (5/10/25/50 km), porque las escalas no coinciden.
34. **«Borrar mis datos» sin diálogos del navegador**: confirmación en la propia página. No borra
    las rutas guardadas, que tienen su propio botón en Ruta (se indica en la página).
35. **`[hidden] { display: none !important }`** global: evita que una clase con `display` muestre
    lo que está oculto (pasaba con el enlace «Cuenta»).

# Decisiones — Ficha de estación (18/10/2026)

36. **Ficha plegable con `<details>`/`<summary>`**: nativo, accesible con teclado y sin JS para
    abrir y cerrar. Cerrada en todos los tamaños; el resumen basta para comparar.
37. **El detalle se pide al abrir** (`gasol-buscar?ficha=`, caché HTTP de 10 min y en memoria):
    no engorda la búsqueda de 200 resultados. Favoritas precarga todas en una sola petición.
38. **Productos de la ficha**: los seis pedidos (Gasóleo A y Premium, 95 E5, 98 E5, 95 E5
    Premium, AdBlue) más Diésel renovable y GLP, que ya están en el comparador, para poder
    destacar el elegido. Lista única en `gasol-buscar/ids.ts` (`FICHA_COMBUSTIBLES`).
39. **En la tabla, fecha corta (día/mes y hora)** para que quepa a 390 px; la fecha completa va en
    el atributo `title`, en el resumen y en la atribución.
40. **Sin teléfono**: la fuente no lo trae y no se completa con otras.

# Decisiones — Posicionamiento (18/10/2026)

41. **Público: conductores profesionales (taxi, VTC, furgoneta y camión)**, en CLAUDE.md, README,
    portada, inicio, comparador y manifiesto. El diferencial es el control del gasto, no el
    comparador. Se mantienen el aviso «Ruta no verificada para camiones» y la atribución a MITECO.
    Sin cifras ni promesas de ahorro.
42. **La portada anima solo el movimiento, no la opacidad**: con `opacity: 0` de partida, si la
    animación no corría (pestaña en segundo plano, Lighthouse) no se pintaba nada (`NO_FCP`).

# Decisiones — Control de gastos (18/10/2026)

43. **Un solo campo «Turno o vehículo»**, libre (máx. 40), como pidió el producto. El coste por km
    se calcula por etiqueta; si se usan turnos del mismo vehículo, las lecturas se mezclan y la
    página lo explica (mejor etiquetar por vehículo para el coste por km).
44. **Coste por km de lleno a lleno**: el primer repostaje con lectura no cuenta (el combustible
    se gastó antes de medir); los que no tienen lectura no entran. Sin al menos dos lecturas
    distintas no se da cifra («Faltan lecturas»). El AdBlue y «Otro» cuentan en el gasto.
45. **Límites de tecleo**: litros hasta 2.000, importe hasta 10.000 €, cuentakilómetros hasta
    9.999.999, fecha desde 2000 hasta mañana (holgura de zona horaria). No se valida el €/l: sería
    una regla de negocio.
46. **CSV con «;» y coma decimal, BOM UTF-8** y celdas que empiezan por `= + - @` precedidas de
    «'» para que una hoja de cálculo no las ejecute como fórmulas.
47. **Borrar un repostaje no pide confirmación; ofrece «Deshacer»**. Borrarlo todo sí la pide.
48. **Cuarta tarjeta en el inicio («Control de gastos»), la primera**, porque es el diferencial.

# Decisiones — Vencimientos (18/10/2026)

49. **Sin plazos legales**: la fecha la pone el usuario y la página lo dice arriba. No se sugieren
    periodicidades de ITV, taxímetro ni licencias.
50. **La antelación del aviso la elige el usuario** (7, 15, 30 o 60 días; 30 por defecto). Es una
    preferencia de la app, no un plazo.
51. **Días de calendario en hora peninsular** (`assets/fechas.js`): «hoy» no depende de la zona
    horaria del móvil ni del cambio de hora.
52. **Avisos solo en el inicio** (la pantalla tras «Entrar»), máximo cinco y enlace a la lista.
    Sin notificaciones push: requieren cuentas o servidor.
53. **«Otro» exige descripción**, para que el aviso diga qué vence.

# Decisiones — Combustibles alternativos y recarga (18/10/2026)

54. **GNC, GNL y biogás entran en €/kg** porque la unidad está confirmada en el anexo oficial de
    la orden de remisión y hay datos reales (42–97 estaciones). Se muestra «por kg» en la ficha,
    «€/kg» en la tabla, el mapa y el selector.
55. **Hidrógeno fuera**: dos estaciones, 9,90 y 25,00 €/kg. Unidad confirmada, dato insuficiente.
56. **La ruta no ofrece gases** y no aplica una preferencia de gas: su calculadora de desvío usa
    litros. Igual las calculadoras y el control de gastos («Otro» sirve mientras tanto).
57. **Recarga eléctrica sin integrar**: el registro del MITECO (CC BY 4.0) no trae precios y el
    Mapa REVE no publica condiciones de reutilización. Documentado en `docs/FUENTE-DATOS.md` §9.

# Decisiones del producto — beta (18/10/2026)

58. **`gasol-cuenta` fuera del proyecto compartido.** Neutralizada (410) y pendiente de borrar
    desde el panel; las cuentas llegan con el proyecto Supabase propio.
59. **Licencia de datos**: no bloquea la beta gratuita con `noindex`. Se resuelve antes de cobrar
    o de indexar. No se escribe al Ministerio todavía.
60. **Recarga eléctrica y gas en kg en ruta, calculadoras y gastos: aplazados** hasta tener
    opiniones de la beta (taxistas).
61. **Se quedan las tarjetas de inicio** «Control de gastos» y «Vencimientos».

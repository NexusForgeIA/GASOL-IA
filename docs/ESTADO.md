# Estado — 18/10/2026

Público: servicio de transporte de pasajeros y de mercancías. El diferencial es el control
del gasto en combustible.

**Dirección oficial: <https://nexusforgeia.github.io/GASOL-IA/>** (GitHub Pages, `noindex`; la única
que se da a los taxistas). Cada fusión en `main` se despliega sola con GitHub Pages, sin compilación.
Netlify está descartado (crédito agotado; decisión 89). GitHub Pages no admite cabeceras propias: el
`noindex` va en el `<meta>` de cada página y el CSP también en `<meta>`.
Backend: proyecto Supabase compartido `mlaqtniujnvfxcvcourm` (prefijo `gasol_*`), a la espera
del proyecto Supabase propio de Gasol-IA.

| Fase | Estado |
| --- | --- |
| 0 · Fuente de datos | Hecha. Licencia comercial pendiente de confirmar (`docs/FUENTE-DATOS.md`). |
| 1 · Comparador | Hecha y publicada. |
| 2 · Ruta y corredor | **En demo, sin cuentas.** Ver abajo. |
| Calculadoras | **Publicadas** (`calculadoras.html`), sin servidor. Ver abajo. |
| Firma, aviso legal y opiniones | **Publicado**: pie con WhiteMoon, `aviso-legal.html`, privacidad con responsable y «Enviar opinión» por correo. |
| Gas (GNC, GNL, biogás) | **En el comparador, la ficha y favoritas**, en €/kg. Ver abajo. |
| Recarga eléctrica | **Investigada, no integrada** (`docs/FUENTE-DATOS.md` §9). |
| Vencimientos | **Publicado** (`vencimientos.html`), solo en el navegador. Ver abajo. |
| Control de gastos | **Publicado** (`gastos.html`), solo en el navegador. Ver abajo. |
| Facturación (taxistas beta) | **Publicada** (`ingresos.html`), solo en el navegador. Ver abajo. |
| Ficha de estación | **Publicada** en comparador, ruta y favoritas. Ver abajo. |
| Inicio, favoritas y preferencias | **Publicadas** (`inicio.html`, `favoritas.html`), solo en el navegador. Ver abajo. |
| 2 · Cuentas, rutas en servidor y avisos push | Escritas, **desactivadas**. Pendientes del proyecto Supabase propio. |
| 3 · 4 · 5 | Pendientes del proyecto Supabase propio. |

## Fase 2 en la demo

Activo:
- `ruta.html`: origen, destino y hasta 3 paradas (municipios con gasolinera o «Mi ubicación»
  redondeada a ~1 km); corredor de 1, 2, 5 o 10 km; filtro de abiertas 24 h; ✓/✗ frente a la
  captura anterior, con las fechas de ambas; desvío por carretera de las 25 más baratas y de la
  más cercana; calculadora de desvío con los litros y el consumo que pone el usuario.
- Navegación: Google Maps con hasta 3 paradas intermedias (si el repostaje no cabe, se quita y se
  avisa) y Waze solo para la siguiente parada.
- Aviso «Ruta no verificada para camiones» fijo arriba del planificador y junto a cada ruta.
- Rutas guardadas **solo en el navegador** (`localStorage`, clave `gasol.rutas`, máx. 20): origen,
  destino, paradas y filtros, sin la línea de la ruta. No llegan al servidor.
- Edge Function `gasol-ruta` (pública, sin JWT, CORS): `POST` calcula ruta y corredor;
  `GET ?listado=lugares` da la lista de municipios. Topes globales de 60 cálculos por hora y 500
  al día (`gasol_uso_ruta`: solo ventana y recuento, sin usuario ni IP) para no abusar del servidor
  público de OSRM, más 20 por dispositivo y día en el cliente (decisión 110).

Desactivado (código presente, no se borra):
- Bandera `CUENTAS = false` en `assets/config.js`: oculta el enlace «Cuenta», el aviso de sesión,
  la casilla de avisos y la lista de rutas del servidor. `cuenta.html` muestra «Cuentas
  desactivadas en esta demo».
- En el servidor, `gasol-ruta` solo exige sesión y aplica el límite por usuario con
  `GASOL_CUENTAS=1` (secreto de la función; hoy sin definir).
- `gasol-alertas` (avisos push con VAPID): **no desplegada**.

## Calculadoras

`calculadoras.html`, enlazada en el menú junto a Comparador y Ruta. Todo se calcula en el navegador
(`assets/calculos.js`, con tests); consumos, litros, km, capacidad y precio habitual los pone el
usuario y se etiquetan «tu dato». Lo único que se pide al servidor es el precio oficial más bajo de
la zona elegida (`gasol-buscar`), siempre con su fecha de captura y la atribución.

1. Ahorro por repostaje: gasolinera habitual frente al precio más bajo de la zona, restando el
   desvío opcional (km extra y consumo). Dice si compensa con esos datos.
2. Coste del viaje. 3. Consumo real (l/100 km). 4. Coste por km y proyección mensual y anual.
5. Litros por depósito: nivel en % o litros, litros y coste para llenar, autonomía y coste hasta
   un nivel elegido. Valida nivel negativo o por encima de la capacidad.

Los últimos valores y la zona se recuerdan en `localStorage` (`gasol.calculadoras`), con
`try/catch`: sin almacenamiento la página funciona igual. Sin consejo fiscal ni legal.

## Firma, aviso legal y opiniones

- Pie de todas las páginas: «Privacidad · Aviso legal», botón «Enviar opinión»
  (`mailto:comercial@whitemoon.es`, asunto «Opinión Gasol-IA beta»; constante en
  `assets/config.js`) y logo 3D de WhiteMoon (`whitemoon-logo-3d.webp`, 3,6 KB, con PNG de
  respaldo de 15,5 KB; 72×72 en pantalla, generado a 144 px desde el original que subió Cris,
  guardado en `assets/img/whitemoon-logo-3d-original.jpeg`) con «Desarrollado por WhiteMoon Agencia IA» enlazado a
  whitemoon.es. En la portada, firma y enlaces legales; en el inicio, una línea de beta con la
  opinión y la firma. Sin WhatsApp.
- `aviso-legal.html`: datos del titular copiados del aviso legal publicado de whitemoon.es
  (titular, domicilio, C.I.F. y correo), remisión a sus condiciones generales y secciones propias
  (precios oficiales con fecha de captura, beta gratuita sin garantía, ruta no verificada para
  camiones, atribución sin sugerir participación del Ministerio).
- `privacidad.html`: responsable = mismo titular (datos de la política de privacidad de
  whitemoon.es, sin teléfono), derechos y AEPD, y tratamiento de las opiniones por correo.
- Portada: el logo de Gasol-IA se sirve en WebP (28 KB frente a 372 KB) con prioridad alta.

## Combustibles alternativos

GNC, GNL, biogás comprimido y biogás licuado en el comparador, la ficha y favoritas, en €/kg
(unidad confirmada en el anexo de la Orden ITC/2308/2007; `docs/FUENTE-DATOS.md` §8). El GLP ya
estaba (€/l). Hidrógeno fuera (dos estaciones, precios muy dispares). La ruta, las calculadoras y
el control de gastos siguen solo con productos en litros. Recarga eléctrica: documentada como
pendiente con fuente, licencia y recomendación (§9).

## Vencimientos

`vencimientos.html` (menú y tarjeta del inicio). El usuario apunta tipo (ITV, seguro, revisión
del taxímetro, revista municipal, otro), descripción y vehículo opcionales, la fecha y con
cuántos días de antelación avisar (7, 15, 30 o 60). **La fecha la pone él**: la app no calcula ni
afirma plazos legales. Lista por fecha con vencidos (rojo), de hoy y próximos (ámbar). Al abrir
el inicio, un recuadro lista los vencidos y próximos (sin push ni servidor). «Hoy» es el día en
Madrid aunque el móvil esté en otra zona horaria. Editar, borrar con «Deshacer», exportar CSV y
borrar todo con confirmación. `localStorage` (`gasol.vencimientos`, máx. 500; respaldo en
`gasol.vencimientos.respaldo` de lo que no se entienda).

## Control de gastos

`gastos.html` (menú y primera tarjeta del inicio). El usuario apunta repostajes: fecha, litros,
importe, combustible, cuentakilómetros (opcional) y turno o vehículo (opcional). Con sus datos:
totales y precio medio pagado; por turno o vehículo con coste por km (entre la primera y la
última lectura del cuentakilómetros: importes posteriores a la primera ÷ km recorridos); por día;
por mes. Filtro por mes. Editar, borrar con «Deshacer», exportar CSV (`;` y coma decimal, sin
fórmulas) y «Borrar mis datos» con confirmación en la página. Se guarda en `localStorage`
(`gasol.gastos`, máx. 5.000). La validación solo frena errores de tecleo. Resumen informativo:
ni declaración ni consejo fiscal.

## Facturación

Petición de los taxistas de la beta. `ingresos.html` (menú «Facturación» y enlace dentro de la
tarjeta de Control de gastos del inicio).
- **Calendario mensual** (desde el 18/10/2026, sustituye a la lista de días): cuadrícula de lunes a
  domingo (cabecera L M X J V S D, huecos al principio y al final), mes anterior/siguiente (no pasa
  del mes actual) y botón «Hoy». Cada día es un botón de 52 px de alto que cabe a 390 px: número y,
  si hay datos, el total en euros enteros («<1 €» si solo hay céntimos), fondo más claro y barra
  verde; sin datos, neutro. Hoy: borde discontinuo y número subrayado. Elegido: verde con texto y
  borde blancos. Días futuros atenuados y no se abren. `table role="grid"`, `aria-label` completo
  por día («miércoles 14 de octubre, 3 carreras y 1 total sin detallar, total 112,51 €» / «sin
  carreras»), `aria-current="date"` en hoy, `aria-selected` en el elegido y foco itinerante:
  flechas (día y semana), Inicio/Fin (semana) y RePág/AvPág (mes). Totales del mes con las cuatro
  columnas y los subtotales «Efectivo en mano (calle + app)» y «Cobrado por banco, datáfono o app».
- **Detalle del día** (debajo del calendario; con el dedo o el ratón la vista baja hasta él, con el
  teclado el foco sigue en el día): total exacto y nº de carreras, lista (hora, canal o aplicación,
  método e importe) con Editar y Borrar + «Deshacer». Formulario «+ Carrera»: Calle/Aplicación;
  efectivo o tarjeta; o aplicación (texto libre con atajos de las del usuario, ninguna
  preinstalada) y cobrado por la app o efectivo en mano; importe con teclado numérico; hora de
  Madrid automática y editable; nota opcional. Tras guardar, la casilla se actualiza y el detalle
  sigue abierto, listo para la siguiente con el mismo canal, cobro y aplicación. «Añadir total sin
  detallar»: línea sin hora que suma al día pero no cuenta como carrera.
- **Con tus gastos** (etiquetado «tus datos», informativo): facturación del mes menos los
  repostajes del mes de Control de gastos, y facturación por km si hay dos lecturas del
  cuentakilómetros en el mes.
- **Tus aplicaciones**: añadir y quitar nombres (quitar no cambia carreras ya apuntadas).
- Exportar CSV del mes (una fila por carrera: fecha, hora, canal, aplicación, método, importe y las
  cuatro columnas; `;`, coma decimal, sin fórmulas) y «Borrar mis datos» con confirmación en la
  página (no toca los gastos).
- `localStorage` `gasol.ingresos` con versión (`{v: 1, carreras, apps}`, máx. 20.000 carreras y
  30 aplicaciones). Si lo guardado no se entiende (corrupto o de una versión futura), se copia
  intacto a `gasol.ingresos.respaldo` antes de escribir. No se tocan las demás claves.
- Aviso visible arriba y abajo: «Resumen informativo con tus propios datos. No es una declaración
  ni asesoramiento fiscal.» Sin IVA, IRPF ni cuotas. «Al volante, no: apunta la carrera cuando
  estés parado.» Validación solo de tecleo: importe mayor que 0 y hasta 10.000 € con un solo
  separador decimal (coma o punto) y hasta 2 decimales; hora HH:MM; textos con límite. Bajo los
  totales, la nota «Carreras: solo las detalladas» (un total sin detallar no cuenta como carrera).

## Ficha de estación

Cada estación del comparador, la ruta y favoritas es una ficha plegable (`<details>`, accesible con
teclado). Resumen: rótulo, precio del combustible elegido con su captura, distancia (en línea
recta en «Cerca de mí»; km de la ruta y desvío en la ruta) y etiquetas. Al abrirla se piden a
`gasol-buscar?ficha=` (función `gasol_fichas`) la dirección completa (dirección, C.P., localidad,
municipio, provincia) y los precios de la estación: Gasóleo A y Premium, Diésel renovable,
Gasolina 95 E5, 95 E5 Premium y 98 E5, GLP y AdBlue, solo los que tienen precio, cada uno con
fecha y hora de captura y el elegido destacado. Horario tal cual lo publica la estación con el
indicador de 24 h de siempre. «Cómo llegar» con Google Maps y Waze por coordenadas, estrella de
favoritas y atribución con fecha. La fuente no trae teléfono (`docs/FUENTE-DATOS.md` §7).

## Inicio, favoritas y preferencias

- Portada → «Entrar» → `inicio.html`: tarjeta destacada «Comparar precios por provincia o cerca de
  mí» a ancho completo y, debajo, Control de gastos, Facturación, Vencimientos, Planificador de rutas,
  Favoritas y preferencias y Calculadora de repostaje (abre la del depósito). Cada tarjeta es un solo
  enlace con icono SVG, título, texto y chevron; 1 columna a 390 px y 2 desde 600 px. El logo del
  menú lleva a `inicio.html`.
- `favoritas.html`: estrella «Favorita» con icono SVG de contorno o relleno (botón de 44 px con
  `aria-pressed`) en el comparador y en
  la ruta. Se guarda solo en el navegador (`gasol.favoritas`, máx. 50): ID oficial, rótulo,
  dirección, municipio y provincia; nunca coordenadas ni la ubicación del usuario. La lista pide el
  último precio por ID a `gasol-buscar?ids=` (función SQL `gasol_estaciones_por_id`, mismas columnas
  y misma `abierta_24h` que el comparador), con fecha de captura, fuente y atribución.
- Preferencias (`gasol.preferencias`): combustible habitual, radio de «Cerca de mí» y distancia a la
  ruta. Son el valor inicial del comparador (si la URL no trae otro) y de la ruta (una ruta guardada
  los sustituye).
- «Borrar mis datos» con confirmación en la página: borra favoritas y preferencias.
- Sincronización con cuenta preparada (`sincronizarFavoritas`) y apagada mientras `CUENTAS = false`.

## Pendiente de decidir o de hacer

- Si se publican las páginas generadas, añadir viewport-fit=cover en scripts/generar_paginas.py.
- **Comprobar el resumen de Telegram el 25/10/2026 y el 26/10/2026 a las 08:00** (primer día de
  horario de invierno: debe salir a las 07:00 UTC; decisión 119).
- `gasol_uso_demo` (y su función `gasol_uso_demo_ruta`): ya no se usa desde el tope por hora y día
  (`gasol_uso_ruta`, decisión 110). Pendiente de `DROP` manual, solo con confirmación de Cris.
- Conocido y sin tocar: sin conexión, el service worker devuelve la portada para páginas abiertas
  con parámetros en la URL (p. ej. `instalar.html?x`), porque la caché guarda la página sin ellos.

- **Alertas de precio**: no se hacen todavía. Requieren cuentas y el proyecto Supabase propio
  (avisos push con VAPID, `gasol-alertas`, ya escrito y sin desplegar).

- **`gasol-cuenta` retirada (18/10/2026)**: desplegada como v2 que responde 410 a todo, sin tocar
  Auth ni la base (antes permitía registrarse en el Auth compartido; 0 perfiles creados). Falta
  **borrarla** del proyecto compartido: el conector de Supabase no tiene esa operación; se hace en
  el panel de Supabase (Edge Functions → gasol-cuenta → Delete) o con
  `supabase functions delete gasol-cuenta --project-ref mlaqtniujnvfxcvcourm`. El código original
  sigue en `supabase/functions/gasol-cuenta/` para el proyecto propio: **no redesplegarlo aquí**.
- Las tablas de cuentas (`gasol_perfiles`, `gasol_rutas`, `gasol_push_suscripciones`,
  `gasol_avisos`, `gasol_uso`) y los secretos VAPID de Vault ya existen en el proyecto compartido
  (migraciones `20261018100000` y `20261018101000`). Están vacías. Al pasar al proyecto propio se
  aplican allí; retirarlas del compartido requiere `DROP` y se haría a mano, con confirmación.
- Ruta, calculadoras y control de gastos en kg y kg/100 km para los gases: **aplazado**; se
  decide según lo que digan los taxistas en la beta.
- Puntos de recarga eléctrica: **aplazado**. Sin precios ni disponibilidad aporta poco; queda
  documentado (`docs/FUENTE-DATOS.md` §9).
- Proveedor de rutas para producción con perfil de camión (hoy OSRM demo, perfil turismo).
- Teselas de mapa con condiciones para tráfico real (hoy OpenStreetMap).
- Licencia comercial de los datos oficiales (`docs/FUENTE-DATOS.md`): pendiente. **No bloquea
  la beta gratuita con `noindex`**; se resuelve antes de cobrar o de indexar. No se ha enviado
  todavía la consulta al Ministerio.

## Verificación de esta versión

- `deno test supabase/functions assets/*.test.js`: 105 OK (12 de facturación y calendario). `python -m unittest`: 7 OK.
- Pruebas reales contra la base (captura del 17/10/2026, 23:12):
  - Madrid → Valencia (353,1 km): 142 / 214 / 399 / 625 estaciones con 1 / 2 / 5 / 10 km.
  - Getafe → Alcalá de Henares (45,4 km): 67 / 113 / 240 / 437.
  - Solo 24 h: todas las devueltas llevan «Abierta 24 h».
  - Muestra de 10 estaciones contra el servicio oficial: 9 iguales; la otra cambió de precio
    después de nuestra captura.
- Móvil 390 px: sin desbordamiento horizontal y sin errores de consola en `index`, `ruta`,
  `cuenta` y `privacidad`.
- Lighthouse móvil (`index`, `ruta`, `privacidad`): rendimiento, accesibilidad y buenas
  prácticas en 100. SEO en 60 solo por el `noindex` (buscado).
- Calculadoras (18/10/2026): capturas a 390 px de las 5 (`docs/capturas/calc-*.png`), sin
  desbordamiento ni errores de consola; Lighthouse móvil 100/100/100 (SEO 60 por `noindex`);
  precio de zona contra el servicio oficial (Getafe y Zaragoza gasóleo A, Sevilla gasolina 95):
  12 de 12 iguales.
- Favoritas e inicio (18/10/2026): flujo portada → Entrar → inicio → cada tarjeta; estrella en
  comparador y ruta; precios, 24 h y capturas en favoritas; preferencias aplicadas; borrar; datos
  corruptos y almacenamiento bloqueado sin errores. 8 páginas a 390 px sin desbordamiento ni errores
  de consola. Lighthouse móvil `inicio`, `favoritas`, `ruta`: 100/100/100 (SEO 60 por `noindex`).
  Precios por ID contra el servicio oficial (Getafe, Valdemoro, Zaragoza): 15 de 15 iguales.
- Ficha (18/10/2026): abierta y cerrada en comparador (zona y «Cerca de mí» con AdBlue), ruta y
  favoritas; teclado; 0 desbordamiento con todas las fichas abiertas; 0 errores de consola.
  Lighthouse móvil `comparador` 99, `ruta` y `favoritas` 100 (accesibilidad y buenas prácticas
  100). Contraste de 50 precios en 10 fichas: iguales al oficial de la fecha de captura.
- Firma (18/10/2026): 11 páginas a 390 px con firma, logo WebP cargado, aviso legal enlazado y
  mailto correcto; sin WhatsApp ni teléfono; sin desbordamiento; 0 errores de consola. Lighthouse
  móvil portada, inicio, aviso legal, privacidad y comparador: 100/100/100 (la portada bajaba a
  92 por el logo PNG de 372 KB; con WebP, 100).
- Gas (18/10/2026): comparador con GNC, GNL y biogás licuado en Madrid («por kg»), ficha y
  popup del mapa en €/kg, preferencia de gas aplicada en comparador y favoritas e ignorada en la
  ruta; 0 errores de consola. Contraste con el histórico oficial del 17/10: 241/241 precios.
- Vencimientos (18/10/2026): alta con errores frenados, estados vencido/hoy/próximo/al día,
  editar, borrar y deshacer, aviso en el inicio, CSV, borrar todo, corruptos y sin
  almacenamiento; con el navegador en `Pacific/Pago_Pago` (otro día) «hoy» sigue siendo el de
  Madrid. 10 páginas a 390 px sin desbordamiento; 0 errores de consola. Lighthouse móvil
  `vencimientos` e `inicio` 100/100/100.
- Gastos (18/10/2026): alta con errores de tecleo frenados, resumen por turno, día y mes
  comprobado a mano, editar, borrar y deshacer, CSV descargado, borrar todo, datos corruptos y
  almacenamiento bloqueado; 390 px sin desbordamiento (tampoco dentro de las tablas); 0 errores
  de consola. Lighthouse móvil `gastos` e `inicio` 100/100/100.
- Facturación (18/10/2026): tests con casos a mano (día con calle efectivo y tarjeta, dos apps con
  las dos formas de cobro y un total sin detallar: 111,45 €, 7 carreras, efectivo en mano 65,20 €,
  cobrado por banco/app 46,25 €; cambio de mes con carreras el 30/09 a las 23:50 y el 01/10;
  octubre con 29 días sin carreras; febrero de 28 y 29 días; migración desde lista sin versión,
  JSON roto y versión futura con respaldo). En el navegador, el mismo día metido con el formulario
  da las mismas cifras; editar, borrar y deshacer, cambio de mes, «+ Carrera hoy», teclado,
  aplicaciones, confirmación de borrado y cruce con gastos (0,124 €/km con 900 km) comprobados.
  Captura a 390 px con el día desplegado (`docs/capturas/ingresos-dia-abierto.png`). 9 páginas a
  390 px sin desbordamiento con el menú nuevo; 0 errores de consola. Lighthouse móvil `ingresos` e
  `inicio` 100/100/100 (SEO 63 por `noindex`; `ingresos` bajaba a 85 por CLS 0,29 al pintar los
  días, corregido reservando altura).
- Resumen por Telegram (18/10/2026): `gasol-resumen` desplegada y cron `gasol-resumen-diario`
  (`0 6,7 * * *`, filtro de las 08:00 de Madrid), migración `20261018220000` (decisiones 117-119).
  Sin clave o con clave falsa, 401. Prueba manual lanzada desde la base con la clave de Vault: 200,
  Telegram aceptó el mensaje del 17/10 (todo «sin datos»: las tablas se crearon el 18/10).
- Contador de aperturas (18/10/2026): `gasol-visita` desplegada; tablas `gasol_visitas` y
  `gasol_visitas_hora` (migración `20261018210000`), tope de 300 por hora (decisiones 113-116).
  Función SQL probada en una transacción deshecha (ok, tope, inválidas). Con la función desplegada:
  válida 204 con CORS, página fuera de lista 400, preflight 200. En local no se envía nada y no se
  guarda nada en el navegador; 13 páginas a 390 px sin desbordamiento; Lighthouse móvil privacidad e
  inicio 100/100/100. Texto en privacidad. El contador incluye las aperturas de estas pruebas.
- Límite de rutas (18/10/2026): `gasol-ruta` desplegada con topes de 60/hora y 500/día
  (`gasol_uso_ruta`, migración `20261018200000`); cliente con 20/día por dispositivo, 5 s entre
  pulsaciones y un cálculo cada vez (decisiones 109-112). Con la función desplegada: cálculo normal
  Madrid → Getafe (17 km, 45 estaciones); 429 de la hora y del día con CORS y su aviso; pausa; tope
  del dispositivo sin llamar al servidor; comparador, favoritas y facturación siguen funcionando.
  Los contadores se subieron a mano para provocar los 429 y se devolvieron a los 6 intentos reales.
  Prueba de la función SQL en una transacción deshecha. 13 páginas a 390 px sin desbordamiento;
  Lighthouse móvil `ruta` e `inicio` 100/100/100; 0 errores de consola. Enlace «fix the map» en la
  atribución de la ruta.
- Guía de instalación (18/10/2026): `instalar.html` (decisiones 105-108). Con un iPhone simulado
  sale primero el bloque de Safari y, con la app «instalada» simulada, «Ya la tienes instalada».
  Funciona sin conexión una vez cargada (servidor parado: página, estilos, menú e iconos desde la
  caché). 13 páginas a 390 px sin desbordamiento; Lighthouse móvil `instalar`, portada e inicio
  100/100/100, CLS 0; 0 errores de consola. Captura `docs/capturas/instalar.png`.
- Etiqueta Beta (18/10/2026): «Beta» junto al nombre en las 12 páginas (CSS) y nota de beta con
  «Enviar opinión» en la portada y en el panel «Más» (decisiones 103-104). 12 páginas a 390 px sin
  desbordamiento; 0 errores de consola; Lighthouse móvil portada, inicio y privacidad 100/100/100,
  CLS 0. Capturas `docs/capturas/beta-portada.png` y `beta-panel.png`.
- CSP en Privacidad (18/10/2026): `privacidad.html` ya tiene el CSP de las demás páginas
  (decisión 101); estilos y menú de móvil sin violaciones de CSP ni errores de consola; Lighthouse
  móvil 100/100/100.
- Revista municipal (18/10/2026): el tipo «Licencia o autorización» pasa a «Revista municipal»
  (decisiones 99-100). Un dato guardado con el tipo antiguo se ve y se guarda como revista municipal
  con su vehículo y antelación; aparece en el aviso del inicio; CSV con «Revista municipal». Tests
  108 OK. Captura `docs/capturas/vencimientos-revista.png`; 12 páginas a 390 px sin desbordamiento;
  0 errores de consola.
- Menú tipo app (18/10/2026): por debajo de 900 px, barra fija inferior (Inicio, Comparador, Ruta,
  Facturación, Más) y panel «Más» (Gastos, Calculadoras, Favoritas, Vencimientos, «Enviar opinión»,
  Privacidad y Aviso legal); desde 900 px, la barra superior de píldoras. Un solo componente en
  `assets/nav.js`, que lo inyecta en las 11 páginas con cabecera (la portada no lleva menú). Teclado:
  el foco entra en el panel y queda atrapado; Escape, el botón de cerrar, pulsar fuera y navegar lo
  cierran y el foco vuelve a «Más». En las 11 páginas el pie queda por encima de la barra; 12 páginas
  sin desbordamiento a 390 px; 0 errores de consola. Contraste: etiquetas 8,04:1 (inactiva) y
  15,39:1 (actual), icono actual 5,02:1, filas del panel 16,95:1. Capturas
  `docs/capturas/menu-antes-*.png` y `menu-despues-*.png`. Lighthouse móvil inicio, comparador, ruta,
  facturación, gastos y privacidad: rendimiento 99-100, accesibilidad 100, buenas prácticas 100,
  CLS 0. `<meta name="referrer" content="strict-origin-when-cross-origin">` en las 12 páginas.
- Iconos, tarjetas y alturas (18/10/2026): sin emojis en HTML, JS ni CSS (quedan «→» en comentarios
  y en el resumen «Origen → Destino» de la ruta, que es texto). Sprite `assets/iconos.svg`
  (12 iconos) y `assets/iconos.js` para el DOM creado desde JS. 12 páginas a 390 px sin
  desbordamiento y con el pie abajo; capturas antes/después en `docs/capturas/v2-antes-*.png` y
  `v2-despues-*.png` (portada, inicio, comparador, ruta, facturación, gastos). Contraste nuevo:
  título 9,95:1, texto 8,04:1, destacada 5,02:1. Lighthouse móvil de esas seis: rendimiento 99-100,
  accesibilidad 100, buenas prácticas 100, CLS 0, 0 errores de consola.
- Calendario de facturación (18/10/2026): tests de meses de 28, 29, 30 y 31 días, mes que empieza
  en domingo (febrero y marzo de 2026), cambio a hora de invierno del 25/10/2026 (la hora repetida y
  la medianoche del 26 caen en su día), fin de mes y casilla con céntimos («<1 €», etiqueta con
  0,45 €). En el navegador: alta en el 14 y el 13, casilla actualizada al momento, detalle abierto,
  flechas/Inicio/Fin/RePág/AvPág, borrar y deshacer, mes anterior y «Hoy»; febrero de 2026 con el 1
  en domingo. Captura `docs/capturas/facturacion-calendario.png` a 390 px (casillas de 46 × 52 px),
  sin desbordamiento; 0 errores de consola. Lighthouse móvil `ingresos` e `inicio` 100/100/100
  (CLS 0; SEO 63 por `noindex`).
- Barra en una fila y opciones (18/10/2026): 12 páginas a 390 px sin desbordamiento; página actual
  centrada (o lo más cerca posible en los extremos) y visible al cargar; el foco con teclado desplaza
  solo la barra. Opción elegida 5,02:1. Capturas antes/después `docs/capturas/nav-antes-*.png` y
  `nav-despues-*.png`. Lighthouse móvil comparador, facturación, vencimientos e inicio 100/100/100,
  contraste y tamaño táctil OK, 0 errores de consola.
- Botones verdes (18/10/2026): texto blanco sobre verde 5,02 / 7,13 / 9,11:1 y sobre rojo 5,62 /
  6,47 / 8,31:1, medidos también en el navegador. 12 páginas a 390 px sin desbordamiento y todos
  los botones de al menos 44×44. Capturas `docs/capturas/botones-*.png` (portada, inicio,
  comparador, ruta, facturación, gastos). Lighthouse móvil de esas seis: 100/100/100, contraste y
  tamaño táctil OK, 0 errores de consola (SEO 63 por `noindex`).
- Texto de posicionamiento (18/10/2026): «Servicio de transporte de pasajeros y de mercancías» en
  lugar de «conductores profesionales» y la lista de vehículos (decisión 76). Capturas a 390 px
  (`docs/capturas/posicionamiento-portada.png`, `posicionamiento-inicio.png`), sin desbordamiento
  ni errores de consola. Lighthouse móvil portada, inicio y comparador 100/100/100 (SEO 63 por
  `noindex`).
- Posicionamiento (18/10/2026): textos de portada, inicio, comparador y manifiesto para
  conductores profesionales. Lighthouse móvil portada 100/100/100 (antes fallaba con `NO_FCP`
  por la animación de opacidad), inicio y comparador 100/100/100.
- Corregido: «Repostar aquí» desmarcaba también las estrellas de favoritas de la ruta.
- Corregido: el enlace «Cuenta» y la casilla de avisos de la ruta se veían aunque `CUENTAS = false`
  (las clases con `display` anulaban `hidden`). Ahora `[hidden]` siempre oculta.
- **URL pública verificada tras fusionar (#2, 18/10/2026):** el planificador carga, Madrid →
  Valencia y Getafe → Alcalá calculan con 1/2/5/10 km, guardar/cargar/borrar en el navegador
  funciona, sin desbordamiento a 390 px y sin errores de consola.

# Estado — 18/10/2026

Demo pública: <https://nexusforgeia.github.io/GASOL-IA/> (GitHub Pages desde `main`, `noindex`).
Backend: proyecto Supabase compartido `mlaqtniujnvfxcvcourm` (prefijo `gasol_*`), a la espera
del proyecto Supabase propio de Gasol-IA.

| Fase | Estado |
| --- | --- |
| 0 · Fuente de datos | Hecha. Licencia comercial pendiente de confirmar (`docs/FUENTE-DATOS.md`). |
| 1 · Comparador | Hecha y publicada. |
| 2 · Ruta y corredor | **En demo, sin cuentas.** Ver abajo. |
| Calculadoras | **Publicadas** (`calculadoras.html`), sin servidor. Ver abajo. |
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
  `GET ?listado=lugares` da la lista de municipios. Límite global de 500 cálculos al día
  (`gasol_uso_demo`: solo día y recuento, sin usuario ni IP) para no abusar del servidor
  público de OSRM.

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

- Portada → «Entrar» → `inicio.html`: tres tarjetas (Planificador de rutas, Favoritas y preferencias,
  Calculadora de repostaje, que abre la del depósito) y un acceso al comparador. El logo del menú
  lleva a `inicio.html`.
- `favoritas.html`: estrella «☆ Favorita» (botón de 44 px con `aria-pressed`) en el comparador y en
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

- **Alertas de precio**: no se hacen todavía. Requieren cuentas y el proyecto Supabase propio
  (avisos push con VAPID, `gasol-alertas`, ya escrito y sin desplegar).

- **`gasol-cuenta` está desplegada (v1) en el proyecto compartido** desde la sesión anterior,
  aunque la web ya no la enlaza. Es pública y permite registrarse en el Auth compartido.
  Hay que decidir si se elimina hasta tener el proyecto propio.
- Las tablas de cuentas (`gasol_perfiles`, `gasol_rutas`, `gasol_push_suscripciones`,
  `gasol_avisos`, `gasol_uso`) y los secretos VAPID de Vault ya existen en el proyecto compartido
  (migraciones `20261018100000` y `20261018101000`). Están vacías. Al pasar al proyecto propio se
  aplican allí; retirarlas del compartido requiere `DROP` y se haría a mano, con confirmación.
- Proveedor de rutas para producción con perfil de camión (hoy OSRM demo, perfil turismo).
- Teselas de mapa con condiciones para tráfico real (hoy OpenStreetMap).
- Licencia comercial de los datos oficiales (`docs/FUENTE-DATOS.md`).

## Verificación de esta versión

- `deno test supabase/functions assets/calculos.test.js assets/favoritas.test.js assets/ficha.test.js`: 74 OK. `python -m unittest`: 7 OK.
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
- Corregido: «Repostar aquí» desmarcaba también las estrellas de favoritas de la ruta.
- Corregido: el enlace «Cuenta» y la casilla de avisos de la ruta se veían aunque `CUENTAS = false`
  (las clases con `display` anulaban `hidden`). Ahora `[hidden]` siempre oculta.
- **URL pública verificada tras fusionar (#2, 18/10/2026):** el planificador carga, Madrid →
  Valencia y Getafe → Alcalá calculan con 1/2/5/10 km, guardar/cargar/borrar en el navegador
  funciona, sin desbordamiento a 390 px y sin errores de consola.

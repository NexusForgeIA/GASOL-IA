# Estado — 18/10/2026

Demo pública: <https://nexusforgeia.github.io/GASOL-IA/> (GitHub Pages desde `main`, `noindex`).
Backend: proyecto Supabase compartido `mlaqtniujnvfxcvcourm` (prefijo `gasol_*`), a la espera
del proyecto Supabase propio de Gasol-IA.

| Fase | Estado |
| --- | --- |
| 0 · Fuente de datos | Hecha. Licencia comercial pendiente de confirmar (`docs/FUENTE-DATOS.md`). |
| 1 · Comparador | Hecha y publicada. |
| 2 · Ruta y corredor | **En demo, sin cuentas.** Ver abajo. |
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

## Pendiente de decidir o de hacer

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

- `deno test supabase/functions assets/calculos.test.js`: 49 OK. `python -m unittest`: 7 OK.
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
- **URL pública verificada tras fusionar (#2, 18/10/2026):** el planificador carga, Madrid →
  Valencia y Getafe → Alcalá calculan con 1/2/5/10 km, guardar/cargar/borrar en el navegador
  funciona, sin desbordamiento a 390 px y sin errores de consola.

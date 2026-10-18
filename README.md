# Gasol-IA

App para el servicio de transporte de pasajeros y de mercancías: control del gasto
en combustible y precios de carburantes en su zona y en su ruta, con filtro de gasolineras
abiertas 24 horas.

Precios procedentes del servicio oficial del Ministerio para la Transición
Ecológica y el Reto Demográfico, mostrados siempre con la fecha y hora de la
captura. Ver [`docs/FUENTE-DATOS.md`](docs/FUENTE-DATOS.md).

Productos: gasóleos, gasolinas, diésel renovable, GLP y AdBlue en €/l; GNC, GNL y biogás en
€/kg (unidades confirmadas en la orden oficial de remisión). Hidrógeno y puntos de recarga
eléctrica, pendientes (ver `docs/FUENTE-DATOS.md` §8 y §9).

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` (portada), `inicio.html`, `comparador.html`, `ruta.html`, `calculadoras.html`, `favoritas.html`, `gastos.html`, `ingresos.html`, `vencimientos.html`, `instalar.html`, `assets/`, `sw.js` | PWA: inicio, comparador, planificador de ruta, calculadoras, favoritas, control de gastos, facturación, vencimientos y guía de instalación (vanilla JS). Iconos SVG propios en `assets/iconos.svg`; menú tipo app en móvil (barra inferior y panel «Más») inyectado por `assets/nav.js` |
| `supabase/migrations/` | Esquema `gasol_*` (aplicado) |
| `supabase/functions/gasol-ingest/` | Carga diaria del JSON oficial |
| `supabase/functions/gasol-buscar/` | Lectura pública para la web (también precios por ID para favoritas y la ficha de estación) |
| `supabase/functions/gasol-visita/` | Contador de aperturas por día, página y modo (aperturas, no personas; sin IP ni identificadores) |
| `supabase/functions/gasol-ruta/` | Ruta y corredor (pública en la demo), con topes de cálculos por hora y día en `limites.ts` |
| `scripts/generar_paginas.py` | Páginas estáticas por provincia y municipio |
| `scripts/generar_iconos.py` | Iconos provisionales de la PWA |
| `docs/` | Informe de la fuente de datos y decisiones |

## Desarrollo

```bash
deno test supabase/functions assets/*.test.js   # horarios, normalización, corredor, calculadoras, favoritas, ficha, gastos, facturación y su calendario, vencimientos y fechas
python scripts/generar_paginas.py                         # genera gasolineras/ y sitemap.xml
python -m unittest discover -s scripts -p "test_*.py"     # slugs, hora y JSON-LD de las páginas; nota de beta
python -m http.server 8080            # sirve la PWA en local
```

Desarrollado por [WhiteMoon Agencia IA](https://whitemoon.es). Titular, aviso legal y
privacidad: los mismos que whitemoon.es (`aviso-legal.html`, `privacidad.html`). Opiniones de la
beta: comercial@whitemoon.es.

Reglas del proyecto en [`CLAUDE.md`](CLAUDE.md).

Dirección oficial: **<https://nexusforgeia.github.io/GASOL-IA/>** (GitHub Pages). Cada fusión en `main`
se despliega sola, sin compilación. Netlify está descartado.

Estado actual: [`docs/ESTADO.md`](docs/ESTADO.md). Decisiones y lo pendiente de revisar: [`docs/DECISIONES.md`](docs/DECISIONES.md).

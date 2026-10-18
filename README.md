# Gasol-IA

App para conductores profesionales (taxi, VTC, furgoneta y camión): control del gasto
en combustible y precios de carburantes en su zona y en su ruta, con filtro de gasolineras
abiertas 24 horas.

Precios procedentes del servicio oficial del Ministerio para la Transición
Ecológica y el Reto Demográfico, mostrados siempre con la fecha y hora de la
captura. Ver [`docs/FUENTE-DATOS.md`](docs/FUENTE-DATOS.md).

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` (portada), `inicio.html`, `comparador.html`, `ruta.html`, `calculadoras.html`, `favoritas.html`, `gastos.html`, `assets/`, `sw.js` | PWA: inicio, comparador, planificador de ruta, calculadoras, favoritas y control de gastos (vanilla JS) |
| `supabase/migrations/` | Esquema `gasol_*` (aplicado) |
| `supabase/functions/gasol-ingest/` | Carga diaria del JSON oficial |
| `supabase/functions/gasol-buscar/` | Lectura pública para la web (también precios por ID para favoritas y la ficha de estación) |
| `supabase/functions/gasol-ruta/` | Ruta y corredor (pública en la demo) |
| `scripts/generar_paginas.py` | Páginas estáticas por provincia y municipio |
| `scripts/generar_iconos.py` | Iconos provisionales de la PWA |
| `docs/` | Informe de la fuente de datos y decisiones |

## Desarrollo

```bash
deno test supabase/functions assets/*.test.js   # horarios, normalización, corredor, calculadoras, favoritas, ficha, gastos y fechas
python scripts/generar_paginas.py                         # genera gasolineras/ y sitemap.xml
python -m unittest discover -s scripts -p "test_*.py"     # slugs, hora y JSON-LD de las páginas
python -m http.server 8080            # sirve la PWA en local
```

Reglas del proyecto en [`CLAUDE.md`](CLAUDE.md).

Estado actual: [`docs/ESTADO.md`](docs/ESTADO.md). Decisiones y lo pendiente de revisar: [`docs/DECISIONES.md`](docs/DECISIONES.md).

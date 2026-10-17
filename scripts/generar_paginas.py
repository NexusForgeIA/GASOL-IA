"""Genera páginas estáticas por provincia y municipio + sitemap.xml.

Uso:
    python scripts/generar_paginas.py

Lee de la Edge Function pública gasol-buscar (la misma que usa la web), así que
no necesita ninguna clave. Escribe en gasolineras/ y sitemap.xml (ignorados por
git hasta decidir el despliegue).

Variables de entorno:
    GASOL_BASE_URL  URL pública del sitio (canonical y sitemap).
    GASOL_INDEXAR   "1" para quitar el noindex. Por defecto NO se indexa.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
import unicodedata
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1/gasol-buscar"
BASE_URL = os.environ.get("GASOL_BASE_URL", "https://nexusforgeia.github.io/GASOL-IA").rstrip("/")
INDEXAR = os.environ.get("GASOL_INDEXAR") == "1"
RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "gasolineras"

# Combustibles que se muestran en las páginas estáticas (orden de columnas).
COMBUSTIBLES = {"gasoleo_a": "Gasóleo A", "adblue": "AdBlue", "gasolina_95_e5": "Gasolina 95"}
ATRIBUCION = "Origen de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico"


# --- utilidades -------------------------------------------------------------
def slug(texto: str) -> str:
    """'CORUÑA (A)' -> 'a-coruna'; 'VALENCIA / VALÈNCIA' -> 'valencia'."""
    t = texto.split("/")[0].strip()
    m = re.match(r"^(.*)\s+\((\w+)\)$", t)
    if m:
        t = f"{m.group(2)} {m.group(1)}"
    t = unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "sin-nombre"


def titulo(texto: str) -> str:
    """'CORUÑA (A)' -> 'A Coruña'; respeta la parte en castellano de los bilingües."""
    t = texto.split("/")[0].strip()
    m = re.match(r"^(.*)\s+\((\w+)\)$", t)
    if m:
        t = f"{m.group(2)} {m.group(1)}"
    return " ".join(p[:1].upper() + p[1:].lower() if p.isupper() else p for p in t.split())


def e(texto: object) -> str:
    return html.escape(str(texto), quote=True)


def precio(p: float | None) -> str:
    return "—" if p is None else f"{p:.3f}".replace(".", ",") + " €/l"


def _ultimo_domingo(anio: int, mes: int) -> datetime:
    d = datetime(anio, mes + 1, 1, 1, tzinfo=timezone.utc) - timedelta(days=1)  # último día, 01:00 UTC
    return d - timedelta(days=(d.weekday() + 1) % 7)


def hora_peninsular(d: datetime) -> datetime:
    """UTC -> hora peninsular (CET/CEST, regla de la UE). Sin depender de tzdata en Windows."""
    d = d.astimezone(timezone.utc)
    verano = _ultimo_domingo(d.year, 3) <= d < _ultimo_domingo(d.year, 10)
    return d.astimezone(timezone(timedelta(hours=2 if verano else 1)))


def fecha_es(iso: str) -> str:
    return hora_peninsular(datetime.fromisoformat(iso)).strftime("%d/%m/%Y, %H:%M")


def ld(obj: dict) -> str:
    """JSON-LD seguro dentro de <script>."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def get(params: str) -> dict:
    with urllib.request.urlopen(f"{API}?{params}", timeout=60) as r:
        return json.load(r)


# --- datos ------------------------------------------------------------------
def cargar() -> tuple[list[dict], dict[str, dict[str, dict]]]:
    territorios = get("listado=territorios")["territorios"]
    provincias = sorted({t["id_provincia"] for t in territorios})
    trabajos = [(p, c) for p in provincias for c in COMBUSTIBLES]

    def bajar(args: tuple[str, str]) -> tuple[str, str, list[dict]]:
        prov, comb = args
        return prov, comb, get(f"combustible={comb}&provincia={prov}&limite=1000")["resultados"]

    estaciones: dict[str, dict[str, dict]] = defaultdict(dict)  # prov -> ideess -> estación
    with ThreadPoolExecutor(max_workers=6) as pool:
        for prov, comb, filas in pool.map(bajar, trabajos):
            if len(filas) >= 1000:
                sys.exit(f"Provincia {prov} {comb}: 1000 filas, puede estar truncada")
            for f in filas:
                est = estaciones[prov].setdefault(f["ideess"], {**f, "precios": {}})
                est["precios"][comb] = f["precio"]
    return territorios, estaciones


# --- plantillas -------------------------------------------------------------
def pagina(*, titulo_pag: str, descripcion: str, ruta: str, cuerpo: str, jsonld: list[dict], profundidad: int) -> str:
    raiz = "../" * profundidad
    robots = "index, follow" if INDEXAR else "noindex, follow"
    scripts = "\n".join(f'<script type="application/ld+json">{ld(x)}</script>' for x in jsonld)
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo_pag)}</title>
<meta name="description" content="{e(descripcion)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{e(BASE_URL + ruta)}">
<meta name="theme-color" content="#0d1013">
<link rel="icon" href="{raiz}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{raiz}assets/app.css">
{scripts}
</head>
<body>
<header class="cabecera"><div class="contenedor"><p class="marca"><a href="{raiz}">Gasol-IA</a></p></div></header>
<main class="contenedor">
{cuerpo}
</main>
<footer class="pie"><div class="contenedor">
<p>{ATRIBUCION} (servicio de precios de carburantes en estaciones terrestres). Cada precio indica la fecha y hora en que lo capturamos; puede haber cambiado desde entonces. El Ministerio no participa en esta web ni la patrocina.</p>
<p><a href="{raiz}privacidad.html">Privacidad</a></p>
</div></footer>
</body>
</html>
"""


def tarjeta(est: dict, con_municipio: bool, nivel: int = 3) -> str:
    chip = {"si": '<span class="chip si">Abierta 24 h</span>',
            "sin_confirmar": '<span class="chip duda">Horario sin confirmar</span>'}.get(est["abierta_24h"], "")
    precios = "".join(f"<li>{n} <strong>{precio(est['precios'][c])}</strong></li>"
                      for c, n in COMBUSTIBLES.items() if c in est["precios"])
    donde = titulo(est["direccion"]) + (f" · {est['municipio']}" if con_municipio else "")
    horario = e(est["horario_texto"]) if est["horario_texto"] else "Sin horario publicado"
    return f"""<li class="estacion simple">
<h{nivel}>{e(titulo(est['rotulo'] or 'Sin rótulo'))}</h{nivel}>
<p class="dir">{e(donde)}</p>
<ul class="precios-lista">{precios}</ul>
<p class="meta">{chip}<span>Horario oficial: {horario}</span></p>
</li>"""


def gas_station_ld(est: dict, url: str) -> dict:
    obj = {
        "@type": "GasStation",
        "name": titulo(est["rotulo"] or "Gasolinera"),
        "url": url,
        "address": {"@type": "PostalAddress", "streetAddress": titulo(est["direccion"]),
                    "addressLocality": est["municipio"], "addressRegion": titulo(est["provincia"]),
                    "addressCountry": "ES"},
        "geo": {"@type": "GeoCoordinates", "latitude": est["lat"], "longitude": est["lon"]},
    }
    if est["abierta_24h"] == "si":  # solo cuando el horario oficial lo dice sin ambigüedad
        obj["openingHours"] = "Mo-Su 00:00-23:59"
    return obj


def captura_de(ests: list[dict]) -> str:
    fechas = sorted({x["fecha_captura"] for x in ests})
    return fecha_es(fechas[-1]) if fechas else ""


# --- generación -------------------------------------------------------------
def generar() -> int:
    territorios, por_prov = cargar()
    nombres_prov = {t["id_provincia"]: t["provincia"] for t in territorios}
    urls: list[str] = []
    prov_slugs: dict[str, str] = {}
    for pid, nombre in sorted(nombres_prov.items(), key=lambda x: slug(x[1])):
        prov_slugs[pid] = slug(nombre)

    # Índice general
    items = "".join(f'<li><a href="{s}/">{e(titulo(nombres_prov[p]))}</a></li>' for p, s in
                    sorted(prov_slugs.items(), key=lambda x: x[1]))
    ruta = "/gasolineras/"
    escribir(SALIDA / "index.html", pagina(
        titulo_pag="Gasolineras por provincia · Gasol-IA",
        descripcion="Precios oficiales de gasóleo A, AdBlue y gasolina 95 por provincia, con fecha de captura y filtro de abiertas 24 horas.",
        ruta=ruta, profundidad=1, jsonld=[],
        cuerpo=f'<h1>Gasolineras por provincia</h1><ul class="lista-enlaces">{items}</ul>'))
    urls.append(ruta)

    for pid, pslug in prov_slugs.items():
        pnombre = titulo(nombres_prov[pid])
        ests = list(por_prov.get(pid, {}).values())
        muns = sorted({(t["id_municipio"], t["municipio"]) for t in territorios if t["id_provincia"] == pid},
                      key=lambda x: slug(x[1]))
        mun_slugs: dict[str, str] = {}
        for mid, mnombre in muns:
            s = slug(mnombre)
            mun_slugs[mid] = s if s not in mun_slugs.values() else f"{s}-{mid}"
        captura = captura_de(ests)
        baratas = sorted((x for x in ests if "gasoleo_a" in x["precios"]), key=lambda x: x["precios"]["gasoleo_a"])[:20]

        ruta = f"/gasolineras/{pslug}/"
        url_comp = f"../../?modo=zona&provincia={pid}&combustible=gasoleo_a"
        lista_muns = "".join(f'<li><a href="{mun_slugs[m]}/">{e(n)}</a></li>' for m, n in muns)
        cuerpo = f"""{migas_html([("Gasol-IA", "../../"), ("Provincias", "../"), (pnombre, None)])}
<h1>Gasolineras en {e(pnombre)}: precios de gasóleo A y AdBlue</h1>
<p class="estado">{len(ests)} estaciones con precio publicado. Precios de la captura del {e(captura)} (hora peninsular). Para la última captura disponible, usa el <a href="{e(url_comp)}">comparador</a>.</p>
<h2>Gasóleo A: las 20 más baratas de la provincia en esa captura</h2>
<ol class="lista">{''.join(tarjeta(x, True) for x in baratas)}</ol>
<h2>Municipios</h2>
<ul class="lista-enlaces">{lista_muns}</ul>"""
        jsonld = [
            breadcrumb([("Gasol-IA", "/"), ("Provincias", "/gasolineras/"), (pnombre, ruta)]),
            {"@context": "https://schema.org", "@type": "ItemList", "name": f"Gasolineras en {pnombre}",
             "itemListElement": [{"@type": "ListItem", "position": i + 1,
                                  "item": gas_station_ld(x, f"{BASE_URL}/gasolineras/{pslug}/{mun_slugs.get(x['id_municipio'], '')}/")}
                                 for i, x in enumerate(baratas)]},
        ]
        escribir(SALIDA / pslug / "index.html", pagina(
            titulo_pag=f"Gasolineras en {pnombre}: gasóleo A y AdBlue · Gasol-IA",
            descripcion=f"Precios oficiales de gasóleo A, AdBlue y gasolina 95 en {len(ests)} gasolineras de {pnombre}, con su fecha de captura y si abren 24 horas.",
            ruta=ruta, cuerpo=cuerpo, jsonld=jsonld, profundidad=2))
        urls.append(ruta)

        for mid, mnombre in muns:
            mslug = mun_slugs[mid]
            mests = sorted((x for x in ests if x["id_municipio"] == mid),
                           key=lambda x: (x["precios"].get("gasoleo_a", 99), x["ideess"]))
            ruta_m = f"/gasolineras/{pslug}/{mslug}/"
            url_comp_m = f"../../../?modo=zona&provincia={pid}&municipio={mid}&combustible=gasoleo_a"
            n24 = sum(1 for x in mests if x["abierta_24h"] == "si")
            cuerpo_m = f"""{migas_html([("Gasol-IA", "../../../"), ("Provincias", "../../"), (pnombre, "../"), (mnombre, None)])}
<h1>Gasolineras en {e(mnombre)} ({e(pnombre)})</h1>
<p class="estado">{len(mests)} estaciones con precio publicado, {n24} abiertas 24 h según su horario oficial. Precios de la captura del {e(captura_de(mests) or captura)} (hora peninsular), ordenados por gasóleo A. Para la última captura, usa el <a href="{e(url_comp_m)}">comparador</a>.</p>
<ol class="lista">{''.join(tarjeta(x, False, 2) for x in mests) or '<li class="estado">Sin estaciones con precio publicado de estos combustibles en esta captura.</li>'}</ol>"""
            jsonld_m = [
                breadcrumb([("Gasol-IA", "/"), ("Provincias", "/gasolineras/"), (pnombre, ruta), (mnombre, ruta_m)]),
                {"@context": "https://schema.org", "@type": "ItemList", "name": f"Gasolineras en {mnombre}",
                 "itemListElement": [{"@type": "ListItem", "position": i + 1,
                                      "item": gas_station_ld(x, BASE_URL + ruta_m)} for i, x in enumerate(mests)]},
            ]
            escribir(SALIDA / pslug / mslug / "index.html", pagina(
                titulo_pag=f"Gasolineras en {mnombre} ({pnombre}): precios · Gasol-IA",
                descripcion=f"{len(mests)} gasolineras en {mnombre}: precio oficial de gasóleo A, AdBlue y gasolina 95 con fecha de captura, y cuáles abren 24 horas.",
                ruta=ruta_m, cuerpo=cuerpo_m, jsonld=jsonld_m, profundidad=3))
            urls.append(ruta_m)

    hoy = hora_peninsular(datetime.now(timezone.utc)).date().isoformat()
    sitemap = "".join(f"<url><loc>{e(BASE_URL + u)}</loc><lastmod>{hoy}</lastmod></url>" for u in urls)
    escribir(RAIZ / "sitemap.xml",
             f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sitemap}</urlset>\n')
    return len(urls)


def migas_html(items: list[tuple[str, str | None]]) -> str:
    partes = [f'<a href="{e(u)}">{e(n)}</a>' if u else f'<span aria-current="page">{e(n)}</span>' for n, u in items]
    return f'<nav class="migas" aria-label="Migas de pan">{" › ".join(partes)}</nav>'


def breadcrumb(items: list[tuple[str, str]]) -> dict:
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": BASE_URL + r}
                                for i, (n, r) in enumerate(items)]}


def escribir(ruta: Path, contenido: str) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(contenido, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    n = generar()
    print(f"{n} páginas generadas en {SALIDA} · indexar={'sí' if INDEXAR else 'no (noindex)'}")

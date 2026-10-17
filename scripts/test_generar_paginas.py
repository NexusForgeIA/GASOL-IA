"""Tests del generador. Uso: python -m unittest discover -s scripts -p "test_*.py"

Los tests de páginas solo corren si gasolineras/ ya está generado.
"""
import json
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generar_paginas import SALIDA, fecha_es, ld, slug, titulo  # noqa: E402


class Slugs(unittest.TestCase):
    def test_articulo_entre_parentesis(self):
        self.assertEqual(slug("CORUÑA (A)"), "a-coruna")
        self.assertEqual(slug("PALMAS (LAS)"), "las-palmas")
        self.assertEqual(titulo("PALMAS (LAS)"), "Las Palmas")

    def test_bilingues_toman_la_primera_parte(self):
        self.assertEqual(slug("VALENCIA / VALÈNCIA"), "valencia")
        self.assertEqual(slug("ARABA/ÁLAVA"), "araba")

    def test_tildes_y_simbolos(self):
        self.assertEqual(slug("Alcalá de Henares"), "alcala-de-henares")
        self.assertEqual(slug("L'Hospitalet de Llobregat"), "l-hospitalet-de-llobregat")

    def test_hora_peninsular_verano_e_invierno(self):
        self.assertEqual(fecha_es("2026-10-17T20:52:26+00:00"), "17/10/2026, 22:52")
        self.assertEqual(fecha_es("2027-01-15T07:00:00+00:00"), "15/01/2027, 08:00")
        # Cambio de hora: último domingo de octubre de 2026 = día 25, a las 01:00 UTC.
        self.assertEqual(fecha_es("2026-10-25T00:59:00+00:00"), "25/10/2026, 02:59")
        self.assertEqual(fecha_es("2026-10-25T01:00:00+00:00"), "25/10/2026, 02:00")

    def test_jsonld_no_cierra_script(self):
        self.assertNotIn("</script", ld({"name": "</script><b>"}))


@unittest.skipUnless((SALIDA / "index.html").exists(), "páginas no generadas")
class Paginas(unittest.TestCase):
    paginas = sorted(SALIDA.rglob("index.html"))

    def test_jsonld_valido_y_metas(self):
        patron = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
        for p in self.paginas:
            html = p.read_text(encoding="utf-8")
            with self.subTest(pagina=str(p.relative_to(SALIDA))):
                self.assertIn('<meta name="robots" content="noindex, follow">', html)
                self.assertIn('<link rel="canonical" href="https://', html)
                self.assertRegex(html, r"<title>[^<]{10,}</title>")
                self.assertRegex(html, r'<meta name="description" content="[^"]{50,}">')
                self.assertIn("Origen de los datos: Ministerio", html)
                for bloque in patron.findall(html):
                    obj = json.loads(bloque)
                    self.assertEqual(obj["@context"], "https://schema.org")

    def test_cada_precio_con_fecha_de_captura(self):
        for p in self.paginas:
            html = p.read_text(encoding="utf-8")
            if "€/l" in html:
                self.assertRegex(html, r"captura del \d{2}/\d{2}/\d{4}, \d{2}:\d{2}")


if __name__ == "__main__":
    unittest.main()

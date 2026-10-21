"""La nota de beta de la portada (HTML sin JS) es la misma que AVISO_BETA de assets/config.js."""
import re
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


class NotaBeta(unittest.TestCase):
    def test_portada_igual_que_config(self):
        config = (RAIZ / "assets" / "config.js").read_text(encoding="utf-8")
        aviso = re.search(r'export const AVISO_BETA = "([^"]+)";', config).group(1)
        self.assertIn(aviso, (RAIZ / "index.html").read_text(encoding="utf-8"))
        self.assertNotRegex(aviso.lower(), r"en vivo|tiempo real")


class ListaPaginas(unittest.TestCase):
    def test_codigo_igual_que_migracion(self):
        ts = (RAIZ / "supabase" / "functions" / "gasol-visita" / "limites.ts").read_text(encoding="utf-8")
        bloque = re.search(r"PAGINAS = \[(.*?)\] as const", ts, re.S).group(1)
        codigo = re.findall(r'"([^"]+)"', bloque)
        sql = (RAIZ / "supabase" / "migrations" / "20261021160000_gasol_instalacion.sql").read_text(encoding="utf-8")
        listas = re.findall(r"pagina\s+not in \(([^)]*)\)|pagina in \(([^)]*)\)", sql)
        for a, b in listas:
            self.assertEqual(re.findall(r"'([^']+)'", a or b), codigo)
        self.assertEqual(len(listas), 2)
        self.assertEqual(len(codigo), 15)


if __name__ == "__main__":
    unittest.main()

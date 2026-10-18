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


if __name__ == "__main__":
    unittest.main()

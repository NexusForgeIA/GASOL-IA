"""Genera los iconos provisionales de la PWA (Pillow). Uso: python scripts/generar_iconos.py"""
from pathlib import Path

from PIL import Image, ImageDraw

FONDO = (13, 16, 19)
ACENTO = (61, 220, 132)
SALIDA = Path(__file__).resolve().parent.parent / "assets" / "icons"


def icono(lado: int, margen: float) -> Image.Image:
    """Gota con una flecha hacia abajo (precio a la baja), sobre fondo grafito."""
    im = Image.new("RGB", (lado, lado), FONDO)
    d = ImageDraw.Draw(im)
    s = lado * (1 - 2 * margen)
    ox = oy = lado * margen
    # Gota: círculo + triángulo superior.
    cx, cy, r = ox + s / 2, oy + s * 0.62, s * 0.32
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACENTO)
    d.polygon([(cx, oy + s * 0.08), (cx - r * 0.93, cy - r * 0.35), (cx + r * 0.93, cy - r * 0.35)], fill=ACENTO)
    # Flecha hacia abajo en el centro de la gota.
    w = r * 0.22
    d.rectangle([cx - w / 2, cy - r * 0.55, cx + w / 2, cy + r * 0.1], fill=FONDO)
    d.polygon([(cx - r * 0.42, cy + r * 0.05), (cx + r * 0.42, cy + r * 0.05), (cx, cy + r * 0.6)], fill=FONDO)
    return im


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    icono(192, 0.08).save(SALIDA / "icon-192.png", optimize=True)
    icono(512, 0.08).save(SALIDA / "icon-512.png", optimize=True)
    icono(512, 0.2).save(SALIDA / "icon-maskable-512.png", optimize=True)  # zona segura


if __name__ == "__main__":
    main()

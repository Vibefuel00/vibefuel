"""Render media/icon.png: an orange fuel pump on cream, no lightning bolt.

Uses only Pillow so the icon is reproducible without a browser or ImageMagick.
Run: python3 scripts/make-icon.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 512
SCALE = 4  # supersample for smooth edges
S = SIZE * SCALE
CREAM = (244, 235, 227, 255)
ORANGE = (234, 88, 12, 255)

# The mark is drawn on a 24 unit grid with a 1 unit margin on each side.
GRID = 26.0


def px(v: float) -> float:
    return (v + 1.0) / GRID * S


def ln(v: float) -> int:
    return int(round(v / GRID * S))


img = Image.new("RGBA", (S, S), CREAM)
d = ImageDraw.Draw(img)

# Pump body, window and base.
d.rounded_rectangle([px(2), px(1.5), px(14), px(21)], radius=ln(2.2), fill=ORANGE)
d.rounded_rectangle([px(4.5), px(4), px(11.5), px(9.5)], radius=ln(1.1), fill=CREAM)
d.rounded_rectangle([px(0.5), px(20), px(15.5), px(22.5)], radius=ln(1), fill=ORANGE)

# Hose: leaves the body near the top, runs down, U-turns and rises to the nozzle.
w = ln(1.7)
hose = [
    (px(14), px(5.5)),
    (px(18.5), px(5.5)),
    (px(18.5), px(17)),
    (px(22), px(17)),
    (px(22), px(11)),
]
d.line(hose, fill=ORANGE, width=w, joint="curve")
for (x, y) in (hose[0], hose[-1]):
    d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=ORANGE)

# Nozzle cap on top of the rising hose.
d.polygon(
    [
        (px(20.4), px(11.2)),
        (px(20.4), px(8.6)),
        (px(22), px(6.6)),
        (px(23.6), px(8.6)),
        (px(23.6), px(11.2)),
    ],
    fill=ORANGE,
)

img = img.resize((SIZE, SIZE), Image.LANCZOS)
out = Path(__file__).resolve().parent.parent / "media" / "icon.png"
img.save(out, "PNG")
print(f"wrote {out}")

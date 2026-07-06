#!/usr/bin/env python3
"""Generate PWA splash screens and favicon.ico from public/icon-512x512.png."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
ICON_PATH = PUBLIC / "icon-512x512.png"
BG = (251, 251, 249)  # #fbfbf9 — matches app background

SPLASH_SIZES = (
    (750, 1334),
    (828, 1792),
    (1125, 2436),
    (1536, 2048),
    (1668, 2388),
    (2048, 2732),
)


def make_splash(width: int, height: int, icon: Image.Image) -> Image.Image:
    canvas = Image.new("RGB", (width, height), BG)
    scale = int(min(width, height) * 0.28)
    resized = icon.resize((scale, scale), Image.Resampling.LANCZOS)
    x = (width - scale) // 2
    y = (height - scale) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


def main() -> None:
    icon = Image.open(ICON_PATH).convert("RGBA")

    for width, height in SPLASH_SIZES:
        out = PUBLIC / f"apple-splash-{width}-{height}.jpg"
        make_splash(width, height, icon).save(out, "JPEG", quality=90, optimize=True)
        print(f"Wrote {out.name}")

    icon.save(PUBLIC / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])
    print("Wrote favicon.ico")


if __name__ == "__main__":
    main()

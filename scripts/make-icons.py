#!/usr/bin/env python3
"""Regenerate ChatUltra web icon set from the new AI logo (v2)."""
from PIL import Image

SRC = "/home/z/my-project/public/logo-new.png"
OUT = "/home/z/my-project/public"

img = Image.open(SRC).convert("RGBA")

# full logo (same asset path the app already uses everywhere)
img.resize((512, 512), Image.LANCZOS).save(f"{OUT}/logo.png", optimize=True)

# favicon PNGs
for size, name in [(256, "favicon-256.png"), (64, "favicon-64.png"), (32, "favicon-32.png"), (16, "favicon-16.png")]:
    img.resize((size, size), Image.LANCZOS).save(f"{OUT}/{name}", optimize=True)

# apple touch icon (square, no transparency needed but fine)
img.resize((180, 180), Image.LANCZOS).save(f"{OUT}/apple-touch-icon.png", optimize=True)

print("icon set written: logo.png 512, favicon 256/64/32/16, apple-touch-icon 180")

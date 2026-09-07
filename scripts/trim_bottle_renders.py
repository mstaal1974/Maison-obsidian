#!/usr/bin/env python3
"""
Trim the transparent margins off the per-fragrance bottle renders.

The renders are uploaded as square canvases (e.g. 1080×1080) with the bottle
occupying roughly the middle third, which makes them tiny once `object-fit:
contain` fits the whole canvas into a portrait tile. This crops each
/assets/<slug>.png to its opaque bounding box plus a small uniform margin, so
the bottle fills the frame consistently across the catalogue.

Idempotent: re-running on an already-trimmed file is a no-op. Only PNGs whose
name matches a fragrance slug are touched; stock photography is left alone.

    pip install pillow
    python3 scripts/trim_bottle_renders.py [--dry-run]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
DATA = Path(__file__).resolve().parent.parent / "src" / "lib" / "data.ts"
# Ignore near-invisible haze around the bottle when finding its box.
ALPHA_THRESHOLD = 24
# Breathing room, as a fraction of the trimmed box's larger side.
MARGIN = 0.03


def catalogue_slugs() -> set[str]:
    return set(re.findall(r'slug:\s*"([a-z0-9-]+)"', DATA.read_text()))


def trim(path: Path, dry_run: bool) -> str:
    im = Image.open(path)
    if im.mode != "RGBA":
        return f"skip (no alpha, {im.mode})"
    alpha = im.getchannel("A").point(lambda a: 255 if a >= ALPHA_THRESHOLD else 0)
    box = alpha.getbbox()
    if box is None:
        return "skip (fully transparent)"
    left, top, right, bottom = box
    pad = round(max(right - left, bottom - top) * MARGIN)
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(im.width, right + pad), min(im.height, bottom + pad)
    if (left, top, right, bottom) == (0, 0, im.width, im.height):
        return "already trimmed"
    msg = f"{im.width}x{im.height} -> {right - left}x{bottom - top}"
    if not dry_run:
        im.crop((left, top, right, bottom)).save(path, optimize=True)
    return msg


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    args = ap.parse_args()
    slugs = catalogue_slugs()
    for path in sorted(ASSETS.glob("*.png")):
        if path.stem not in slugs:
            continue
        print(f"{path.name:32} {trim(path, args.dry_run)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

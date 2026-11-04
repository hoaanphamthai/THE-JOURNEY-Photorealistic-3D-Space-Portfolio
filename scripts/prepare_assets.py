"""Convert raw textures -> WebP and HYG catalog -> compact binary starfield.

Usage:  python scripts/prepare_assets.py
Inputs: raw/*.jpg|png|tif, raw/hyg.csv.gz   Outputs: public/assets/**
Requires Pillow. KTX2 conversion is a separate, optional step (see README).
"""
import csv, gzip, math, struct, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / "raw", ROOT / "public/assets"

TEXTURES = {  # raw name -> (out subpath, quality, keep_alpha)
    "2k_earth_daymap.jpg": ("textures/earth/day.webp", 88, False),
    "2k_earth_nightmap.jpg": ("textures/earth/night.webp", 85, False),
    "2k_earth_clouds.jpg": ("textures/earth/clouds.webp", 80, False),
    "2k_earth_specular_map.tif": ("textures/earth/specular.webp", 80, False),
    "2k_earth_normal_map.tif": ("textures/earth/normal.webp", 88, False),
    "2k_moon.jpg": ("textures/moon/albedo.webp", 88, False),
    "2k_saturn.jpg": ("textures/saturn/albedo.webp", 85, False),
    "2k_saturn_ring_alpha.png": ("textures/saturn/ring.webp", 95, True),
    "2k_stars_milky_way.jpg": ("textures/sky/milkyway.webp", 82, False),
}

def convert_textures():
    for src, (dst, q, alpha) in TEXTURES.items():
        p = RAW / src
        if not p.exists():
            print("skip (missing)", src); continue
        img = Image.open(p)
        img = img.convert("RGBA" if alpha else "RGB")
        o = OUT / dst; o.parent.mkdir(parents=True, exist_ok=True)
        img.save(o, "WEBP", quality=q, method=6)
        print(f"{src} -> {dst} {o.stat().st_size // 1024} KB")

def build_moon_height():
    """Moon displacement from albedo luminance (no real DEM in raw/). ponytail: swap for LRO LOLA DEM when available."""
    p = RAW / "2k_moon.jpg"
    if not p.exists(): return
    img = Image.open(p).convert("L").resize((1024, 512), Image.Resampling.LANCZOS)
    o = OUT / "textures/moon/height.webp"
    img.save(o, "WEBP", quality=80, method=6)
    print("moon height ->", o.stat().st_size // 1024, "KB")

def build_stars(mag_limit=7.0):
    """stars.bin: little-endian records of float32 x,y,z (unit dir, equatorial J2000), float32 mag, float32 ci (B-V)."""
    p = RAW / "hyg.csv.gz"
    if not p.exists():
        print("skip stars (missing hyg.csv.gz)"); return
    out = bytearray(); n = 0
    with gzip.open(p, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["id"] == "0": continue  # Sol
            try:
                mag = float(row["mag"]); ra = float(row["rarad"]); dec = float(row["decrad"])
            except ValueError: continue
            if mag > mag_limit: continue
            ci = float(row["ci"]) if row["ci"] else 0.6
            x = math.cos(dec) * math.cos(ra); y = math.cos(dec) * math.sin(ra); z = math.sin(dec)
            out += struct.pack("<5f", x, y, z, mag, ci); n += 1
    o = OUT / "stars/stars.bin"; o.parent.mkdir(parents=True, exist_ok=True)
    o.write_bytes(out)
    print(f"stars.bin: {n} stars, {len(out)//1024} KB")

def build_project_placeholders():
    """Dark gridded placeholders for the case-study overlay until real screenshots exist."""
    from PIL import ImageDraw
    names = ["orbital-commerce", "telemetry-dash", "lunar-atlas", "quiet-type"]
    out = OUT / "projects"; out.mkdir(parents=True, exist_ok=True)
    for i, n in enumerate(names):
        img = Image.new("RGB", (1600, 1000), (14, 16, 20))
        d = ImageDraw.Draw(img)
        for x in range(0, 1600, 80): d.line([(x, 0), (x, 1000)], fill=(28, 31, 38))
        for y in range(0, 1000, 80): d.line([(0, y), (1600, y)], fill=(28, 31, 38))
        d.rectangle([120, 120, 1480, 880], outline=(242, 239, 233), width=2)
        d.text((160, 160), f"{i+1:02d}  {n}", fill=(255, 184, 107))
        img.save(out / f"{n}.webp", "WEBP", quality=80, method=6)
    print("project placeholders:", len(names))

if __name__ == "__main__":
    convert_textures(); build_moon_height(); build_stars(); build_project_placeholders()

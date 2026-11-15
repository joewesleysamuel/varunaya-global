"""
Pack rendered PNG frames into web-ready WebP sequences with a manifest.

  python render/pack.py <frames_dir> <public/sequence/name> [--small 480]

Writes frame_0000.webp ... (full size), s/frame_0000.webp ... (small, for
phones) and manifest.json, in the format src/sequence/FrameSequence.ts reads.
Also: python render/pack.py --still <png> <out.webp> [--width 1600]
"""
import argparse
import glob
import json
import os

from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--small", type=int, default=480, help="width of the phone set")
ap.add_argument("--quality", type=int, default=80)
ap.add_argument("--still", action="store_true")
ap.add_argument("--width", type=int, default=1600)
a = ap.parse_args()

if a.still:
    im = Image.open(a.src).convert("RGBA")
    if im.width > a.width:
        im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(a.dst) or ".", exist_ok=True)
    im.save(a.dst, "WEBP", quality=a.quality, method=6)
    print(f"still -> {a.dst} {os.path.getsize(a.dst) // 1024} KB")
    raise SystemExit

frames = sorted(glob.glob(os.path.join(a.src, "frame_*.png")))
if not frames:
    raise SystemExit(f"no frames in {a.src}")
os.makedirs(os.path.join(a.dst, "s"), exist_ok=True)
total = 0
for i, path in enumerate(frames):
    im = Image.open(path).convert("RGBA")
    full = os.path.join(a.dst, f"frame_{i:04d}.webp")
    im.save(full, "WEBP", quality=a.quality, method=6)
    sm = im.resize((a.small, round(im.height * a.small / im.width)), Image.LANCZOS)
    sm.save(os.path.join(a.dst, "s", f"frame_{i:04d}.webp"), "WEBP", quality=a.quality, method=6)
    total += os.path.getsize(full)
w, h = Image.open(frames[0]).size
manifest = {
    "frameCount": len(frames),
    "width": w,
    "height": h,
    "pattern": "frame_{index}.webp",
    "small": "s/frame_{index}.webp",
    "pad": 4,
    "start": 0,
}
with open(os.path.join(a.dst, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
print(f"{len(frames)} frames -> {a.dst} (full set {total // 1024} KB)")

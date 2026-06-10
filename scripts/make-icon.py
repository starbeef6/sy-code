"""Build build/icon.icns + build/icon.png from the source art with a
macOS-style rounded-rect (squircle) corner so the app icon looks native.
"""
import os
import subprocess
import sys
from PIL import Image, ImageDraw

SRC = "/Users/yamijin/Desktop/ai_terminal_hub_black_square_bg.png"
BUILD = "/Users/yamijin/Desktop/本地控制三幻神/build"
ICONSET = "/tmp/aihub-icon.iconset"

MASTER = 1024
RADIUS = int(MASTER * 0.2237)  # Big Sur-style continuous corner radius


def rounded_master() -> Image.Image:
    src = Image.open(SRC).convert("RGBA").resize((MASTER, MASTER), Image.LANCZOS)
    mask = Image.new("L", (MASTER, MASTER), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, MASTER, MASTER], radius=RADIUS, fill=255)
    out = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out


def main() -> int:
    master = rounded_master()
    os.makedirs(ICONSET, exist_ok=True)
    os.makedirs(BUILD, exist_ok=True)

    # macOS iconset: base sizes with @1x and @2x variants.
    for base in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px = base * scale
            name = f"icon_{base}x{base}{'@2x' if scale == 2 else ''}.png"
            master.resize((px, px), Image.LANCZOS).save(os.path.join(ICONSET, name))

    master.save(os.path.join(BUILD, "icon.png"))
    subprocess.run(
        ["iconutil", "-c", "icns", ICONSET, "-o", os.path.join(BUILD, "icon.icns")],
        check=True,
    )
    print("icon.icns + icon.png written to", BUILD)
    return 0


if __name__ == "__main__":
    sys.exit(main())

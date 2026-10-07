"""Make the small AVIF copies of the site's photographs, and the list the website reads them from.

Run it after adding or replacing a picture in frontend/public/images (or the logo):

    python frontend/scripts/photos.py

Each JPEG keeps its place as the fallback for old browsers. Beside it go copies at a few widths
(city-uk-320.avif, city-uk-640.avif ...), and frontend/src/data/photos.json records which widths exist
so <Photo> can offer the browser the right one. Needs Pillow 11.3 or newer (it reads and writes AVIF).

Copies are written over the old ones and leftovers are cleared at the end, so the site never has
pictures missing while this runs, or if it is stopped half-way.
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

PUBLIC = Path(__file__).resolve().parents[1] / "public"
MANIFEST = Path(__file__).resolve().parents[1] / "src" / "data" / "photos.json"
WIDTHS = (160, 320, 480, 720, 960, 1280, 1600)
FACES = (96, 192, 384)          # portraits and the logo are only ever shown small
SLIDES = (960, 1280, 1440, 1600, 1920)
TALL = (480, 640, 800, 1080)          # phone crops of the hero slides, 9:16
MADE = re.compile(r"-(t)?\d+\.avif$")


def main():
    photos, made = {}, set()

    def save(img, path, quality):
        img.save(path, "AVIF", quality=quality, speed=3)
        made.add(Path(path))

    for src in sorted([*PUBLIC.glob("images/**/*.jpg"), PUBLIC / "logo.png"]):
        img = ImageOps.exif_transpose(Image.open(src))
        w, h = img.size
        slide, face, logo = src.name.startswith("slide-"), src.parent.name == "people", src.suffix == ".png"
        if slide:
            img = ImageOps.grayscale(img)  # the hero shows them in black and white under a dark wash
        ladder = FACES if face or logo else SLIDES if slide else WIDTHS
        # every step smaller than the original, then the original itself (capped at the top step)
        widths = sorted({x for x in ladder if x < w} | {min(w, ladder[-1])})
        stem = src.with_suffix("")
        for x in widths:
            save(img.resize((x, round(h * x / w)), Image.LANCZOS), f"{stem}-{x}.avif", 38 if slide else 62 if logo else 50)
        entry = {"w": w, "h": h, "widths": widths}
        if slide:
            for x in TALL:
                save(ImageOps.fit(img, (x, round(x * 16 / 9)), Image.LANCZOS), f"{stem}-t{x}.avif", 36)
            entry["tall"] = list(TALL)
        photos["/" + src.relative_to(PUBLIC).as_posix()] = entry

    for old in PUBLIC.rglob("*.avif"):
        if MADE.search(old.name) and old not in made:
            old.unlink()  # a width that is no longer made, or a picture that was removed
    MANIFEST.write_text(json.dumps(photos, indent=1) + "\n", encoding="utf-8")
    print(f"{len(photos)} pictures, {len(made)} copies, {sum(p.stat().st_size for p in made) // 1024} KB")


if __name__ == "__main__":
    main()

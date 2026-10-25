"""Make the tab and home-screen icons from the logo.

Run it after replacing frontend/public/logo.png:

    python frontend/scripts/icons.py

Every icon is drawn from logo.png in one step: resized with Lanczos and sharpened once, rather
than resized again from a copy that was already resized, which is what made the home-screen icon
look soft. The logo is 384 pixels across, so that is the detail there is; a bigger original, or a
vector, is the only thing that makes these sharper still.

Two kinds of icon, because phones use them differently:
  any        the icon as it is, on nothing. Browser tabs and the older home screens.
  maskable   Android cuts its own shape out of this one, so the logo sits at 76% of the square
             with the manifest's background behind it: whatever shape is cut, nothing is clipped.
Apple ignores both and reads the apple-touch-icon link in index.html, which cannot be
transparent: iOS fills transparency with black, so that one is drawn on the background too.
"""
from pathlib import Path

from PIL import Image, ImageFilter

PUBLIC = Path(__file__).resolve().parents[1] / "public"
BACKGROUND = (14, 21, 37, 255)   # background_color in site.webmanifest
SAFE = 0.76                      # how much of a maskable icon the logo may use
ICO = (16, 32, 48)


def logo():
    """The artwork with the empty edge taken off, so every size below is measured from the logo
    itself and not from whatever space was left around it when it was exported."""
    img = Image.open(PUBLIC / "logo.png").convert("RGBA")
    return img.crop(img.getbbox())


def drawn(art, side, fill, background=None):
    """One icon: the logo at `fill` of a square `side` wide, sharpened once, over `background`
    or over nothing. The logo keeps its shape; a square canvas simply leaves a little space."""
    want = round(side * fill)
    scale = want / max(art.size)
    small = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    small = small.filter(ImageFilter.UnsharpMask(radius=1.1, percent=125, threshold=2))
    icon = Image.new("RGBA", (side, side), background or (0, 0, 0, 0))
    icon.alpha_composite(small, ((side - small.width) // 2, (side - small.height) // 2))
    return icon


def main():
    art = logo()
    made = []

    def save(icon, name):
        icon.save(PUBLIC / name, "PNG", optimize=True)
        made.append(name)

    for side in (48, 96, 192, 512):
        save(drawn(art, side, 1.0), f"favicon-{side}.png")
    for side in (192, 512):
        save(drawn(art, side, SAFE, BACKGROUND), f"favicon-maskable-{side}.png")
    save(drawn(art, 180, 0.88, BACKGROUND), "apple-touch-icon.png")

    # One .ico holding the three sizes Windows and older browsers ask for
    base = drawn(art, max(ICO), 1.0)
    base.save(PUBLIC / "favicon.ico", sizes=[(s, s) for s in ICO])
    made.append("favicon.ico")

    print(f"{len(made)} icons from a {art.width}x{art.height} logo: {', '.join(made)}")


if __name__ == "__main__":
    main()

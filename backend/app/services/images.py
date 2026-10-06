"""Uploaded pictures (post images, avatars): checked, turned upright, resized and re-saved as JPEG,
which also drops EXIF data such as the phone's location."""
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 6 * 1024 * 1024


class ImageError(Exception):
    """Shown to the person who uploaded the file."""


def prepare(upload, max_side=1600, square=False):
    data = upload.read()
    if len(data) > MAX_BYTES:
        raise ImageError("That picture is too large. Use one under 6 MB.")
    try:
        img = Image.open(BytesIO(data))
        if img.format not in ("JPEG", "PNG", "WEBP"):
            raise ImageError("Use a JPG, PNG or WebP picture.")
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise ImageError("We could not open that picture. Use a JPG, PNG or WebP file.") from None
    if square:
        img = ImageOps.fit(img, (max_side, max_side))
    else:
        img.thumbnail((max_side, max_side))
    out = BytesIO()
    img.save(out, "JPEG", quality=85, optimize=True)
    return out.getvalue()

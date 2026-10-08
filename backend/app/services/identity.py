"""Age check at sign-up: read the date of birth from a photo ID (OCR).

Passports and many ID cards carry a machine readable zone (MRZ) whose dates have check digits, so
that is trusted first; otherwise a date next to a "Date of birth" / "DOB" label; otherwise the
earliest plausible date on the card. Runs on our own server with RapidOCR (ONNX), no third-party
KYC service, and the photo is only ever held in memory.

A date on any picture is not an ID, so before a date is believed the text must show what a real
document carries (document_kind): a machine readable zone whose check digits add up, an Aadhaar
number that passes its checksum, a PAN in the Income Tax Department's format, or a driving licence.
This stops a random photo with a date on it. It cannot tell a real card from a careful forgery of
one: that takes a government lookup (DigiLocker or a KYC provider), which is the upgrade path.
"""
import re
from datetime import date
from functools import cache
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError

cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)  # OpenCV 5 warns about unused GPU targets

MAX_SIDE = 1600  # downscale large phone photos before OCR
MAX_PIXELS = 40_000_000  # far above any phone camera


class IdentityError(Exception):
    """A problem the person can fix by retaking the photo. The message is shown to them."""


# ---------------------------------------------------------------- images

def decode(data: bytes):
    try:  # read the size from the header before decoding: a tiny file can claim a billion pixels
        width, height = Image.open(BytesIO(data)).size
    except (UnidentifiedImageError, OSError):
        raise IdentityError("We could not open that file. Use a JPG or PNG photo.") from None
    if width * height > MAX_PIXELS:
        raise IdentityError("That photo is too large. Take it again at a normal size.")
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise IdentityError("We could not open that file. Use a JPG or PNG photo.")
    h, w = img.shape[:2]
    if max(h, w) > MAX_SIDE:
        scale = MAX_SIDE / max(h, w)
        img = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    return img


# ---------------------------------------------------------------- date of birth

MONTHS = {m: i for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
# 14/03/2001, 14-03-2001, 14.03.2001, 14 MAR 2001, 14 March 2001, 2001-03-14
DATE = re.compile(
    r"\b(\d{1,2})\s*[./-]?\s*([a-z]{3,9}|\d{1,2})\s*[./-]?\s*((?:19|20)\d{2})\b"
    r"|\b((?:19|20)\d{2})[./-](\d{1,2})[./-](\d{1,2})\b",
    re.I,
)
LABEL = re.compile(r"\bd\s*\.?\s*o\s*\.?\s*b\b|date\s*of\s*birth|birth\s*date|\bborn\b|geburtsdatum|जन्म", re.I)


def _make_date(day, month, year):
    try:
        if not month.isdigit():
            month = MONTHS[month[:3].lower()]
        day, month, year = int(day), int(month), int(year)
        # ponytail: assumes day-first (India, UK, EU documents); a month > 12 means it was US order
        if month > 12 and day <= 12:
            day, month = month, day
        return date(year, month, day)
    except (KeyError, ValueError):
        return None


def _dates(text):
    for m in DATE.finditer(text):
        d = _make_date(*m.group(1, 2, 3)) if m.group(1) else _make_date(m.group(6), m.group(5), m.group(4))
        if d and date(date.today().year - 100, 1, 1) < d < date.today():  # nobody signing up is over 100
            yield d


# MRZ: values A-Z = 10..35, '<' = 0, weights 7, 3, 1 repeating
def _check_digit(field):
    total = 0
    for i, ch in enumerate(field):
        v = int(ch) if ch.isdigit() else 0 if ch == "<" else ord(ch) - 55
        total += v * (7, 3, 1)[i % 3]
    return str(total % 10)


DIGIT_FIXES = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6"})


def _checked(line, start):
    """The six digits at `start` if the check digit after them adds up, else None."""
    field = line[start:start + 6].translate(DIGIT_FIXES)
    check = line[start + 6:start + 7].translate(DIGIT_FIXES)
    return field if len(field) == 6 and field.isdigit() and check == _check_digit(field) else None


def _mrz_line(raw):
    line = re.sub(r"[^A-Z0-9<]", "", raw.upper().replace("«", "<"))
    return line if line.count("<") >= 2 and len(line) >= 28 else None


def _mrz_dob(line, today):
    """DOB from one MRZ line, or None. Passport (TD3, 44 chars) and TD2 (36) second line: birth at
    13, expiry at 21. ID card (TD1, 30 chars) second line: birth at 0, expiry at 8. Both dates carry
    a check digit and both must add up: one alone is right by chance one time in ten."""
    birth, expiry = (13, 21) if len(line) >= 34 else (0, 8)
    field = _checked(line, birth)
    if not (field and _checked(line, expiry)):
        return None
    yy, mm, dd = int(field[:2]), int(field[2:4]), int(field[4:])
    try:
        return date(2000 + yy if 2000 + yy <= today.year else 1900 + yy, mm, dd)
    except ValueError:
        return None


def find_dob(lines, today=None):
    """(date_of_birth, source) from OCR text lines, or (None, None). source: mrz | label | date"""
    today = today or date.today()
    for raw in lines:
        if (line := _mrz_line(raw)) and (dob := _mrz_dob(line, today)):
            return dob, "mrz"

    for i, raw in enumerate(lines):
        if m := LABEL.search(raw):
            # The value is on the same line after the label, or on the next line or two
            for text in (raw[m.end():], *lines[i + 1:i + 3]):
                if dob := next(_dates(text), None):
                    return dob, "label"

    found = [d for raw in lines for d in _dates(raw)]
    return (min(found), "date") if found else (None, None)


# ---------------------------------------------------------------- which document is it

# Verhoeff checksum, the one Aadhaar numbers end in: it catches every single wrong digit and swap
_D = [[(i + j) % 5 if i < 5 and j < 5 else 5 + (i + j) % 5 if i < 5 else 5 + (i - j) % 5 if j < 5 else (i - j) % 5
       for j in range(10)] for i in range(10)]
_P = [list(range(10)), [1, 5, 7, 6, 2, 8, 3, 0, 9, 4]]
for _ in range(6):
    _P.append([_P[-1][_P[1][i]] for i in range(10)])


def _verhoeff(number):
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


AADHAAR = re.compile(r"(?<!\d)(?<!\d )([2-9]\d{3}) ?(\d{4}) ?(\d{4})(?! ?\d)")
PAN = re.compile(r"\b[A-Z]{3}P[A-Z]\d{4}[A-Z]\b")  # the fourth letter is P on a person's card
PASSPORT_NO = re.compile(r"\b[A-Z]\d{7}\b")
LICENCE_NO = re.compile(r"\b[A-Z]{2}[- ]?\d{2}[- ]?(?:19|20)\d{2} ?\d{7}\b")  # state, office, year, serial


def document_kind(lines, today=None):
    """'passport', 'driving_licence' or 'national_id' when the text is that of a real document, else None."""
    today = today or date.today()
    for raw in lines:
        if (line := _mrz_line(raw)) and _mrz_dob(line, today):
            return "passport" if len(line) >= 40 else "national_id"
    text = " ".join(lines).upper()
    words = re.sub(r"[^A-Z]", "", text)  # OCR drops and adds spaces; the letters survive

    def said(*any_of):
        return any(w in words for w in any_of)

    labelled = any(LABEL.search(raw) for raw in lines)
    if any(_verhoeff("".join(m.groups())) for m in AADHAAR.finditer(text)) and (
            labelled or said("GOVERNMENTOFINDIA", "AADHAAR", "UNIQUEIDENTIFICATION", "UIDAI")):
        return "national_id"
    if PAN.search(text) and said("INCOMETAX", "PERMANENTACCOUNT", "GOVTOFINDIA"):
        return "national_id"
    if said("LICENCE", "LICENSE") and (said("DRIVING", "DRIVER", "TRANSPORT") or LICENCE_NO.search(text)):
        return "driving_licence"
    if said("PASSPORT") and PASSPORT_NO.search(text) and labelled:
        return "passport"  # the photo page, when the two lines at the bottom did not read cleanly
    return None


@cache
def _ocr():
    from rapidocr_onnxruntime import RapidOCR  # heavy import, only when the first ID arrives
    return RapidOCR()


def read_text(img):
    result, _ = _ocr()(img)
    return [text for _, text, score in result or [] if float(score) >= 0.5]


def read_dob(img):
    """(date_of_birth, source, document) from a photo of an ID."""
    lines = read_text(img)
    kind = document_kind(lines)
    if not kind:
        raise IdentityError("We could not recognise this as a passport, driving licence, Aadhaar or PAN card. "
                            "Use the original document, with the whole of it in the frame, in focus and without glare.")
    dob, source = find_dob(lines)
    if not dob:
        raise IdentityError("We could not read a date of birth on that photo. Make sure the whole "
                            "document is in the frame, in focus and without glare.")
    return dob, source, kind

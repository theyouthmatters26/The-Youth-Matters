"""Age check at sign-up: read the date of birth from a photo ID (OCR).

Passports and many ID cards carry a machine readable zone (MRZ) whose dates have check digits, so
that is trusted first; otherwise a date next to a "Date of birth" / "DOB" label; otherwise the
earliest plausible date on the card. Runs on our own server with RapidOCR (ONNX), no third-party
KYC service, and the photo is only ever held in memory.
"""
import re
from datetime import date
from functools import cache

import cv2
import numpy as np

cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)  # OpenCV 5 warns about unused GPU targets

MAX_SIDE = 1600  # downscale large phone photos before OCR


class IdentityError(Exception):
    """A problem the person can fix by retaking the photo. The message is shown to them."""


# ---------------------------------------------------------------- images

def decode(data: bytes):
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
        if d and date(1900, 1, 1) < d < date.today():
            yield d


# MRZ: values A-Z = 10..35, '<' = 0, weights 7, 3, 1 repeating
def _check_digit(field):
    total = 0
    for i, ch in enumerate(field):
        v = int(ch) if ch.isdigit() else 0 if ch == "<" else ord(ch) - 55
        total += v * (7, 3, 1)[i % 3]
    return str(total % 10)


DIGIT_FIXES = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6"})


def _mrz_dob(line, today):
    """DOB from one MRZ line, or None. Passport (TD3, 44 chars) and TD2 (36) second line: positions
    13-19. ID card (TD1, 30 chars) second line: positions 0-6."""
    start = 13 if len(line) >= 34 else 0
    field = line[start:start + 6].translate(DIGIT_FIXES)
    check = line[start + 6:start + 7].translate(DIGIT_FIXES)
    if not (len(field) == 6 and field.isdigit() and check == _check_digit(field)):
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
        line = re.sub(r"[^A-Z0-9<]", "", raw.upper().replace("«", "<"))
        if line.count("<") >= 2 and len(line) >= 28 and (dob := _mrz_dob(line, today)):
            return dob, "mrz"

    for i, raw in enumerate(lines):
        if m := LABEL.search(raw):
            # The value is on the same line after the label, or on the next line or two
            for text in (raw[m.end():], *lines[i + 1:i + 3]):
                if dob := next(_dates(text), None):
                    return dob, "label"

    found = [d for raw in lines for d in _dates(raw)]
    return (min(found), "date") if found else (None, None)


@cache
def _ocr():
    from rapidocr_onnxruntime import RapidOCR  # heavy import, only when the first ID arrives
    return RapidOCR()


def read_text(img):
    result, _ = _ocr()(img)
    return [text for _, text, score in result or [] if float(score) >= 0.5]


def read_dob(img):
    dob, source = find_dob(read_text(img))
    if not dob:
        raise IdentityError("We could not read a date of birth on that photo. Make sure the whole "
                            "document is in the frame, in focus and without glare.")
    return dob, source

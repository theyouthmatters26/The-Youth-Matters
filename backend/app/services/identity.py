"""Age and identity check at sign-up.

1. Read the date of birth from a photo ID (OCR). Passports and many ID cards carry a machine
   readable zone (MRZ) whose dates have check digits, so that is trusted first; otherwise a date
   next to a "Date of birth" / "DOB" label; otherwise the earliest plausible date on the card.
2. Match the face printed on the ID to a live selfie, and check the selfie is a real head:
   two frames, looking straight then turned. A flat photo held up to the camera cannot change
   where the nose sits relative to the eyes, a real head turn does.

Runs on our own server, no third-party KYC service: RapidOCR (ONNX) for text, OpenCV YuNet +
SFace for faces. The two face models download once into backend/instance/models.
"""
import re
import urllib.request
from datetime import date
from functools import cache
from pathlib import Path

import cv2
import numpy as np

cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)  # OpenCV 5 warns about unused GPU targets

MODELS = Path(__file__).resolve().parents[2] / "instance" / "models"
MODEL_URLS = {
    "face_detection_yunet_2023mar.onnx":
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx":
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}

# Calibration knobs. SFace's published cosine threshold for "same person" is 0.363; ID photos
# are small and printed, so a miss goes to a person for review rather than a hard reject.
MATCH_THRESHOLD = 0.363
SAME_SESSION_THRESHOLD = 0.30   # straight vs turned selfie frames: same person, harder angle
MIN_HEAD_TURN = 0.12            # change in nose offset (in eye-distances) between the two frames
MAX_SIDE = 1600                 # downscale large phone photos before detection / OCR


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


def to_jpeg(img) -> bytes:
    """Re-encode for storage: a known format, and no EXIF (location, device) carried along."""
    return cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tobytes()


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


# ---------------------------------------------------------------- faces

def _model(name):
    path = MODELS / name
    if not path.exists():
        MODELS.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        urllib.request.urlretrieve(MODEL_URLS[name], tmp)
        tmp.replace(path)
    return str(path)


@cache
def _detector():
    return cv2.FaceDetectorYN.create(_model("face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.75)


@cache
def _recognizer():
    return cv2.FaceRecognizerSF.create(_model("face_recognition_sface_2021dec.onnx"), "")


def faces(img):
    """Detected faces, largest first. Each row: box x, y, w, h, 5 landmarks (x, y), score."""
    h, w = img.shape[:2]
    det = _detector()
    det.setInputSize((w, h))
    _, found = det.detect(img)
    return [] if found is None else sorted(found, key=lambda f: -f[2] * f[3])


def embedding(img, face):
    rec = _recognizer()
    return rec.feature(rec.alignCrop(img, face)).astype(np.float32)


def similarity(a, b):
    return float(_recognizer().match(a.reshape(1, -1), b.reshape(1, -1), cv2.FaceRecognizerSF_FR_COSINE))


def head_turn(face):
    """Horizontal nose offset from the midpoint of the eyes, in eye-distances. 0 = facing the camera."""
    right_eye_x, left_eye_x, nose_x = face[4], face[6], face[8]
    return (nose_x - (right_eye_x + left_eye_x) / 2) / max(abs(left_eye_x - right_eye_x), 1)


def id_face(img) -> bytes:
    """Embedding of the face printed on the ID, as bytes to carry to the selfie step."""
    found = faces(img)
    if not found:
        raise IdentityError("We could not find the photo of your face on the document. Retake it "
                            "with the whole photo page or card in the frame.")
    return embedding(img, found[0]).tobytes()  # largest face; some IDs also print a small ghost image


def check_selfie(straight_img, turned_img, id_face_bytes):
    """Similarity between the selfie and the ID face. Raises IdentityError for retakes."""
    straight, turned = faces(straight_img), faces(turned_img)
    if len(straight) != 1 or len(turned) != 1:
        raise IdentityError("Make sure only your face is in the frame, in good light, and try again.")
    if abs(head_turn(turned[0]) - head_turn(straight[0])) < MIN_HEAD_TURN:
        # ponytail: geometric liveness defeats printed photos, not a replayed video; add a
        # passive liveness model or a KYC vendor if spoofing shows up in reviews
        raise IdentityError("We did not see your head turn. Look straight at the camera first, "
                            "then slowly turn your head when asked.")
    selfie = embedding(straight_img, straight[0])
    if similarity(selfie, embedding(turned_img, turned[0])) < SAME_SESSION_THRESHOLD:
        raise IdentityError("The two selfie frames did not look like the same person. Try again.")
    return similarity(selfie, np.frombuffer(id_face_bytes, np.float32))

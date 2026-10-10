from datetime import date

from app.services import identity
from app.services.identity import find_dob

TODAY = date(2026, 10, 6)


def test_passport_mrz_wins_and_check_digit_is_enforced():
    mrz = "K1234567<6IND0103141F3208014<<<<<<<<<<<<<<04"
    assert find_dob(["Date of Birth", "02/08/1999", mrz], TODAY) == (date(2001, 3, 14), "mrz")
    # Same line with a wrong check digit (OCR misread) is ignored, the label is used instead
    assert find_dob(["Date of Birth", "02/08/1999", mrz.replace("0103141", "0103145")], TODAY) == (
        date(1999, 8, 2), "label")


def test_id_card_mrz_with_ocr_letter_for_digit():
    # TD1 second line: DOB first. OCR read the zero as the letter O.
    assert find_dob(["O1O3141F3201015IND<<<<<<<<<<<4"], TODAY) == (date(2001, 3, 14), "mrz")


def test_labelled_formats():
    assert find_dob(["जन्म तिथि/DOB: 14/03/2001"], TODAY) == (date(2001, 3, 14), "label")
    assert find_dob(["D.O.B 14-03-2001"], TODAY) == (date(2001, 3, 14), "label")
    assert find_dob(["Date of birth", "14 MAR 2001"], TODAY) == (date(2001, 3, 14), "label")
    assert find_dob(["Date of birth 2001-03-14"], TODAY) == (date(2001, 3, 14), "label")


def test_unlabelled_uses_earliest_date_and_nothing_found():
    assert find_dob(["3. 14.03.2001 INDIA", "4a. 02.08.2022", "4b. 01.08.2032"], TODAY) == (
        date(2001, 3, 14), "date")
    assert find_dob(["REPUBLIC OF INDIA", "SHARMA"], TODAY) == (None, None)

# ---- a date is believed only on a real kind of document (document_kind)


def aadhaar():
    """A made-up Aadhaar number with a correct last (checksum) digit."""
    return next(f"2345 6789 012{d}" for d in "0123456789" if identity._verhoeff(f"23456789012{d}"))


def test_a_picture_with_a_date_is_not_an_id():
    for lines in (["Happy birthday", "14/03/2001"], ["Date of Birth: 14/03/2001"], ["DOB 14 MAR 2001", "Rahul Sharma"],
                  ["Invoice 2345 6789 0123", "Date 14/03/2001"]):
        assert identity.document_kind(lines, TODAY) is None, lines


def test_verhoeff_checksum():
    assert identity._verhoeff("2363") and not identity._verhoeff("2364")  # the textbook example


def test_aadhaar_needs_a_number_that_adds_up():
    good = ["Government of India", "Rahul Sharma", "DOB: 14/03/2001", "MALE", aadhaar()]
    assert identity.document_kind(good, TODAY) == "national_id"
    assert identity.find_dob(good, TODAY) == (date(2001, 3, 14), "label")
    wrong = aadhaar()[:-1] + str((int(aadhaar()[-1]) + 1) % 10)
    assert identity.document_kind([*good[:4], wrong], TODAY) is None


def test_pan_card():
    lines = ["INCOME TAX DEPARTMENT", "GOVT. OF INDIA", "RAHUL SHARMA", "14/03/2001", "Permanent Account Number", "ABCPS1234K"]
    assert identity.document_kind(lines, TODAY) == "national_id"
    assert identity.find_dob(lines, TODAY) == (date(2001, 3, 14), "date")
    assert identity.document_kind(["ABCPS1234K", "14/03/2001"], TODAY) is None           # the number alone
    assert identity.document_kind(["INCOME TAX DEPARTMENT", "ABCCS1234K"], TODAY) is None  # a company's PAN


def test_driving_licence():
    lines = ["UNION OF INDIA", "DRIVING LICENCE", "DL No. MH12 20190012345", "DOB: 14-03-2001", "Valid till 13-03-2041"]
    assert identity.document_kind(lines, TODAY) == "driving_licence"
    assert identity.find_dob(lines, TODAY) == (date(2001, 3, 14), "label")


def test_passport_reads_only_when_both_check_digits_add_up():
    specimen = ["P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", "L898902C36UTO7408122F1204159ZE184226B<<<<<10"]  # ICAO 9303
    assert identity.document_kind(specimen, TODAY) == "passport"
    assert identity.find_dob(specimen, TODAY) == (date(1974, 8, 12), "mrz")
    forged = [specimen[0], specimen[1].replace("1204159", "1204158")]  # the expiry check digit is wrong
    assert identity.document_kind(forged, TODAY) is None


def test_voter_id_is_a_local_id_we_accept():
    card = ["ELECTION COMMISSION OF INDIA", "IDENTITY CARD", "ABC1234567",
            "Date of Birth: 14/03/2001"]
    assert identity.document_kind(card, today=TODAY) == "national_id"
    # The same number on anything else is not an ID
    assert identity.document_kind(["Gym card ABC1234567", "14/03/2001"], today=TODAY) is None

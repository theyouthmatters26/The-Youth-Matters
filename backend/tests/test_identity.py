from datetime import date

from app.services.identity import find_dob

TODAY = date(2026, 10, 6)


def test_passport_mrz_wins_and_check_digit_is_enforced():
    mrz = "K1234567<6IND0103141F3208011<<<<<<<<<<<<<<04"
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

"""
Smoke tests for the FTA TLV QR-code encoder.

Run with:  python -m pytest tests/test_fta_tlv_qr.py -v
"""
import base64
import pytest
from utils.pdf_invoice_generator import generate_fta_tlv_payload, generate_invoice_pdf


def _decode_tlv(b64_payload: str) -> dict:
    """Decode a base64 TLV payload into a {tag: value} dict."""
    raw = base64.b64decode(b64_payload)
    result = {}
    i = 0
    while i < len(raw):
        tag = raw[i]
        length = raw[i + 1]
        value = raw[i + 2 : i + 2 + length].decode("utf-8")
        result[tag] = value
        i += 2 + length
    return result


class TestGenerateFtaTlvPayload:
    def test_five_tags_present(self):
        payload = generate_fta_tlv_payload(
            seller_name="InvoLinks LLC",
            trn="100123456700003",
            timestamp="2025-01-15T10:30:00",
            total_incl_vat=1050.00,
            vat_total=50.00,
        )
        tags = _decode_tlv(payload)
        assert set(tags.keys()) == {1, 2, 3, 4, 5}, "All 5 FTA tags must be present"

    def test_tag_values_correct(self):
        payload = generate_fta_tlv_payload(
            seller_name="InvoLinks LLC",
            trn="100123456700003",
            timestamp="2025-01-15T10:30:00",
            total_incl_vat=1050.00,
            vat_total=50.00,
        )
        tags = _decode_tlv(payload)
        assert tags[1] == "InvoLinks LLC"
        assert tags[2] == "100123456700003"
        assert tags[3] == "2025-01-15T10:30:00"
        assert tags[4] == "1050.00"
        assert tags[5] == "50.00"

    def test_result_is_valid_base64(self):
        payload = generate_fta_tlv_payload("A", "B", "C", 0, 0)
        decoded = base64.b64decode(payload)
        assert len(decoded) > 0

    def test_none_inputs_do_not_raise(self):
        payload = generate_fta_tlv_payload(None, None, None, None, None)
        tags = _decode_tlv(payload)
        assert set(tags.keys()) == {1, 2, 3, 4, 5}
        assert tags[4] == "0.00"
        assert tags[5] == "0.00"

    def test_zero_vat(self):
        payload = generate_fta_tlv_payload("Co", "TRN123", "2025-06-01", 1000.00, 0)
        tags = _decode_tlv(payload)
        assert tags[4] == "1000.00"
        assert tags[5] == "0.00"

    def test_tag1_length_byte_matches_value(self):
        seller = "My Test Company"
        payload = generate_fta_tlv_payload(seller, "X", "Y", 1, 0)
        raw = base64.b64decode(payload)
        tag = raw[0]
        length = raw[1]
        value = raw[2 : 2 + length].decode("utf-8")
        assert tag == 1
        assert length == len(seller.encode("utf-8"))
        assert value == seller


class TestPdfGenerationWithTlv:
    def test_pdf_generated_with_full_data(self):
        invoice_data = {
            "invoice_number": "INV-2025-001",
            "currency_code": "AED",
            "supplier_name": "InvoLinks LLC",
            "supplier_trn": "100123456700003",
            "issue_date": "2025-01-15",
            "issue_datetime": "2025-01-15T10:30:00",
            "subtotal_amount": 1000.0,
            "tax_amount": 50.0,
            "total_amount": 1050.0,
        }
        pdf = generate_invoice_pdf(invoice_data, [])
        assert len(pdf) > 1000, "PDF must be non-trivially sized"

    def test_pdf_generated_with_none_fields(self):
        invoice_data = {
            "invoice_number": "INV-000",
            "currency_code": "AED",
            "supplier_name": None,
            "supplier_trn": None,
            "issue_date": None,
            "issue_datetime": None,
            "subtotal_amount": None,
            "tax_amount": None,
            "total_amount": None,
        }
        pdf = generate_invoice_pdf(invoice_data, [])
        assert len(pdf) > 1000

    def test_pdf_generated_with_public_url(self):
        invoice_data = {
            "invoice_number": "INV-2025-002",
            "currency_code": "AED",
            "supplier_name": "Test LLC",
            "supplier_trn": "100123456700003",
            "issue_date": "2025-03-01",
            "issue_datetime": "2025-03-01T09:00:00",
            "subtotal_amount": 500.0,
            "tax_amount": 25.0,
            "total_amount": 525.0,
        }
        pdf = generate_invoice_pdf(
            invoice_data, [], public_url="https://involinks.app/i/xyz"
        )
        assert len(pdf) > 1000

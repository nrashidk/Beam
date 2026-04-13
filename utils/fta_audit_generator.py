"""
FTA Audit File (FAF) Generator
==============================
Generates UAE Federal Tax Authority compliant audit files in FAF v1.0.0 format.

FAF 5-table structure required by the FTA:
  [CompanyData]     — entity metadata (1 data row), incl. period dates & software ID
  [SalesData]       — outgoing tax invoices / credit notes
  [PurchaseData]    — inward invoices (purchases)
  [TaxData]         — tax summary per rate category
  [GeneralLedger]   — journal entry lines for the period

Each generated file is accompanied by a SHA-256 hash file (.sha256).
Both are packed into a ZIP archive returned for download.
"""
import csv
import hashlib
import io
import os
import zipfile
from datetime import date
from typing import Any, Dict, List, Tuple


FAF_VERSION = "FAFv1.0.0"
TAX_AGENCY_NAME = "InvoLinks"
SOFTWARE_NAME = "InvoLinks"
SOFTWARE_VERSION = "1.0.0"

# ---------------------------------------------------------------------------
# Column definitions per table
# ---------------------------------------------------------------------------

COMPANY_DATA_HEADERS = [
    "TaxAgencyName",
    "FAFVersion",
    "TRN",
    "CompanyName",
    "RegistrationDate",
    "Address",
    "City",
    "Emirate",
    "PeriodStart",
    "PeriodEnd",
    "SoftwareName",
    "SoftwareVersion",
]

SALES_DATA_HEADERS = [
    "TransactionID",
    "TransactionType",
    "InvoiceDate",
    "DueDate",
    "SupplyDate",
    "InvoiceType",
    "CustomerTRN",
    "CustomerName",
    "CustomerCountry",
    "InvoiceValueExclVAT",
    "VATAmount",
    "TotalInvoiceValue",
    "Currency",
    "TaxCode",
    "VATRatePct",
    "PaymentDate",
    "PaymentMethod",
    "PaymentStatus",
    "Status",
]

PURCHASE_DATA_HEADERS = [
    "TransactionID",
    "TransactionType",
    "InvoiceDate",
    "DueDate",
    "SupplyDate",
    "InvoiceType",
    "SupplierTRN",
    "SupplierName",
    "SupplierCountry",
    "InvoiceValueExclVAT",
    "VATAmount",
    "TotalInvoiceValue",
    "Currency",
    "TaxCode",
    "VATRatePct",
    "PaymentDate",
    "PaymentMethod",
    "PaymentStatus",
    "Status",
]

TAX_DATA_HEADERS = [
    "TaxCategory",
    "TaxCode",
    "VATRatePct",
    "TaxableAmountSales",
    "VATAmountSales",
    "TaxableAmountPurchases",
    "VATAmountPurchases",
    "NetVATDue",
]

GL_DATA_HEADERS = [
    "EntryDate",
    "JournalRef",
    "AccountCode",
    "AccountName",
    "Debit",
    "Credit",
    "SourceDocRef",
    "SourceDocType",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _derive_tax_code(invoice_type: str, vat_rate: float) -> str:
    """Map invoice_type + vat_rate to FTA tax code."""
    itype = (invoice_type or "").upper()
    if "EXEMPT" in itype or itype == "EX":
        return "EX"
    if "ZERO" in itype or "ZR" in itype or abs(vat_rate) < 0.001:
        return "ZR"
    if "OUT" in itype or "OOS" in itype:
        return "OOS"
    return "SR"  # Standard Rate 5%


def _derive_vat_rate(vat_amount: float, subtotal: float) -> float:
    """Compute effective VAT rate from amounts; fallback to 5%."""
    if subtotal and subtotal != 0:
        return round((vat_amount / subtotal) * 100, 2)
    return 5.0


def _format_date(d) -> str:
    if isinstance(d, date):
        return d.strftime("%Y-%m-%d")
    return str(d) if d else ""


def _amount(v) -> str:
    try:
        return f"{float(v):.2f}"
    except (TypeError, ValueError):
        return "0.00"


# ---------------------------------------------------------------------------
# Generator class
# ---------------------------------------------------------------------------

class FTAAuditFileGenerator:
    """Generate FTA-compliant FAF v1.0.0 audit files."""

    def __init__(self, company_data: Dict[str, Any]):
        self.company_data = company_data

    # ------------------------------------------------------------------
    # Primary public method — produces a ZIP with CSV + SHA-256 file
    # ------------------------------------------------------------------

    def generate_faf_zip(
        self,
        outgoing_invoices: List[Dict],
        inward_invoices: List[Dict],
        output_dir: str,
        base_name: str,
        gl_entries: List[Dict] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Build the FAF CSV, compute its SHA-256, pack both into a ZIP.

        Returns:
            zip_path  — absolute path to the generated .zip file
            stats     — dict with summary counts / totals
        """
        os.makedirs(output_dir, exist_ok=True)

        csv_content, stats = self._build_faf_content(
            outgoing_invoices, inward_invoices, gl_entries=gl_entries or []
        )

        csv_bytes = csv_content.encode("utf-8")
        sha256_hex = hashlib.sha256(csv_bytes).hexdigest()

        csv_name = f"{base_name}.csv"
        sha256_name = f"{base_name}.sha256"
        zip_name = f"{base_name}.zip"
        zip_path = os.path.join(output_dir, zip_name)

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(csv_name, csv_bytes)
            zf.writestr(sha256_name, f"{sha256_hex}  {csv_name}\n".encode("utf-8"))

        stats["file_size"] = os.path.getsize(zip_path)
        stats["sha256"] = sha256_hex
        stats["zip_name"] = zip_name

        return zip_path, stats

    # ------------------------------------------------------------------
    # Legacy compatibility methods (keep same signature)
    # ------------------------------------------------------------------

    def generate_csv(
        self,
        outgoing_invoices: List[Dict],
        inward_invoices: List[Dict],
        output_path: str,
    ) -> Dict[str, Any]:
        """Write a FAF CSV (no ZIP). Kept for backward compatibility."""
        csv_content, stats = self._build_faf_content(outgoing_invoices, inward_invoices)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            f.write(csv_content)
        stats["file_size"] = os.path.getsize(output_path)
        return stats

    def generate_txt(
        self,
        outgoing_invoices: List[Dict],
        inward_invoices: List[Dict],
        output_path: str,
    ) -> Dict[str, Any]:
        """Write a tab-delimited FAF file (no ZIP). Kept for backward compatibility."""
        csv_content, stats = self._build_faf_content(
            outgoing_invoices, inward_invoices, delimiter="\t"
        )
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(csv_content)
        stats["file_size"] = os.path.getsize(output_path)
        return stats

    # ------------------------------------------------------------------
    # Core builder — produces the 5-table FAF string
    # ------------------------------------------------------------------

    def _build_faf_content(
        self,
        outgoing_invoices: List[Dict],
        inward_invoices: List[Dict],
        delimiter: str = ",",
        gl_entries: List[Dict] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        if gl_entries is None:
            gl_entries = []

        buf = io.StringIO()

        # File-level header metadata
        buf.write(f"FAFVersion{delimiter}{FAF_VERSION}\n")
        buf.write(f"TaxAgencyName{delimiter}{TAX_AGENCY_NAME}\n")
        buf.write(f"GeneratedDate{delimiter}{date.today().strftime('%Y-%m-%d')}\n")
        buf.write("\n")

        # ============================================================
        # TABLE 1: CompanyData
        # ============================================================
        buf.write("[CompanyData]\n")
        writer = csv.DictWriter(
            buf, fieldnames=COMPANY_DATA_HEADERS,
            delimiter=delimiter, lineterminator="\n"
        )
        writer.writeheader()
        writer.writerow(
            {
                "TaxAgencyName": TAX_AGENCY_NAME,
                "FAFVersion": FAF_VERSION,
                "TRN": self.company_data.get("trn", ""),
                "CompanyName": self.company_data.get("legal_name", ""),
                "RegistrationDate": _format_date(
                    self.company_data.get("registration_date", "")
                ),
                "Address": self.company_data.get("address", ""),
                "City": self.company_data.get("city", ""),
                "Emirate": self.company_data.get("emirate", ""),
                "PeriodStart": _format_date(self.company_data.get("period_start", "")),
                "PeriodEnd": _format_date(self.company_data.get("period_end", "")),
                "SoftwareName": SOFTWARE_NAME,
                "SoftwareVersion": SOFTWARE_VERSION,
            }
        )
        buf.write("\n")

        # ============================================================
        # TABLE 2: SalesData
        # ============================================================
        buf.write("[SalesData]\n")
        writer = csv.DictWriter(
            buf, fieldnames=SALES_DATA_HEADERS,
            delimiter=delimiter, lineterminator="\n"
        )
        writer.writeheader()

        total_sales = 0
        total_sales_excl = 0.0
        total_sales_vat = 0.0
        sales_by_code: Dict[str, Dict] = {}

        for inv in outgoing_invoices:
            subtotal = float(inv.get("subtotal_amount", 0) or 0)
            vat = float(inv.get("tax_amount", 0) or 0)
            total = float(inv.get("total_amount", 0) or 0)
            inv_type = inv.get("invoice_type", "TAX_INVOICE")
            vat_rate = _derive_vat_rate(vat, subtotal)
            tax_code = _derive_tax_code(inv_type, vat_rate)
            currency = (inv.get("currency_code", "AED") or "AED").upper()

            # P2-A: Use AED equivalent for non-AED invoices so FAF always reports in AED.
            # For AED invoices: use amounts directly.
            # For non-AED invoices without total_amount_aed: emit zeros (data gap — not compliant to include foreign-currency amounts labeled AED).
            if currency != "AED":
                raw_aed = inv.get("total_amount_aed")
                if raw_aed:
                    total_aed = float(raw_aed)
                    if total > 0:
                        aed_ratio = total_aed / total
                        subtotal_aed = round(subtotal * aed_ratio, 2)
                        vat_aed = round(vat * aed_ratio, 2)
                    else:
                        subtotal_aed = 0.0
                        vat_aed = 0.0
                else:
                    # Missing AED conversion — emit zeros to avoid reporting foreign-currency amounts as AED
                    total_aed = 0.0
                    subtotal_aed = 0.0
                    vat_aed = 0.0
            else:
                total_aed = total
                subtotal_aed = subtotal
                vat_aed = vat

            issue_date = inv.get("issue_date", "")
            due_date = inv.get("due_date", "")
            supply_date_val = inv.get("supply_date") or issue_date
            writer.writerow(
                {
                    "TransactionID": inv.get("invoice_number", ""),
                    "TransactionType": "SALE",
                    "InvoiceDate": _format_date(issue_date),
                    "DueDate": _format_date(due_date),
                    "SupplyDate": _format_date(supply_date_val),
                    "InvoiceType": inv_type,
                    "CustomerTRN": inv.get("customer_trn", "") or "N/A",
                    "CustomerName": inv.get("customer_name", ""),
                    "CustomerCountry": inv.get("customer_country", "AE"),
                    "InvoiceValueExclVAT": _amount(subtotal_aed),
                    "VATAmount": _amount(vat_aed),
                    "TotalInvoiceValue": _amount(total_aed),
                    "Currency": "AED",
                    "TaxCode": tax_code,
                    "VATRatePct": f"{vat_rate:.1f}",
                    "PaymentDate": _format_date(inv.get("paid_at", "")),
                    "PaymentMethod": inv.get("payment_method", "") or "",
                    "PaymentStatus": "PAID" if inv.get("paid_at") else "UNPAID",
                    "Status": inv.get("status", ""),
                }
            )
            total_sales += 1
            total_sales_excl += subtotal_aed
            total_sales_vat += vat_aed

            bucket = sales_by_code.setdefault(
                tax_code, {"vat_rate": vat_rate, "taxable": 0.0, "vat": 0.0}
            )
            bucket["taxable"] += subtotal_aed
            bucket["vat"] += vat_aed

        buf.write("\n")

        # ============================================================
        # TABLE 3: PurchaseData
        # ============================================================
        buf.write("[PurchaseData]\n")
        writer = csv.DictWriter(
            buf, fieldnames=PURCHASE_DATA_HEADERS,
            delimiter=delimiter, lineterminator="\n"
        )
        writer.writeheader()

        total_purchases = 0
        total_purchase_excl = 0.0
        total_purchase_vat = 0.0
        purchase_by_code: Dict[str, Dict] = {}

        for inv in inward_invoices:
            subtotal = float(inv.get("subtotal_amount", 0) or 0)
            vat = float(inv.get("tax_amount", 0) or 0)
            total = float(inv.get("total_amount", 0) or 0)
            inv_type = inv.get("invoice_type", "TAX_INVOICE")
            vat_rate = _derive_vat_rate(vat, subtotal)
            tax_code = _derive_tax_code(inv_type, vat_rate)
            currency = (inv.get("currency_code", "AED") or "AED").upper()

            # P2-A: Use AED equivalent for non-AED invoices so FAF always reports in AED.
            # For AED invoices: use amounts directly.
            # For non-AED invoices without total_amount_aed: emit zeros (data gap — not compliant to include foreign-currency amounts labeled AED).
            if currency != "AED":
                raw_aed = inv.get("total_amount_aed")
                if raw_aed:
                    total_aed = float(raw_aed)
                    if total > 0:
                        aed_ratio = total_aed / total
                        subtotal_aed = round(subtotal * aed_ratio, 2)
                        vat_aed = round(vat * aed_ratio, 2)
                    else:
                        subtotal_aed = 0.0
                        vat_aed = 0.0
                else:
                    # Missing AED conversion — emit zeros to avoid reporting foreign-currency amounts as AED
                    total_aed = 0.0
                    subtotal_aed = 0.0
                    vat_aed = 0.0
            else:
                total_aed = total
                subtotal_aed = subtotal
                vat_aed = vat

            inv_date = inv.get("invoice_date", "")
            due_date = inv.get("due_date", "")
            purch_supply_date = inv.get("supply_date") or inv_date
            writer.writerow(
                {
                    "TransactionID": (inv.get("supplier_invoice_number") or "").strip() or f"INW-{inv.get('id', '')}",
                    "TransactionType": "PURCHASE",
                    "InvoiceDate": _format_date(inv_date),
                    "DueDate": _format_date(due_date),
                    "SupplyDate": _format_date(purch_supply_date),
                    "InvoiceType": inv_type,
                    "SupplierTRN": inv.get("supplier_trn", ""),
                    "SupplierName": inv.get("supplier_name", ""),
                    "SupplierCountry": inv.get("supplier_country", "AE"),
                    "InvoiceValueExclVAT": _amount(subtotal_aed),
                    "VATAmount": _amount(vat_aed),
                    "TotalInvoiceValue": _amount(total_aed),
                    "Currency": "AED",
                    "TaxCode": tax_code,
                    "VATRatePct": f"{vat_rate:.1f}",
                    "PaymentDate": _format_date(inv.get("paid_at", "")),
                    "PaymentMethod": inv.get("payment_method", "") or "",
                    "PaymentStatus": inv.get("payment_status", "") or ("PAID" if inv.get("paid_at") else "PENDING"),
                    "Status": inv.get("status", ""),
                }
            )
            total_purchases += 1
            total_purchase_excl += subtotal_aed
            total_purchase_vat += vat_aed

            bucket = purchase_by_code.setdefault(
                tax_code, {"vat_rate": vat_rate, "taxable": 0.0, "vat": 0.0}
            )
            bucket["taxable"] += subtotal_aed
            bucket["vat"] += vat_aed

        buf.write("\n")

        # ============================================================
        # TABLE 4: TaxData
        # ============================================================
        buf.write("[TaxData]\n")
        writer = csv.DictWriter(
            buf, fieldnames=TAX_DATA_HEADERS,
            delimiter=delimiter, lineterminator="\n"
        )
        writer.writeheader()

        # FTA spec requires one row per tax category (S/SR, Z/ZR, E/EX, O/OOS)
        # Always emit all 4 rows, even if amounts are zero.
        ALL_TAX_CODES = ["SR", "ZR", "EX", "OOS"]
        all_codes = ALL_TAX_CODES  # fixed order, all 4 categories always present

        category_labels = {
            "SR": "Standard Rate (5%)",
            "ZR": "Zero Rated",
            "EX": "Exempt",
            "OOS": "Out of Scope",
        }

        DEFAULT_RATES = {"SR": 5.0, "ZR": 0.0, "EX": 0.0, "OOS": 0.0}

        for code in all_codes:
            default_rate = DEFAULT_RATES.get(code, 0.0)
            s = sales_by_code.get(code, {"vat_rate": default_rate, "taxable": 0.0, "vat": 0.0})
            p = purchase_by_code.get(
                code, {"vat_rate": default_rate, "taxable": 0.0, "vat": 0.0}
            )
            vat_rate = s["vat_rate"] if s["vat_rate"] else (p["vat_rate"] if p["vat_rate"] else default_rate)
            writer.writerow(
                {
                    "TaxCategory": category_labels.get(code, code),
                    "TaxCode": code,
                    "VATRatePct": f"{vat_rate:.1f}",
                    "TaxableAmountSales": _amount(s["taxable"]),
                    "VATAmountSales": _amount(s["vat"]),
                    "TaxableAmountPurchases": _amount(p["taxable"]),
                    "VATAmountPurchases": _amount(p["vat"]),
                    "NetVATDue": _amount(s["vat"] - p["vat"]),
                }
            )

        buf.write("\n")

        # ============================================================
        # TABLE 5: GeneralLedger
        # ============================================================
        buf.write("[GeneralLedger]\n")
        gl_writer = csv.DictWriter(
            buf, fieldnames=GL_DATA_HEADERS,
            delimiter=delimiter, lineterminator="\n"
        )
        gl_writer.writeheader()

        total_gl_lines = 0
        for entry in gl_entries:
            for line in entry.get("lines", []):
                gl_writer.writerow(
                    {
                        "EntryDate": _format_date(entry.get("entry_date", "")),
                        "JournalRef": entry.get("reference_number", "") or entry.get("id", ""),
                        "AccountCode": line.get("account_code", ""),
                        "AccountName": line.get("account_name", ""),
                        "Debit": _amount(line.get("debit_amount", 0)),
                        "Credit": _amount(line.get("credit_amount", 0)),
                        "SourceDocRef": entry.get("reference_id", "") or "",
                        "SourceDocType": entry.get("reference_type", "") or "",
                    }
                )
                total_gl_lines += 1

        buf.write("\n")

        content = buf.getvalue()

        stats: Dict[str, Any] = {
            "total_invoices": total_sales + total_purchases,
            "total_sales": total_sales,
            "total_purchases": total_purchases,
            "total_customers": total_sales,
            "total_suppliers": total_purchases,
            "total_amount": round(total_sales_excl + total_purchase_excl, 2),
            "total_vat": round(total_sales_vat + total_purchase_vat, 2),
            "total_gl_lines": total_gl_lines,
        }

        return content, stats

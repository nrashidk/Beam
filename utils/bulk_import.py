import pandas as pd
import io
from typing import Dict, List, Any, Tuple
from datetime import datetime, date
from decimal import Decimal


class BulkImportValidator:
    """Validates and parses bulk CSV/Excel uploads for invoices and vendors"""

    @staticmethod
    def _parse_date_value(date_value: Any) -> str:
        """Parse supported date inputs and normalize to YYYY-MM-DD."""
        if date_value is None or pd.isna(date_value):
            raise ValueError("Date value is required")

        if isinstance(date_value, (datetime, date, pd.Timestamp)):
            return date_value.strftime("%Y-%m-%d")

        raw_value = str(date_value).strip()
        supported_formats = (
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%Y/%m/%d",
        )

        for fmt in supported_formats:
            try:
                return datetime.strptime(raw_value, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        raise ValueError(f"Unsupported date format: {raw_value}")

    @staticmethod
    def _normalize_invoice_mode(invoice_mode: str = "vat") -> str:
        mode = str(invoice_mode or "vat").strip().lower().replace("-", "_")
        if mode not in {"vat", "non_vat"}:
            return "vat"
        return mode

    @staticmethod
    def _normalize_invoice_type(invoice_type_raw: Any, invoice_mode: str) -> str:
        invoice_mode = BulkImportValidator._normalize_invoice_mode(invoice_mode)
        invoice_type = (
            str(invoice_type_raw).upper().strip()
            if invoice_type_raw is not None and not pd.isna(invoice_type_raw)
            else ""
        )

        invoice_type_aliases = {
            "380": "TAX_INVOICE",
            "381": "TAX_CREDIT_NOTE",
            "383": "DEBIT_NOTE",
            "480": "COMMERCIAL",
            "81": "CREDIT_NOTE",
            "TAX INVOICE": "TAX_INVOICE",
            "TAX-INVOICE": "TAX_INVOICE",
            "TAX_INVOICE": "TAX_INVOICE",
            "TAX CREDIT NOTE": "TAX_CREDIT_NOTE",
            "TAX-CREDIT-NOTE": "TAX_CREDIT_NOTE",
            "TAX_CREDIT_NOTE": "TAX_CREDIT_NOTE",
            "DEBIT NOTE": "DEBIT_NOTE",
            "DEBIT-NOTE": "DEBIT_NOTE",
            "DEBIT_NOTE": "DEBIT_NOTE",
            "COMMERCIAL INVOICE": "COMMERCIAL",
            "COMMERCIAL-INVOICE": "COMMERCIAL",
            "COMMERCIAL_INVOICE": "COMMERCIAL",
            "COMMERCIAL": "COMMERCIAL",
            "CREDIT NOTE": "CREDIT_NOTE",
            "CREDIT-NOTE": "CREDIT_NOTE",
            "CREDIT_NOTE": "CREDIT_NOTE",
        }
        normalized = invoice_type_aliases.get(invoice_type, invoice_type)

        if invoice_mode == "non_vat" and normalized == "TAX_CREDIT_NOTE":
            return "CREDIT_NOTE"
        return normalized or ("TAX_INVOICE" if invoice_mode == "vat" else "COMMERCIAL")

    @staticmethod
    def generate_invoice_template(invoice_mode: str = "vat") -> pd.DataFrame:
        """Generate CSV/Excel template for invoice bulk upload"""
        invoice_mode = BulkImportValidator._normalize_invoice_mode(invoice_mode)

        common_data = {
            "issue_date": [
                "15/01/2025",
                "16/01/2025",
                "17/01/2025",
                "18/01/2025",
            ],
            "due_date": [
                "15/02/2025",
                "16/02/2025",
                "17/02/2025",
                "18/02/2025",
            ],
            "customer_name": [
                "ABC Trading LLC",
                "XYZ Company",
                "DEF Corporation",
                "GHI Enterprises",
            ],
            "customer_email": [
                "customer@example.com",
                "customer2@example.com",
                "customer3@example.com",
                "customer4@example.com",
            ],
            "customer_trn": ["", "", "", ""],
            "customer_address": [
                "Dubai, UAE",
                "Abu Dhabi, UAE",
                "Sharjah, UAE",
                "Ajman, UAE",
            ],
            "customer_city": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
            "item_name": ["Goods", "Services", "Adjustment", "Materials"],
            "item_description": [
                "Consulting services",
                "Professional work",
                "Invoice adjustment",
                "Building materials",
            ],
            "quantity": ["10", "5", "2", "20"],
            "unit_price": ["500.00", "1000.00", "250.00", "25.00"],
            "unit_name": ["Hour", "Day", "Unit", "Piece"],
        }

        if invoice_mode == "non_vat":
            template_data = {
                **common_data,
                "invoice_type": [
                    "COMMERCIAL",
                    "COMMERCIAL",
                    "CREDIT_NOTE",
                    "COMMERCIAL",
                ],
                "preceding_invoice_number": ["", "", "CI-00001", ""],
                "tax_category": ["O", "O", "O", "O"],
                "tax_percent": ["0", "0", "0", "0"],
                "tax_code": ["OP", "OP", "OP", "OP"],
            }
        else:
            template_data = {
                **common_data,
                "invoice_type": [
                    "TAX_INVOICE",
                    "COMMERCIAL",
                    "TAX_CREDIT_NOTE",
                    "DEBIT_NOTE",
                ],
                "preceding_invoice_number": ["", "", "TI-00001", "TI-00002"],
                "tax_category": ["S", "O", "S", "S"],
                "tax_percent": ["5", "0", "5", "5"],
                "tax_code": ["S_5_5", "OP", "S_5_5", "S_5_5"],
            }

        return pd.DataFrame(template_data)

    @staticmethod
    def generate_vendor_template() -> pd.DataFrame:
        """Generate CSV/Excel template for vendor/supplier bulk upload"""
        template_data = {
            "vendor_name": ["ABC Supplies LLC", "XYZ Trading Co."],
            "vendor_trn": ["100000000000001", "100000000000002"],
            "vendor_email": ["vendor1@example.com", "vendor2@example.com"],
            "vendor_phone": ["+971501234567", "+971509876543"],
            "vendor_address": ["Dubai Industrial Area, UAE", "Sharjah Free Zone, UAE"],
            "peppol_id": ["0088:1234567890123", "0088:9876543210987"],
            "payment_terms": ["Net 30", "Net 45"],
            "is_active": [True, True],
        }
        return pd.DataFrame(template_data)

    @staticmethod
    def validate_invoice_file(
        file_content: bytes, filename: str, invoice_mode: str = "vat"
    ) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Validate and parse invoice CSV/Excel file
        Returns: (is_valid, parsed_data, errors)
        """
        errors = []
        parsed_invoices = []

        try:
            invoice_mode = BulkImportValidator._normalize_invoice_mode(invoice_mode)
            if filename.endswith(".xlsx") or filename.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(file_content), engine="openpyxl")
            elif filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_content))
            else:
                return (
                    False,
                    [],
                    ["Unsupported file format. Please upload CSV or Excel files."],
                )

            required_columns = [
                "issue_date",
                "due_date",
                "invoice_type",
                "customer_name",
                "item_description",
                "quantity",
                "unit_price",
            ]

            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                errors.append(f"Missing required columns: {', '.join(missing_columns)}")
                return False, [], errors

            has_preceding_invoice = "preceding_invoice_number" in df.columns

            for idx, row in df.iterrows():
                row_num = idx + 2
                row_errors = []

                try:
                    default_invoice_type = (
                        "TAX_INVOICE" if invoice_mode == "vat" else "COMMERCIAL"
                    )
                    invoice_type_raw = row.get("invoice_type", default_invoice_type)
                    invoice_type = BulkImportValidator._normalize_invoice_type(
                        invoice_type_raw, invoice_mode
                    )

                    # TRN: optional but if provided must be valid 15 digits
                    trn_raw = (
                        row.get("customer_trn", "") if "customer_trn" in row else ""
                    )
                    trn_value = (
                        str(trn_raw).strip() if trn_raw and not pd.isna(trn_raw) else ""
                    )
                    if trn_value and (len(trn_value) != 15 or not trn_value.isdigit()):
                        row_errors.append(
                            f"Row {row_num}: If provided, TRN must be 15 digits (numeric only)"
                        )

                    customer_name_raw = (
                        row.get("customer_name", "") if "customer_name" in row else ""
                    )
                    if (
                        pd.isna(customer_name_raw)
                        or str(customer_name_raw).strip() == ""
                    ):
                        row_errors.append(f"Row {row_num}: Customer name is required")

                    try:
                        quantity_raw = (
                            row.get("quantity", 0) if "quantity" in row else 0
                        )
                        quantity = (
                            float(quantity_raw) if not pd.isna(quantity_raw) else 0
                        )
                        if quantity <= 0:
                            row_errors.append(
                                f"Row {row_num}: Quantity must be greater than 0"
                            )
                    except (ValueError, TypeError):
                        row_errors.append(f"Row {row_num}: Invalid quantity value")

                    try:
                        unit_price_raw = (
                            row.get("unit_price", 0) if "unit_price" in row else 0
                        )
                        unit_price = (
                            float(unit_price_raw) if not pd.isna(unit_price_raw) else 0
                        )
                        if unit_price < 0:
                            row_errors.append(
                                f"Row {row_num}: Unit price cannot be negative"
                            )
                    except (ValueError, TypeError):
                        row_errors.append(f"Row {row_num}: Invalid unit price value")

                    valid_invoice_types = (
                        ["TAX_INVOICE", "TAX_CREDIT_NOTE", "DEBIT_NOTE", "COMMERCIAL"]
                        if invoice_mode == "vat"
                        else ["COMMERCIAL", "CREDIT_NOTE"]
                    )
                    if invoice_type not in valid_invoice_types:
                        allowed = ", ".join(valid_invoice_types)
                        row_errors.append(
                            f"Row {row_num}: Invalid invoice type for {invoice_mode.replace('_', '-')} bulk upload. Allowed values: {allowed}"
                        )

                    preceding_invoice_number = None
                    if has_preceding_invoice:
                        preceding_raw = (
                            row.get("preceding_invoice_number", "")
                            if "preceding_invoice_number" in row
                            else ""
                        )
                        if not pd.isna(preceding_raw):
                            preceding_invoice_number = str(preceding_raw).strip()

                    if invoice_type in ["CREDIT_NOTE", "TAX_CREDIT_NOTE", "DEBIT_NOTE"] and not preceding_invoice_number:
                        row_errors.append(
                            f"Row {row_num}: preceding_invoice_number is required for credit notes and debit notes"
                        )

                    issue_date_str = None
                    issue_date_raw = (
                        row.get("issue_date") if "issue_date" in row else None
                    )
                    if not pd.isna(issue_date_raw):
                        try:
                            issue_date_str = BulkImportValidator._parse_date_value(
                                issue_date_raw
                            )
                        except (ValueError, TypeError):
                            row_errors.append(
                                f"Row {row_num}: Invalid issue_date format. Supported formats: YYYY-MM-DD or DD/MM/YYYY (e.g., 2025-01-15 or 15/01/2025)"
                            )
                    else:
                        issue_date_str = datetime.now().strftime("%Y-%m-%d")

                    due_date_str = None
                    due_date_raw = row.get("due_date") if "due_date" in row else None
                    if not pd.isna(due_date_raw):
                        try:
                            due_date_str = BulkImportValidator._parse_date_value(
                                due_date_raw
                            )
                        except (ValueError, TypeError):
                            row_errors.append(
                                f"Row {row_num}: Invalid due_date format. Supported formats: YYYY-MM-DD or DD/MM/YYYY (e.g., 2025-02-15 or 15/02/2025)"
                            )

                    if row_errors:
                        errors.extend(row_errors)
                    else:
                        # Build invoice data with safe conversions
                        def safe_str(val, default=""):
                            """Safely convert value to string"""
                            if val is None or pd.isna(val):
                                return default
                            return str(val).strip()

                        raw_tax_category = str(row.get("tax_category") or "").upper().strip()
                        raw_tax_percent = row.get("tax_percent")
                        raw_tax_code = safe_str(row.get("tax_code"))

                        if invoice_mode == "non_vat" or invoice_type in [
                            "COMMERCIAL",
                            "CREDIT_NOTE",
                        ]:
                            effective_tax_category = "O"
                            effective_tax_percent = 0.0
                            effective_tax_code = "OP"
                        else:
                            effective_tax_category = raw_tax_category or "S"
                            if effective_tax_category == "O":
                                effective_tax_percent = 0.0
                                effective_tax_code = raw_tax_code or "OP"
                            else:
                                effective_tax_percent = (
                                    float(raw_tax_percent)
                                    if not pd.isna(raw_tax_percent)
                                    and str(raw_tax_percent).strip() != ""
                                    else 5.0
                                )
                                effective_tax_code = raw_tax_code or "S_5_5"

                        invoice_data = {
                            "row_num": int(row_num),
                            "invoice_number": safe_str(row.get("invoice_number"))
                            or None,
                            "issue_date": issue_date_str,
                            "due_date": due_date_str,
                            "invoice_type": invoice_type,
                            "preceding_invoice_number": preceding_invoice_number,
                            "customer_name": safe_str(row.get("customer_name")),
                            "customer_email": safe_str(row.get("customer_email"))
                            or None,
                            "customer_trn": trn_value or None,
                            "customer_address": safe_str(row.get("customer_address"))
                            or None,
                            "customer_city": safe_str(row.get("customer_city")) or None,
                            "item_name": safe_str(row.get("item_name"), "Item")
                            or "Item",
                            "item_description": safe_str(row.get("item_description")),
                            "quantity": float(quantity_raw)
                            if not pd.isna(quantity_raw)
                            else 0,
                            "unit_price": float(unit_price_raw)
                            if not pd.isna(unit_price_raw)
                            else 0,
                            "unit_name": safe_str(row.get("unit_name"), "Unit")
                            or "Unit",
                            "tax_category": effective_tax_category,
                            "tax_percent": effective_tax_percent,
                            "tax_code": effective_tax_code,
                        }
                        parsed_invoices.append(invoice_data)
                except Exception as e:
                    errors.append(f"Row {row_num}: Processing error - {str(e)}")

            is_valid = len(errors) == 0
            return is_valid, parsed_invoices, errors

        except Exception as e:
            return False, [], [f"File parsing error: {str(e)}"]

    @staticmethod
    def validate_vendor_file(
        file_content: bytes, filename: str
    ) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Validate and parse vendor CSV/Excel file
        Returns: (is_valid, parsed_data, errors)
        """
        errors = []
        parsed_vendors = []

        try:
            if filename.endswith(".xlsx") or filename.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(file_content), engine="openpyxl")
            elif filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_content))
            else:
                return (
                    False,
                    [],
                    ["Unsupported file format. Please upload CSV or Excel files."],
                )

            required_columns = ["vendor_name", "vendor_trn", "vendor_email"]

            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                errors.append(f"Missing required columns: {', '.join(missing_columns)}")
                return False, [], errors

            for idx, row in df.iterrows():
                row_num = idx + 2
                row_errors = []

                try:
                    vendor_name_raw = (
                        row.get("vendor_name", "") if "vendor_name" in row else ""
                    )
                    if pd.isna(vendor_name_raw) or str(vendor_name_raw).strip() == "":
                        row_errors.append(f"Row {row_num}: Vendor name is required")

                    vendor_trn_raw = (
                        row.get("vendor_trn", "") if "vendor_trn" in row else ""
                    )
                    vendor_trn_value = (
                        str(vendor_trn_raw).strip()
                        if vendor_trn_raw and not pd.isna(vendor_trn_raw)
                        else ""
                    )
                    if len(vendor_trn_value) != 15 or not vendor_trn_value.isdigit():
                        row_errors.append(
                            f"Row {row_num}: Valid 15-digit TRN is required (must be numeric)"
                        )

                    vendor_email_raw = (
                        row.get("vendor_email", "") if "vendor_email" in row else ""
                    )
                    if pd.isna(vendor_email_raw) or "@" not in str(vendor_email_raw):
                        row_errors.append(
                            f"Row {row_num}: Valid email address is required"
                        )

                    if row_errors:
                        errors.extend(row_errors)
                    else:
                        # Build vendor data with safe conversions
                        def safe_str(val, default=""):
                            """Safely convert value to string"""
                            if val is None or pd.isna(val):
                                return default
                            return str(val).strip()

                        vendor_data = {
                            "vendor_name": safe_str(row.get("vendor_name")),
                            "vendor_trn": safe_str(row.get("vendor_trn")),
                            "vendor_email": safe_str(row.get("vendor_email")),
                            "vendor_phone": safe_str(row.get("vendor_phone")) or None,
                            "vendor_address": safe_str(row.get("vendor_address"))
                            or None,
                        }
                        parsed_vendors.append(vendor_data)
                except Exception as e:
                    errors.append(f"Row {row_num}: Processing error - {str(e)}")

            is_valid = len(errors) == 0
            return is_valid, parsed_vendors, errors

        except Exception as e:
            return False, [], [f"File parsing error: {str(e)}"]

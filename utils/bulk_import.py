import pandas as pd
import io
from typing import Dict, List, Any, Tuple
from datetime import datetime, date
from decimal import Decimal


class BulkImportValidator:
    """Validates and parses bulk CSV/Excel uploads for invoices and vendors"""

    @staticmethod
    def generate_invoice_template() -> pd.DataFrame:
        """Generate CSV/Excel template for invoice bulk upload"""
        template_data = {
            "issue_date": ["2025-01-15", "2025-01-16", "2025-01-17", "2025-01-18"],
            "due_date": ["2025-02-15", "2025-02-16", "2025-02-17", "2025-02-18"],
            "invoice_type": ["COMMERCIAL", "COMMERCIAL", "CREDIT_NOTE", "COMMERCIAL"],
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
            "customer_trn": ["", "", "", ""],  # Optional for all
            "customer_address": [
                "Dubai, UAE",
                "Abu Dhabi, UAE",
                "Sharjah, UAE",
                "Ajman, UAE",
            ],
            "customer_city": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
            "preceding_invoice_number": [
                "",
                "",
                "CI-00001",
                "",
            ],  # Required for credit notes only
            "item_name": ["Goods", "Services", "Refund", "License"],
            "item_description": [
                "Consulting Services",
                "Professional work",
                "Refund for returned goods",
                "Software License",
            ],
            "quantity": ["10", "5", "8", "12"],
            "unit_price": ["500.00", "1000.00", "750.00", "1200.00"],
            "unit_name": ["Hour", "Day", "Unit", "Month"],
            "tax_category": ["S", "S", "S", "S"],
            "tax_percent": ["5", "5", "5", "5"],
            "tax_code": ["S_5_5", "S_5_5", "S_5_5", "S_5_5"],
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
        file_content: bytes, filename: str
    ) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Validate and parse invoice CSV/Excel file
        Returns: (is_valid, parsed_data, errors)
        """
        errors = []
        parsed_invoices = []

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
                    # Safely get invoice_type
                    invoice_type_raw = (
                        row.get("invoice_type", "COMMERCIAL")
                        if "invoice_type" in row
                        else "COMMERCIAL"
                    )
                    invoice_type = (
                        str(invoice_type_raw).upper().strip()
                        if not pd.isna(invoice_type_raw)
                        else "COMMERCIAL"
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

                    if invoice_type not in ["TAX_INVOICE", "CREDIT_NOTE", "COMMERCIAL"]:
                        row_errors.append(
                            f"Row {row_num}: Invalid invoice type. Must be TAX_INVOICE, CREDIT_NOTE, or COMMERCIAL"
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

                    if invoice_type == "CREDIT_NOTE" and not preceding_invoice_number:
                        row_errors.append(
                            f"Row {row_num}: preceding_invoice_number is required for credit notes"
                        )

                    issue_date_str = None
                    issue_date_raw = (
                        row.get("issue_date") if "issue_date" in row else None
                    )
                    if not pd.isna(issue_date_raw):
                        try:
                            if isinstance(
                                issue_date_raw, (datetime, date, pd.Timestamp)
                            ):
                                issue_date_str = issue_date_raw.strftime("%Y-%m-%d")
                            else:
                                date_value_str = str(issue_date_raw).strip()
                                parsed_date = datetime.strptime(
                                    date_value_str, "%Y-%m-%d"
                                )
                                issue_date_str = parsed_date.strftime("%Y-%m-%d")
                        except (ValueError, TypeError):
                            row_errors.append(
                                f"Row {row_num}: Invalid issue_date format. Must be YYYY-MM-DD (e.g., 2025-01-15)"
                            )
                    else:
                        issue_date_str = datetime.now().strftime("%Y-%m-%d")

                    due_date_str = None
                    due_date_raw = row.get("due_date") if "due_date" in row else None
                    if not pd.isna(due_date_raw):
                        try:
                            if isinstance(due_date_raw, (datetime, date, pd.Timestamp)):
                                due_date_str = due_date_raw.strftime("%Y-%m-%d")
                            else:
                                date_value_str = str(due_date_raw).strip()
                                parsed_date = datetime.strptime(
                                    date_value_str, "%Y-%m-%d"
                                )
                                due_date_str = parsed_date.strftime("%Y-%m-%d")
                        except (ValueError, TypeError):
                            row_errors.append(
                                f"Row {row_num}: Invalid due_date format. Must be YYYY-MM-DD (e.g., 2025-02-15)"
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
                            "tax_category": safe_str(row.get("tax_category"), "S")
                            or "S",
                            "tax_percent": float(row.get("tax_percent", 5))
                            if not pd.isna(row.get("tax_percent"))
                            else 5.0,
                            "tax_code": safe_str(row.get("tax_code"), "S_5_5")
                            or "S_5_5",
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

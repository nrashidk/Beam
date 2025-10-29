"""
FTA Audit File (FAF) Generator
==============================
Generates UAE Federal Tax Authority compliant audit files in CSV/TXT format.

Based on FTA specifications:
- Invoice-level transaction detail
- Company and customer/supplier information
- VAT categorization and amounts
- Tax codes (SR, ZR, EX)
"""
import csv
import os
from datetime import date
from typing import List, Dict, Any
from io import StringIO


class FTAAuditFileGenerator:
    """Generate FTA-compliant audit files (FAF format)"""
    
    # FTA FAF CSV Headers
    FAF_HEADERS = [
        "TRN",  # Company Tax Registration Number
        "Company Name",
        "Invoice Number",
        "Invoice Date",
        "Invoice Type",  # "Tax Invoice", "Credit Note", etc.
        "Customer TRN",
        "Customer Name",
        "Customer Country",
        "Supplier TRN",  # For purchase invoices
        "Supplier Name",
        "Supplier Country",
        "Transaction Type",  # "Sale" or "Purchase"
        "Invoice Value (Excl. VAT)",
        "VAT Amount",
        "Total Invoice Value",
        "Currency",
        "Tax Code",  # SR (Standard Rate 5%), ZR (Zero Rated), EX (Exempt), OOS (Out of Scope)
        "VAT Rate %",
        "Payment Date",
        "Payment Method",
        "Status"
    ]
    
    def __init__(self, company_data: Dict[str, Any]):
        """
        Initialize generator with company information
        
        Args:
            company_data: Dict with company_trn, company_name, address, etc.
        """
        self.company_data = company_data
    
    def generate_csv(
        self, 
        outgoing_invoices: List[Dict], 
        inward_invoices: List[Dict],
        output_path: str
    ) -> Dict[str, Any]:
        """
        Generate FTA Audit File in CSV format
        
        Args:
            outgoing_invoices: List of issued invoices (sales)
            inward_invoices: List of received invoices (purchases)
            output_path: Path to save the CSV file
            
        Returns:
            Statistics dict with counts and totals
        """
        rows = []
        stats = {
            "total_invoices": 0,
            "total_sales": 0,
            "total_purchases": 0,
            "total_customers": set(),
            "total_suppliers": set(),
            "total_amount": 0.0,
            "total_vat": 0.0
        }
        
        # Process outgoing invoices (sales)
        for invoice in outgoing_invoices:
            row = self._create_sales_row(invoice)
            rows.append(row)
            stats["total_sales"] += 1
            stats["total_customers"].add(invoice.get("customer_trn", ""))
            stats["total_amount"] += invoice.get("total_amount", 0.0)
            stats["total_vat"] += invoice.get("tax_amount", 0.0)
        
        # Process inward invoices (purchases)
        for invoice in inward_invoices:
            row = self._create_purchase_row(invoice)
            rows.append(row)
            stats["total_purchases"] += 1
            stats["total_suppliers"].add(invoice.get("supplier_trn", ""))
            stats["total_amount"] += invoice.get("total_amount", 0.0)
            stats["total_vat"] += invoice.get("tax_amount", 0.0)
        
        stats["total_invoices"] = stats["total_sales"] + stats["total_purchases"]
        stats["total_customers"] = len([c for c in stats["total_customers"] if c])
        stats["total_suppliers"] = len([s for s in stats["total_suppliers"] if s])
        
        # Write CSV file
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=self.FAF_HEADERS)
            writer.writeheader()
            writer.writerows(rows)
        
        # Get file size
        file_size = os.path.getsize(output_path)
        stats["file_size"] = file_size
        
        return stats
    
    def _create_sales_row(self, invoice: Dict) -> Dict:
        """Create CSV row for sales invoice"""
        # Determine tax code and rate
        tax_code, vat_rate = self._get_tax_info(invoice)
        
        return {
            "TRN": self.company_data.get("trn", ""),
            "Company Name": self.company_data.get("legal_name", ""),
            "Invoice Number": invoice.get("invoice_number", ""),
            "Invoice Date": self._format_date(invoice.get("issue_date")),
            "Invoice Type": self._map_invoice_type(invoice.get("invoice_type", "")),
            "Customer TRN": invoice.get("customer_trn", "") or "N/A",  # N/A for B2C
            "Customer Name": invoice.get("customer_name", ""),
            "Customer Country": invoice.get("customer_country", "AE"),
            "Supplier TRN": "",  # Empty for sales
            "Supplier Name": "",
            "Supplier Country": "",
            "Transaction Type": "Sale",
            "Invoice Value (Excl. VAT)": f"{invoice.get('subtotal_amount', 0.0):.2f}",
            "VAT Amount": f"{invoice.get('tax_amount', 0.0):.2f}",
            "Total Invoice Value": f"{invoice.get('total_amount', 0.0):.2f}",
            "Currency": invoice.get("currency_code", "AED"),
            "Tax Code": tax_code,
            "VAT Rate %": f"{vat_rate:.2f}",
            "Payment Date": "",  # To be filled when payment recorded
            "Payment Method": "",
            "Status": invoice.get("status", "")
        }
    
    def _create_purchase_row(self, invoice: Dict) -> Dict:
        """Create CSV row for purchase invoice"""
        # Determine tax code and rate
        tax_code, vat_rate = self._get_tax_info(invoice)
        
        return {
            "TRN": self.company_data.get("trn", ""),
            "Company Name": self.company_data.get("legal_name", ""),
            "Invoice Number": invoice.get("supplier_invoice_number", ""),
            "Invoice Date": self._format_date(invoice.get("invoice_date")),
            "Invoice Type": self._map_invoice_type(invoice.get("invoice_type", "")),
            "Customer TRN": "",  # Empty for purchases
            "Customer Name": "",
            "Customer Country": "",
            "Supplier TRN": invoice.get("supplier_trn", ""),
            "Supplier Name": invoice.get("supplier_name", ""),
            "Supplier Country": "AE",  # Default to UAE
            "Transaction Type": "Purchase",
            "Invoice Value (Excl. VAT)": f"{invoice.get('subtotal_amount', 0.0):.2f}",
            "VAT Amount": f"{invoice.get('tax_amount', 0.0):.2f}",
            "Total Invoice Value": f"{invoice.get('total_amount', 0.0):.2f}",
            "Currency": invoice.get("currency_code", "AED"),
            "Tax Code": tax_code,
            "VAT Rate %": f"{vat_rate:.2f}",
            "Payment Date": "",
            "Payment Method": "",
            "Status": invoice.get("status", "")
        }
    
    def _get_tax_info(self, invoice: Dict) -> tuple:
        """
        Determine tax code and VAT rate from invoice
        
        Returns:
            (tax_code, vat_rate) tuple
        """
        tax_amount = invoice.get("tax_amount", 0.0)
        subtotal = invoice.get("subtotal_amount", 0.0)
        
        if subtotal == 0:
            return ("OOS", 0.0)  # Out of Scope
        
        # Calculate effective VAT rate
        vat_rate = (tax_amount / subtotal * 100) if subtotal > 0 else 0.0
        
        # Classify based on rate
        if vat_rate == 0.0:
            tax_code = "ZR"  # Zero-rated
        elif 4.5 <= vat_rate <= 5.5:  # Allow small rounding tolerance
            tax_code = "SR"  # Standard Rate (5%)
            vat_rate = 5.0
        else:
            tax_code = "EX"  # Exempt or other
        
        return (tax_code, vat_rate)
    
    def _map_invoice_type(self, type_code: str) -> str:
        """Map invoice type code to readable name"""
        type_mapping = {
            "380": "Tax Invoice",
            "381": "Credit Note",
            "480": "Commercial Invoice",
            "81": "Credit Note (Out of Scope)"
        }
        return type_mapping.get(type_code, "Tax Invoice")
    
    def _format_date(self, date_value) -> str:
        """Format date to YYYY-MM-DD"""
        if isinstance(date_value, date):
            return date_value.strftime("%Y-%m-%d")
        elif isinstance(date_value, str):
            return date_value
        return ""
    
    def generate_txt(
        self,
        outgoing_invoices: List[Dict],
        inward_invoices: List[Dict],
        output_path: str
    ) -> Dict[str, Any]:
        """
        Generate FTA Audit File in TXT (tab-delimited) format
        
        Same as CSV but with tab delimiters
        """
        # Generate CSV first to a string buffer
        csv_buffer = StringIO()
        rows = []
        stats = {"total_invoices": 0, "total_amount": 0.0, "total_vat": 0.0}
        
        # Process invoices (same logic as CSV)
        for invoice in outgoing_invoices:
            rows.append(self._create_sales_row(invoice))
        
        for invoice in inward_invoices:
            rows.append(self._create_purchase_row(invoice))
        
        stats["total_invoices"] = len(rows)
        
        # Write as tab-delimited
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as txtfile:
            # Write header
            txtfile.write('\t'.join(self.FAF_HEADERS) + '\n')
            
            # Write rows
            for row in rows:
                values = [str(row.get(header, "")) for header in self.FAF_HEADERS]
                txtfile.write('\t'.join(values) + '\n')
        
        stats["file_size"] = os.path.getsize(output_path)
        return stats

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
            'invoice_number': ['INV-001', 'INV-002'],
            'issue_date': ['2025-01-15', '2025-01-16'],
            'due_date': ['2025-02-15', '2025-02-16'],
            'invoice_type': ['TAX_INVOICE', 'TAX_INVOICE'],
            'customer_trn': ['100000000000003', '100000000000003'],
            'customer_name': ['ABC Trading LLC', 'XYZ Company'],
            'customer_email': ['customer@example.com', 'customer2@example.com'],
            'customer_address': ['Dubai, UAE', 'Abu Dhabi, UAE'],
            'item_description': ['Consulting Services', 'Software License'],
            'quantity': [10, 5],
            'unit_price': [500.00, 1000.00],
            'tax_percent': [5, 5],
            'discount_amount': [0, 100],
            'notes': ['Payment due in 30 days', 'Annual subscription']
        }
        return pd.DataFrame(template_data)
    
    @staticmethod
    def generate_vendor_template() -> pd.DataFrame:
        """Generate CSV/Excel template for vendor/supplier bulk upload"""
        template_data = {
            'vendor_name': ['ABC Supplies LLC', 'XYZ Trading Co.'],
            'vendor_trn': ['100000000000001', '100000000000002'],
            'vendor_email': ['vendor1@example.com', 'vendor2@example.com'],
            'vendor_phone': ['+971501234567', '+971509876543'],
            'vendor_address': ['Dubai Industrial Area, UAE', 'Sharjah Free Zone, UAE'],
            'peppol_id': ['0088:1234567890123', '0088:9876543210987'],
            'payment_terms': ['Net 30', 'Net 45'],
            'is_active': [True, True]
        }
        return pd.DataFrame(template_data)
    
    @staticmethod
    def validate_invoice_file(file_content: bytes, filename: str) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Validate and parse invoice CSV/Excel file
        Returns: (is_valid, parsed_data, errors)
        """
        errors = []
        parsed_invoices = []
        
        try:
            if filename.endswith('.xlsx') or filename.endswith('.xls'):
                df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
            elif filename.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file_content))
            else:
                return False, [], ['Unsupported file format. Please upload CSV or Excel files.']
            
            required_columns = [
                'invoice_number', 'issue_date', 'invoice_type', 
                'customer_trn', 'customer_name', 'item_description',
                'quantity', 'unit_price', 'tax_percent'
            ]
            
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                errors.append(f"Missing required columns: {', '.join(missing_columns)}")
                return False, [], errors
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                row_errors = []
                
                if pd.isna(row['invoice_number']) or str(row['invoice_number']).strip() == '':
                    row_errors.append(f"Row {row_num}: Invoice number is required")
                
                trn_value = str(row['customer_trn']).strip() if not pd.isna(row['customer_trn']) else ''
                if len(trn_value) != 15 or not trn_value.isdigit():
                    row_errors.append(f"Row {row_num}: Valid 15-digit TRN is required (must be numeric)")
                
                if pd.isna(row['customer_name']) or str(row['customer_name']).strip() == '':
                    row_errors.append(f"Row {row_num}: Customer name is required")
                
                try:
                    quantity = float(row['quantity']) if not pd.isna(row['quantity']) else 0
                    if quantity <= 0:
                        row_errors.append(f"Row {row_num}: Quantity must be greater than 0")
                except (ValueError, TypeError):
                    row_errors.append(f"Row {row_num}: Invalid quantity value")
                
                try:
                    unit_price = float(row['unit_price']) if not pd.isna(row['unit_price']) else 0
                    if unit_price < 0:
                        row_errors.append(f"Row {row_num}: Unit price cannot be negative")
                except (ValueError, TypeError):
                    row_errors.append(f"Row {row_num}: Invalid unit price value")
                
                invoice_type = str(row['invoice_type']).upper() if not pd.isna(row['invoice_type']) else 'TAX_INVOICE'
                if invoice_type not in ['TAX_INVOICE', 'CREDIT_NOTE', 'COMMERCIAL']:
                    row_errors.append(f"Row {row_num}: Invalid invoice type. Must be TAX_INVOICE, CREDIT_NOTE, or COMMERCIAL")
                
                issue_date_str = None
                if not pd.isna(row['issue_date']):
                    try:
                        date_value = row['issue_date']
                        if isinstance(date_value, (datetime, date, pd.Timestamp)):
                            issue_date_str = date_value.strftime('%Y-%m-%d')
                        else:
                            date_value_str = str(date_value).strip()
                            parsed_date = datetime.strptime(date_value_str, '%Y-%m-%d')
                            issue_date_str = parsed_date.strftime('%Y-%m-%d')
                    except (ValueError, TypeError):
                        row_errors.append(f"Row {row_num}: Invalid issue_date format. Must be YYYY-MM-DD (e.g., 2025-01-15)")
                else:
                    issue_date_str = datetime.now().strftime('%Y-%m-%d')
                
                due_date_str = None
                if not pd.isna(row['due_date']):
                    try:
                        date_value = row['due_date']
                        if isinstance(date_value, (datetime, date, pd.Timestamp)):
                            due_date_str = date_value.strftime('%Y-%m-%d')
                        else:
                            date_value_str = str(date_value).strip()
                            parsed_date = datetime.strptime(date_value_str, '%Y-%m-%d')
                            due_date_str = parsed_date.strftime('%Y-%m-%d')
                    except (ValueError, TypeError):
                        row_errors.append(f"Row {row_num}: Invalid due_date format. Must be YYYY-MM-DD (e.g., 2025-02-15)")
                
                if row_errors:
                    errors.extend(row_errors)
                else:
                    invoice_data = {
                        'invoice_number': str(row['invoice_number']).strip(),
                        'issue_date': issue_date_str,
                        'due_date': due_date_str,
                        'invoice_type': invoice_type,
                        'customer_trn': str(row['customer_trn']).strip(),
                        'customer_name': str(row['customer_name']).strip(),
                        'customer_email': str(row['customer_email']).strip() if not pd.isna(row['customer_email']) else None,
                        'customer_address': str(row['customer_address']).strip() if not pd.isna(row['customer_address']) else None,
                        'item_description': str(row['item_description']).strip(),
                        'quantity': float(row['quantity']),
                        'unit_price': float(row['unit_price']),
                        'tax_percent': float(row['tax_percent']) if not pd.isna(row['tax_percent']) else 5.0,
                        'discount_amount': float(row['discount_amount']) if not pd.isna(row['discount_amount']) else 0.0,
                        'notes': str(row['notes']).strip() if not pd.isna(row['notes']) else None
                    }
                    parsed_invoices.append(invoice_data)
            
            is_valid = len(errors) == 0
            return is_valid, parsed_invoices, errors
            
        except Exception as e:
            return False, [], [f"File parsing error: {str(e)}"]
    
    @staticmethod
    def validate_vendor_file(file_content: bytes, filename: str) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Validate and parse vendor CSV/Excel file
        Returns: (is_valid, parsed_data, errors)
        """
        errors = []
        parsed_vendors = []
        
        try:
            if filename.endswith('.xlsx') or filename.endswith('.xls'):
                df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
            elif filename.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file_content))
            else:
                return False, [], ['Unsupported file format. Please upload CSV or Excel files.']
            
            required_columns = ['vendor_name', 'vendor_trn', 'vendor_email']
            
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                errors.append(f"Missing required columns: {', '.join(missing_columns)}")
                return False, [], errors
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                row_errors = []
                
                if pd.isna(row['vendor_name']) or str(row['vendor_name']).strip() == '':
                    row_errors.append(f"Row {row_num}: Vendor name is required")
                
                vendor_trn_value = str(row['vendor_trn']).strip() if not pd.isna(row['vendor_trn']) else ''
                if len(vendor_trn_value) != 15 or not vendor_trn_value.isdigit():
                    row_errors.append(f"Row {row_num}: Valid 15-digit TRN is required (must be numeric)")
                
                if pd.isna(row['vendor_email']) or '@' not in str(row['vendor_email']):
                    row_errors.append(f"Row {row_num}: Valid email address is required")
                
                if row_errors:
                    errors.extend(row_errors)
                else:
                    vendor_data = {
                        'vendor_name': str(row['vendor_name']).strip(),
                        'vendor_trn': str(row['vendor_trn']).strip(),
                        'vendor_email': str(row['vendor_email']).strip(),
                        'vendor_phone': str(row['vendor_phone']).strip() if not pd.isna(row['vendor_phone']) else None,
                        'vendor_address': str(row['vendor_address']).strip() if not pd.isna(row['vendor_address']) else None,
                        'peppol_id': str(row['peppol_id']).strip() if not pd.isna(row['peppol_id']) else None,
                        'payment_terms': str(row['payment_terms']).strip() if not pd.isna(row['payment_terms']) else 'Net 30',
                        'is_active': bool(row['is_active']) if not pd.isna(row['is_active']) else True
                    }
                    parsed_vendors.append(vendor_data)
            
            is_valid = len(errors) == 0
            return is_valid, parsed_vendors, errors
            
        except Exception as e:
            return False, [], [f"File parsing error: {str(e)}"]

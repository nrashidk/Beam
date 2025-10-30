"""
VAT Utilities Module for UAE Tax Compliance
============================================

This module provides UAE-specific VAT calculations, tax code definitions,
and validation utilities for Federal Tax Authority (FTA) compliance.

Tax Codes Reference:
- SR: Standard-rated (5%)
- ZR: Zero-rated (0%)
- ES: Exempt (not applicable)
- RC: Reverse charge (5%)
- OP: Out of scope (not applicable)

Federal Tax Authority: https://tax.gov.ae
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Literal, Any
import re


TaxCode = Literal['SR', 'ZR', 'ES', 'RC', 'OP']


UAE_TAX_CODES: Dict[str, Dict] = {
    'SR': {
        'rate': Decimal('0.05'),
        'name': 'Standard-rated',
        'name_ar': 'خاضع للضريبة بالنسبة الأساسية',
        'description': 'Most goods & services, commercial real estate',
        'peppol_code': 'AE',
        'oracle_code': 'S-UAE',
        'taxable': True
    },
    'ZR': {
        'rate': Decimal('0.00'),
        'name': 'Zero-rated',
        'name_ar': 'خاضع للضريبة بنسبة الصفر',
        'description': 'Exports, international transport, first sale residential property, healthcare, education',
        'peppol_code': 'Z',
        'oracle_code': 'Z-UAE',
        'taxable': True
    },
    'ES': {
        'rate': None,
        'name': 'Exempt',
        'name_ar': 'معفى من الضريبة',
        'description': 'Subsequent residential property sales, bare land, financial services',
        'peppol_code': 'E',
        'oracle_code': 'X-UAE',
        'taxable': False
    },
    'RC': {
        'rate': Decimal('0.05'),
        'name': 'Reverse charge',
        'name_ar': 'آلية الاحتساب العكسي',
        'description': 'Importer accounting for VAT (both output & input)',
        'peppol_code': 'AE',
        'oracle_code': 'RCP-UAE, RCS-UAE',
        'taxable': True
    },
    'OP': {
        'rate': None,
        'name': 'Out of scope',
        'name_ar': 'خارج نطاق الضريبة',
        'description': 'Non-UAE supplies',
        'peppol_code': 'O',
        'oracle_code': 'NO_TAX-UAE',
        'taxable': False
    }
}


def is_valid_tax_code(tax_code: str) -> bool:
    """
    Validate UAE tax code.
    
    Args:
        tax_code: Tax code to validate (SR, ZR, ES, RC, OP)
    
    Returns:
        True if valid, False otherwise
    """
    return tax_code in UAE_TAX_CODES


def get_tax_code_info(tax_code: str) -> Dict:
    """
    Get detailed information about a tax code.
    
    Args:
        tax_code: UAE tax code (SR, ZR, ES, RC, OP)
    
    Returns:
        Dictionary with tax code details
    
    Raises:
        ValueError: If tax code is invalid
    """
    if not is_valid_tax_code(tax_code):
        raise ValueError(f"Invalid tax code: {tax_code}. Must be one of {list(UAE_TAX_CODES.keys())}")
    
    return UAE_TAX_CODES[tax_code].copy()


def calculate_vat(amount: Decimal, tax_code: str, is_inclusive: bool = False) -> Dict[str, Any]:
    """
    Calculate VAT for a given amount and tax code.
    
    UAE FTA recommends tax-exclusive pricing (amount + VAT = total).
    
    Args:
        amount: Net amount (if exclusive) or gross amount (if inclusive)
        tax_code: UAE tax code (SR, ZR, ES, RC, OP)
        is_inclusive: If True, amount includes VAT; if False, amount excludes VAT
    
    Returns:
        Dictionary containing:
        - net_amount: Amount excluding VAT
        - vat_amount: VAT amount
        - total_amount: Amount including VAT
        - tax_code: Applied tax code
        - tax_rate: Applied tax rate (or None)
    
    Raises:
        ValueError: If tax code is invalid
    
    Examples:
        >>> calculate_vat(Decimal('1000'), 'SR', is_inclusive=False)
        {'net_amount': Decimal('1000.00'), 'vat_amount': Decimal('50.00'), 
         'total_amount': Decimal('1050.00'), 'tax_code': 'SR', 'tax_rate': Decimal('0.05')}
        
        >>> calculate_vat(Decimal('1050'), 'SR', is_inclusive=True)
        {'net_amount': Decimal('1000.00'), 'vat_amount': Decimal('50.00'), 
         'total_amount': Decimal('1050.00'), 'tax_code': 'SR', 'tax_rate': Decimal('0.05')}
        
        >>> calculate_vat(Decimal('1000'), 'ZR', is_inclusive=False)
        {'net_amount': Decimal('1000.00'), 'vat_amount': Decimal('0.00'), 
         'total_amount': Decimal('1000.00'), 'tax_code': 'ZR', 'tax_rate': Decimal('0.00')}
        
        >>> calculate_vat(Decimal('1000'), 'ES', is_inclusive=False)
        {'net_amount': Decimal('1000.00'), 'vat_amount': Decimal('0.00'), 
         'total_amount': Decimal('1000.00'), 'tax_code': 'ES', 'tax_rate': None}
    """
    if not is_valid_tax_code(tax_code):
        raise ValueError(f"Invalid tax code: {tax_code}")
    
    tax_info = UAE_TAX_CODES[tax_code]
    rate = tax_info['rate']
    
    if rate is None:
        return {
            'net_amount': amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'vat_amount': Decimal('0.00'),
            'total_amount': amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'tax_code': tax_code,
            'tax_rate': None
        }
    
    if is_inclusive:
        total = amount
        net = total / (Decimal('1') + rate)
        vat = total - net
    else:
        net = amount
        vat = amount * rate
        total = net + vat
    
    return {
        'net_amount': net.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'vat_amount': vat.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'total_amount': total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'tax_code': tax_code,
        'tax_rate': rate
    }


def calculate_line_item_vat(quantity: Decimal, unit_price: Decimal, tax_code: str, 
                           is_inclusive: bool = False) -> Dict[str, Any]:
    """
    Calculate VAT for a line item (quantity × unit price).
    
    Args:
        quantity: Item quantity
        unit_price: Price per unit
        tax_code: UAE tax code
        is_inclusive: If True, unit_price includes VAT
    
    Returns:
        Dictionary with line totals and VAT breakdown
    """
    line_amount = quantity * unit_price
    vat_calc = calculate_vat(line_amount, tax_code, is_inclusive)
    
    return {
        'quantity': quantity,
        'unit_price': unit_price.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'line_net': vat_calc['net_amount'],
        'line_vat': vat_calc['vat_amount'],
        'line_total': vat_calc['total_amount'],
        'tax_code': tax_code,
        'tax_rate': vat_calc['tax_rate']
    }


def aggregate_invoice_vat(line_items: list) -> Dict[str, Any]:
    """
    Aggregate VAT from multiple line items.
    
    Args:
        line_items: List of line item calculations (from calculate_line_item_vat)
    
    Returns:
        Dictionary with invoice totals:
        - subtotal: Sum of all net amounts
        - total_vat: Sum of all VAT amounts
        - grand_total: Sum of all line totals
        - vat_by_code: Breakdown by tax code
    """
    subtotal = Decimal('0.00')
    total_vat = Decimal('0.00')
    grand_total = Decimal('0.00')
    vat_by_code = {}
    
    for item in line_items:
        subtotal += item['line_net']
        total_vat += item['line_vat']
        grand_total += item['line_total']
        
        tax_code = item['tax_code']
        if tax_code not in vat_by_code:
            vat_by_code[tax_code] = {
                'net': Decimal('0.00'),
                'vat': Decimal('0.00'),
                'total': Decimal('0.00')
            }
        
        vat_by_code[tax_code]['net'] += item['line_net']
        vat_by_code[tax_code]['vat'] += item['line_vat']
        vat_by_code[tax_code]['total'] += item['line_total']
    
    return {
        'subtotal': subtotal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'total_vat': total_vat.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'grand_total': grand_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'vat_by_code': vat_by_code
    }


def is_valid_trn(trn: str) -> bool:
    """
    Validate UAE Tax Registration Number (TRN) format.
    
    UAE TRN Format:
    - Exactly 15 digits
    - No letters, spaces, or special characters
    
    Args:
        trn: Tax Registration Number to validate
    
    Returns:
        True if valid format, False otherwise
    
    Examples:
        >>> is_valid_trn('123456789012345')
        True
        >>> is_valid_trn('12345678901234')
        False
        >>> is_valid_trn('123456789012345A')
        False
    """
    if not trn:
        return False
    
    trn_pattern = re.compile(r'^\d{15}$')
    return bool(trn_pattern.match(trn))


def format_trn(trn: str) -> str:
    """
    Format TRN for display (add spaces for readability).
    
    Args:
        trn: 15-digit TRN
    
    Returns:
        Formatted TRN (e.g., '123456789012345' → '123 4567 8901 2345')
    
    Examples:
        >>> format_trn('123456789012345')
        '123 4567 8901 2345'
    """
    if not is_valid_trn(trn):
        return trn
    
    return f"{trn[:3]} {trn[3:7]} {trn[7:11]} {trn[11:15]}"


def classify_invoice_type(total_amount: Decimal, vat_enabled: bool) -> str:
    """
    Classify invoice type based on UAE FTA regulations.
    
    UAE FTA Rules:
    - Total >= AED 10,000 → Full Tax Invoice (must show supplier & customer TRN)
    - Total < AED 10,000 → Simplified Tax Invoice (only supplier TRN required)
    - Non-VAT business → Standard Invoice (no TRN requirements)
    
    Args:
        total_amount: Invoice total amount (including VAT)
        vat_enabled: Whether business is VAT-registered
    
    Returns:
        'full', 'simplified', or 'standard'
    
    Examples:
        >>> classify_invoice_type(Decimal('15000'), True)
        'full'
        >>> classify_invoice_type(Decimal('5000'), True)
        'simplified'
        >>> classify_invoice_type(Decimal('15000'), False)
        'standard'
    """
    if not vat_enabled:
        return 'standard'
    
    threshold = Decimal('10000.00')
    
    if total_amount >= threshold:
        return 'full'
    else:
        return 'simplified'


def get_invoice_type_label(invoice_type: str, language: str = 'en') -> str:
    """
    Get human-readable label for invoice type.
    
    Args:
        invoice_type: 'full', 'simplified', or 'standard'
        language: 'en' or 'ar'
    
    Returns:
        Invoice type label
    """
    labels = {
        'full': {
            'en': 'TAX INVOICE',
            'ar': 'فاتورة ضريبية'
        },
        'simplified': {
            'en': 'SIMPLIFIED TAX INVOICE',
            'ar': 'فاتورة ضريبية مبسطة'
        },
        'standard': {
            'en': 'INVOICE',
            'ar': 'فاتورة'
        }
    }
    
    return labels.get(invoice_type, {}).get(language, 'INVOICE')


def calculate_vat_return(
    sales_invoices_vat: Decimal,
    purchase_bills_vat: Decimal,
    purchase_expenses_vat: Decimal
) -> Dict[str, Any]:
    """
    Calculate VAT return (Output VAT - Input VAT).
    
    Args:
        sales_invoices_vat: Total VAT from sales invoices (Output VAT)
        purchase_bills_vat: Total VAT from purchase bills (Input VAT)
        purchase_expenses_vat: Total VAT from expenses (Input VAT)
    
    Returns:
        Dictionary with VAT return calculation:
        - output_vat: Total output VAT (sales)
        - input_vat_bills: Input VAT from bills
        - input_vat_expenses: Input VAT from expenses
        - total_input_vat: Total input VAT
        - net_vat_payable: Amount payable to FTA (or refundable if negative)
    """
    output_vat = sales_invoices_vat
    input_vat_bills = purchase_bills_vat
    input_vat_expenses = purchase_expenses_vat
    total_input_vat = input_vat_bills + input_vat_expenses
    net_vat_payable = output_vat - total_input_vat
    
    return {
        'output_vat': output_vat.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'input_vat_bills': input_vat_bills.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'input_vat_expenses': input_vat_expenses.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'total_input_vat': total_input_vat.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'net_vat_payable': net_vat_payable.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    }


if __name__ == '__main__':
    print("UAE VAT Utilities Module")
    print("=" * 50)
    print("\nTax Codes:")
    for code, info in UAE_TAX_CODES.items():
        rate_str = f"{info['rate'] * 100}%" if info['rate'] is not None else "N/A"
        print(f"{code}: {info['name']} ({rate_str}) - {info['description']}")
    
    print("\n" + "=" * 50)
    print("\nExample Calculations:")
    
    print("\n1. Standard-rated (SR) - AED 1,000 (exclusive):")
    result = calculate_vat(Decimal('1000'), 'SR', is_inclusive=False)
    print(f"   Net: AED {result['net_amount']}")
    print(f"   VAT: AED {result['vat_amount']}")
    print(f"   Total: AED {result['total_amount']}")
    
    print("\n2. Zero-rated (ZR) - AED 1,000 (exclusive):")
    result = calculate_vat(Decimal('1000'), 'ZR', is_inclusive=False)
    print(f"   Net: AED {result['net_amount']}")
    print(f"   VAT: AED {result['vat_amount']}")
    print(f"   Total: AED {result['total_amount']}")
    
    print("\n3. Exempt (ES) - AED 1,000:")
    result = calculate_vat(Decimal('1000'), 'ES', is_inclusive=False)
    print(f"   Net: AED {result['net_amount']}")
    print(f"   VAT: AED {result['vat_amount']}")
    print(f"   Total: AED {result['total_amount']}")
    
    print("\n4. TRN Validation:")
    print(f"   '123456789012345' valid? {is_valid_trn('123456789012345')}")
    print(f"   '12345' valid? {is_valid_trn('12345')}")
    print(f"   Formatted: {format_trn('123456789012345')}")
    
    print("\n5. Invoice Classification:")
    print(f"   AED 15,000 (VAT-enabled): {classify_invoice_type(Decimal('15000'), True)}")
    print(f"   AED 5,000 (VAT-enabled): {classify_invoice_type(Decimal('5000'), True)}")
    print(f"   AED 15,000 (non-VAT): {classify_invoice_type(Decimal('15000'), False)}")

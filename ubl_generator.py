"""
UBL 2.1 / PINT-AE XML Invoice Generator for UAE E-Invoicing
Compliant with PINT UAE specification and Peppol BIS Billing 3.0
"""
from datetime import datetime, date
from typing import List, Dict, Any
import hashlib


def generate_pint_ae_xml(invoice_data: Dict[str, Any]) -> str:
    """
    Generate PINT-AE compliant UBL 2.1 XML invoice
    
    Args:
        invoice_data: Dictionary containing all invoice fields
        
    Returns:
        XML string compliant with PINT-AE specification
    """
    
    # Extract data
    invoice = invoice_data["invoice"]
    line_items = invoice_data.get("line_items", [])
    tax_breakdowns = invoice_data.get("tax_breakdowns", [])
    
    # UBL namespace declarations
    namespaces = '''xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"'''
    
    # Build XML
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Invoice {namespaces}>
    <!-- PINT-AE Profile and Customization -->
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    
    <!-- Invoice Identification -->
    <cbc:ID>{_xml_escape(invoice["invoice_number"])}</cbc:ID>
    <cbc:IssueDate>{_format_date(invoice["issue_date"])}</cbc:IssueDate>
    {f'<cbc:DueDate>{_format_date(invoice["due_date"])}</cbc:DueDate>' if invoice.get("due_date") else ''}
    <cbc:InvoiceTypeCode>{invoice["invoice_type"]}</cbc:InvoiceTypeCode>
    {f'<cbc:Note>{_xml_escape(invoice["invoice_notes"])}</cbc:Note>' if invoice.get("invoice_notes") else ''}
    <cbc:DocumentCurrencyCode>{invoice["currency_code"]}</cbc:DocumentCurrencyCode>
    {f'<cbc:BuyerReference>{_xml_escape(invoice["reference_number"])}</cbc:BuyerReference>' if invoice.get("reference_number") else ''}
    
    <!-- Preceding Invoice Reference (for credit notes) -->
    {_generate_preceding_invoice_reference(invoice) if invoice.get("preceding_invoice_id") else ''}
    
    <!-- Accounting Supplier Party (Issuer) -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <!-- Supplier Peppol Endpoint ID -->
            {_generate_endpoint_id(invoice.get("supplier_peppol_id")) if invoice.get("supplier_peppol_id") else ''}
            
            <!-- Supplier Postal Address -->
            <cac:PostalAddress>
                {f'<cbc:StreetName>{_xml_escape(invoice.get("supplier_address", ""))}</cbc:StreetName>' if invoice.get("supplier_address") else ''}
                {f'<cbc:CityName>{_xml_escape(invoice.get("supplier_city", ""))}</cbc:CityName>' if invoice.get("supplier_city") else ''}
                <cbc:CountrySubentityCode>{invoice.get("supplier_country", "AE")}</cbc:CountrySubentityCode>
                <cac:Country>
                    <cbc:IdentificationCode>{invoice.get("supplier_country", "AE")}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            
            <!-- Supplier Tax Scheme (TRN) -->
            <cac:PartyTaxScheme>
                <cbc:CompanyID>{invoice["supplier_trn"]}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            
            <!-- Supplier Legal Entity -->
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{_xml_escape(invoice["supplier_name"])}</cbc:RegistrationName>
                <cbc:CompanyID>{invoice.get("supplier_peppol_id", invoice["supplier_trn"][:10])}</cbc:CompanyID>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <!-- Accounting Customer Party (Buyer) -->
    <cac:AccountingCustomerParty>
        <cac:Party>
            <!-- Customer Peppol Endpoint ID -->
            {_generate_endpoint_id(invoice.get("customer_peppol_id")) if invoice.get("customer_peppol_id") else ''}
            
            <!-- Customer Postal Address -->
            <cac:PostalAddress>
                {f'<cbc:StreetName>{_xml_escape(invoice.get("customer_address", ""))}</cbc:StreetName>' if invoice.get("customer_address") else ''}
                {f'<cbc:CityName>{_xml_escape(invoice.get("customer_city", ""))}</cbc:CityName>' if invoice.get("customer_city") else ''}
                <cac:Country>
                    <cbc:IdentificationCode>{invoice.get("customer_country", "AE")}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            
            <!-- Customer Tax Scheme (TRN if available) -->
            {_generate_customer_tax_scheme(invoice.get("customer_trn")) if invoice.get("customer_trn") else ''}
            
            <!-- Customer Legal Entity -->
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{_xml_escape(invoice["customer_name"])}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <!-- Payment Terms -->
    {_generate_payment_terms(invoice) if invoice.get("payment_terms") or invoice.get("payment_due_days") else ''}
    
    <!-- Tax Total -->
    {_generate_tax_total(tax_breakdowns, invoice["currency_code"])}
    
    <!-- Legal Monetary Total -->
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="{invoice["currency_code"]}">{_format_amount(invoice["subtotal_amount"])}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="{invoice["currency_code"]}">{_format_amount(invoice["subtotal_amount"])}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="{invoice["currency_code"]}">{_format_amount(invoice["total_amount"])}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="{invoice["currency_code"]}">{_format_amount(invoice["amount_due"])}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    
    <!-- Invoice Lines -->
{_generate_invoice_lines(line_items, invoice["currency_code"])}
</Invoice>'''
    
    return xml


def _xml_escape(text: str) -> str:
    """Escape XML special characters"""
    if not text:
        return ""
    return (text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;"))


def _format_date(date_value) -> str:
    """Format date to YYYY-MM-DD"""
    if isinstance(date_value, str):
        return date_value.split("T")[0]  # Handle ISO datetime strings
    elif isinstance(date_value, (datetime, date)):
        return date_value.strftime("%Y-%m-%d")
    return str(date_value)


def _format_amount(amount: float) -> str:
    """Format monetary amount to 2 decimal places"""
    return f"{float(amount):.2f}"


def _generate_endpoint_id(peppol_id: str) -> str:
    """Generate Peppol endpoint ID element"""
    return f'''<cbc:EndpointID schemeID="0190">{peppol_id}</cbc:EndpointID>'''


def _generate_customer_tax_scheme(trn: str) -> str:
    """Generate customer tax scheme element"""
    return f'''<cac:PartyTaxScheme>
                <cbc:CompanyID>{trn}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>'''


def _generate_preceding_invoice_reference(invoice: dict) -> str:
    """Generate preceding invoice reference for credit notes"""
    ref = f'''<cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>{_xml_escape(invoice.get("preceding_invoice_number", ""))}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>'''
    
    # Add credit note reason if present
    if invoice.get("credit_note_reason"):
        ref += f'''
    <cbc:CreditNoteReasonCode>{_xml_escape(invoice["credit_note_reason"])}</cbc:CreditNoteReasonCode>'''
    
    return ref


def _generate_payment_terms(invoice: dict) -> str:
    """Generate payment terms element"""
    terms = invoice.get("payment_terms", "")
    if not terms and invoice.get("payment_due_days"):
        terms = f"Payment due within {invoice['payment_due_days']} days"
    
    return f'''<cac:PaymentTerms>
        <cbc:Note>{_xml_escape(terms)}</cbc:Note>
    </cac:PaymentTerms>'''


def _generate_tax_total(tax_breakdowns: List[dict], currency: str) -> str:
    """Generate tax total element with breakdowns"""
    total_tax = sum(tb.get("tax_amount", 0) for tb in tax_breakdowns)
    
    xml = f'''<cac:TaxTotal>
        <cbc:TaxAmount currencyID="{currency}">{_format_amount(total_tax)}</cbc:TaxAmount>'''
    
    for tb in tax_breakdowns:
        category_code = tb.get("tax_category", "S")
        xml += f'''
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="{currency}">{_format_amount(tb["taxable_amount"])}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="{currency}">{_format_amount(tb["tax_amount"])}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>{category_code}</cbc:ID>
                <cbc:Percent>{_format_amount(tb["tax_percent"])}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>'''
    
    xml += '''
    </cac:TaxTotal>'''
    return xml


def _generate_invoice_lines(line_items: List[dict], currency: str) -> str:
    """Generate all invoice line elements"""
    xml = ""
    for line in line_items:
        xml += f'''    <cac:InvoiceLine>
        <cbc:ID>{line["line_number"]}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="{line.get("unit_code", "C62")}">{_format_amount(line["quantity"])}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="{currency}">{_format_amount(line["line_extension_amount"])}</cbc:LineExtensionAmount>
        
        <cac:Item>
            <cbc:Name>{_xml_escape(line["item_name"])}</cbc:Name>
            {f'<cbc:Description>{_xml_escape(line["item_description"])}</cbc:Description>' if line.get("item_description") else ''}
            {f'<cac:SellersItemIdentification><cbc:ID>{_xml_escape(line["item_code"])}</cbc:ID></cac:SellersItemIdentification>' if line.get("item_code") else ''}
            
            <cac:ClassifiedTaxCategory>
                <cbc:ID>{line.get("tax_category", "S")}</cbc:ID>
                <cbc:Percent>{_format_amount(line.get("tax_percent", 5.0))}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        
        <cac:Price>
            <cbc:PriceAmount currencyID="{currency}">{_format_amount(line["unit_price"])}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
'''
    return xml


def calculate_xml_hash(xml_content: str) -> str:
    """Calculate SHA-256 hash of XML content"""
    return hashlib.sha256(xml_content.encode('utf-8')).hexdigest()


def validate_pint_ae_invoice(invoice_data: Dict[str, Any]) -> List[str]:
    """
    Validate invoice data against PINT-AE mandatory requirements
    Returns list of validation errors (empty if valid)
    """
    errors = []
    invoice = invoice_data.get("invoice", {})
    line_items = invoice_data.get("line_items", [])
    
    # Mandatory fields check
    required_fields = [
        ("invoice_number", "Invoice number"),
        ("issue_date", "Issue date"),
        ("invoice_type", "Invoice type code"),
        ("currency_code", "Currency code"),
        ("supplier_trn", "Supplier TRN"),
        ("supplier_name", "Supplier name"),
        ("customer_name", "Customer name"),
    ]
    
    for field, label in required_fields:
        if not invoice.get(field):
            errors.append(f"Missing required field: {label}")
    
    # Line items required
    if not line_items:
        errors.append("At least one invoice line item is required")
    
    # TRN format validation (15 digits)
    if invoice.get("supplier_trn") and len(str(invoice["supplier_trn"])) != 15:
        errors.append("Supplier TRN must be exactly 15 digits")
    
    if invoice.get("customer_trn") and len(str(invoice["customer_trn"])) != 15:
        errors.append("Customer TRN must be exactly 15 digits")
    
    # Credit note validation
    if invoice.get("invoice_type") == "381":  # Tax credit note
        if not invoice.get("credit_note_reason"):
            errors.append("Credit note reason is mandatory for type 381")
        if not invoice.get("preceding_invoice_id"):
            errors.append("Preceding invoice reference is mandatory for credit notes")
    
    # Currency must be AED or have AED conversion
    if invoice.get("currency_code") != "AED":
        if not invoice.get("total_amount_aed"):
            errors.append("AED conversion amount required when currency is not AED")
    
    return errors

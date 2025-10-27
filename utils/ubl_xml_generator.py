"""
UBL 2.1 XML Generator for UAE PINT-AE E-Invoicing
Generates compliant XML invoices following PEPPOL BIS and UAE FTA requirements
"""
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from xml.etree.ElementTree import Element, SubElement, tostring, ElementTree
from xml.dom import minidom


class UBLXMLGenerator:
    """Generates UBL 2.1 XML for invoices compliant with UAE PINT-AE profile"""
    
    # UBL 2.1 Namespaces
    NAMESPACES = {
        'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
    }
    
    def __init__(self):
        self.root = None
    
    def generate_invoice_xml(self, invoice_data: Dict[str, Any], line_items: List[Dict[str, Any]]) -> str:
        """
        Generate complete UBL 2.1 Invoice XML
        
        Args:
            invoice_data: Dictionary containing invoice header data
            line_items: List of invoice line items
            
        Returns:
            Pretty-printed XML string
        """
        # Create root Invoice element with namespaces
        self.root = Element('Invoice')
        for prefix, uri in self.NAMESPACES.items():
            self.root.set(prefix, uri)
        
        # Build XML structure
        self._add_ubl_version()
        self._add_customization_id()
        self._add_profile_id()
        self._add_invoice_header(invoice_data)
        self._add_supplier_party(invoice_data)
        self._add_customer_party(invoice_data)
        self._add_payment_terms(invoice_data)
        self._add_tax_total(invoice_data)
        self._add_monetary_total(invoice_data)
        self._add_invoice_lines(line_items)
        
        # Convert to pretty XML string
        return self._prettify_xml(self.root)
    
    def _add_element(self, parent: Element, tag: str, text: str = None, attributes: Dict[str, str] = None) -> Element:
        """Helper to add element with namespace prefix"""
        if ':' in tag:
            # Already has namespace prefix
            elem = SubElement(parent, tag)
        else:
            # Add cbc: prefix for basic components
            elem = SubElement(parent, f"cbc:{tag}")
        
        if text is not None:
            elem.text = str(text)
        
        if attributes:
            for key, value in attributes.items():
                elem.set(key, value)
        
        return elem
    
    def _add_ubl_version(self):
        """Add UBL version information"""
        self._add_element(self.root, 'UBLVersionID', '2.1')
    
    def _add_customization_id(self):
        """Add PEPPOL BIS customization identifier"""
        self._add_element(
            self.root, 
            'CustomizationID',
            'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'
        )
    
    def _add_profile_id(self):
        """Add UAE PINT-AE profile identifier"""
        self._add_element(
            self.root,
            'ProfileID',
            'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'
        )
    
    def _add_invoice_header(self, invoice_data: Dict[str, Any]):
        """Add invoice header information"""
        # Invoice number
        self._add_element(self.root, 'ID', invoice_data.get('invoice_number', ''))
        
        # Issue date
        issue_date = invoice_data.get('issue_date')
        if isinstance(issue_date, (datetime, date)):
            issue_date = issue_date.strftime('%Y-%m-%d')
        self._add_element(self.root, 'IssueDate', issue_date or datetime.now().strftime('%Y-%m-%d'))
        
        # Due date
        due_date = invoice_data.get('due_date')
        if due_date:
            if isinstance(due_date, (datetime, date)):
                due_date = due_date.strftime('%Y-%m-%d')
            self._add_element(self.root, 'DueDate', due_date)
        
        # Invoice type code (380 = Commercial Invoice, 381 = Credit Note)
        invoice_type = invoice_data.get('invoice_type', 'TAX_INVOICE')
        type_code = '381' if 'CREDIT' in invoice_type.upper() else '380'
        self._add_element(self.root, 'InvoiceTypeCode', type_code)
        
        # Document currency
        self._add_element(self.root, 'DocumentCurrencyCode', invoice_data.get('currency_code', 'AED'))
        
        # Tax currency (always AED for UAE)
        self._add_element(self.root, 'TaxCurrencyCode', 'AED')
        
        # Note/Description
        if invoice_data.get('invoice_notes'):
            self._add_element(self.root, 'Note', invoice_data['invoice_notes'])
        
        # Order reference (if exists)
        if invoice_data.get('reference_number'):
            order_ref = SubElement(self.root, 'cac:OrderReference')
            self._add_element(order_ref, 'ID', invoice_data['reference_number'])
        
        # Credit note reference (for credit notes)
        if invoice_data.get('preceding_invoice_id'):
            billing_ref = SubElement(self.root, 'cac:BillingReference')
            invoice_doc_ref = SubElement(billing_ref, 'cac:InvoiceDocumentReference')
            self._add_element(invoice_doc_ref, 'ID', invoice_data['preceding_invoice_id'])
    
    def _add_supplier_party(self, invoice_data: Dict[str, Any]):
        """Add supplier (seller) party information"""
        supplier_party = SubElement(self.root, 'cac:AccountingSupplierParty')
        party = SubElement(supplier_party, 'cac:Party')
        
        # Supplier PEPPOL ID (if available)
        if invoice_data.get('supplier_peppol_id'):
            endpoint_id = SubElement(party, 'cbc:EndpointID')
            endpoint_id.set('schemeID', '0195')  # UAE TRN scheme
            endpoint_id.text = invoice_data['supplier_peppol_id']
        
        # Party identification (TRN)
        party_id_elem = SubElement(party, 'cac:PartyIdentification')
        trn_id = self._add_element(party_id_elem, 'ID', invoice_data.get('supplier_trn', ''))
        trn_id.set('schemeID', 'TRN')  # UAE Tax Registration Number
        
        # Party name
        party_name = SubElement(party, 'cac:PartyName')
        self._add_element(party_name, 'Name', invoice_data.get('supplier_name', ''))
        
        # Postal address
        if invoice_data.get('supplier_address') or invoice_data.get('supplier_city'):
            postal_addr = SubElement(party, 'cac:PostalAddress')
            
            if invoice_data.get('supplier_address'):
                self._add_element(postal_addr, 'StreetName', invoice_data['supplier_address'])
            
            if invoice_data.get('supplier_city'):
                self._add_element(postal_addr, 'CityName', invoice_data['supplier_city'])
            
            country = SubElement(postal_addr, 'cac:Country')
            self._add_element(country, 'IdentificationCode', invoice_data.get('supplier_country', 'AE'))
        
        # Party tax scheme (VAT)
        party_tax = SubElement(party, 'cac:PartyTaxScheme')
        self._add_element(party_tax, 'CompanyID', invoice_data.get('supplier_trn', ''))
        tax_scheme = SubElement(party_tax, 'cac:TaxScheme')
        self._add_element(tax_scheme, 'ID', 'VAT')
        
        # Party legal entity
        party_legal = SubElement(party, 'cac:PartyLegalEntity')
        self._add_element(party_legal, 'RegistrationName', invoice_data.get('supplier_name', ''))
    
    def _add_customer_party(self, invoice_data: Dict[str, Any]):
        """Add customer (buyer) party information"""
        customer_party = SubElement(self.root, 'cac:AccountingCustomerParty')
        party = SubElement(customer_party, 'cac:Party')
        
        # Customer PEPPOL ID (if available)
        if invoice_data.get('customer_peppol_id'):
            endpoint_id = SubElement(party, 'cbc:EndpointID')
            endpoint_id.set('schemeID', '0195')
            endpoint_id.text = invoice_data['customer_peppol_id']
        
        # Party identification (TRN - optional for B2C)
        if invoice_data.get('customer_trn'):
            party_id_elem = SubElement(party, 'cac:PartyIdentification')
            trn_id = self._add_element(party_id_elem, 'ID', invoice_data['customer_trn'])
            trn_id.set('schemeID', 'TRN')
        
        # Party name
        party_name = SubElement(party, 'cac:PartyName')
        self._add_element(party_name, 'Name', invoice_data.get('customer_name', ''))
        
        # Postal address
        if invoice_data.get('customer_address') or invoice_data.get('customer_city'):
            postal_addr = SubElement(party, 'cac:PostalAddress')
            
            if invoice_data.get('customer_address'):
                self._add_element(postal_addr, 'StreetName', invoice_data['customer_address'])
            
            if invoice_data.get('customer_city'):
                self._add_element(postal_addr, 'CityName', invoice_data['customer_city'])
            
            country = SubElement(postal_addr, 'cac:Country')
            self._add_element(country, 'IdentificationCode', invoice_data.get('customer_country', 'AE'))
        
        # Party legal entity
        party_legal = SubElement(party, 'cac:PartyLegalEntity')
        self._add_element(party_legal, 'RegistrationName', invoice_data.get('customer_name', ''))
        
        # Contact (email if available)
        if invoice_data.get('customer_email'):
            contact = SubElement(party, 'cac:Contact')
            self._add_element(contact, 'ElectronicMail', invoice_data['customer_email'])
    
    def _add_payment_terms(self, invoice_data: Dict[str, Any]):
        """Add payment terms"""
        if invoice_data.get('payment_terms'):
            payment_terms = SubElement(self.root, 'cac:PaymentTerms')
            self._add_element(payment_terms, 'Note', invoice_data['payment_terms'])
    
    def _add_tax_total(self, invoice_data: Dict[str, Any]):
        """Add tax total (VAT) information"""
        tax_total = SubElement(self.root, 'cac:TaxTotal')
        
        # Tax amount in document currency
        tax_amt = self._add_element(tax_total, 'TaxAmount', f"{invoice_data.get('tax_amount', 0.0):.2f}")
        tax_amt.set('currencyID', invoice_data.get('currency_code', 'AED'))
        
        # Tax subtotal (VAT breakdown)
        tax_subtotal = SubElement(tax_total, 'cac:TaxSubtotal')
        
        taxable_amt = self._add_element(
            tax_subtotal,
            'TaxableAmount',
            f"{invoice_data.get('subtotal_amount', 0.0):.2f}"
        )
        taxable_amt.set('currencyID', invoice_data.get('currency_code', 'AED'))
        
        tax_amt_sub = self._add_element(
            tax_subtotal,
            'TaxAmount',
            f"{invoice_data.get('tax_amount', 0.0):.2f}"
        )
        tax_amt_sub.set('currencyID', invoice_data.get('currency_code', 'AED'))
        
        # Tax category
        tax_category = SubElement(tax_subtotal, 'cac:TaxCategory')
        self._add_element(tax_category, 'ID', 'S')  # Standard rate
        
        # Tax percent (5% for UAE standard rate)
        tax_rate = (invoice_data.get('tax_amount', 0.0) / invoice_data.get('subtotal_amount', 1.0) * 100) if invoice_data.get('subtotal_amount', 0) > 0 else 5.0
        self._add_element(tax_category, 'Percent', f"{tax_rate:.2f}")
        
        tax_scheme = SubElement(tax_category, 'cac:TaxScheme')
        self._add_element(tax_scheme, 'ID', 'VAT')
        
        # Add tax total in AED (if different currency)
        if invoice_data.get('currency_code', 'AED') != 'AED' and invoice_data.get('total_amount_aed'):
            tax_total_aed = SubElement(self.root, 'cac:TaxTotal')
            tax_amt_aed = self._add_element(tax_total_aed, 'TaxAmount', f"{invoice_data.get('tax_amount', 0.0):.2f}")
            tax_amt_aed.set('currencyID', 'AED')
    
    def _add_monetary_total(self, invoice_data: Dict[str, Any]):
        """Add legal monetary totals"""
        legal_total = SubElement(self.root, 'cac:LegalMonetaryTotal')
        
        currency = invoice_data.get('currency_code', 'AED')
        
        # Line extension amount (subtotal before tax)
        line_ext = self._add_element(
            legal_total,
            'LineExtensionAmount',
            f"{invoice_data.get('subtotal_amount', 0.0):.2f}"
        )
        line_ext.set('currencyID', currency)
        
        # Tax exclusive amount
        tax_excl = self._add_element(
            legal_total,
            'TaxExclusiveAmount',
            f"{invoice_data.get('subtotal_amount', 0.0):.2f}"
        )
        tax_excl.set('currencyID', currency)
        
        # Tax inclusive amount
        tax_incl = self._add_element(
            legal_total,
            'TaxInclusiveAmount',
            f"{invoice_data.get('total_amount', 0.0):.2f}"
        )
        tax_incl.set('currencyID', currency)
        
        # Payable amount
        payable = self._add_element(
            legal_total,
            'PayableAmount',
            f"{invoice_data.get('amount_due', invoice_data.get('total_amount', 0.0)):.2f}"
        )
        payable.set('currencyID', currency)
    
    def _add_invoice_lines(self, line_items: List[Dict[str, Any]]):
        """Add invoice line items"""
        for item in line_items:
            inv_line = SubElement(self.root, 'cac:InvoiceLine')
            
            # Line ID
            self._add_element(inv_line, 'ID', str(item.get('line_number', 1)))
            
            # Invoiced quantity
            quantity = self._add_element(
                inv_line,
                'InvoicedQuantity',
                f"{item.get('quantity', 1.0):.2f}"
            )
            quantity.set('unitCode', item.get('unit_code', 'C62'))  # C62 = piece
            
            # Line extension amount
            line_ext = self._add_element(
                inv_line,
                'LineExtensionAmount',
                f"{item.get('line_extension_amount', 0.0):.2f}"
            )
            line_ext.set('currencyID', 'AED')
            
            # Item
            item_elem = SubElement(inv_line, 'cac:Item')
            self._add_element(item_elem, 'Description', item.get('item_description', item.get('item_name', '')))
            self._add_element(item_elem, 'Name', item.get('item_name', ''))
            
            # Item classification (if code exists)
            if item.get('item_code'):
                classification = SubElement(item_elem, 'cac:SellersItemIdentification')
                self._add_element(classification, 'ID', item['item_code'])
            
            # Tax category for item
            tax_category = SubElement(item_elem, 'cac:ClassifiedTaxCategory')
            self._add_element(tax_category, 'ID', 'S')  # Standard rate
            self._add_element(tax_category, 'Percent', f"{item.get('tax_percent', 5.0):.2f}")
            
            tax_scheme = SubElement(tax_category, 'cac:TaxScheme')
            self._add_element(tax_scheme, 'ID', 'VAT')
            
            # Price
            price = SubElement(inv_line, 'cac:Price')
            price_amt = self._add_element(price, 'PriceAmount', f"{item.get('unit_price', 0.0):.2f}")
            price_amt.set('currencyID', 'AED')
    
    def _prettify_xml(self, elem: Element) -> str:
        """Return a pretty-printed XML string"""
        rough_string = tostring(elem, encoding='utf-8')
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ", encoding='utf-8').decode('utf-8')
    
    @staticmethod
    def validate_invoice_data(invoice_data: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        Validate invoice data before generating XML
        
        Returns:
            tuple: (is_valid, list_of_errors)
        """
        errors = []
        
        # Required fields
        required_fields = [
            'invoice_number', 'issue_date', 'supplier_trn', 'supplier_name',
            'customer_name', 'subtotal_amount', 'tax_amount', 'total_amount'
        ]
        
        for field in required_fields:
            if not invoice_data.get(field):
                errors.append(f"Missing required field: {field}")
        
        # Validate TRN format (15 digits for UAE)
        if invoice_data.get('supplier_trn'):
            trn = str(invoice_data['supplier_trn']).replace(' ', '')
            if not trn.isdigit() or len(trn) != 15:
                errors.append("Supplier TRN must be 15 digits")
        
        # Validate amounts
        subtotal = float(invoice_data.get('subtotal_amount', 0))
        tax = float(invoice_data.get('tax_amount', 0))
        total = float(invoice_data.get('total_amount', 0))
        
        if abs(total - (subtotal + tax)) > 0.01:  # Allow small rounding differences
            errors.append(f"Total amount mismatch: {total} != {subtotal} + {tax}")
        
        return len(errors) == 0, errors


def generate_invoice_xml(invoice_data: Dict[str, Any], line_items: List[Dict[str, Any]]) -> tuple[bool, str, Optional[str]]:
    """
    Convenience function to generate and validate UBL XML
    
    Returns:
        tuple: (success, xml_string_or_error, validation_errors)
    """
    generator = UBLXMLGenerator()
    
    # Validate first
    is_valid, errors = generator.validate_invoice_data(invoice_data)
    if not is_valid:
        return False, None, errors
    
    # Generate XML
    try:
        xml_string = generator.generate_invoice_xml(invoice_data, line_items)
        return True, xml_string, None
    except Exception as e:
        return False, None, [f"XML generation error: {str(e)}"]

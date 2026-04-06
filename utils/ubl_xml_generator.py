"""
UBL 2.1 XML Generator for UAE PINT-AE E-Invoicing
Generates compliant XML invoices following PEPPOL BIS and UAE FTA requirements

COMPLIANCE NOTES:
- UBL 2.1 structure with UAE PINT-AE profile (urn:peppol:pint:billing-1@ae-1)
- PEPPOL BIS 3.0 specification compliance
- XSD validation: Enable via UBL_XSD_PATH environment variable (requires full schema set)
- Canonicalization: For strict FTA compliance, apply C14N before signing
"""
from collections import defaultdict
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from xml.etree.ElementTree import Element, SubElement, tostring, ElementTree
from defusedxml import minidom
from utils.peppol_provider import resolve_receiver_peppol_id


def get_tin_from_trn(trn: str) -> str:
    """
    Extract TIN from TRN for UAE PEPPOL customer participant ID (scheme 0235).
    TIN = first 10 digits of the Corporate Tax TRN.
    Falls back to full TRN if length < 10.
    NOTE: For the supplier endpoint (scheme 0230), use the full TRN with the
    "0230:" prefix stored in InvoiceDB.supplier_peppol_id; do not use this helper.
    """
    if trn and len(trn) >= 10:
        return trn[:10]
    return trn or ""


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
        self.validation_errors = []
    
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
        
        # Store invoice_data and line_items on self for use by sub-methods
        self._current_invoice_data = invoice_data
        self._current_line_items = line_items or []

        # Build XML structure
        self._add_ubl_version()
        self._add_customization_id()
        self._add_profile_id()
        self._add_invoice_header(invoice_data)
        self._add_transaction_type_fields(invoice_data)
        self._add_supplier_party(invoice_data)
        self._add_customer_party(invoice_data)
        self._add_payment_terms(invoice_data)
        self._add_payment_means(invoice_data)
        self._add_tax_total(invoice_data)
        self._add_monetary_total(invoice_data)
        self._add_invoice_lines(line_items)
        
        # Convert to pretty XML string
        return self._prettify_xml(self.root)
    
    def generate_ubl_xml(self, invoice_data: Dict[str, Any], line_items: List[Dict[str, Any]] = None) -> str:
        """
        Alias for generate_invoice_xml() for backwards compatibility
        
        Args:
            invoice_data: Dictionary containing invoice header data  
            line_items: List of invoice line items (can be in invoice_data)
            
        Returns:
            Pretty-printed XML string
        """
        # Handle line items either as separate parameter or within invoice_data
        if line_items is None:
            line_items = invoice_data.get('line_items', [])
        return self.generate_invoice_xml(invoice_data, line_items)
    
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
        """Add UAE PINT-AE customization identifier"""
        self._add_element(
            self.root,
            'CustomizationID',
            'urn:peppol:pint:billing-1@ae-1'
        )

    def _add_profile_id(self):
        """Add UAE PINT-AE profile identifier"""
        self._add_element(
            self.root,
            'ProfileID',
            'urn:peppol:pint:billing-1'
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

        # Supply / delivery date — Task 5: cac:Delivery/cbc:ActualDeliveryDate
        supply_date = invoice_data.get('supply_date')
        if supply_date:
            if isinstance(supply_date, (datetime, date)):
                supply_date = supply_date.strftime('%Y-%m-%d')
            delivery_el = SubElement(self.root, 'cac:Delivery')
            self._add_element(delivery_el, 'ActualDeliveryDate', supply_date)

        # Invoice type code (380 = Tax Invoice, 381 = Credit Note, 383 = Debit Note, 480 = Commercial)
        invoice_type = invoice_data.get('invoice_type', 'TAX_INVOICE')
        _type_map = {'381': '381', '383': '383', '480': '480', '81': '81'}
        if isinstance(invoice_type, str) and invoice_type in _type_map:
            type_code = _type_map[invoice_type]
        elif 'CREDIT' in str(invoice_type).upper():
            type_code = '381'
        elif 'DEBIT' in str(invoice_type).upper():
            type_code = '383'
        else:
            type_code = '380'
        self._add_element(self.root, 'InvoiceTypeCode', type_code)
        
        # Document currency
        currency = invoice_data.get('currency_code', 'AED')
        self._add_element(self.root, 'DocumentCurrencyCode', currency)

        # Tax currency (always AED for UAE)
        self._add_element(self.root, 'TaxCurrencyCode', 'AED')

        # TaxExchangeRate — FTA Article 60: exchange rate must be stated for foreign-currency invoices
        if currency != 'AED' and invoice_data.get('exchange_rate'):
            tax_exchange_rate = SubElement(self.root, 'cac:TaxExchangeRate')
            self._add_element(tax_exchange_rate, 'SourceCurrencyCode', currency)
            self._add_element(tax_exchange_rate, 'TargetCurrencyCode', 'AED')
            self._add_element(tax_exchange_rate, 'CalculationRate', f"{float(invoice_data['exchange_rate']):.6f}")
        
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
    
    def _add_transaction_type_fields(self, invoice_data: Dict[str, Any]):
        """
        Add UAE PINT-AE transaction-type specific fields to the XML (Task 5).
        Called after the main invoice header. Each transaction type adds
        specific conditional fields required by the FTA data dictionary.
        """
        tx_type = invoice_data.get('invoice_transaction_type', 'STANDARD')

        if tx_type == 'REVERSE_CHARGE':
            note = SubElement(self.root, 'cbc:Note')
            note.text = invoice_data.get('tax_exemption_reason', 'Reverse charge - VAT accounted for by recipient')

        elif tx_type == 'ZERO_RATED':
            if invoice_data.get('tax_exemption_reason'):
                note = SubElement(self.root, 'cbc:Note')
                note.text = invoice_data['tax_exemption_reason']

        elif tx_type == 'DEEMED_SUPPLY':
            if invoice_data.get('payment_due_date'):
                payment_means = SubElement(self.root, 'cac:PaymentMeans')
                pdd = invoice_data['payment_due_date']
                if hasattr(pdd, 'strftime'):
                    pdd = pdd.strftime('%Y-%m-%d')
                self._add_element(payment_means, 'PaymentDueDate', str(pdd))
                if invoice_data.get('payment_type_code'):
                    self._add_element(payment_means, 'PaymentMeansCode', invoice_data['payment_type_code'])

        elif tx_type == 'ECOMMERCE':
            delivery = SubElement(self.root, 'cac:Delivery')
            if invoice_data.get('delivery_date'):
                dd = invoice_data['delivery_date']
                if hasattr(dd, 'strftime'):
                    dd = dd.strftime('%Y-%m-%d')
                self._add_element(delivery, 'ActualDeliveryDate', str(dd))
            if invoice_data.get('deliver_to_location_id'):
                deliver_loc = SubElement(delivery, 'cac:DeliveryLocation')
                loc_id = self._add_element(deliver_loc, 'ID', invoice_data['deliver_to_location_id'])
                if invoice_data.get('ecommerce_scheme_id'):
                    loc_id.set('schemeID', invoice_data['ecommerce_scheme_id'])
                if invoice_data.get('deliver_to_address'):
                    addr = SubElement(deliver_loc, 'cac:Address')
                    self._add_element(addr, 'StreetName', invoice_data['deliver_to_address'])
            if invoice_data.get('deliver_to_party_name'):
                deliver_party = SubElement(delivery, 'cac:DeliveryParty')
                pn = SubElement(deliver_party, 'cac:PartyName')
                self._add_element(pn, 'Name', invoice_data['deliver_to_party_name'])

        elif tx_type == 'EXPORT':
            note = SubElement(self.root, 'cbc:Note')
            note.text = 'Export supply - goods/services exported outside UAE'

        elif tx_type == 'MARGIN_SCHEME':
            if invoice_data.get('margin_credit_note_reason_code'):
                note = SubElement(self.root, 'cbc:Note')
                note.text = f"Margin scheme - reason: {invoice_data.get('margin_credit_note_reason_code')}"
            if invoice_data.get('margin_preceding_ref'):
                billing_ref = self.root.find('cac:BillingReference')
                if billing_ref is None:
                    billing_ref = SubElement(self.root, 'cac:BillingReference')
                idr = SubElement(billing_ref, 'cac:InvoiceDocumentReference')
                self._add_element(idr, 'ID', invoice_data['margin_preceding_ref'])
                if invoice_data.get('margin_preceding_date'):
                    mpd = invoice_data['margin_preceding_date']
                    if hasattr(mpd, 'strftime'):
                        mpd = mpd.strftime('%Y-%m-%d')
                    self._add_element(idr, 'IssueDate', str(mpd))

        elif tx_type == 'CONTINUOUS_SUPPLY':
            if invoice_data.get('invoicing_period_start') or invoice_data.get('invoicing_period_end'):
                inv_period = SubElement(self.root, 'cac:InvoicePeriod')
                if invoice_data.get('invoicing_period_start'):
                    sd = invoice_data['invoicing_period_start']
                    if hasattr(sd, 'strftime'):
                        sd = sd.strftime('%Y-%m-%d')
                    self._add_element(inv_period, 'StartDate', str(sd))
                if invoice_data.get('invoicing_period_end'):
                    ed = invoice_data['invoicing_period_end']
                    if hasattr(ed, 'strftime'):
                        ed = ed.strftime('%Y-%m-%d')
                    self._add_element(inv_period, 'EndDate', str(ed))
            if invoice_data.get('contract_reference'):
                contract_doc = SubElement(self.root, 'cac:ContractDocumentReference')
                self._add_element(contract_doc, 'ID', invoice_data['contract_reference'])
            if invoice_data.get('invoice_note'):
                note = SubElement(self.root, 'cbc:Note')
                note.text = invoice_data['invoice_note']

        elif tx_type == 'SUMMARY_INVOICE':
            if invoice_data.get('invoicing_period_start') or invoice_data.get('invoicing_period_end'):
                inv_period = SubElement(self.root, 'cac:InvoicePeriod')
                if invoice_data.get('invoicing_period_start'):
                    sd = invoice_data['invoicing_period_start']
                    if hasattr(sd, 'strftime'):
                        sd = sd.strftime('%Y-%m-%d')
                    self._add_element(inv_period, 'StartDate', str(sd))
                if invoice_data.get('invoicing_period_end'):
                    ed = invoice_data['invoicing_period_end']
                    if hasattr(ed, 'strftime'):
                        ed = ed.strftime('%Y-%m-%d')
                    self._add_element(inv_period, 'EndDate', str(ed))

        elif tx_type in ('DISCLOSED_AGENT', 'DISCLOSED_AGENT_CREDIT'):
            if invoice_data.get('principal_id'):
                note = SubElement(self.root, 'cbc:Note')
                note.text = f"Disclosed agent billing - Principal ID: {invoice_data['principal_id']}"

        elif tx_type == 'FREE_TRADE_ZONE':
            if invoice_data.get('beneficiary_id'):
                note = SubElement(self.root, 'cbc:Note')
                note.text = f"Free trade zone supply - Beneficiary ID: {invoice_data['beneficiary_id']}"

    def _add_supplier_party(self, invoice_data: Dict[str, Any]):
        """Add supplier (seller) party information"""
        supplier_party = SubElement(self.root, 'cac:AccountingSupplierParty')
        party = SubElement(supplier_party, 'cac:Party')
        
        # Supplier PEPPOL endpoint — use explicit peppol_id or derive from TRN (PINT-AE: ICD 0230)
        supplier_peppol_raw = invoice_data.get('supplier_peppol_id') or ''
        supplier_trn_fallback = invoice_data.get('supplier_trn', '') or ''
        if not supplier_peppol_raw and supplier_trn_fallback:
            # No stored PEPPOL ID but TRN is available: build 0230: form on the fly
            supplier_peppol_raw = f"0230:{supplier_trn_fallback}"
        elif not supplier_peppol_raw:
            # Last resort: use TIN (10-digit) with legacy scheme 0235
            supplier_peppol_raw = get_tin_from_trn(supplier_trn_fallback)
        if supplier_peppol_raw:
            endpoint_id = SubElement(party, 'cbc:EndpointID')
            if supplier_peppol_raw.startswith('0230:'):
                # UAE TRN scheme (ICD 0230) — strip prefix, store bare TRN as text
                endpoint_id.set('schemeID', '0230')
                endpoint_id.text = supplier_peppol_raw[5:]
            else:
                # Legacy / fallback: keep as-is with TIN scheme
                endpoint_id.set('schemeID', '0235')
                endpoint_id.text = supplier_peppol_raw
        
        # Party identification (TRN) - only if provided
        if invoice_data.get('supplier_trn'):
            party_id_elem = SubElement(party, 'cac:PartyIdentification')
            trn_id = self._add_element(party_id_elem, 'ID', invoice_data['supplier_trn'])
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
        
        # Party tax scheme (VAT) - only if TRN provided
        if invoice_data.get('supplier_trn'):
            party_tax = SubElement(party, 'cac:PartyTaxScheme')
            self._add_element(party_tax, 'CompanyID', invoice_data['supplier_trn'])
            tax_scheme = SubElement(party_tax, 'cac:TaxScheme')
            self._add_element(tax_scheme, 'ID', 'VAT')
        
        # Party legal entity
        party_legal = SubElement(party, 'cac:PartyLegalEntity')
        self._add_element(party_legal, 'RegistrationName', invoice_data.get('supplier_name', ''))
    
    def _add_customer_party(self, invoice_data: Dict[str, Any]):
        """Add customer (buyer) party information"""
        customer_party = SubElement(self.root, 'cac:AccountingCustomerParty')
        party = SubElement(customer_party, 'cac:Party')
        
        # Customer PEPPOL endpoint — resolve based on transaction type (Tasks 2 + 4b)
        transaction_type = invoice_data.get('invoice_transaction_type', 'STANDARD')
        customer_peppol_input = invoice_data.get('customer_peppol_id', '') or get_tin_from_trn(invoice_data.get('customer_trn', ''))
        customer_endpoint = resolve_receiver_peppol_id(
            invoice_transaction_type=transaction_type,
            customer_peppol_id=customer_peppol_input
        )
        if customer_endpoint:
            endpoint_id = SubElement(party, 'cbc:EndpointID')
            endpoint_id.set('schemeID', '0235')
            endpoint_id.text = customer_endpoint
        
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

    def _add_payment_means(self, invoice_data: Dict[str, Any]):
        """
        Add cac:PaymentMeans — mandatory per PEPPOL BIS 3.0 / PINT-AE.
        Skipped for DEEMED_SUPPLY (already handled by _add_transaction_type_fields).
        Maps payment_method strings to UN/EDIFACT 4461 PaymentMeansCode values.
        """
        tx_type = invoice_data.get('invoice_transaction_type', 'STANDARD')
        if tx_type == 'DEEMED_SUPPLY':
            return  # Already emitted by _add_transaction_type_fields

        payment_means = SubElement(self.root, 'cac:PaymentMeans')
        method = (invoice_data.get('payment_method') or '').upper().strip()
        code_map = {
            'CASH': '10',
            'CHEQUE': '20',
            'CHECK': '20',
            'BANK TRANSFER': '30',
            'CREDIT TRANSFER': '30',
            'CARD': '48',
            'CREDIT CARD': '48',
            'POS': '48',
            'DIRECT DEBIT': '49',
        }
        means_code = code_map.get(method, '30')  # Default: credit transfer
        self._add_element(payment_means, 'PaymentMeansCode', means_code)
        if invoice_data.get('payment_due_date'):
            pdd = invoice_data['payment_due_date']
            if hasattr(pdd, 'strftime'):
                pdd = pdd.strftime('%Y-%m-%d')
            self._add_element(payment_means, 'PaymentDueDate', str(pdd))

    # Maps TaxCategory DB enum values + UBL codes → canonical UBL TaxCategory ID
    _TAX_CAT_TO_UBL = {
        'S': 'S',   # Standard Rate (SR)
        'Z': 'Z',   # Zero-Rated (ZR)
        'E': 'E',   # Exempt (ES)
        'O': 'O',   # Out-of-Scope (OP)
        'AE': 'AE', # Reverse Charge (RC) — PEPPOL code
    }

    def _add_tax_total(self, invoice_data: Dict[str, Any]):
        """Add tax total (VAT) information with per-category TaxSubtotals.

        Emits one cac:TaxSubtotal per distinct tax category found in the
        invoice lines, using the correct UBL TaxCategory ID for each
        (S / Z / E / AE / O).  Falls back to a single subtotal derived from
        invoice-level totals when no line data is available.
        """
        currency = invoice_data.get('currency_code', 'AED')
        is_reverse_charge = (
            invoice_data.get('invoice_transaction_type') == 'REVERSE_CHARGE'
        )

        tax_total = SubElement(self.root, 'cac:TaxTotal')

        # Header-level tax amount in document currency
        tax_amt_el = self._add_element(
            tax_total, 'TaxAmount',
            f"{invoice_data.get('tax_amount', 0.0):.2f}"
        )
        tax_amt_el.set('currencyID', currency)

        line_items = getattr(self, '_current_line_items', [])

        if line_items:
            # Group line items by their effective UBL tax category ID
            by_cat: Dict[str, Dict[str, float]] = defaultdict(
                lambda: {'taxable': 0.0, 'tax': 0.0, 'percent': 5.0}
            )
            for item in line_items:
                if is_reverse_charge:
                    cat = 'AE'
                else:
                    raw = str(item.get('tax_category', 'S')).upper()
                    cat = self._TAX_CAT_TO_UBL.get(raw, 'S')
                by_cat[cat]['taxable'] += float(item.get('line_extension_amount', 0.0))
                by_cat[cat]['tax'] += float(item.get('tax_amount', 0.0))
                by_cat[cat]['percent'] = float(item.get('tax_percent', 5.0))

            for cat, amounts in by_cat.items():
                sub = SubElement(tax_total, 'cac:TaxSubtotal')
                taxable_el = self._add_element(
                    sub, 'TaxableAmount', f"{amounts['taxable']:.2f}"
                )
                taxable_el.set('currencyID', currency)
                tax_sub_el = self._add_element(
                    sub, 'TaxAmount', f"{amounts['tax']:.2f}"
                )
                tax_sub_el.set('currencyID', currency)
                cat_elem = SubElement(sub, 'cac:TaxCategory')
                self._add_element(cat_elem, 'ID', cat)
                self._add_element(cat_elem, 'Percent', f"{amounts['percent']:.2f}")
                scheme = SubElement(cat_elem, 'cac:TaxScheme')
                self._add_element(scheme, 'ID', 'VAT')
        else:
            # Fallback: single subtotal from invoice-level totals
            cat = 'AE' if is_reverse_charge else 'S'
            subtotal = invoice_data.get('subtotal_amount', 0.0)
            tax_amt = invoice_data.get('tax_amount', 0.0)
            if subtotal and subtotal > 0:
                derived_pct = (tax_amt / subtotal) * 100
                if abs(derived_pct) < 0.01:
                    cat = 'Z' if not is_reverse_charge else 'AE'
            else:
                derived_pct = 5.0
            sub = SubElement(tax_total, 'cac:TaxSubtotal')
            taxable_el = self._add_element(
                sub, 'TaxableAmount', f"{subtotal:.2f}"
            )
            taxable_el.set('currencyID', currency)
            tax_sub_el = self._add_element(
                sub, 'TaxAmount', f"{tax_amt:.2f}"
            )
            tax_sub_el.set('currencyID', currency)
            cat_elem = SubElement(sub, 'cac:TaxCategory')
            self._add_element(cat_elem, 'ID', cat)
            self._add_element(cat_elem, 'Percent', f"{derived_pct:.2f}")
            scheme = SubElement(cat_elem, 'cac:TaxScheme')
            self._add_element(scheme, 'ID', 'VAT')

        # Second TaxTotal in AED required when document currency is not AED
        if currency != 'AED' and invoice_data.get('total_amount_aed'):
            aed_rate = invoice_data.get('exchange_rate', 1.0) or 1.0
            aed_tax = invoice_data.get('tax_amount', 0.0)
            if aed_rate and aed_rate != 1.0:
                aed_tax = round(float(aed_tax) * float(aed_rate), 2)
            tax_total_aed = SubElement(self.root, 'cac:TaxTotal')
            tax_amt_aed = self._add_element(
                tax_total_aed, 'TaxAmount', f"{aed_tax:.2f}"
            )
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
            
            # Line extension amount (net of discount)
            line_ext = self._add_element(
                inv_line,
                'LineExtensionAmount',
                f"{item.get('line_extension_amount', 0.0):.2f}"
            )
            line_ext.set('currencyID', 'AED')

            # AllowanceCharge — line-level discount per PINT-AE / EN 16931
            discount = float(item.get('discount_amount', 0.0) or 0.0)
            if discount > 0:
                ac = SubElement(inv_line, 'cac:AllowanceCharge')
                self._add_element(ac, 'ChargeIndicator', 'false')
                self._add_element(ac, 'AllowanceChargeReasonCode', '95')
                self._add_element(ac, 'AllowanceChargeReason', 'Discount')
                amount_el = self._add_element(ac, 'Amount', f"{discount:.2f}")
                amount_el.set('currencyID', item.get('currency_code', 'AED'))
                base_el = self._add_element(
                    ac, 'BaseAmount',
                    f"{(item.get('line_extension_amount', 0.0) + discount):.2f}"
                )
                base_el.set('currencyID', item.get('currency_code', 'AED'))

            # Item
            item_elem = SubElement(inv_line, 'cac:Item')
            self._add_element(item_elem, 'Description', item.get('item_description', item.get('item_name', '')))
            self._add_element(item_elem, 'Name', item.get('item_name', ''))
            
            # Item classification (if code exists)
            if item.get('item_code'):
                classification = SubElement(item_elem, 'cac:SellersItemIdentification')
                self._add_element(classification, 'ID', item['item_code'])
            
            # Tax category for item — REVERSE_CHARGE uses 'AE' per UAE PINT-AE (Task 5)
            invoice_data = getattr(self, '_current_invoice_data', {})
            if invoice_data.get('invoice_transaction_type') == 'REVERSE_CHARGE':
                tax_cat_code = 'AE'
            else:
                tax_cat_code = item.get('tax_category', 'S')
            tax_category = SubElement(item_elem, 'cac:ClassifiedTaxCategory')
            self._add_element(tax_category, 'ID', tax_cat_code)
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
        
        # Required fields (TRN optional for non-VAT registered parties)
        required_string_fields = [
            'invoice_number', 'issue_date', 'supplier_name', 'customer_name'
        ]
        required_numeric_fields = [
            'subtotal_amount', 'tax_amount', 'total_amount'
        ]
        
        for field in required_string_fields:
            if not invoice_data.get(field):
                errors.append(f"Missing required field: {field}")
        
        # Numeric fields allow 0 values - only check for None
        for field in required_numeric_fields:
            if invoice_data.get(field) is None:
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


def generate_invoice_xml(invoice_data: Dict[str, Any], line_items: List[Dict[str, Any]]) -> Tuple[bool, Optional[str], Optional[List[str]]]:
    """
    Convenience function to generate and validate UBL XML
    
    Args:
        invoice_data: Invoice header data
        line_items: List of invoice line items
    
    Returns:
        tuple: (success: bool, xml_string: Optional[str], validation_errors: Optional[List[str]])
        
    Examples:
        success, xml, errors = generate_invoice_xml(invoice_data, line_items)
        if not success:
            raise XMLGenerationError("Validation failed", {"errors": errors})
    """
    from .exceptions import XMLGenerationError, InvoiceValidationError
    
    generator = UBLXMLGenerator()
    
    # Validate first
    try:
        is_valid, errors = generator.validate_invoice_data(invoice_data)
        if not is_valid:
            return False, None, errors
    except Exception as e:
        return False, None, [f"Validation error: {str(e)}"]
    
    # Generate XML
    try:
        xml_string = generator.generate_invoice_xml(invoice_data, line_items)
        
        if not xml_string or len(xml_string) < 100:
            return False, None, ["Generated XML is empty or too short"]
        
        return True, xml_string, None
    
    except Exception as e:
        error_msg = f"XML generation failed: {type(e).__name__}: {str(e)}"
        return False, None, [error_msg]

# InvoLinks — UAE FTA Compliance Implementation Prompt for Replit Agent

## Context & Objective

You are working on **InvoLinks**, a UAE e-invoicing platform (FastAPI backend in `main.py`, React frontend in `src/`). The codebase is already functional with UBL 2.1 XML generation, digital signatures, PEPPOL provider adapters, multi-tenant SaaS, and invoice CRUD. Your task is to fix specific UAE FTA compliance gaps **without breaking any existing functionality**. All changes must be additive and backward-compatible.

**Key rule:** Do NOT rename, remove, or restructure any existing routes, models, enums, or components. Only add new fields, new enum values, new functions, and new UI sections alongside what already exists.

---

## TASK 1 — Fix PINT-AE CustomizationID in UBL XML (1-line fix, critical)

**File:** `utils/ubl_xml_generator.py`

**Problem:** The `_add_customization_id()` method outputs the generic PEPPOL BIS 3.0 URI. UAE FTA requires the UAE-specific PINT-AE profile URI.

**Change:** In the `_add_customization_id` method, replace the string value:

```python
# BEFORE (current):
'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'

# AFTER (correct UAE PINT-AE):
'urn:peppol:pint:billing-1@ae-1'
```

Also update `_add_profile_id()` to use the correct UAE profile:

```python
# BEFORE (current):
'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'

# AFTER:
'urn:peppol:pint:billing-1'
```

---

## TASK 2 — Fix TIN vs TRN for PEPPOL Participant IDs

**Files:** `utils/ubl_xml_generator.py`, `main.py`

**Problem:** UAE FTA specifies that PEPPOL participant IDs must use the **TIN** (Taxpayer Identification Number = first 10 digits of the Corporate Tax TRN), not the full 15-digit VAT TRN.

**Changes:**

### 2a. Add a helper function in `utils/ubl_xml_generator.py` (add near top of file, after imports):

```python
def get_tin_from_trn(trn: str) -> str:
    """
    Extract TIN from TRN for UAE PEPPOL participant ID.
    TIN = first 10 digits of the Corporate Tax TRN.
    Falls back to full TRN if length < 10.
    """
    if trn and len(trn) >= 10:
        return trn[:10]
    return trn or ""
```

### 2b. In `UBLXMLGenerator._add_supplier_party()`, update the EndpointID logic:

```python
# BEFORE:
if invoice_data.get('supplier_peppol_id'):
    endpoint_id = SubElement(party, 'cbc:EndpointID')
    endpoint_id.set('schemeID', '0195')
    endpoint_id.text = invoice_data['supplier_peppol_id']

# AFTER — use explicit peppol_id if set, otherwise derive TIN from TRN:
supplier_endpoint = invoice_data.get('supplier_peppol_id') or get_tin_from_trn(invoice_data.get('supplier_trn', ''))
if supplier_endpoint:
    endpoint_id = SubElement(party, 'cbc:EndpointID')
    endpoint_id.set('schemeID', '0235')  # UAE scheme for TIN-based IDs
    endpoint_id.text = supplier_endpoint
```

### 2c. Apply the same pattern in `UBLXMLGenerator._add_customer_party()`:

```python
# AFTER — use explicit peppol_id if set, otherwise derive TIN from TRN:
# (But first check for predefined special endpoints — see Task 4)
customer_endpoint = invoice_data.get('customer_peppol_id') or get_tin_from_trn(invoice_data.get('customer_trn', ''))
if customer_endpoint:
    endpoint_id = SubElement(party, 'cbc:EndpointID')
    endpoint_id.set('schemeID', '0235')
    endpoint_id.text = customer_endpoint
```

---

## TASK 3 — Add UAE Transaction Type Field to Invoice Model and Schema

**Files:** `main.py`, `utils/ubl_xml_generator.py`

**Problem:** The UAE FTA data dictionary defines 16 invoice use-case scenarios. The existing `InvoiceType` enum covers the document type (380/381/383/480/81) but not the *transaction scenario* (reverse charge, zero-rated, deemed supply, export, e-commerce, etc.). These are separate concepts.

**Changes:**

### 3a. Add `InvoiceTransactionType` enum in `main.py` — add this **immediately after** the existing `InvoiceType` enum:

```python
class InvoiceTransactionType(str, enum.Enum):
    """UAE PINT-AE invoice transaction/use-case types"""
    STANDARD = "STANDARD"                          # Default standard supply
    REVERSE_CHARGE = "REVERSE_CHARGE"              # Supply under reverse charge mechanism
    ZERO_RATED = "ZERO_RATED"                      # Zero-rated supply
    EXEMPT = "EXEMPT"                              # Exempt supply
    DEEMED_SUPPLY = "DEEMED_SUPPLY"                # Deemed supply
    ECOMMERCE = "ECOMMERCE"                        # Supply through e-commerce
    EXPORT = "EXPORT"                              # Export (buyer outside UAE)
    MARGIN_SCHEME = "MARGIN_SCHEME"                # Profit margin scheme
    CONTINUOUS_SUPPLY = "CONTINUOUS_SUPPLY"        # Continuous supply
    SUMMARY_INVOICE = "SUMMARY_INVOICE"            # Summary tax invoice
    DISCLOSED_AGENT = "DISCLOSED_AGENT"            # Disclosed agent billing
    FREE_TRADE_ZONE = "FREE_TRADE_ZONE"            # Supply involving free trade zone
    SELF_BILLING = "SELF_BILLING"                  # Self-billing
    SELF_BILLING_CREDIT = "SELF_BILLING_CREDIT"    # Self-billing tax credit note
    DISCLOSED_AGENT_CREDIT = "DISCLOSED_AGENT_CREDIT"  # Disclosed agent billing credit note
    COMMERCIAL = "COMMERCIAL"                      # Commercial invoice (non-VAT)
```

### 3b. Add `invoice_transaction_type` column to `InvoiceDB` — add **after** the existing `invoice_classification` column:

```python
invoice_transaction_type = Column(
    String,
    default="STANDARD",
    nullable=True
)  # UAE PINT-AE transaction scenario (one of InvoiceTransactionType values)

# Transaction-type specific fields (conditional per PINT-AE data dictionary)
# Reverse charge / Zero-rated
tax_exemption_reason_code = Column(String, nullable=True)   # IBT-121: e.g. "AE" for reverse charge
tax_exemption_reason = Column(String, nullable=True)         # IBT-120: Free text reason

# Deemed supply
payment_due_date = Column(Date, nullable=True)               # BTUAE-01: Mandatory for deemed supply
payment_type_code = Column(String, nullable=True)            # BTUAE-02: e.g. "10" cash, "42" account

# E-commerce
deliver_to_location_id = Column(String, nullable=True)       # Delivery location identifier
deliver_to_party_name = Column(String, nullable=True)        # Deliver-to party name
deliver_to_address = Column(String, nullable=True)           # Delivery address
delivery_date = Column(Date, nullable=True)                  # E-commerce delivery date
ecommerce_scheme_id = Column(String, nullable=True)          # Scheme identifier for e-commerce

# Exports
buyer_legal_registration = Column(String, nullable=True)     # Buyer legal reg. for exports
buyer_registration_id = Column(String, nullable=True)        # Buyer identifier for exports
buyer_electronic_address = Column(String, nullable=True)     # Buyer electronic address
buyer_scheme_id = Column(String, nullable=True)              # Scheme identifier for exports

# Margin scheme
margin_credit_note_reason_code = Column(String, nullable=True)  # Credit note reason code
margin_process_control = Column(String, nullable=True)           # Process control flag
margin_preceding_ref = Column(String, nullable=True)             # Preceding invoice reference
margin_preceding_date = Column(Date, nullable=True)              # Preceding invoice issue date

# Continuous supply
contract_reference = Column(String, nullable=True)           # Contract reference value
contract_value = Column(Float, nullable=True)                 # Contract value
invoice_note = Column(String, nullable=True)                 # Invoice note for continuous supply
billing_frequency = Column(String, nullable=True)            # e.g. "MONTHLY", "QUARTERLY"

# Summary invoice
invoicing_period_start = Column(Date, nullable=True)         # Summary period start date
invoicing_period_end = Column(Date, nullable=True)           # Summary period end date

# Disclosed agent / Free trade zone / Self-billing
principal_id = Column(String, nullable=True)                 # Principal ID for disclosed agent
beneficiary_id = Column(String, nullable=True)               # Beneficiary ID for free trade zone
```

### 3c. Add these fields to `InvoiceCreate` Pydantic model — add after `credit_note_reason`:

```python
# UAE Transaction Type
invoice_transaction_type: Optional[str] = "STANDARD"

# Reverse charge / Zero-rated fields
tax_exemption_reason_code: Optional[str] = None
tax_exemption_reason: Optional[str] = None

# Deemed supply fields
payment_due_date: Optional[str] = None   # ISO date
payment_type_code: Optional[str] = None

# E-commerce fields
deliver_to_location_id: Optional[str] = None
deliver_to_party_name: Optional[str] = None
deliver_to_address: Optional[str] = None
delivery_date: Optional[str] = None
ecommerce_scheme_id: Optional[str] = None

# Export fields
buyer_legal_registration: Optional[str] = None
buyer_registration_id: Optional[str] = None
buyer_electronic_address: Optional[str] = None
buyer_scheme_id: Optional[str] = None

# Margin scheme fields
margin_credit_note_reason_code: Optional[str] = None
margin_process_control: Optional[str] = None
margin_preceding_ref: Optional[str] = None
margin_preceding_date: Optional[str] = None

# Continuous supply fields
contract_reference: Optional[str] = None
contract_value: Optional[float] = None
invoice_note: Optional[str] = None
billing_frequency: Optional[str] = None

# Summary invoice fields
invoicing_period_start: Optional[str] = None
invoicing_period_end: Optional[str] = None

# Disclosed agent / Free trade zone / Self-billing
principal_id: Optional[str] = None
beneficiary_id: Optional[str] = None
```

### 3d. In `InvoiceOut` Pydantic model, add the same fields as Optional outputs so the API response includes them.

### 3e. In the `create_invoice` function in `main.py`, save all new fields from payload to the `InvoiceDB` object — add **after** the existing field assignments:

```python
invoice.invoice_transaction_type = payload.invoice_transaction_type or "STANDARD"
invoice.tax_exemption_reason_code = payload.tax_exemption_reason_code
invoice.tax_exemption_reason = payload.tax_exemption_reason
invoice.payment_due_date = parse_date(payload.payment_due_date) if payload.payment_due_date else None
invoice.payment_type_code = payload.payment_type_code
invoice.deliver_to_location_id = payload.deliver_to_location_id
invoice.deliver_to_party_name = payload.deliver_to_party_name
invoice.deliver_to_address = payload.deliver_to_address
invoice.delivery_date = parse_date(payload.delivery_date) if payload.delivery_date else None
invoice.ecommerce_scheme_id = payload.ecommerce_scheme_id
invoice.buyer_legal_registration = payload.buyer_legal_registration
invoice.buyer_registration_id = payload.buyer_registration_id
invoice.buyer_electronic_address = payload.buyer_electronic_address
invoice.buyer_scheme_id = payload.buyer_scheme_id
invoice.margin_credit_note_reason_code = payload.margin_credit_note_reason_code
invoice.margin_process_control = payload.margin_process_control
invoice.margin_preceding_ref = payload.margin_preceding_ref
invoice.margin_preceding_date = parse_date(payload.margin_preceding_date) if payload.margin_preceding_date else None
invoice.contract_reference = payload.contract_reference
invoice.contract_value = payload.contract_value
invoice.invoice_note = payload.invoice_note
invoice.billing_frequency = payload.billing_frequency
invoice.invoicing_period_start = parse_date(payload.invoicing_period_start) if payload.invoicing_period_start else None
invoice.invoicing_period_end = parse_date(payload.invoicing_period_end) if payload.invoicing_period_end else None
invoice.principal_id = payload.principal_id
invoice.beneficiary_id = payload.beneficiary_id
```

Also apply the same saving logic in the `update_invoice` endpoint (`PUT /invoices/{invoice_id}`) — only update fields that are not None in the payload.

---

## TASK 4 — Add Predefined PEPPOL Endpoints for Special Transaction Types

**Files:** `utils/ubl_xml_generator.py`, `main.py`

**Problem:** UAE FTA requires specific predefined PEPPOL endpoints for transactions where the buyer is not on the PEPPOL network:
- Deemed supply: `0235:9900000097`
- Export (buyer has no PEPPOL ID): `0235:9900000099`
- Buyer not subject to UAE e-invoicing: `0235:9900000098`

**Changes:**

### 4a. Add constants at the top of `utils/peppol_provider.py` (after imports):

```python
# UAE FTA predefined PEPPOL endpoints for special transaction cases
UAE_PEPPOL_ENDPOINT_DEEMED_SUPPLY = "0235:9900000097"
UAE_PEPPOL_ENDPOINT_EXPORT = "0235:9900000099"
UAE_PEPPOL_ENDPOINT_NOT_ON_PEPPOL = "0235:9900000098"

def resolve_receiver_peppol_id(invoice_transaction_type: str, customer_peppol_id: str) -> str:
    """
    Resolve the correct PEPPOL receiver endpoint ID based on transaction type.
    UAE FTA requires predefined endpoints when buyer is not on PEPPOL network.
    
    Args:
        invoice_transaction_type: One of InvoiceTransactionType values
        customer_peppol_id: The buyer's registered PEPPOL ID (may be empty)
    
    Returns:
        The correct PEPPOL endpoint ID to use for transmission
    """
    if invoice_transaction_type == "DEEMED_SUPPLY":
        return UAE_PEPPOL_ENDPOINT_DEEMED_SUPPLY
    elif invoice_transaction_type == "EXPORT":
        return UAE_PEPPOL_ENDPOINT_EXPORT
    elif not customer_peppol_id:
        # Buyer is not on PEPPOL network — use fallback endpoint
        return UAE_PEPPOL_ENDPOINT_NOT_ON_PEPPOL
    return customer_peppol_id
```

### 4b. In `UBLXMLGenerator._add_customer_party()`, use this resolver for the EndpointID:

Import `resolve_receiver_peppol_id` at the top of the file, then in `_add_customer_party`:

```python
from utils.peppol_provider import resolve_receiver_peppol_id

# In _add_customer_party():
transaction_type = invoice_data.get('invoice_transaction_type', 'STANDARD')
customer_endpoint = resolve_receiver_peppol_id(
    invoice_transaction_type=transaction_type,
    customer_peppol_id=invoice_data.get('customer_peppol_id', '') or get_tin_from_trn(invoice_data.get('customer_trn', ''))
)
if customer_endpoint:
    endpoint_id = SubElement(party, 'cbc:EndpointID')
    endpoint_id.set('schemeID', '0235')
    endpoint_id.text = customer_endpoint
```

### 4c. In `transmit_invoice_via_peppol` endpoint in `main.py`, update the receiver ID resolution:

```python
# BEFORE:
if not invoice.customer_peppol_id:
    raise HTTPException(400, "Customer PEPPOL ID is required for transmission")

# AFTER — allow transmission even without customer PEPPOL ID (uses predefined endpoints):
from utils.peppol_provider import resolve_receiver_peppol_id
receiver_id = resolve_receiver_peppol_id(
    invoice_transaction_type=invoice.invoice_transaction_type or "STANDARD",
    customer_peppol_id=invoice.customer_peppol_id or ""
)
```

Then use `receiver_id` in the `send_invoice_via_peppol` call instead of `invoice.customer_peppol_id`.

---

## TASK 5 — Extend UBL XML Generator for Transaction-Type-Specific Fields

**File:** `utils/ubl_xml_generator.py`

Add a new method `_add_transaction_type_fields(self, invoice_data)` to `UBLXMLGenerator` and call it from `generate_invoice_xml` after `_add_invoice_header`. This method outputs the correct additional XML elements per transaction type:

```python
def _add_transaction_type_fields(self, invoice_data: Dict[str, Any]):
    """
    Add UAE PINT-AE transaction-type specific fields to the XML.
    Called after the main invoice header. Each transaction type adds
    specific conditional fields required by the FTA data dictionary.
    """
    tx_type = invoice_data.get('invoice_transaction_type', 'STANDARD')

    # --- REVERSE CHARGE (2 mandatory fields) ---
    if tx_type == 'REVERSE_CHARGE':
        # Tax exemption reason code and text are set at line level (handled in _add_invoice_lines)
        # BusinessProcessType note for reverse charge
        note = SubElement(self.root, 'cbc:Note')
        note.text = invoice_data.get('tax_exemption_reason', 'Reverse charge - VAT accounted for by recipient')

    # --- ZERO RATED (2 additional fields) ---
    elif tx_type == 'ZERO_RATED':
        if invoice_data.get('tax_exemption_reason'):
            note = SubElement(self.root, 'cbc:Note')
            note.text = invoice_data['tax_exemption_reason']

    # --- DEEMED SUPPLY (2 additional fields: payment due date + payment type) ---
    elif tx_type == 'DEEMED_SUPPLY':
        if invoice_data.get('payment_due_date'):
            payment_means = SubElement(self.root, 'cac:PaymentMeans')
            pdd = invoice_data['payment_due_date']
            if hasattr(pdd, 'strftime'):
                pdd = pdd.strftime('%Y-%m-%d')
            self._add_element(payment_means, 'PaymentDueDate', str(pdd))
            if invoice_data.get('payment_type_code'):
                self._add_element(payment_means, 'PaymentMeansCode', invoice_data['payment_type_code'])

    # --- ECOMMERCE (5 mandatory fields) ---
    elif tx_type == 'ECOMMERCE':
        delivery = SubElement(self.root, 'cac:Delivery')
        if invoice_data.get('delivery_date'):
            dd = invoice_data['delivery_date']
            if hasattr(dd, 'strftime'):
                dd = dd.strftime('%Y-%m-%d')
            self._add_element(delivery, 'ActualDeliveryDate', str(dd))
        if invoice_data.get('deliver_to_location_id'):
            deliver_loc = SubElement(delivery, 'cac:DeliveryLocation')
            self._add_element(deliver_loc, 'ID', invoice_data['deliver_to_location_id'])
            if invoice_data.get('ecommerce_scheme_id'):
                deliver_loc.find('cbc:ID').set('schemeID', invoice_data['ecommerce_scheme_id'])
        if invoice_data.get('deliver_to_party_name'):
            deliver_party = SubElement(delivery, 'cac:DeliveryParty')
            pn = SubElement(deliver_party, 'cac:PartyName')
            self._add_element(pn, 'Name', invoice_data['deliver_to_party_name'])
        if invoice_data.get('deliver_to_address'):
            if not delivery.find('cac:DeliveryLocation'):
                dl = SubElement(delivery, 'cac:DeliveryLocation')
            else:
                dl = delivery.find('cac:DeliveryLocation')
            addr = SubElement(dl, 'cac:Address')
            self._add_element(addr, 'StreetName', invoice_data['deliver_to_address'])

    # --- EXPORT (4 mandatory fields) ---
    elif tx_type == 'EXPORT':
        # Export buyer info is already in customer party section
        # Add export-specific note
        note = SubElement(self.root, 'cbc:Note')
        note.text = 'Export supply - goods/services exported outside UAE'

    # --- MARGIN SCHEME (4 mandatory fields) ---
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

    # --- CONTINUOUS SUPPLY (4 additional fields) ---
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

    # --- SUMMARY INVOICE (3 additional fields) ---
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

    # --- DISCLOSED AGENT (1 additional field: principal ID) ---
    elif tx_type in ('DISCLOSED_AGENT', 'DISCLOSED_AGENT_CREDIT'):
        if invoice_data.get('principal_id'):
            note = SubElement(self.root, 'cbc:Note')
            note.text = f"Disclosed agent billing - Principal ID: {invoice_data['principal_id']}"

    # --- FREE TRADE ZONE (1 mandatory field: beneficiary ID) ---
    elif tx_type == 'FREE_TRADE_ZONE':
        if invoice_data.get('beneficiary_id'):
            note = SubElement(self.root, 'cbc:Note')
            note.text = f"Free trade zone supply - Beneficiary ID: {invoice_data['beneficiary_id']}"
```

In `generate_invoice_xml`, add the call after `self._add_invoice_header(invoice_data)`:

```python
self._add_transaction_type_fields(invoice_data)
```

Also update `_add_invoice_lines` to handle reverse charge tax category. In the tax subtotal section within each line, when the invoice `invoice_transaction_type` is `REVERSE_CHARGE`, set:

```python
# In _add_invoice_lines, when building TaxCategory for each line:
if invoice_data.get('invoice_transaction_type') == 'REVERSE_CHARGE':
    tax_cat_code = 'AE'  # Reverse charge VAT category code
    tax_exemption_code = invoice_data.get('tax_exemption_reason_code', 'AE')
```

---

## TASK 6 — Add MLS (Message Level Status) Handling

**Files:** `main.py`, `utils/peppol_provider.py`

**Problem:** UAE FTA requires every corner to respond to messages within 10 minutes. The system needs retry logic, MLS status tracking, and deemed-acceptance handling.

**Changes:**

### 6a. Add MLS status fields to `InvoiceDB` — add after existing PEPPOL fields:

```python
# MLS (Message Level Status) tracking — UAE FTA 10-minute response requirement
mls_status = Column(String, nullable=True)          # "ACCEPTED", "REJECTED", "PENDING"
mls_received_at = Column(DateTime, nullable=True)   # When MLS was received from Corner 3
mls_rejection_reason = Column(String, nullable=True) # Reason code if rejected
mls_retry_count = Column(Integer, default=0)         # Number of retry attempts
mls_last_retry_at = Column(DateTime, nullable=True)  # Last retry timestamp
peppol_deemed_accepted = Column(Boolean, default=False)  # True if 10-min window passed with no rejection
```

### 6b. Add a new API endpoint in `main.py` for receiving MLS callbacks (after the existing peppol-status endpoint):

```python
@app.post("/invoices/{invoice_id}/mls-callback", tags=["Invoices"])
def receive_mls_callback(
    invoice_id: str,
    mls_data: dict,
    db: Session = Depends(get_db),
):
    """
    Receive Message Level Status (MLS) callback from PEPPOL network.
    Called by the ASP when Corner 3 sends acceptance/rejection.
    UAE FTA requirement: all corners respond within 10 minutes.
    """
    invoice = db.query(InvoiceDB).filter(InvoiceDB.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    mls_status = mls_data.get("status", "").upper()
    invoice.mls_status = mls_status
    invoice.mls_received_at = datetime.utcnow()

    if mls_status == "REJECTED":
        invoice.mls_rejection_reason = mls_data.get("rejection_reason", "")
        invoice.status = InvoiceStatus.DRAFT  # Revert to draft for correction
    elif mls_status == "ACCEPTED":
        invoice.status = InvoiceStatus.DELIVERED if hasattr(InvoiceStatus, 'DELIVERED') else InvoiceStatus.SENT

    db.commit()
    return {"success": True, "invoice_id": invoice_id, "mls_status": mls_status}


@app.post("/invoices/{invoice_id}/retry-transmission", tags=["Invoices"])
def retry_peppol_transmission(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db),
):
    """
    Retry PEPPOL transmission for failed or rejected invoices.
    Implements the retry mechanism required by UAE FTA for connectivity failures.
    Maximum 3 retries.
    """
    invoice = db.query(InvoiceDB).filter(InvoiceDB.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.company_id != current_user.company_id:
        raise HTTPException(403, "Access denied")

    retry_count = invoice.mls_retry_count or 0
    if retry_count >= 3:
        raise HTTPException(400, f"Maximum retry attempts (3) reached for invoice {invoice.invoice_number}")

    # Reset status for retry
    invoice.peppol_status = "PENDING"
    invoice.mls_status = None
    invoice.mls_retry_count = retry_count + 1
    invoice.mls_last_retry_at = datetime.utcnow()
    db.commit()

    # Trigger transmission (reuse existing logic)
    return {"success": True, "message": f"Retry {retry_count + 1}/3 initiated", "invoice_id": invoice_id}
```

### 6c. Add a background check function for deemed acceptance — add as a utility function in `main.py`:

```python
def check_and_apply_deemed_acceptance(invoice_id: str, db: Session) -> bool:
    """
    Check if the 10-minute MLS window has passed without rejection.
    If so, mark the invoice as deemed accepted per UAE FTA guidelines.
    Called when checking invoice status.
    """
    invoice = db.query(InvoiceDB).filter(InvoiceDB.id == invoice_id).first()
    if not invoice:
        return False

    if (invoice.peppol_status == "SENT" and
        invoice.mls_status is None and
        invoice.peppol_sent_at and
        not invoice.peppol_deemed_accepted):
        
        elapsed_minutes = (datetime.utcnow() - invoice.peppol_sent_at).total_seconds() / 60
        if elapsed_minutes >= 10:
            invoice.peppol_deemed_accepted = True
            invoice.mls_status = "DEEMED_ACCEPTED"
            db.commit()
            return True
    return False
```

Call `check_and_apply_deemed_acceptance` inside the `get_peppol_transmission_status` endpoint before returning the status.

---

## TASK 7 — Frontend: Add Transaction Type Selector to CreateInvoice

**File:** `src/pages/CreateInvoice.jsx`

**Problem:** The invoice creation UI has no way to select UAE transaction type or enter the conditional fields required for each scenario.

**Approach:** Add a new collapsible section called "UAE Transaction Type" that appears **after** the existing invoice type selector and **only when** the invoice type is a TAX_INVOICE (380) or COMMERCIAL_INVOICE (480). Do not change the existing invoice type dropdown or any other existing UI.

**Changes:**

### 7a. Add `invoice_transaction_type` to the `formData` state initialization:

```javascript
// In the formData useState initialization, add:
invoice_transaction_type: "STANDARD",
tax_exemption_reason_code: "",
tax_exemption_reason: "",
payment_due_date: "",
payment_type_code: "",
deliver_to_location_id: "",
deliver_to_party_name: "",
deliver_to_address: "",
delivery_date: "",
ecommerce_scheme_id: "",
buyer_legal_registration: "",
buyer_registration_id: "",
buyer_electronic_address: "",
buyer_scheme_id: "",
margin_credit_note_reason_code: "",
margin_process_control: "",
margin_preceding_ref: "",
margin_preceding_date: "",
contract_reference: "",
contract_value: "",
invoice_note: "",
billing_frequency: "",
invoicing_period_start: "",
invoicing_period_end: "",
principal_id: "",
beneficiary_id: "",
```

### 7b. Add a `UAE_TRANSACTION_TYPES` constant near the top of the component:

```javascript
const UAE_TRANSACTION_TYPES = [
  { value: "STANDARD", label: "Standard Supply" },
  { value: "REVERSE_CHARGE", label: "Reverse Charge Mechanism" },
  { value: "ZERO_RATED", label: "Zero-Rated Supply" },
  { value: "EXEMPT", label: "Exempt Supply" },
  { value: "DEEMED_SUPPLY", label: "Deemed Supply" },
  { value: "ECOMMERCE", label: "Supply through E-Commerce" },
  { value: "EXPORT", label: "Export" },
  { value: "MARGIN_SCHEME", label: "Profit Margin Scheme" },
  { value: "CONTINUOUS_SUPPLY", label: "Continuous Supply" },
  { value: "SUMMARY_INVOICE", label: "Summary Tax Invoice" },
  { value: "DISCLOSED_AGENT", label: "Disclosed Agent Billing" },
  { value: "FREE_TRADE_ZONE", label: "Supply in Free Trade Zone" },
  { value: "SELF_BILLING", label: "Self-Billing" },
];
```

### 7c. Add the Transaction Type UI section in the JSX — insert it **after** the existing invoice type `<select>` field block and **before** the customer details section. Keep the exact same styling as the rest of the form (same card/section pattern, same input classes):

```jsx
{/* UAE Transaction Type — only shown for standard tax and commercial invoices */}
{(formData.invoice_type === "380" || formData.invoice_type === "480") && (
  <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
      <span>🇦🇪</span>
      UAE Transaction Scenario
      <span className="text-xs font-normal text-gray-500 ml-1">(PINT-AE data dictionary)</span>
    </h3>

    {/* Transaction type dropdown */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Transaction Type
      </label>
      <select
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={formData.invoice_transaction_type}
        onChange={(e) => setFormData((prev) => ({ ...prev, invoice_transaction_type: e.target.value }))}
      >
        {UAE_TRANSACTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </div>

    {/* REVERSE CHARGE fields */}
    {formData.invoice_transaction_type === "REVERSE_CHARGE" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tax Exemption Reason Code</label>
          <input type="text" placeholder="e.g. AE" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.tax_exemption_reason_code}
            onChange={(e) => setFormData((p) => ({ ...p, tax_exemption_reason_code: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tax Exemption Reason</label>
          <input type="text" placeholder="VAT accounted for by recipient" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.tax_exemption_reason}
            onChange={(e) => setFormData((p) => ({ ...p, tax_exemption_reason: e.target.value }))} />
        </div>
      </div>
    )}

    {/* ZERO RATED fields */}
    {formData.invoice_transaction_type === "ZERO_RATED" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tax Exemption Reason Code</label>
          <input type="text" placeholder="e.g. Z" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.tax_exemption_reason_code}
            onChange={(e) => setFormData((p) => ({ ...p, tax_exemption_reason_code: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tax Exemption Reason</label>
          <input type="text" placeholder="Zero-rated supply description" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.tax_exemption_reason}
            onChange={(e) => setFormData((p) => ({ ...p, tax_exemption_reason: e.target.value }))} />
        </div>
      </div>
    )}

    {/* DEEMED SUPPLY fields */}
    {formData.invoice_transaction_type === "DEEMED_SUPPLY" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date <span className="text-red-500">*</span></label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.payment_due_date}
            onChange={(e) => setFormData((p) => ({ ...p, payment_due_date: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type Code <span className="text-red-500">*</span></label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.payment_type_code}
            onChange={(e) => setFormData((p) => ({ ...p, payment_type_code: e.target.value }))}>
            <option value="">Select payment type</option>
            <option value="10">10 — Cash</option>
            <option value="30">30 — Credit Transfer</option>
            <option value="42">42 — Payment to account</option>
            <option value="48">48 — Bank card</option>
            <option value="49">49 — Direct debit</option>
          </select>
        </div>
      </div>
    )}

    {/* E-COMMERCE fields */}
    {formData.invoice_transaction_type === "ECOMMERCE" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheme Identifier <span className="text-red-500">*</span></label>
          <input type="text" placeholder="e.g. UAE-ECOM" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.ecommerce_scheme_id}
            onChange={(e) => setFormData((p) => ({ ...p, ecommerce_scheme_id: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date <span className="text-red-500">*</span></label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.delivery_date}
            onChange={(e) => setFormData((p) => ({ ...p, delivery_date: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deliver-to Location ID <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Location identifier" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.deliver_to_location_id}
            onChange={(e) => setFormData((p) => ({ ...p, deliver_to_location_id: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deliver-to Party Name <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Recipient party name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.deliver_to_party_name}
            onChange={(e) => setFormData((p) => ({ ...p, deliver_to_party_name: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
          <input type="text" placeholder="Full delivery address" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.deliver_to_address}
            onChange={(e) => setFormData((p) => ({ ...p, deliver_to_address: e.target.value }))} />
        </div>
      </div>
    )}

    {/* EXPORT fields */}
    {formData.invoice_transaction_type === "EXPORT" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Legal Registration <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Buyer's legal registration number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.buyer_legal_registration}
            onChange={(e) => setFormData((p) => ({ ...p, buyer_legal_registration: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Identifier <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Buyer identifier" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.buyer_registration_id}
            onChange={(e) => setFormData((p) => ({ ...p, buyer_registration_id: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Electronic Address <span className="text-red-500">*</span></label>
          <input type="text" placeholder="buyer@company.com or endpoint" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.buyer_electronic_address}
            onChange={(e) => setFormData((p) => ({ ...p, buyer_electronic_address: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheme Identifier <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Scheme ID" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.buyer_scheme_id}
            onChange={(e) => setFormData((p) => ({ ...p, buyer_scheme_id: e.target.value }))} />
        </div>
        <div className="md:col-span-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
          ⚠️ Export invoices use predefined PEPPOL endpoint <code>0235:9900000099</code> — customer PEPPOL ID is not required.
        </div>
      </div>
    )}

    {/* MARGIN SCHEME fields */}
    {formData.invoice_transaction_type === "MARGIN_SCHEME" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Credit Note Reason Code <span className="text-red-500">*</span></label>
          <input type="text" placeholder="e.g. 01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.margin_credit_note_reason_code}
            onChange={(e) => setFormData((p) => ({ ...p, margin_credit_note_reason_code: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Process Control</label>
          <input type="text" placeholder="Process control value" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.margin_process_control}
            onChange={(e) => setFormData((p) => ({ ...p, margin_process_control: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preceding Invoice Reference <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Original invoice number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.margin_preceding_ref}
            onChange={(e) => setFormData((p) => ({ ...p, margin_preceding_ref: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preceding Invoice Issue Date <span className="text-red-500">*</span></label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.margin_preceding_date}
            onChange={(e) => setFormData((p) => ({ ...p, margin_preceding_date: e.target.value }))} />
        </div>
      </div>
    )}

    {/* CONTINUOUS SUPPLY fields */}
    {formData.invoice_transaction_type === "CONTINUOUS_SUPPLY" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contract Reference <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Contract reference number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.contract_reference}
            onChange={(e) => setFormData((p) => ({ ...p, contract_reference: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contract Value</label>
          <input type="number" placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.contract_value}
            onChange={(e) => setFormData((p) => ({ ...p, contract_value: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period Start Date <span className="text-red-500">*</span></label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.invoicing_period_start}
            onChange={(e) => setFormData((p) => ({ ...p, invoicing_period_start: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period End Date <span className="text-red-500">*</span></label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.invoicing_period_end}
            onChange={(e) => setFormData((p) => ({ ...p, invoicing_period_end: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Billing Frequency</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.billing_frequency}
            onChange={(e) => setFormData((p) => ({ ...p, billing_frequency: e.target.value }))}>
            <option value="">Select frequency</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Note <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Supply description or note" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.invoice_note}
            onChange={(e) => setFormData((p) => ({ ...p, invoice_note: e.target.value }))} />
        </div>
      </div>
    )}

    {/* SUMMARY INVOICE fields */}
    {formData.invoice_transaction_type === "SUMMARY_INVOICE" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoicing Period Start <span className="text-red-500">*</span></label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.invoicing_period_start}
            onChange={(e) => setFormData((p) => ({ ...p, invoicing_period_start: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoicing Period End <span className="text-red-500">*</span></label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.invoicing_period_end}
            onChange={(e) => setFormData((p) => ({ ...p, invoicing_period_end: e.target.value }))} />
        </div>
      </div>
    )}

    {/* DISCLOSED AGENT fields */}
    {(formData.invoice_transaction_type === "DISCLOSED_AGENT" || formData.invoice_transaction_type === "DISCLOSED_AGENT_CREDIT") && (
      <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Principal ID <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Principal identifier" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.principal_id}
            onChange={(e) => setFormData((p) => ({ ...p, principal_id: e.target.value }))} />
        </div>
      </div>
    )}

    {/* FREE TRADE ZONE fields */}
    {formData.invoice_transaction_type === "FREE_TRADE_ZONE" && (
      <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary ID <span className="text-red-500">*</span></label>
          <input type="text" placeholder="Free trade zone beneficiary identifier" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={formData.beneficiary_id}
            onChange={(e) => setFormData((p) => ({ ...p, beneficiary_id: e.target.value }))} />
        </div>
      </div>
    )}

    {/* SELF BILLING fields */}
    {(formData.invoice_transaction_type === "SELF_BILLING" || formData.invoice_transaction_type === "SELF_BILLING_CREDIT") && (
      <div className="text-xs text-blue-600 bg-blue-50 rounded-lg p-3 mt-2">
        ℹ️ Self-billing uses the same fields as the standard tax invoice. The buyer generates the invoice on behalf of the supplier. No additional fields required beyond the standard 50 mandatory fields.
      </div>
    )}

  </div>
)}
```

### 7d. Include all new fields in the form submission payload. Find the `handleSubmit` or submit function and ensure the `payload` object passed to the API includes all the new fields from `formData`. Add them to the existing payload spread:

```javascript
// Add to the invoice creation API payload:
invoice_transaction_type: formData.invoice_transaction_type || "STANDARD",
tax_exemption_reason_code: formData.tax_exemption_reason_code || null,
tax_exemption_reason: formData.tax_exemption_reason || null,
payment_due_date: formData.payment_due_date || null,
payment_type_code: formData.payment_type_code || null,
deliver_to_location_id: formData.deliver_to_location_id || null,
deliver_to_party_name: formData.deliver_to_party_name || null,
deliver_to_address: formData.deliver_to_address || null,
delivery_date: formData.delivery_date || null,
ecommerce_scheme_id: formData.ecommerce_scheme_id || null,
buyer_legal_registration: formData.buyer_legal_registration || null,
buyer_registration_id: formData.buyer_registration_id || null,
buyer_electronic_address: formData.buyer_electronic_address || null,
buyer_scheme_id: formData.buyer_scheme_id || null,
margin_credit_note_reason_code: formData.margin_credit_note_reason_code || null,
margin_process_control: formData.margin_process_control || null,
margin_preceding_ref: formData.margin_preceding_ref || null,
margin_preceding_date: formData.margin_preceding_date || null,
contract_reference: formData.contract_reference || null,
contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
invoice_note: formData.invoice_note || null,
billing_frequency: formData.billing_frequency || null,
invoicing_period_start: formData.invoicing_period_start || null,
invoicing_period_end: formData.invoicing_period_end || null,
principal_id: formData.principal_id || null,
beneficiary_id: formData.beneficiary_id || null,
```

---

## TASK 8 — Add Database Migration for New Columns

**File:** `migrations/` (create a new file) or add inline migration to `main.py`

Add SQL migration columns for all new database fields. The safest approach for Replit/Neon is to add `ALTER TABLE` statements that run on startup if columns don't exist. Add this function to `main.py` and call it at startup (after the `Base.metadata.create_all(engine)` call):

```python
def run_pint_ae_migration(engine):
    """
    Add UAE PINT-AE transaction type columns to invoices table.
    Safe to run multiple times (checks column existence first).
    """
    migration_sql = """
    DO $$ 
    BEGIN
        -- Transaction type
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_transaction_type') THEN
            ALTER TABLE invoices ADD COLUMN invoice_transaction_type VARCHAR DEFAULT 'STANDARD';
        END IF;
        -- Reverse charge / Zero rated
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='tax_exemption_reason_code') THEN
            ALTER TABLE invoices ADD COLUMN tax_exemption_reason_code VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='tax_exemption_reason') THEN
            ALTER TABLE invoices ADD COLUMN tax_exemption_reason VARCHAR;
        END IF;
        -- Deemed supply
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_due_date') THEN
            ALTER TABLE invoices ADD COLUMN payment_due_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_type_code') THEN
            ALTER TABLE invoices ADD COLUMN payment_type_code VARCHAR;
        END IF;
        -- E-commerce
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='deliver_to_location_id') THEN
            ALTER TABLE invoices ADD COLUMN deliver_to_location_id VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='deliver_to_party_name') THEN
            ALTER TABLE invoices ADD COLUMN deliver_to_party_name VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='deliver_to_address') THEN
            ALTER TABLE invoices ADD COLUMN deliver_to_address VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='delivery_date') THEN
            ALTER TABLE invoices ADD COLUMN delivery_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='ecommerce_scheme_id') THEN
            ALTER TABLE invoices ADD COLUMN ecommerce_scheme_id VARCHAR;
        END IF;
        -- Export
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='buyer_legal_registration') THEN
            ALTER TABLE invoices ADD COLUMN buyer_legal_registration VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='buyer_registration_id') THEN
            ALTER TABLE invoices ADD COLUMN buyer_registration_id VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='buyer_electronic_address') THEN
            ALTER TABLE invoices ADD COLUMN buyer_electronic_address VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='buyer_scheme_id') THEN
            ALTER TABLE invoices ADD COLUMN buyer_scheme_id VARCHAR;
        END IF;
        -- Margin scheme
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='margin_credit_note_reason_code') THEN
            ALTER TABLE invoices ADD COLUMN margin_credit_note_reason_code VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='margin_process_control') THEN
            ALTER TABLE invoices ADD COLUMN margin_process_control VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='margin_preceding_ref') THEN
            ALTER TABLE invoices ADD COLUMN margin_preceding_ref VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='margin_preceding_date') THEN
            ALTER TABLE invoices ADD COLUMN margin_preceding_date DATE;
        END IF;
        -- Continuous supply
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='contract_reference') THEN
            ALTER TABLE invoices ADD COLUMN contract_reference VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='contract_value') THEN
            ALTER TABLE invoices ADD COLUMN contract_value NUMERIC(15,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_note') THEN
            ALTER TABLE invoices ADD COLUMN invoice_note VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='billing_frequency') THEN
            ALTER TABLE invoices ADD COLUMN billing_frequency VARCHAR;
        END IF;
        -- Summary invoice / Continuous supply periods
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoicing_period_start') THEN
            ALTER TABLE invoices ADD COLUMN invoicing_period_start DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoicing_period_end') THEN
            ALTER TABLE invoices ADD COLUMN invoicing_period_end DATE;
        END IF;
        -- Disclosed agent / FTZ / Self billing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='principal_id') THEN
            ALTER TABLE invoices ADD COLUMN principal_id VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='beneficiary_id') THEN
            ALTER TABLE invoices ADD COLUMN beneficiary_id VARCHAR;
        END IF;
        -- MLS tracking
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='mls_status') THEN
            ALTER TABLE invoices ADD COLUMN mls_status VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='mls_received_at') THEN
            ALTER TABLE invoices ADD COLUMN mls_received_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='mls_rejection_reason') THEN
            ALTER TABLE invoices ADD COLUMN mls_rejection_reason VARCHAR;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='mls_retry_count') THEN
            ALTER TABLE invoices ADD COLUMN mls_retry_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='mls_last_retry_at') THEN
            ALTER TABLE invoices ADD COLUMN mls_last_retry_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='peppol_deemed_accepted') THEN
            ALTER TABLE invoices ADD COLUMN peppol_deemed_accepted BOOLEAN DEFAULT FALSE;
        END IF;
    END $$;
    """
    with engine.connect() as conn:
        conn.execute(text(migration_sql))
        conn.commit()
```

If using SQLite (development), use a simpler version that checks with `PRAGMA table_info`.

---

## TASK 9 — Display Transaction Type in Invoice Detail and List Views

**Files:** `src/pages/InvoiceDetail.jsx`, `src/pages/InvoiceDashboard.jsx`

### 9a. In `InvoiceDetail.jsx`, add a "Transaction Type" badge near the invoice type display. Find where `invoice_type` is shown and add alongside it:

```jsx
{invoice.invoice_transaction_type && invoice.invoice_transaction_type !== "STANDARD" && (
  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
    🇦🇪 {invoice.invoice_transaction_type.replace(/_/g, " ")}
  </span>
)}
```

### 9b. In `InvoiceDetail.jsx`, add a "UAE Scenario Details" section that shows the relevant conditional fields. Find the invoice details card and add a new section at the bottom that conditionally renders based on `invoice.invoice_transaction_type`. Follow the exact same layout/styling as existing detail sections in the file.

---

## TASK 10 — Update EditInvoice to support new fields

**File:** `src/pages/EditInvoice.jsx`

Apply the same `invoice_transaction_type` field and conditional fields UI as in `CreateInvoice.jsx` (Task 7). The edit form should:
1. Pre-populate `invoice_transaction_type` from the existing invoice data
2. Pre-populate all conditional fields from the existing invoice data
3. Include the same UAE Transaction Type section added in Task 7

---

## IMPLEMENTATION NOTES FOR REPLIT AGENT

**Order of implementation:**
1. Task 8 (migration) first — run and verify DB columns exist
2. Task 1 (CustomizationID fix) — quick win, test XML generation
3. Task 2 (TIN fix) — test that PEPPOL IDs use first 10 digits
4. Task 4 (predefined endpoints) — add constants, test routing logic
5. Task 3 (enum + model + schema) — largest backend change
6. Task 5 (XML generator extension) — depends on Task 3
7. Task 6 (MLS handling) — new endpoints only
8. Task 7 (frontend CreateInvoice) — depends on Task 3 backend being done
9. Task 9 (detail view display)
10. Task 10 (edit invoice)

**Critical constraints:**
- Do NOT change the `InvoiceType` enum values (380/381/383/480/81) — these are UBL type codes and must stay
- Do NOT rename existing API endpoints — only add new ones
- Do NOT alter existing `InvoiceCreate` required fields — all new fields are Optional with defaults
- Do NOT change the existing PEPPOL provider adapter signatures — only add the new `resolve_receiver_peppol_id` helper
- The `invoice_transaction_type` is separate from `invoice_type` — one is the document type code (380 etc), the other is the UAE scenario
- All new DB columns must have safe defaults so existing invoice records continue to work

**Testing checklist after implementation:**
- [ ] Create a standard tax invoice → XML has `urn:peppol:pint:billing-1@ae-1` as CustomizationID
- [ ] Create invoice with TRN → PEPPOL EndpointID uses first 10 digits, scheme 0235
- [ ] Create deemed supply invoice → PEPPOL transmission uses endpoint `0235:9900000097`
- [ ] Create export invoice → PEPPOL transmission uses endpoint `0235:9900000099`
- [ ] Create invoice with no customer PEPPOL ID → uses `0235:9900000098`
- [ ] Create e-commerce invoice → XML contains Delivery section with location and party
- [ ] Create continuous supply invoice → XML contains InvoicePeriod and ContractDocumentReference
- [ ] Existing invoices still load and display correctly
- [ ] Existing API endpoints still work (GET /invoices, POST /invoices, etc.)
- [ ] Credit note creation still requires preceding_invoice_id
- [ ] VAT calculations unchanged

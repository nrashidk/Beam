# InvoLinks Technical Specifications

**Version:** 1.0  
**Last Updated:** October 28, 2025  
**Status:** Production Ready (Core Platform)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Validation Rules](#validation-rules)
4. [UAE FTA Compliance](#uae-fta-compliance)
5. [Security Specifications](#security-specifications)
6. [Data Flows](#data-flows)
7. [API Specifications](#api-specifications)
8. [PEPPOL Integration](#peppol-integration)
9. [File Storage](#file-storage)
10. [Performance Specifications](#performance-specifications)

---

## 1. System Overview

### 1.1 Architecture Pattern
- **Pattern:** Multi-tenant SaaS with row-level tenant isolation
- **Backend:** FastAPI (async Python) with SQLAlchemy ORM
- **Frontend:** React 19.2 SPA with Vite bundler
- **Database:** PostgreSQL 14+ (Neon-backed)
- **Authentication:** JWT with role-based access control (RBAC)

### 1.2 Multi-Tenancy Model
- **Tenant Identifier:** `company_id` (UUID string)
- **Isolation:** Row-level security via foreign key relationships
- **Shared Resources:** User authentication, subscription plans, content blocks
- **Isolated Resources:** Invoices, purchase orders, documents, branding

### 1.3 Deployment Architecture
- **Deployment Type:** Reserved VM (Always-On)
- **Reason:** Maintains state, handles background tasks, ensures availability
- **Environment:** Replit cloud infrastructure
- **Scalability:** Horizontal scaling via load balancers (future)

---

## 2. Database Schema

### 2.1 Core Tables

#### **users**
User authentication and profile management.

```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR,
  role VARCHAR NOT NULL,  -- 'SUPERADMIN', 'ADMIN', 'USER'
  company_id VARCHAR REFERENCES companies(id),
  is_owner BOOLEAN DEFAULT FALSE,
  full_name VARCHAR,
  invited_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  
  -- MFA (Multi-Factor Authentication) - Ministerial Decision No. 64/2025
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_method VARCHAR,  -- 'totp', 'email', or NULL
  mfa_secret VARCHAR,  -- Base32 encoded TOTP secret
  mfa_backup_codes TEXT,  -- JSON array of hashed backup codes
  mfa_enrolled_at TIMESTAMP,
  mfa_last_verified_at TIMESTAMP
);
```

**Indexes:**
- `users_email_idx` on `email` (unique)
- `users_company_id_idx` on `company_id`

**Constraints:**
- Email must be unique across platform
- `company_id` required for non-SUPERADMIN roles
- `mfa_enabled` mandatory for ADMIN and SUPERADMIN

---

#### **companies**
Multi-tenant company entities.

```sql
CREATE TABLE companies (
  id VARCHAR PRIMARY KEY,
  legal_name VARCHAR,
  country VARCHAR DEFAULT 'AE',
  status VARCHAR NOT NULL,  -- 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'INACTIVE'
  trn VARCHAR,  -- 15-digit numeric Tax Registration Number
  
  -- MFA settings (company-level)
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_method VARCHAR,
  mfa_secret VARCHAR,
  mfa_backup_codes TEXT,
  mfa_enrolled_at TIMESTAMP,
  mfa_last_verified_at TIMESTAMP,
  
  -- Registration
  business_type VARCHAR,
  business_activity VARCHAR,
  registration_number VARCHAR,
  registration_date DATE,
  email VARCHAR,
  phone VARCHAR,
  website VARCHAR,
  
  -- Address
  address_line1 VARCHAR,
  address_line2 VARCHAR,
  city VARCHAR,
  emirate VARCHAR,
  po_box VARCHAR,
  
  -- Authorized person
  authorized_person_name VARCHAR,
  authorized_person_title VARCHAR,
  authorized_person_email VARCHAR,
  authorized_person_phone VARCHAR,
  
  -- Email verification
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR,
  verification_sent_at TIMESTAMP,
  
  -- Password & authentication
  password_hash VARCHAR,
  password_reset_token VARCHAR,
  password_reset_expires TIMESTAMP,
  
  -- Free plan configuration
  free_plan_type VARCHAR,  -- 'DURATION' or 'INVOICE_COUNT'
  free_plan_duration_months INTEGER,
  free_plan_invoice_limit INTEGER,
  free_plan_start_date TIMESTAMP,
  invoices_generated INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `companies_status_idx` on `status`
- `companies_trn_idx` on `trn`
- `companies_email_idx` on `email`

**Validation:**
- TRN must be exactly 15 numeric digits (regex: `^\d{15}$`)
- At least one of `password_hash` or `users.password_hash` required
- `email` must be valid email format

---

#### **subscription_plans**
Available subscription tiers.

```sql
CREATE TABLE subscription_plans (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,  -- 'Free', 'Pro', 'Enterprise'
  description TEXT,
  price_monthly FLOAT DEFAULT 0.0,
  price_yearly FLOAT DEFAULT 0.0,
  max_invoices_per_month INTEGER,
  max_users INTEGER DEFAULT 1,
  max_pos_devices INTEGER DEFAULT 0,
  allow_api_access BOOLEAN DEFAULT TRUE,
  allow_branding BOOLEAN DEFAULT FALSE,
  allow_multi_currency BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Default Plans:**
1. **Free:** 0 AED/month, 10 invoices/month, 1 user
2. **Pro:** 199 AED/month, unlimited invoices, 5 users
3. **Enterprise:** 499 AED/month, unlimited invoices, unlimited users

---

#### **company_subscriptions**
Tracks active subscriptions.

```sql
CREATE TABLE company_subscriptions (
  id VARCHAR PRIMARY KEY,
  company_id VARCHAR REFERENCES companies(id) NOT NULL,
  plan_id VARCHAR REFERENCES subscription_plans(id) NOT NULL,
  status VARCHAR NOT NULL,  -- 'TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED'
  billing_cycle VARCHAR DEFAULT 'monthly',  -- 'monthly' or 'yearly'
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  invoices_this_period INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `company_subscriptions_company_id_idx` on `company_id`

---

### 2.2 Invoice Tables

#### **invoices**
Outgoing invoices (Sales - Corner 1 of 5-Corner Model).

```sql
CREATE TABLE invoices (
  id VARCHAR PRIMARY KEY,
  company_id VARCHAR REFERENCES companies(id) NOT NULL,
  
  -- UBL/PINT-AE Core Fields
  invoice_number VARCHAR NOT NULL,
  invoice_type VARCHAR NOT NULL,  -- 'Tax Invoice', 'Credit Note', 'Commercial Invoice'
  status VARCHAR NOT NULL,  -- 'DRAFT', 'FINALIZED', 'APPROVED', 'SENT', 'PAID', 'CANCELLED'
  issue_date DATE NOT NULL,
  due_date DATE,
  currency_code VARCHAR DEFAULT 'AED',
  
  -- Supplier (Issuer)
  supplier_trn VARCHAR NOT NULL,
  supplier_name VARCHAR NOT NULL,
  supplier_address TEXT,
  supplier_city VARCHAR,
  supplier_country VARCHAR DEFAULT 'AE',
  supplier_peppol_id VARCHAR,
  
  -- Customer (Buyer)
  customer_trn VARCHAR,
  customer_name VARCHAR NOT NULL,
  customer_email VARCHAR,
  customer_address TEXT,
  customer_city VARCHAR,
  customer_country VARCHAR DEFAULT 'AE',
  customer_peppol_id VARCHAR,
  
  -- Monetary Totals
  subtotal_amount FLOAT DEFAULT 0.0,
  tax_amount FLOAT DEFAULT 0.0,
  total_amount FLOAT DEFAULT 0.0,
  amount_due FLOAT DEFAULT 0.0,
  total_amount_aed FLOAT,  -- Mandatory if currency != AED
  
  -- Payment Terms
  payment_terms TEXT,
  payment_due_days INTEGER DEFAULT 30,
  
  -- Notes & References
  invoice_notes TEXT,
  reference_number VARCHAR,
  preceding_invoice_id VARCHAR REFERENCES invoices(id),  -- For credit notes
  credit_note_reason VARCHAR,
  
  -- Document Management
  xml_file_path VARCHAR,
  pdf_file_path VARCHAR,
  xml_hash VARCHAR,  -- SHA-256 hash
  
  -- Digital Signature & Hash Chain
  prev_invoice_hash VARCHAR,  -- Chain link to previous invoice
  signature_b64 TEXT,  -- Base64 encoded digital signature
  signing_cert_serial VARCHAR,  -- Certificate serial for audit
  signing_timestamp TIMESTAMP,
  
  -- PEPPOL Transmission
  peppol_message_id VARCHAR,
  peppol_status VARCHAR,  -- 'SENT', 'DELIVERED', 'REJECTED'
  peppol_provider VARCHAR,  -- 'tradeshift', 'basware', 'mock'
  peppol_sent_at TIMESTAMP,
  peppol_response TEXT,  -- JSON
  
  -- Sharing
  share_token VARCHAR,
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  paid_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `invoices_company_id_idx` on `company_id`
- `invoices_invoice_number_idx` on `invoice_number`
- `invoices_status_idx` on `status`
- `invoices_prev_invoice_hash_idx` on `prev_invoice_hash`
- `invoices_peppol_message_id_idx` on `peppol_message_id`
- `invoices_share_token_idx` on `share_token`

**Constraints:**
- `invoice_number` unique per company
- `invoice_type = 'Credit Note'` requires `preceding_invoice_id` and `credit_note_reason`
- `status = 'APPROVED'` requires `signature_b64` and `xml_hash`

---

#### **invoice_line_items**
Individual items within invoices.

```sql
CREATE TABLE invoice_line_items (
  id VARCHAR PRIMARY KEY,
  invoice_id VARCHAR REFERENCES invoices(id) NOT NULL,
  line_number INTEGER NOT NULL,
  
  -- Product/Service
  item_name VARCHAR NOT NULL,
  item_description TEXT,
  item_code VARCHAR,  -- SKU
  
  -- Quantity & Unit
  quantity FLOAT NOT NULL,
  unit_code VARCHAR DEFAULT 'EA',  -- 'EA' (each), 'KG', 'M', etc.
  unit_price FLOAT NOT NULL,
  line_total FLOAT NOT NULL,
  
  -- Tax
  tax_category VARCHAR NOT NULL,  -- 'S' (Standard), 'Z' (Zero), 'E' (Exempt)
  tax_percent FLOAT NOT NULL,
  tax_amount FLOAT NOT NULL,
  
  -- Discounts
  discount_percent FLOAT DEFAULT 0.0,
  discount_amount FLOAT DEFAULT 0.0,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `invoice_line_items_invoice_id_idx` on `invoice_id`

---

### 2.3 Accounts Payable Tables

#### **purchase_orders**
Purchase orders to suppliers (AP Management).

```sql
CREATE TABLE purchase_orders (
  id VARCHAR PRIMARY KEY,
  company_id VARCHAR REFERENCES companies(id) NOT NULL,
  
  po_number VARCHAR NOT NULL,
  status VARCHAR NOT NULL,  -- 'DRAFT', 'SENT', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'
  
  -- Supplier
  supplier_trn VARCHAR NOT NULL,
  supplier_name VARCHAR NOT NULL,
  supplier_contact_email VARCHAR,
  supplier_address TEXT,
  supplier_peppol_id VARCHAR,
  
  -- Order Details
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  delivery_address TEXT,
  
  -- Financial
  currency_code VARCHAR DEFAULT 'AED',
  expected_subtotal FLOAT DEFAULT 0.0,
  expected_tax FLOAT DEFAULT 0.0,
  expected_total FLOAT NOT NULL,
  
  -- Matching Stats
  received_invoice_count INTEGER DEFAULT 0,
  matched_invoice_count INTEGER DEFAULT 0,
  received_amount_total FLOAT DEFAULT 0.0,
  variance_amount FLOAT DEFAULT 0.0,
  
  -- Notes & Reference
  reference_number VARCHAR,
  notes TEXT,
  
  -- Approval
  approved_by_user_id VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `purchase_orders_company_id_idx` on `company_id`
- `purchase_orders_po_number_idx` on `po_number`
- `purchase_orders_status_idx` on `status`

---

#### **purchase_order_line_items**
Line items for purchase orders.

```sql
CREATE TABLE purchase_order_line_items (
  id VARCHAR PRIMARY KEY,
  po_id VARCHAR REFERENCES purchase_orders(id) NOT NULL,
  line_number INTEGER NOT NULL,
  
  item_name VARCHAR NOT NULL,
  item_description TEXT,
  item_code VARCHAR,
  
  quantity_ordered FLOAT NOT NULL,
  quantity_received FLOAT DEFAULT 0.0,
  unit_code VARCHAR DEFAULT 'EA',
  unit_price FLOAT NOT NULL,
  line_total FLOAT NOT NULL,
  
  tax_category VARCHAR NOT NULL,
  tax_percent FLOAT NOT NULL
);
```

---

#### **goods_receipts**
Goods Receipt Notes (GRN) tracking physical deliveries.

```sql
CREATE TABLE goods_receipts (
  id VARCHAR PRIMARY KEY,
  company_id VARCHAR REFERENCES companies(id) NOT NULL,
  po_id VARCHAR REFERENCES purchase_orders(id),
  
  grn_number VARCHAR NOT NULL,
  status VARCHAR NOT NULL,  -- 'PENDING', 'RECEIVED', 'INSPECTED', 'ACCEPTED', 'REJECTED'
  
  receipt_date DATE NOT NULL,
  received_by_user_id VARCHAR REFERENCES users(id),
  
  -- Supplier
  supplier_trn VARCHAR NOT NULL,
  supplier_name VARCHAR NOT NULL,
  supplier_delivery_note VARCHAR,
  
  -- Quantities
  total_quantity_expected FLOAT DEFAULT 0.0,
  total_quantity_received FLOAT NOT NULL,
  
  -- Quality Control
  quality_status VARCHAR DEFAULT 'PENDING',  -- 'PENDING', 'PASSED', 'FAILED'
  quality_notes TEXT,
  inspected_by_user_id VARCHAR REFERENCES users(id),
  inspected_at TIMESTAMP,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `goods_receipts_company_id_idx` on `company_id`
- `goods_receipts_po_id_idx` on `po_id`
- `goods_receipts_grn_number_idx` on `grn_number`

---

#### **inward_invoices**
Incoming invoices from suppliers (Corner 4 of 5-Corner Model).

```sql
CREATE TABLE inward_invoices (
  id VARCHAR PRIMARY KEY,
  company_id VARCHAR REFERENCES companies(id) NOT NULL,
  po_id VARCHAR REFERENCES purchase_orders(id),
  grn_id VARCHAR REFERENCES goods_receipts(id),
  
  -- Supplier Invoice Details
  supplier_invoice_number VARCHAR NOT NULL,
  supplier_trn VARCHAR NOT NULL,
  supplier_name VARCHAR NOT NULL,
  supplier_email VARCHAR,
  supplier_address TEXT,
  supplier_peppol_id VARCHAR,
  
  -- Customer (Us)
  customer_trn VARCHAR NOT NULL,
  customer_name VARCHAR NOT NULL,
  
  -- Invoice Data
  invoice_date DATE NOT NULL,
  due_date DATE,
  currency_code VARCHAR DEFAULT 'AED',
  
  subtotal_amount FLOAT DEFAULT 0.0,
  tax_amount FLOAT DEFAULT 0.0,
  total_amount FLOAT NOT NULL,
  
  -- Matching
  matching_status VARCHAR DEFAULT 'NOT_MATCHED',  -- 'NOT_MATCHED', 'PARTIAL_MATCH', 'FULL_MATCH', 'VARIANCE_DETECTED'
  amount_variance FLOAT DEFAULT 0.0,
  
  -- Approval Workflow
  approval_status VARCHAR DEFAULT 'PENDING',  -- 'PENDING', 'APPROVED', 'REJECTED'
  approved_by_user_id VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Payment
  payment_status VARCHAR DEFAULT 'UNPAID',  -- 'UNPAID', 'PARTIALLY_PAID', 'PAID'
  amount_paid FLOAT DEFAULT 0.0,
  payment_date DATE,
  
  -- Document Management
  xml_file_path VARCHAR,
  xml_hash VARCHAR,
  
  -- Dispute
  dispute_status VARCHAR DEFAULT 'NO_DISPUTE',  -- 'NO_DISPUTE', 'UNDER_REVIEW', 'RESOLVED'
  dispute_notes TEXT,
  
  notes TEXT,
  received_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `inward_invoices_company_id_idx` on `company_id`
- `inward_invoices_supplier_trn_idx` on `supplier_trn`
- `inward_invoices_po_id_idx` on `po_id`
- `inward_invoices_matching_status_idx` on `matching_status`

**Constraints:**
- Combination of `(company_id, supplier_trn, supplier_invoice_number)` must be unique (no duplicates)

---

### 2.4 Supporting Tables

#### **company_documents**
Document uploads for verification.

```sql
CREATE TABLE company_documents (
  id VARCHAR PRIMARY KEY,
  company_id VARCHAR REFERENCES companies(id) NOT NULL,
  document_type VARCHAR NOT NULL,  -- 'BUSINESS_LICENSE', 'TRN_CERTIFICATE', 'TRADE_LICENSE', 'POA'
  file_name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR,
  status VARCHAR DEFAULT 'PENDING_REVIEW',  -- 'PENDING_REVIEW', 'APPROVED', 'REJECTED'
  issue_date DATE,
  expiry_date DATE,
  document_number VARCHAR,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
```

---

#### **company_branding**
Custom branding assets.

```sql
CREATE TABLE company_branding (
  id VARCHAR PRIMARY KEY,
  company_id VARCHAR REFERENCES companies(id) UNIQUE NOT NULL,
  
  -- Logo
  logo_file_name VARCHAR,
  logo_file_path VARCHAR,
  logo_file_size INTEGER,
  logo_mime_type VARCHAR,
  logo_uploaded_at TIMESTAMP,
  
  -- Stamp/Seal
  stamp_file_name VARCHAR,
  stamp_file_path VARCHAR,
  stamp_file_size INTEGER,
  stamp_mime_type VARCHAR,
  stamp_uploaded_at TIMESTAMP,
  
  -- Brand Colors
  primary_color VARCHAR,  -- Hex color
  secondary_color VARCHAR,
  font_family VARCHAR,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

#### **content_blocks**
CMS content management.

```sql
CREATE TABLE content_blocks (
  id VARCHAR PRIMARY KEY,
  key VARCHAR UNIQUE NOT NULL,  -- 'homepage_hero_title'
  value TEXT NOT NULL,
  description VARCHAR,
  section VARCHAR,  -- 'homepage', 'features', etc.
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR  -- Admin email
);
```

**Indexes:**
- `content_blocks_key_idx` on `key` (unique)
- `content_blocks_section_idx` on `section`

---

## 3. Validation Rules

### 3.1 UAE-Specific Validation

#### **TRN (Tax Registration Number)**
```
Pattern: ^\d{15}$
Length: Exactly 15 characters
Format: Numeric only
Example: 123456789012345

Validation Function: utils/validation.js
- validateTRN(trn)
```

#### **Email Addresses**
```
Pattern: ^[^\s@]+@[^\s@]+\.[^\s@]+$
Max Length: 255 characters
Case: Normalized to lowercase

Validation Function: utils/validation.js
- validateEmail(email)
```

#### **Phone Numbers**
```
Pattern: ^(\+971|0)(50|51|52|54|55|56|58|2|3|4|6|7|9)\d{7}$
Format: +971XXXXXXXXX or 0XXXXXXXXX
UAE Mobile Prefixes: 50, 51, 52, 54, 55, 56, 58
UAE Landline Prefixes: 2, 3, 4, 6, 7, 9

Validation Function: utils/validation.js
- validatePhone(phone)
```

#### **Password Strength**
```
Min Length: 8 characters
Requirements:
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*)

Pattern: ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$

Validation Function: utils/validation.js
- validatePassword(password)
```

### 3.2 Invoice Validation

#### **Invoice Number Format**
```
Pattern: INV-{company_id_prefix}-{sequence}
Example: INV-ABC123-00001
Generation: Sequential per company
Uniqueness: Per company (enforced at DB level)
```

#### **Date Validation**
```
issue_date:
- Format: YYYY-MM-DD (ISO 8601)
- Range: Cannot be future date
- Required: Yes

due_date:
- Format: YYYY-MM-DD (ISO 8601)
- Range: Must be >= issue_date
- Required: No (defaults to issue_date + 30 days)

Credit Note:
- issue_date must be >= preceding_invoice.issue_date
```

#### **Amount Validation**
```
Precision: 2 decimal places
Rounding: Half-up (0.005 rounds to 0.01)
Currency: Default AED

Line Total Calculation:
line_total = (quantity × unit_price) - discount_amount

Tax Calculation:
tax_amount = line_total × (tax_percent / 100)

Invoice Totals:
subtotal_amount = SUM(line_items.line_total)
tax_amount = SUM(line_items.tax_amount)
total_amount = subtotal_amount + tax_amount
```

#### **VAT Rate Validation**
```
Standard Rate: 5.0%
Zero Rate: 0.0%
Exempt: 0.0% (different tax category)

Tax Categories:
- S (Standard): 5%
- Z (Zero-rated): 0%
- E (Exempt): 0%
- O (Out of scope): 0%
```

### 3.3 File Upload Validation

#### **Document Uploads**
```
Allowed Types:
- PDF: application/pdf
- PNG: image/png
- JPG/JPEG: image/jpeg
- Excel: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- CSV: text/csv

Max File Size: 10 MB (10485760 bytes)
Validation: MIME type check + file extension validation
Storage: Local filesystem under artifacts/

Sanitization:
- Remove special characters from filenames
- Replace spaces with underscores
- Lowercase extensions
```

---

## 4. UAE FTA Compliance

### 4.1 Digital Signatures

#### **Algorithm**
- **Signature:** RSA-2048 with PSS padding
- **Hash:** SHA-256
- **Encoding:** Base64

#### **Process**
1. Generate invoice hash (SHA-256)
2. Generate XML hash (SHA-256)
3. Combine: `signature_data = invoice_hash + "|" + xml_hash`
4. Sign with private key (RSA-2048/PSS/SHA-256)
5. Base64 encode signature
6. Store in `invoices.signature_b64`

#### **Certificate Requirements**
- **Key Size:** 2048 bits minimum
- **Algorithm:** RSA or ECDSA
- **Format:** X.509 PEM
- **Validity:** Check expiry before signing
- **Serial:** Stored in `signing_cert_serial` for audit trail

### 4.2 Hash Chain

#### **Invoice Hash Calculation**
```python
hash_data = (
    invoice_number +
    issue_date +
    supplier_trn +
    customer_trn +
    total_amount (formatted to 2 decimals) +
    prev_invoice_hash (or "GENESIS" for first invoice)
)
hash = SHA256(hash_data).hexdigest()
```

#### **Chain Validation**
1. Retrieve previous invoice
2. Compute its hash
3. Compare with `current_invoice.prev_invoice_hash`
4. If match → Chain intact
5. If mismatch → Chain broken (audit alert)

### 4.3 UBL 2.1 XML Generation

#### **Namespaces**
```xml
xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
```

#### **Required Elements (PINT-AE)**
```xml
<Invoice>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>{invoice_number}</cbc:ID>
  <cbc:IssueDate>{issue_date}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>{invoice_type_code}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>{currency_code}</cbc:DocumentCurrencyCode>
  
  <cac:AccountingSupplierParty>...</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>...</cac:AccountingCustomerParty>
  <cac:TaxTotal>...</cac:TaxTotal>
  <cac:LegalMonetaryTotal>...</cac:LegalMonetaryTotal>
  <cac:InvoiceLine>...</cac:InvoiceLine>
</Invoice>
```

#### **Invoice Type Codes**
- `380`: Commercial Invoice
- `381`: Credit Note
- `386`: Prepayment Invoice

### 4.4 MFA Compliance (Ministerial Decision No. 64/2025)

#### **Article 9.1 Requirements**
- **Mandatory:** Admin and SuperAdmin users
- **Optional:** Regular users (Finance User role)
- **Methods:** TOTP (preferred), Email OTP, Backup Codes

#### **TOTP Specifications**
```
Algorithm: SHA-1 (TOTP standard)
Digits: 6
Period: 30 seconds
Library: pyotp (Python), authenticator apps (mobile)
QR Code: Generated with qrcode + pillow
Format: otpauth://totp/InvoLinks:{email}?secret={secret}&issuer=InvoLinks
```

#### **Backup Codes**
```
Count: 10 codes per enrollment
Format: 8 alphanumeric characters (XXXX-XXXX)
Storage: SHA-256 hashed in database
Usage: One-time use, marked as used after verification
Regeneration: User can regenerate new set (invalidates old)
```

---

## 5. Security Specifications

### 5.1 Authentication

#### **JWT Token Structure**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "ADMIN",
  "company_id": "company_uuid",
  "exp": 1698796800,
  "iat": 1698710400
}
```

**Expiration:** 24 hours (configurable via `JWT_EXPIRATION_HOURS`)  
**Algorithm:** HS256 (HMAC with SHA-256)  
**Secret:** 256-bit random key (from environment)

#### **Password Hashing**
```
Algorithm: bcrypt
Cost Factor: 12 (2^12 iterations)
Salt: Automatically generated per password
Storage: Only hash stored, never plaintext
```

### 5.2 SQL Injection Prevention

- **ORM:** All queries via SQLAlchemy (parameterized)
- **User Input:** Never concatenated into raw SQL
- **Escape:** Automatic parameter binding

### 5.3 CORS Configuration

```python
origins = [
    "http://localhost:5000",
    "https://*.replit.dev",
    "https://involinks.ae"
]

allow_credentials = True
allow_methods = ["*"]
allow_headers = ["*"]
```

### 5.4 File Upload Security

1. **MIME Type Validation:** Check against allowed list
2. **Extension Validation:** Verify file extension matches MIME
3. **Size Limit:** 10 MB maximum
4. **Path Traversal Prevention:** Sanitize filenames
5. **Storage Location:** Isolated artifacts directory

---

## 6. Data Flows

### 6.1 Invoice Creation Flow

```
User → Frontend → POST /invoices
        ↓
    FastAPI validates JWT
        ↓
    Check company subscription limits
        ↓
    Validate invoice data (Pydantic)
        ↓
    Generate invoice number (sequential)
        ↓
    Calculate totals (subtotal, tax, total)
        ↓
    Create InvoiceDB record (DRAFT status)
        ↓
    Create InvoiceLineItemDB records
        ↓
    Commit to database
        ↓
    Return invoice_id to frontend
```

### 6.2 Invoice Finalization Flow

```
User → Frontend → POST /invoices/{id}/finalize
        ↓
    FastAPI validates JWT & ownership
        ↓
    Load invoice from database
        ↓
    Retrieve previous invoice (for hash chain)
        ↓
    Compute invoice hash (SHA-256)
        ↓
    Generate UBL 2.1 XML
        ↓
    Compute XML hash (SHA-256)
        ↓
    Create digital signature (RSA-2048)
        ↓
    Save XML file to disk
        ↓
    Update invoice:
      - status = FINALIZED
      - xml_file_path
      - xml_hash
      - prev_invoice_hash
      - signature_b64
      - signing_timestamp
        ↓
    Commit to database
        ↓
    Return success
```

### 6.3 PEPPOL Transmission Flow

```
User → Frontend → POST /invoices/{id}/send
        ↓
    Validate invoice status (must be APPROVED)
        ↓
    Load UBL XML from file
        ↓
    Initialize PEPPOL provider (Tradeshift/Basware/Mock)
        ↓
    Call provider.send_invoice(xml, invoice_number, sender_id, receiver_id)
        ↓
    Provider returns message_id and status
        ↓
    Update invoice:
      - status = SENT
      - peppol_message_id
      - peppol_status
      - peppol_provider
      - peppol_sent_at
      - peppol_response (JSON)
        ↓
    Commit to database
        ↓
    Return transmission result
```

### 6.4 3-Way Matching Flow

```
Receive Inward Invoice → POST /inward-invoices/receive
        ↓
    Validate supplier TRN matches
        ↓
    Find matching PO (by supplier_trn + status)
        ↓
    Calculate amount variance (invoice total - PO expected_total)
        ↓
    Determine matching status:
      - FULL_MATCH: variance < 0.01 AED
      - VARIANCE_DETECTED: variance < 5% of PO total
      - PARTIAL_MATCH: variance >= 5%
      - NOT_MATCHED: no PO found
        ↓
    Find matching GRN (by po_id)
        ↓
    Compare line items:
      - Invoice quantities vs GRN quantities
      - Invoice amounts vs PO amounts
        ↓
    Update inward_invoice.matching_status
        ↓
    If variance > threshold → Flag for manual approval
        ↓
    Return matching result
```

---

## 7. API Specifications

### 7.1 Error Responses

#### **Standard Error Format**
```json
{
  "detail": "Error message",
  "status_code": 400,
  "error_type": "ValidationError"
}
```

#### **HTTP Status Codes**
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing/invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource
- `422 Unprocessable Entity`: Validation failed
- `500 Internal Server Error`: Server error

### 7.2 Pagination

```
Default: limit=50, offset=0
Max Limit: 100

Query Parameters:
- limit: Number of results (1-100)
- offset: Starting position (0-indexed)

Response:
{
  "items": [...],
  "total": 250,
  "limit": 50,
  "offset": 0,
  "has_more": true
}
```

### 7.3 Filtering

```
Invoices:
GET /invoices?status=APPROVED&invoice_type=Tax+Invoice&from_date=2025-01-01&to_date=2025-12-31

Purchase Orders:
GET /purchase-orders?status=SENT&supplier_trn=123456789012345
```

---

## 8. PEPPOL Integration

### 8.1 Provider Adapter Pattern

#### **Interface**
```python
class PeppolProvider:
    def send_invoice(xml, invoice_number, sender_id, receiver_id) -> dict
    def get_status(message_id) -> dict
    def validate_participant_id(participant_id) -> bool
```

#### **Supported Providers**
1. **Tradeshift:**
   - Base URL: `https://api.tradeshift.com`
   - Auth: API Key header
   - Endpoint: `/rest/external/documents`

2. **Basware:**
   - Base URL: `https://api.basware.com`
   - Auth: OAuth2 Bearer token
   - Endpoint: `/v1/invoices`

3. **Mock:**
   - Local simulation for testing
   - No API credentials required
   - Always returns success

### 8.2 Environment Configuration

```bash
PEPPOL_PROVIDER=tradeshift  # or 'basware', 'mock'
PEPPOL_BASE_URL=https://api.tradeshift.com
PEPPOL_API_KEY=your-api-key-here
```

### 8.3 PEPPOL ID Format

```
Format: ISO6523-based identifier
UAE Format: 0191:{TRN}
Example: 0191:123456789012345

Validation:
- Prefix: 0191 (UAE)
- TRN: 15 digits
- Total: 19 characters (0191: + 15 digits)
```

---

## 9. File Storage

### 9.1 Directory Structure

```
artifacts/
├── invoices/
│   └── {company_id}/
│       ├── {invoice_id}.xml
│       └── {invoice_id}.pdf
├── inward_invoices/
│   └── {company_id}/
│       └── {inward_invoice_id}.xml
├── company_assets/
│   └── {company_id}/
│       ├── logo.png
│       └── stamp.png
└── documents/
    └── {company_id}/
        └── {document_id}.pdf
```

### 9.2 File Naming Conventions

```
UBL XML: {invoice_id}.xml
PDF: {invoice_id}.pdf
Logo: logo_{timestamp}.{ext}
Stamp: stamp_{timestamp}.{ext}
Documents: {document_type}_{timestamp}.{ext}
```

---

## 10. Performance Specifications

### 10.1 Response Time Targets

- **API Endpoints:** < 200ms (95th percentile)
- **Invoice Generation:** < 500ms
- **UBL XML Generation:** < 100ms
- **Digital Signature:** < 50ms
- **Database Queries:** < 50ms (simple), < 200ms (complex)

### 10.2 Scalability Targets

- **Concurrent Users:** 100+ per company
- **Invoices per Month:** 10,000+ per company
- **Database Size:** 1 million+ invoices
- **File Storage:** 100 GB+

### 10.3 Database Optimization

#### **Indexes**
- Primary keys on all `id` columns
- Foreign keys on all relationship columns
- Frequently queried columns (`status`, `company_id`, `trn`)
- Hash chain navigation (`prev_invoice_hash`)

#### **Query Optimization**
- Eager loading for relationships
- Pagination for large result sets
- Filtered queries with proper indexes
- Connection pooling (SQLAlchemy)

---

## Appendix

### A. Glossary

- **TRN:** Tax Registration Number (15-digit UAE identifier)
- **UBL:** Universal Business Language (XML invoice standard)
- **PINT-AE:** PEPPOL International Invoicing - UAE Profile
- **PEPPOL:** Pan-European Public Procurement OnLine
- **GRN:** Goods Receipt Note
- **3-Way Matching:** PO → GRN → Invoice validation
- **MFA:** Multi-Factor Authentication
- **TOTP:** Time-based One-Time Password

### B. References

- [UAE FTA e-Invoicing Specifications](https://tax.gov.ae/)
- [PEPPOL BIS Billing 3.0](https://docs.peppol.eu/)
- [UBL 2.1 Specification](http://docs.oasis-open.org/ubl/)
- [Ministerial Decision No. 64/2025](https://uaegazette.gov.ae/)

### C. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-28 | Initial technical specifications |

---

**Document Status:** Living Document  
**Review Cycle:** Quarterly  
**Next Review:** January 2026

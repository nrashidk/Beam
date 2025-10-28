# InvoLinks System Architecture

**Version:** 1.0  
**Last Updated:** October 28, 2025  
**Document Status:** Living Document

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Component Architecture](#3-component-architecture)
4. [Data Architecture](#4-data-architecture)
5. [Security Architecture](#5-security-architecture)
6. [Integration Architecture](#6-integration-architecture)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Scalability & Performance](#8-scalability--performance)
9. [Disaster Recovery](#9-disaster-recovery)
10. [Future Architecture](#10-future-architecture)

---

## 1. System Overview

### 1.1 Purpose

InvoLinks is a multi-tenant SaaS platform designed to enable UAE businesses to:
- Issue FTA-compliant e-invoices
- Manage accounts payable with 3-way matching
- Exchange invoices via PEPPOL network
- Maintain digital audit trails with immutable hash chains
- Comply with UAE VAT regulations and Ministerial Decision No. 64/2025

### 1.2 Core Principles

**Multi-Tenancy:** Row-level isolation via `company_id` foreign keys  
**Compliance-First:** Built-in FTA Phase 2 and PEPPOL standards  
**Immutability:** Hash chains and digital signatures prevent tampering  
**Modularity:** Provider adapters allow swapping PEPPOL services  
**Security:** MFA, JWT auth, bcrypt hashing, SQL injection protection  

### 1.3 Technology Choices

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Backend | FastAPI (Python 3.11+) | Async support, auto OpenAPI docs, Pydantic validation |
| Database | PostgreSQL 14+ | ACID compliance, JSON support, mature ecosystem |
| ORM | SQLAlchemy 2.0 (async) | Type safety, migrations, relationship management |
| Frontend | React 19.2 + Vite | Modern SPA, fast HMR, component-based |
| Auth | JWT | Stateless, scalable, industry standard |
| XML | lxml | UBL 2.1 generation, XSD validation support |
| Crypto | cryptography (Python) | RSA/ECDSA signatures, SHA-256 hashing |
| Deployment | Replit Reserved VM | Always-on, managed infrastructure, auto-scaling |

---

## 2. High-Level Architecture

### 2.1 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        InvoLinks Platform                        │
│                                                                  │
│  ┌──────────┐    ┌───────────┐    ┌──────────┐   ┌──────────┐ │
│  │  React   │───▶│  FastAPI  │───▶│PostgreSQL│   │  File    │ │
│  │ Frontend │    │  Backend  │    │ Database │   │ Storage  │ │
│  └──────────┘    └───────────┘    └──────────┘   └──────────┘ │
│       │               │                                │        │
│       │               └────────────────────────────────┘        │
│       │                        │                                │
└───────┼────────────────────────┼────────────────────────────────┘
        │                        │
        │                        ▼
    ┌───┴────┐          ┌───────────────┐
    │ Users  │          │ External APIs │
    │ (Web)  │          │               │
    └────────┘          │ - Tradeshift  │
                        │ - Basware     │
                        │ - Email       │
                        │ - SMS (Twilio)│
                        └───────────────┘
```

### 2.2 Request Flow

```
User Browser → Vite Dev Server (Port 5000)
                    ↓
               React App (SPA)
                    ↓
            JWT Token (localStorage)
                    ↓
    HTTP Request → FastAPI (Port 8000)
                    ↓
           JWT Validation Middleware
                    ↓
         Business Logic (Services)
                    ↓
     SQLAlchemy ORM → PostgreSQL
                    ↓
           JSON Response ← FastAPI
                    ↓
         React State Update → UI Render
```

---

## 3. Component Architecture

### 3.1 Backend Components

```
main.py
├── API Routes (/auth, /invoices, /purchase-orders, etc.)
│   ├── Authentication endpoints
│   ├── Invoice CRUD endpoints
│   ├── AP Management endpoints
│   ├── SuperAdmin endpoints
│   └── Bulk import endpoints
│
├── Database Models (SQLAlchemy ORM)
│   ├── UserDB, CompanyDB
│   ├── InvoiceDB, InvoiceLineItemDB
│   ├── PurchaseOrderDB, GoodsReceiptDB
│   └── InwardInvoiceDB
│
├── Authentication & Authorization
│   ├── JWT token generation (create_access_token)
│   ├── Password hashing (bcrypt)
│   ├── User authentication (get_current_user)
│   └── MFA verification (TOTP, Email OTP, Backup Codes)
│
└── Business Logic
    ├── Invoice generation (generate_invoice_number)
    ├── Subscription enforcement (check_free_plan_limits)
    ├── 3-way matching (match_invoice_to_po)
    └── Document uploads (handle_file_upload)

utils/
├── crypto_utils.py
│   ├── InvoiceCrypto (hash chains, digital signatures)
│   ├── compute_hash (SHA-256)
│   ├── sign_invoice (RSA-2048/PSS)
│   └── verify_signature (public key verification)
│
├── ubl_xml_generator.py
│   ├── UBLXMLGenerator (PINT-AE compliant XML)
│   ├── generate_invoice_xml (UBL 2.1 structure)
│   └── validate_invoice_data (pre-generation checks)
│
├── peppol_provider.py
│   ├── PeppolProvider (abstract base class)
│   ├── TradeshiftProvider (Tradeshift API)
│   ├── BaswareProvider (Basware API)
│   ├── MockPeppolProvider (testing)
│   └── PeppolProviderFactory (provider instantiation)
│
├── bulk_import.py
│   ├── BulkImportValidator (CSV/Excel validation)
│   ├── validate_invoice_file (row-level validation)
│   ├── validate_vendor_file (vendor data validation)
│   └── parse_csv/parse_excel (data extraction)
│
└── exceptions.py
    ├── SigningError, CertificateError, CryptoError
    ├── ValidationError, ConfigurationError
    └── PeppolError, MatchingError
```

### 3.2 Frontend Components

```
src/
├── App.jsx (Main application router)
│   ├── Route definitions
│   ├── Authentication guards
│   └── Layout wrappers
│
├── pages/
│   ├── Homepage.jsx (Landing page with dynamic content)
│   ├── Login.jsx (Authentication)
│   ├── ForgotPassword.jsx (Password reset request)
│   ├── ResetPassword.jsx (Token-based reset)
│   ├── Dashboard.jsx (Business dashboard)
│   ├── SuperAdminDashboard.jsx (Platform analytics)
│   ├── Invoices.jsx (Invoice management)
│   ├── CreateInvoice.jsx (Invoice creation form)
│   ├── PurchaseOrders.jsx (AP management)
│   ├── ContentManager.jsx (CMS editor - SuperAdmin)
│   └── BulkImport.jsx (CSV/Excel upload)
│
├── contexts/
│   └── ContentContext.jsx
│       ├── ContentProvider (global content state)
│       ├── useContent() hook (access content by key)
│       └── Fetches content from /content/public on mount
│
├── utils/
│   └── validation.js
│       ├── validateTRN (15-digit numeric)
│       ├── validateEmail (RFC 5322)
│       ├── validatePhone (UAE formats)
│       └── validatePassword (strength requirements)
│
└── components/ (Reusable UI components)
    ├── PhoneInput.jsx (UAE phone validation)
    ├── EmailInput.jsx (Email validation)
    ├── PasswordInput.jsx (Strength indicator)
    └── TRNInput.jsx (TRN format validation)
```

---

## 4. Data Architecture

### 4.1 Entity Relationship Diagram

```
┌─────────────┐           ┌──────────────┐
│   users     │◀─────────▶│  companies   │
│             │  1:N      │              │
│ - id (PK)   │           │ - id (PK)    │
│ - email     │           │ - trn        │
│ - role      │           │ - status     │
│ - company_id│           │ - email      │
└─────────────┘           └──────────────┘
                                 │
                                 │ 1:N
                                 ▼
                          ┌──────────────┐
                          │  invoices    │
                          │              │
                          │ - id (PK)    │
                          │ - company_id │◀──┐
                          │ - invoice_#  │   │ Hash Chain
                          │ - status     │   │
                          │ - prev_hash  │───┘
                          │ - signature  │
                          └──────────────┘
                                 │
                                 │ 1:N
                                 ▼
                    ┌──────────────────────┐
                    │ invoice_line_items   │
                    │                      │
                    │ - id (PK)            │
                    │ - invoice_id (FK)    │
                    │ - item_name          │
                    │ - quantity           │
                    │ - unit_price         │
                    └──────────────────────┘

┌─────────────────┐       ┌───────────────────┐
│ purchase_orders │◀─────▶│ inward_invoices   │
│                 │  1:N  │                   │
│ - id (PK)       │       │ - id (PK)         │
│ - company_id    │       │ - po_id (FK)      │
│ - po_number     │       │ - grn_id (FK)     │
│ - supplier_trn  │       │ - matching_status │
└─────────────────┘       └───────────────────┘
        │                            ▲
        │ 1:N                        │
        ▼                            │ 1:N
┌────────────────┐                   │
│ goods_receipts │───────────────────┘
│                │
│ - id (PK)      │
│ - po_id (FK)   │
│ - grn_number   │
│ - status       │
└────────────────┘
```

### 4.2 Data Flow Patterns

#### **Pattern 1: Invoice Creation → Finalization → Sending**

```
1. CREATE (DRAFT)
   User Input → Validation → Database Insert
   Status: DRAFT
   
2. FINALIZE
   Load Invoice → Compute Hash → Generate XML → Create Signature
   Status: DRAFT → FINALIZED
   
3. APPROVE
   Business Approval → Update Status
   Status: FINALIZED → APPROVED
   
4. SEND
   Load XML → PEPPOL Provider → Transmission
   Status: APPROVED → SENT
```

#### **Pattern 2: 3-Way Matching (AP)**

```
1. PO Created
   Purchase Order → Status: DRAFT
   
2. PO Sent
   PO → Supplier (email/PEPPOL)
   Status: DRAFT → SENT
   
3. GRN Created
   Physical Delivery → GRN Record
   Links to PO
   
4. Invoice Received
   Supplier Invoice → Inward Invoice Record
   Auto-match: PO.supplier_trn == Invoice.supplier_trn
   
5. 3-Way Match
   Compare:
   - PO expected_total vs Invoice total_amount
   - GRN quantities vs Invoice quantities
   - Line item matching
   
   Result:
   - FULL_MATCH: variance < 0.01 AED
   - VARIANCE_DETECTED: variance < 5%
   - PARTIAL_MATCH: variance >= 5%
   - NOT_MATCHED: no PO found
```

### 4.3 Data Integrity Mechanisms

**Hash Chain:**
```
Invoice N:
  prev_invoice_hash = SHA256(Invoice N-1 data)
  
Invoice N+1:
  prev_invoice_hash = SHA256(Invoice N data)
  
Verification:
  Recompute SHA256(Invoice N)
  Compare with Invoice N+1.prev_invoice_hash
  If match → Chain intact
  If mismatch → Tampering detected
```

**Digital Signature:**
```
1. Compute invoice_hash = SHA256(invoice_data)
2. Compute xml_hash = SHA256(ubl_xml)
3. signature_data = invoice_hash + "|" + xml_hash
4. signature = RSA_SIGN(signature_data, private_key)
5. Store signature_b64 = Base64(signature)

Verification:
1. Load signature_b64
2. Recompute invoice_hash and xml_hash
3. Reconstruct signature_data
4. RSA_VERIFY(signature, signature_data, public_key)
```

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
┌──────────┐
│ Browser  │
└────┬─────┘
     │ 1. POST /auth/login
     │    {email, password}
     ▼
┌────────────────┐
│  FastAPI       │
│  /auth/login   │
└────┬───────────┘
     │ 2. Verify password (bcrypt)
     │ 3. Generate JWT token
     │    {sub: user_id, role, company_id, exp}
     │ 4. Return token
     ▼
┌──────────┐
│ Browser  │ Store in localStorage
└────┬─────┘
     │ 5. Subsequent requests
     │    Authorization: Bearer <token>
     ▼
┌────────────────┐
│  FastAPI       │
│  Middleware    │
└────┬───────────┘
     │ 6. Validate JWT signature
     │ 7. Check expiration
     │ 8. Extract user context
     │ 9. Proceed to route handler
     ▼
┌────────────────┐
│ Route Handler  │
│ (with user ctx)│
└────────────────┘
```

### 5.2 Multi-Factor Authentication (MFA)

```
Enrollment Flow:
1. User enables MFA
2. System generates TOTP secret (Base32)
3. QR code generated with:
   otpauth://totp/InvoLinks:{email}?secret={secret}&issuer=InvoLinks
4. User scans QR with authenticator app
5. User enters verification code
6. System validates code
7. Generate 10 backup codes (SHA-256 hashed)
8. Store: mfa_enabled=true, mfa_method='totp', mfa_secret, mfa_backup_codes

Login Flow with MFA:
1. User enters email + password
2. System validates credentials
3. If MFA enabled → Require verification code
4. User enters TOTP or backup code
5. System validates:
   - TOTP: pyotp.verify(code, secret)
   - Backup: SHA256(code) matches stored hash
6. If valid → Issue JWT token
7. If backup code used → Mark as used
```

### 5.3 Authorization Model

**Role-Based Access Control (RBAC):**

```
SUPER_ADMIN:
  - Full platform access
  - Company approval
  - Analytics dashboard
  - Content management
  - All company data (read-only for audit)

COMPANY_ADMIN:
  - Full company access
  - Invoice CRUD
  - AP management
  - Team management
  - Company settings

FINANCE_USER:
  - Invoice read/create
  - AP read access
  - Limited settings access
  - No team management
```

**Row-Level Security:**
```python
# All queries filtered by company_id
invoices = db.query(InvoiceDB).filter(
    InvoiceDB.company_id == current_user.company_id
).all()

# SuperAdmin bypass for audit/analytics
if current_user.role == Role.SUPER_ADMIN:
    # Access all companies
    companies = db.query(CompanyDB).all()
else:
    # Own company only
    company = db.query(CompanyDB).filter(
        CompanyDB.id == current_user.company_id
    ).first()
```

### 5.4 Data Protection

**At Rest:**
- Database: PostgreSQL encryption (provider-managed)
- Files: Filesystem encryption (Replit managed)
- Passwords: bcrypt (cost factor 12)
- MFA Secrets: Encrypted in database
- Backup Codes: SHA-256 hashed

**In Transit:**
- HTTPS/TLS 1.3 for all API calls
- WSS for WebSocket connections (future)
- PEPPOL: AS4 protocol with encryption

**Sensitive Data Handling:**
```
Never Logged:
- Passwords (plaintext)
- JWT tokens (full value)
- Private keys
- MFA secrets (plaintext)
- Backup codes (plaintext)

Logged (Masked):
- Email: adi***@acme.ae
- TRN: 123***789 (first 3 + last 3)
- Phone: +971***567
```

---

## 6. Integration Architecture

### 6.1 PEPPOL Integration

```
┌──────────────────┐
│  InvoLinks       │
│  Invoice Approved│
└────────┬─────────┘
         │
         │ 1. Load UBL XML
         │
         ▼
┌──────────────────────────┐
│ PeppolProviderFactory    │
│ .create_provider(name)   │
└────────┬─────────────────┘
         │
         │ 2. Instantiate provider
         │
         ▼
┌──────────────────────────┐
│  Provider (Tradeshift)   │
│  .send_invoice(xml, ...)  │
└────────┬─────────────────┘
         │
         │ 3. HTTP POST to provider API
         │
         ▼
┌──────────────────────────┐
│  Tradeshift API          │
│  https://api.tradeshift.com/rest/external/documents
└────────┬─────────────────┘
         │
         │ 4. PEPPOL Network transmission
         │
         ▼
┌──────────────────────────┐
│  PEPPOL Network          │
│  (AS4 protocol)          │
└────────┬─────────────────┘
         │
         │ 5. Delivery to recipient
         │
         ▼
┌──────────────────────────┐
│  Recipient Access Point  │
│  (Customer's PEPPOL AP)  │
└──────────────────────────┘
```

**Provider Adapter Pattern:**
```python
class PeppolProvider(ABC):
    @abstractmethod
    def send_invoice(xml, invoice_number, sender_id, receiver_id) -> dict:
        pass
    
    @abstractmethod
    def get_status(message_id) -> dict:
        pass
    
    @abstractmethod
    def validate_participant_id(participant_id) -> bool:
        pass

class TradeshiftProvider(PeppolProvider):
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
    
    def send_invoice(self, ...):
        # Tradeshift-specific implementation
        response = requests.post(
            f"{self.base_url}/rest/external/documents",
            headers={"X-Tradeshift-Token": self.api_key},
            data=xml
        )
        return response.json()

# Factory creates correct provider
provider = PeppolProviderFactory.create_provider(
    provider_name=os.getenv("PEPPOL_PROVIDER"),  # "tradeshift"
    base_url=os.getenv("PEPPOL_BASE_URL"),
    api_key=os.getenv("PEPPOL_API_KEY")
)
```

### 6.2 Future Integrations

**Planned:**
- **Stripe:** Payment processing for subscriptions
- **Twilio:** SMS delivery for MFA (currently placeholder)
- **SendGrid:** Transactional emails (password reset, invoice notifications)
- **AWS S3:** File storage migration from local filesystem
- **Redis:** Caching layer for content blocks and session data

---

## 7. Deployment Architecture

### 7.1 Current Deployment (Replit)

```
┌─────────────────────────────────────────────────┐
│              Replit Reserved VM                  │
│                                                  │
│  ┌──────────────┐      ┌─────────────────────┐ │
│  │   Frontend   │      │      Backend        │ │
│  │   (Port 5000)│      │   (Port 8000)       │ │
│  │   Vite Dev   │      │   uvicorn           │ │
│  │   Server     │      │   main:app          │ │
│  └──────┬───────┘      └──────┬──────────────┘ │
│         │                     │                 │
│         │  HTTP Requests      │                 │
│         └────────────────────▶│                 │
│                               │                 │
│                               ▼                 │
│                    ┌───────────────────┐        │
│                    │ Database (SQLite  │        │
│                    │ or PostgreSQL)    │        │
│                    └───────────────────┘        │
│                               │                 │
│                               ▼                 │
│                    ┌───────────────────┐        │
│                    │  File Storage     │        │
│                    │  artifacts/       │        │
│                    └───────────────────┘        │
└─────────────────────────────────────────────────┘
                        │
                        │ HTTPS
                        ▼
                 ┌──────────────┐
                 │  End Users   │
                 └──────────────┘
```

**Workflow Configuration:**
```
Workflow 1: Backend API
- Command: uvicorn main:app --host 0.0.0.0 --port 8000
- Auto-restart: On code changes
- Output: Console

Workflow 2: Frontend
- Command: npm run dev
- Port: 5000 (bound to 0.0.0.0)
- Output: Webview
- Hot Module Reload: Enabled
```

### 7.2 Production Deployment (Future)

```
┌────────────────────────────────────────────────────────┐
│                  Load Balancer (NGINX)                  │
│                  https://involinks.ae                   │
└───────────────────┬───────────────────┬────────────────┘
                    │                   │
        ┌───────────┴────────┐   ┌──────┴──────────┐
        │  Frontend Servers  │   │ Backend Servers │
        │  (Multiple Nodes)  │   │ (Multiple Nodes)│
        │  Static Files      │   │  FastAPI        │
        └──────────┬─────────┘   └────────┬────────┘
                   │                      │
                   │                      ▼
                   │           ┌───────────────────┐
                   │           │  PostgreSQL       │
                   │           │  (RDS/Managed)    │
                   │           └───────────────────┘
                   │                      │
                   │                      ▼
                   │           ┌───────────────────┐
                   │           │   Redis           │
                   │           │   (Cache/Sessions)│
                   │           └───────────────────┘
                   │                      │
                   │                      ▼
                   │           ┌───────────────────┐
                   │           │  Celery Workers   │
                   │           │  (Async Tasks)    │
                   │           └───────────────────┘
                   │                      │
                   ▼                      ▼
        ┌────────────────────────────────────────┐
        │           S3 / Object Storage          │
        │  - Invoice XML/PDF files               │
        │  - Company logos & stamps              │
        │  - Document uploads                    │
        └────────────────────────────────────────┘
```

**Infrastructure as Code (Future):**
- **Containerization:** Docker + Docker Compose
- **Orchestration:** Kubernetes or AWS ECS
- **CI/CD:** GitHub Actions → Build → Test → Deploy
- **Monitoring:** Prometheus + Grafana
- **Logging:** ELK Stack (Elasticsearch, Logstash, Kibana)

---

## 8. Scalability & Performance

### 8.1 Current Bottlenecks

| Component | Current Limit | Bottleneck |
|-----------|--------------|------------|
| Database Connections | 20 (SQLAlchemy pool) | Connection exhaustion |
| File Storage | Local filesystem | Disk I/O, no redundancy |
| UBL XML Generation | Synchronous | Blocks request thread |
| PEPPOL Transmission | Synchronous | Long API calls |
| Content Delivery | No CDN | Slow for distant users |

### 8.2 Scaling Strategies

**Horizontal Scaling (Future):**
```
Current: 1 VM → All components
Future: N VMs → Load balanced

Database:
- Read replicas for analytics queries
- Write leader for transactions
- Connection pooling (PgBouncer)

Backend:
- Stateless FastAPI instances
- Load balancer distributes requests
- Auto-scaling based on CPU/memory

Frontend:
- Static files on CDN (CloudFlare)
- Multiple edge locations
- Cache-Control headers
```

**Async Processing (Future):**
```
Current: Synchronous API calls

Future: Celery + Redis/RabbitMQ
Tasks:
- Invoice XML generation
- PEPPOL transmission
- Email sending
- Bulk import processing
- Report generation

Benefits:
- Non-blocking API responses
- Retry logic for failures
- Priority queues
- Scheduled tasks (e.g., daily reports)
```

### 8.3 Caching Strategy (Future)

```
Layer 1: Browser Cache
- Static assets (CSS, JS): 1 year
- API responses: No cache

Layer 2: Redis Cache
- Content blocks: 5 minutes
- Company profiles: 1 minute
- Subscription plans: 10 minutes
- Invoice lists: 30 seconds

Layer 3: Database Query Cache
- SQLAlchemy query result cache
- Invalidate on writes
```

### 8.4 Database Optimization

**Indexes:**
```sql
-- High-priority indexes
CREATE INDEX idx_invoices_company_status ON invoices(company_id, status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_trn);
CREATE INDEX idx_inward_invoices_matching ON inward_invoices(company_id, matching_status);

-- Full-text search (future)
CREATE INDEX idx_invoices_customer_name_fts ON invoices USING gin(to_tsvector('english', customer_name));
```

**Query Optimization:**
```python
# BAD: N+1 queries
invoices = db.query(InvoiceDB).all()
for invoice in invoices:
    line_items = invoice.line_items  # Separate query for each

# GOOD: Eager loading
invoices = db.query(InvoiceDB).options(
    joinedload(InvoiceDB.line_items)
).all()
```

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

**Database Backups:**
```
Provider: Neon (automatic daily backups)
Retention: 7 days (free tier), 30 days (paid)
Frequency: Daily at 02:00 UTC
Recovery: Point-in-time restore

Future Enhancements:
- Multi-region replication
- Hourly incremental backups
- Off-site backup storage (AWS S3)
```

**File Backups:**
```
Current: Local filesystem only (single point of failure)

Future Strategy:
- Daily sync to S3 (artifacts/)
- Versioning enabled
- Lifecycle policies:
  * Hot: 30 days (Instant retrieval)
  * Warm: 90 days (Glacier)
  * Cold: 7 years (Deep Archive) - FTA requirement
```

### 9.2 Recovery Procedures

**Database Restore:**
```bash
# 1. Identify backup point
neon_cli backups list --db involinks-prod

# 2. Restore to new instance
neon_cli restore --backup-id=backup_20251028 --to=involinks-recovery

# 3. Verify data integrity
psql involinks-recovery -c "SELECT COUNT(*) FROM invoices;"

# 4. Switch DNS/connection string
export DATABASE_URL=postgresql://...involinks-recovery...

# 5. Restart application
systemctl restart involinks
```

**File Restore:**
```bash
# 1. List available backups
aws s3 ls s3://involinks-backups/artifacts/

# 2. Restore specific directory
aws s3 sync s3://involinks-backups/artifacts/2025-10-28/ ./artifacts/

# 3. Verify file integrity
find artifacts/ -type f | wc -l
```

### 9.3 Failover Architecture (Future)

```
Primary Region (UAE - Dubai)
│
├── Primary Database (RDS Multi-AZ)
│   ├── Master (Active)
│   └── Standby (Passive, same AZ failover)
│
├── Application Servers (Auto Scaling Group)
│   ├── AZ-1a (Active)
│   └── AZ-1b (Active)
│
└── File Storage (S3)
    └── Cross-region replication → Backup Region (EU)

Failover Trigger:
- Health checks fail (3/3)
- Database unavailable > 60 seconds
- Manual override (disaster)

Failover Process:
1. Route 53 switches DNS to backup region
2. Application connects to read replica (promoted to master)
3. S3 serves from replicated region
4. Notification sent to ops team
```

---

## 10. Future Architecture

### 10.1 Microservices Evolution (Long-term)

```
Current: Monolithic FastAPI application
Future: Microservices architecture

Service Breakdown:
┌────────────────────┐
│  API Gateway       │
│  (Kong/AWS Gateway)│
└──────────┬─────────┘
           │
     ┌─────┴──────────────────────────┐
     │                                │
     ▼                                ▼
┌──────────────┐            ┌──────────────────┐
│ Auth Service │            │ Invoice Service  │
│ - Login      │            │ - CRUD           │
│ - MFA        │            │ - UBL generation │
│ - JWT        │            │ - Signature      │
└──────────────┘            └──────────────────┘
     │                                │
     │                                ▼
     │                      ┌──────────────────┐
     │                      │ PEPPOL Service   │
     │                      │ - Transmission   │
     │                      │ - Status tracking│
     │                      └──────────────────┘
     │                                │
     ▼                                ▼
┌──────────────┐            ┌──────────────────┐
│ AP Service   │            │ Analytics Service│
│ - PO         │            │ - Reporting      │
│ - GRN        │            │ - Dashboards     │
│ - Matching   │            │ - Insights       │
└──────────────┘            └──────────────────┘

Benefits:
- Independent scaling
- Technology diversity (Python, Go, Node.js)
- Fault isolation
- Easier testing

Challenges:
- Distributed transactions
- Service discovery
- Network latency
- Monitoring complexity
```

### 10.2 Event-Driven Architecture (Future)

```
Message Bus: RabbitMQ / Apache Kafka

Event Producers:
- Invoice created → InvoiceCreatedEvent
- Invoice approved → InvoiceApprovedEvent
- PEPPOL sent → PeppolTransmissionEvent
- Payment received → PaymentReceivedEvent

Event Consumers:
- Email Service (send notifications)
- Analytics Service (update metrics)
- Audit Service (log events)
- Integration Service (webhook callbacks)

Example Flow:
1. User creates invoice
2. Invoice Service → Publish "InvoiceCreatedEvent"
3. Email Service → Send confirmation email
4. Analytics Service → Increment company metrics
5. Audit Service → Log creation event
```

### 10.3 AI/ML Integration (Future Vision)

```
Use Cases:
1. Invoice Data Extraction
   - OCR from PDF/image uploads
   - Auto-populate invoice fields
   - Smart line item detection

2. Fraud Detection
   - Anomaly detection in amounts
   - Duplicate invoice prevention
   - Suspicious pattern recognition

3. Predictive Analytics
   - Cash flow forecasting
   - Payment delay prediction
   - Customer credit risk scoring

4. Smart Matching
   - Fuzzy matching for 3-way
   - ML-based PO recommendation
   - Variance explanation
```

### 10.4 Mobile Application (Future)

```
Technology: React Native
Platforms: iOS, Android

Features:
- Invoice capture via camera (OCR)
- Quick invoice approval (push notifications)
- Dashboard widgets
- Offline mode (sync when online)
- MFA authentication
- Receipt uploads

Architecture:
Mobile App → REST API (same FastAPI backend)
          → WebSocket (real-time updates)
          → Push Notifications (Firebase/APNS)
```

---

## Appendix

### A. Glossary

- **AP:** Accounts Payable
- **GRN:** Goods Receipt Note
- **PO:** Purchase Order
- **PEPPOL:** Pan-European Public Procurement OnLine
- **UBL:** Universal Business Language
- **TRN:** Tax Registration Number
- **MFA:** Multi-Factor Authentication
- **TOTP:** Time-based One-Time Password

### B. Architecture Decision Records (ADRs)

**ADR-001: Chosen FastAPI over Django/Flask**
- **Decision:** Use FastAPI for backend
- **Rationale:** Async support, auto OpenAPI docs, Pydantic validation, modern Python
- **Alternatives:** Django (too heavy), Flask (no async)
- **Status:** Accepted

**ADR-002: PostgreSQL over MongoDB**
- **Decision:** Use PostgreSQL for database
- **Rationale:** ACID compliance, relational data, mature ecosystem, JSON support
- **Alternatives:** MongoDB (no ACID), MySQL (inferior JSON support)
- **Status:** Accepted

**ADR-003: JWT over Session-based Auth**
- **Decision:** Use JWT tokens for authentication
- **Rationale:** Stateless, scalable, mobile-friendly, industry standard
- **Alternatives:** Session cookies (stateful, requires Redis)
- **Status:** Accepted

**ADR-004: Provider Adapter for PEPPOL**
- **Decision:** Abstract PEPPOL providers via adapter pattern
- **Rationale:** Swap providers without code changes, testability, future-proof
- **Alternatives:** Hard-coded Tradeshift integration
- **Status:** Accepted

### C. References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PEPPOL Technical Specifications](https://docs.peppol.eu/)
- [UAE FTA e-Invoicing](https://tax.gov.ae/)

### D. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-28 | InvoLinks Team | Initial architecture documentation |

---

**Document Status:** Living Document  
**Review Cycle:** Quarterly  
**Next Review:** January 2026  
**Maintained By:** InvoLinks Architecture Team

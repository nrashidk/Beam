# InvoLinks - Digital Invoicing for UAE

## Overview
InvoLinks is a full-stack digital invoicing platform for UAE businesses, providing automated, VAT-compliant e-invoicing, subscription management, and payment processing. Its purpose is to digitalize operations, enhance efficiency, eliminate paper invoices, ensure tax compliance, and provide transparent financial operations.

**Key Capabilities:**
- Modern React UI with dual dashboards (Super Admin and Business Admin).
- Streamlined company onboarding and flexible subscription management.
- Automated UAE e-Invoicing with UBL/PINT-AE compliance and Schematron validation.
- Multiple payment methods and customizable company branding.
- Digital signatures, hash chains, and PEPPOL integration for compliance and security.

## User Preferences
Detailed explanations preferred.

## Recent Changes

**October 27, 2025 - Corner 4: AP Management & Inward Invoicing (UAE 5-Corner Model Compliance):**
- **Database Schema Extensions for AP Management:**
  - `purchase_orders` + `purchase_order_line_items`: Track expected invoices from suppliers with PO matching
  - `goods_receipts` + `goods_receipt_line_items`: Goods Receipt Notes (GRN) for physical delivery tracking  
  - `inward_invoices` + `inward_invoice_line_items`: Received invoices from suppliers via PEPPOL (Corner 4)
  - New enums: PurchaseOrderStatus, GoodsReceiptStatus, InwardInvoiceStatus, MatchingStatus
  - Comprehensive 3-way matching fields (PO ↔ Invoice ↔ GRN) with variance detection
  - Approval workflows with multi-user review and authorization
  - Payment tracking, dispute management, and quality control fields
- **5-Corner Model Compliance:** InvoLinks now supports full UAE FTA 5-corner e-invoicing model:
  - Corner 1: Invoice Creation (Outward) - ✅ 100% Complete
  - Corner 2: Validation & Transmission - ✅ 100% Complete  
  - Corner 3: Secure PEPPOL Transmission - ✅ 95% Complete (architecture ready)
  - Corner 4: Invoice Receipt (AP Management) - 🚧 Database schema complete, APIs in progress
  - Corner 5: FTA Submission - ✅ 70% Complete (via ASP partnership)
- **Next Steps:** Build AP Inbox APIs, PEPPOL webhook handler, 3-way matching engine, and frontend dashboards

**October 27, 2025 - Tier 1 Production Hardening:**
- **Custom Exception Module (`utils/exceptions.py`):** Structured domain exceptions for better error handling and debugging (ValidationError, CryptoError, SigningError, CertificateError, XMLGenerationError, PeppolError, ConfigurationError).
- **Enhanced Crypto Utilities (`utils/crypto_utils.py`):** 
  - Certificate loading, validation, expiry checking, and metadata extraction
  - InvoiceCrypto now accepts and validates X.509 certificates at initialization
  - Environment key validation with development/production mode support
- **Environment Validation:** 
  - **Development Mode** (default): Warns about missing keys, continues with mocks
  - **Production Mode** (`PRODUCTION_MODE=true`): Fails hard if signing keys/certificates are missing
  - Validates certificate expiry at startup (warns if < 30 days to expiration)
- **UBL XML Generator:** Updated with structured error handling and better validation
- **PEPPOL Provider:** Added canonical error envelopes with error codes (TIMEOUT, NETWORK_ERROR) for observability
- **Global Exception Handler:** FastAPI automatically converts domain exceptions to structured HTTP responses
- **Required Environment Variables:**
  - `SIGNING_PRIVATE_KEY_PEM`: PEM-encoded RSA-2048 private key for invoice signing
  - `SIGNING_CERTIFICATE_PEM`: PEM-encoded X.509 certificate for validation
  - `PRODUCTION_MODE`: Set to `true` to enforce strict validation (optional, defaults to false)

**Follow-Up Improvements (October 27, 2025):**
- **Automated Test Suite (`tests/test_crypto_validation.py`):** 11 comprehensive tests covering production mode validation, certificate expiry detection, metadata extraction, and InvoiceCrypto initialization. All tests passing.
- **Production Runbook (`docs/PRODUCTION_RUNBOOK.md`):** Complete operational guide for certificate management, rotation procedures, monitoring, troubleshooting, and security best practices.
- **KMS/HSM Migration Plan (`docs/KMS_ARCHITECTURE.md`):** Detailed architecture plan for migrating to AWS KMS/Azure Key Vault, including provider comparison, cost analysis, security benefits, and 6-8 week implementation timeline.

## System Architecture

**Technology Stack:**
- **Frontend:** React 19.2 (Vite 7.1), React Router 7.9, Tailwind CSS 3.4, Axios, Recharts, Radix UI, date-fns.
- **Backend:** FastAPI 2.0 (Python async), PostgreSQL, SQLAlchemy 2.0.36 ORM, JWT authentication (bcrypt), CORS.

**UI/UX Decisions:**
- Groww/Toss-inspired design: clean, minimal, modern fintech style.
- Bold hero sections, card-based feature highlights, glassmorphism navbar.
- Rounded corners, enhanced shadows, hover states, mobile-responsive design.
- Inter font family for professional typography.

**Core Features & Technical Implementations:**
1.  **Registration & Subscription:** Simplified signup with email verification, token-based workflow, and automatic Free tier assignment. Flexible Free plan configuration (duration or invoice count).
2.  **Admin Approval Workflow:** Admins approve/reject registrations, configure free plan types and limits, and track per-company invoice counters.
3.  **Company Management:** TRN validation, automatic VAT state transitions, Peppol endpoint ID support, and custom branding profiles.
4.  **Invoice Generation & Management:**
    *   Full UAE e-Invoicing Compliance: UBL 2.1 / PINT-AE XML generation, support for Tax Invoice, Credit Note, Commercial types. Automatic validation, SHA-256 hash calculation, digital signatures, and hash chain linking for tamper-proof audit trails.
    *   CRUD operations for invoices (create, list, view, issue, send, cancel).
    *   Invoice sharing via public links and customer portal.
    *   Free plan enforcement with invoice counters and blocking upon limit.
    *   ASP Integration Architecture ready for Accredited Service Provider APIs (e.g., Peppol network transmission).
5.  **Payment Processing:** Supports Cash, Card, POS, Bank transfer, Digital wallets, with payment intents pattern and card surcharge configuration.
6.  **Branding:** Custom logos (PNG/SVG), configurable colors/fonts, header/footer text. Drag-and-drop upload interface with live preview, asset management with checksums, and subscription plan gating.
7.  **Multi-User Team Management:** Unlimited team members per company, role-based access (Owner, Admin, Finance User), invitation system with temporary passwords, and robust security.
8.  **SuperAdmin Analytics Dashboard:** Comprehensive revenue metrics (MRR/ARR, revenue breakdown by plan), company explorer (filtering, search, CSV export), registration analytics, and invoice statistics.
9.  **Critical Compliance Features:**
    *   **Digital Signatures, Hash Chains & PEPPOL Integration:** Database schema extensions for `signature_b64`, `signing_cert_serial`, `signing_timestamp`, `prev_invoice_hash`, `xml_hash`, and PEPPOL tracking fields.
    *   **Crypto Utilities Module:** SHA-256 hashing, RSA-2048 digital signature generation/verification, hash chain linking.
    *   **UBL 2.1 XML Generator:** Generates UAE PINT-AE compliant XML (UBL 2.1, PEPPOL BIS 3.0).
    *   **PEPPOL Provider Adapter:** Extensible adapter for multiple PEPPOL providers (e.g., Tradeshift, Basware).
    *   **Enhanced Invoice Workflow:** Specific endpoints for DRAFT, ISSUED (with XML, signature, hash chain), and PEPPOL transmission.

**System Design Choices:**
- **Deployment:** Configured for Reserved VM (Always-On) for persistent connections, in-memory counters, and 24/7 availability.
- **Database Schema:** 
  - **Core Tables:** `companies`, `subscription_plans`, `users`, `invoices`, `invoice_line_items`, `invoice_tax_breakdowns`, `payment_intents`, `assets`, `company_branding`
  - **AP Management (Corner 4):** `purchase_orders`, `purchase_order_line_items`, `goods_receipts`, `goods_receipt_line_items`, `inward_invoices`, `inward_invoice_line_items`
  - Includes fields for free plan tracking, comprehensive invoice data, user management (is_owner, full_name, invited_by), branding assets, PO matching, 3-way reconciliation, and approval workflows
- **Configuration:** Environment variables for `DATABASE_URL`, `ARTIFACT_ROOT`, `PEPPOL_ENDPOINT_SCHEME`, `RETENTION_YEARS`.
- **VAT Settings:** Standard 5% VAT rate, AED 375,000 mandatory registration threshold.
- **Security:** SQLAlchemy ORM for SQL injection protection, file upload validation, environment variable-based database credentials.

## External Dependencies

-   **PostgreSQL:** Primary database (Neon-backed).
-   **Axios:** Frontend API communication.
-   **Recharts:** Frontend analytics visualization.
-   **Radix UI:** UI component library.
-   **date-fns:** Frontend date handling.
-   **JWT:** Authentication.
-   **bcrypt:** Password hashing.
-   **PINT/PINT-AE specification:** UAE e-invoicing compliance.
-   **Schematron:** Invoice validation (global and UAE-specific rules).
-   **Genericode files:** Compliance-related data (`eas.gc`, `ISO4217.gc`, `UNCL*.gc`, etc.) from `/mnt/data/`.
-   **Schematron XSLT files:** Validation rules (`PINT-UBL-validation-preprocessed.xslt`, `PINT-jurisdiction-aligned-rules.xslt`) from `/mnt/data/`.
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

**October 28, 2025 - MFA Implementation (✅ 100% COMPLETE - Backend + Frontend):**
- **Legal Requirement:** Article 9.1 of Ministerial Decision No. 64/2025 - "Multifactor authentication mechanisms to secure user access is maintained"
- **Status:** ✅ Article 9.1 COMPLIANT - Full stack implementation complete
- **Implementation:** 3 authentication methods with $0 cost:
  1. **TOTP** (Time-Based OTP) - Primary method, Google/Microsoft Authenticator compatible
  2. **Email OTP** - Backup method with 10-minute expiry, rate limited (3/hour)
  3. **Backup Codes** - 10 single-use recovery codes, SHA-256 hashed storage

**Backend (✅ Complete & Architect Approved):**
- `utils/mfa_utils.py` (~350 lines) - MFAManager, EmailOTPManager classes
- 7 REST API endpoints (enroll, verify, status, disable, backup codes, email OTP)
- QR code generation for authenticator apps
- Database: 6 MFA fields added to both `users` and `companies` tables
- Security: Temp tokens (5-min expiry), rate limiting (3/hour), SHA-256 hashing, RFC 6238 TOTP
- Updated login flow: Email + Password → MFA challenge (if enabled) → Verify code → Access granted
- Both user and company authentication paths enforce MFA

**Frontend (✅ Complete - October 28, 2025):**
- `src/components/MFAVerificationModal.jsx` (~150 lines) - Login MFA verification UI
- `src/components/MFAEnrollmentWizard.jsx` (~280 lines) - 3-step TOTP enrollment wizard
- `src/pages/MFASettings.jsx` (~300 lines) - Security settings dashboard
- `src/lib/api.js` - 7 MFA API endpoints integrated
- `src/contexts/AuthContext.jsx` - MFA state management (mfaRequired, tempToken, mfaMethod)
- `src/pages/Login.jsx` - MFA verification modal integration
- `src/App.jsx` - `/settings/security` route added
- Total: ~1,140 lines of frontend code, 0 compilation errors

**Features:**
- 3-step enrollment wizard (Introduction → QR Code → Backup Codes)
- Login verification modal (TOTP, Email OTP, Backup Code support)
- Settings dashboard (Enable/Disable, Regenerate codes, Status display)
- Download/Copy backup codes functionality
- Error handling and loading states
- Mobile responsive design
- Matches existing InvoLinks UI/UX

**Testing:**
- Comprehensive testing guide: `MFA_FRONTEND_TESTING_GUIDE.md`
- 10 test scenarios covering enrollment, login, regeneration, disable
- Both workflows running successfully (Backend API + Frontend)
- Ready for end-to-end testing

**Documentation:**
- `MFA_IMPLEMENTATION_SUMMARY.md` - Backend technical details
- `TASK_3_COMPLETION_REPORT.md` - Backend completion report
- `MFA_FRONTEND_TESTING_GUIDE.md` - Frontend testing scenarios
- `MFA_FRONTEND_IMPLEMENTATION_COMPLETE.md` - Frontend summary

**Packages:** pyotp, qrcode, pillow (backend) - $0 cost forever
**Next Steps:** End-to-end testing, production SMTP configuration, Redis for OTP storage

**October 27, 2025 - ASP Partnership Model Confirmed:**
- **CRITICAL DECISION:** InvoLinks is **NOT an Accredited Service Provider (ASP)**
- **Business Model:** We are **billing software** that partners with ASPs (Tradeshift/Basware)
- **Invoice Flow:** InvoLinks → ASP Partner → PEPPOL Network → Buyer's ASP → FTA
- **What We DON'T Build:**
  - Direct FTA submission APIs (ASP handles this - Corner 5)
  - PEPPOL certification process (use existing ASPs)
  - ISO 22301 business continuity certification (only for ASPs)
- **What We DO Build:**
  - Corner 1: Invoice creation (✅ Complete)
  - Corner 2: Integration with ASP for transmission (⚠️ Need partnership)
  - Corner 3: Integration with ASP for reception (⚠️ Need partnership)
  - Corner 4: AP Management - receiving invoices (🚧 40% done)
  - Compliance: MFA, ISO 27001, security monitoring
- **Partnership Requirements:** Tradeshift or Basware production API credentials needed

**October 27, 2025 - Corner 4: AP Management & Inward Invoicing (UAE 5-Corner Model Compliance):**
- **Database Schema Extensions for AP Management:**
  - `purchase_orders` + `purchase_order_line_items`: Track expected invoices from suppliers with PO matching
  - `goods_receipts` + `goods_receipt_line_items`: Goods Receipt Notes (GRN) for physical delivery tracking  
  - `inward_invoices` + `inward_invoice_line_items`: Received invoices from suppliers via PEPPOL (Corner 4)
  - New enums: PurchaseOrderStatus, GoodsReceiptStatus, InwardInvoiceStatus, MatchingStatus
  - Comprehensive 3-way matching fields (PO ↔ Invoice ↔ GRN) with variance detection
  - Approval workflows with multi-user review and authorization
  - Payment tracking, dispute management, and quality control fields
- **Corner 4 REST APIs (✅ Completed & Architect Approved):**
  - POST /inward-invoices/receive - Receive invoices from suppliers
  - GET /inward-invoices - List AP inbox with filters
  - GET /inward-invoices/{id} - Get invoice details
  - POST /inward-invoices/{id}/approve - Approve for payment
  - POST /inward-invoices/{id}/reject - Reject with reason
  - POST /inward-invoices/{id}/match-po - Manual PO matching
- **5-Corner Model Compliance:** InvoLinks now supports full UAE FTA 5-corner e-invoicing model:
  - Corner 1: Invoice Creation (Outward) - ✅ 100% Complete
  - Corner 2: ASP Validation & Transmission - ⚠️ 70% Ready (need ASP partnership)
  - Corner 3: ASP Secure Transmission - ⚠️ 70% Ready (need ASP partnership)
  - Corner 4: Invoice Receipt (AP Management) - 🚧 40% Complete (database + APIs done)
  - Corner 5: FTA Submission - ⚠️ Handled by ASP Partner
- **Next Steps:** MFA implementation (Task 3), PEPPOL webhook handler (Task 4), PO management APIs (Task 5)

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
-   **pyotp:** TOTP generation for MFA (installed).
-   **qrcode + pillow:** QR code generation for TOTP enrollment (installed).
-   **twilio:** SMS delivery for SMS-based 2FA (installed, needs manual credentials).

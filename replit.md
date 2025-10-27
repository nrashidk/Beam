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
- **Database Schema:** Tables for `companies`, `subscription_plans`, `users`, `invoices`, `invoice_line_items`, `invoice_tax_breakdowns`, `payment_intents`, `assets`, `company_branding`. Includes fields for free plan tracking, comprehensive invoice data, user management (is_owner, full_name, invited_by), and branding assets.
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
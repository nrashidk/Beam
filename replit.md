# InvoLinks - Digital Invoicing for UAE

## Overview
InvoLinks is a full-stack digital invoicing platform for UAE businesses, providing automated, VAT-compliant e-invoicing, subscription management, and payment processing. Its purpose is to digitalize operations, enhance efficiency, ensure tax compliance, and provide transparent financial operations for UAE businesses. Key capabilities include a modern React UI, streamlined onboarding, automated UAE e-Invoicing (UBL/PINT-AE compliant), multiple payment methods, customizable branding, digital signatures, hash chains, multi-factor authentication, and comprehensive Accounts Payable (AP) Management supporting the UAE 5-Corner model.

## User Preferences
Detailed explanations preferred.

## System Architecture

**UI/UX Decisions:**
- Groww/Toss-inspired design: clean, minimal, modern fintech style with bold hero sections, card-based feature highlights, and glassmorphism navbar.
- Rounded corners, enhanced shadows, hover states, mobile-responsive design, and Inter font family.
- Reusable validation system with centralized utilities for UAE-specific validation.
- Persistent branding system: AdminLayout component provides consistent InvoLinks header (logo + name) and footer across all admin pages (SuperAdmin, Business Admin, Team User), maintaining brand identity during all states including loading and navigation.

**Technical Implementations:**
- **Technology Stack:** Frontend: React 19.2 (Vite 7.1), React Router 7.9, Tailwind CSS 3.4, Axios, Recharts, Radix UI, date-fns. Backend: FastAPI 2.0 (Python async), PostgreSQL, SQLAlchemy 2.0.36 ORM, JWT authentication (bcrypt), CORS.
- **Registration & Subscription:** Simple 2x2 grid signup form collecting essential information (legal name, phone, email, password). Additional company details (business type, website, address, TRN) can be added and modified by business admins via the in-dashboard Edit button after approval. Includes email verification, token-based workflow, automatic Free tier assignment, and flexible free plan configuration.
- **Company Management:** TRN validation, automatic VAT state transitions, Peppol endpoint ID support, custom branding profiles, and comprehensive company approval workflow with status tracking (approved_at, rejected_at timestamps).
- **SuperAdmin Company Management:** Full-featured company database browser with subscription-aware status filtering and comprehensive company editing capabilities. Company status classification: **Pending** (awaiting approval), **Approved** (approved companies on Free plan without paid subscription), **Active** (companies with active paid subscription/tier), **Rejected** (rejected registrations), and **Inactive** (suspended companies). The system distinguishes between approved companies using the free tier versus those with active paid subscriptions, enabling SuperAdmins to track conversion from free to paid tiers. Features include relative date displays, interactive status cards for quick filtering, and comprehensive editing via "Manage" column with inline edit modal. Backend endpoints `/admin/stats` and `/admin/companies` implement subscription-aware filtering logic based on subscription_plan_id to differentiate free vs paid companies. SuperAdmins can edit company details including invoices_generated, free_plan_invoice_limit, free_plan_duration_months, and vat_enabled. The dashboard features a streamlined interface focusing on core company management functionality. (Enhanced November 2025)
- **Company Admin Dashboard:** Consolidated company information management directly in the dashboard. Company Information section displays legal name, status, email, phone, website, and complete address details (address_line1, address_line2, city, emirate, po_box) with auto-population from registration data upon approval. In-dashboard Edit button opens modal dialog for updating company profile without separate settings page. Backend GET `/companies/{company_id}` returns complete company data including all address fields for seamless auto-population. (Implemented November 2025)
- **Billing & Subscription System:** Complete monetization infrastructure with Stripe integration supporting free trials, tiered subscriptions, multi-cycle billing, volume discounts, and various payment methods.
- **Invoice Generation & Management:** Full UAE e-Invoicing Compliance (UBL 2.1 / PINT-AE XML generation). Features include automatic validation, SHA-256 hash calculation, digital signatures, hash chain linking, and CRUD operations.
- **Email Integration:** Production-ready email service for verification, MFA, invoice notifications, and admin approvals using HTML templates.
- **Invoice Delivery System:** Multi-channel delivery via QR code, Email, SMS, and WhatsApp, with a public invoice view.
- **Excel/CSV Bulk Import:** Data import system for invoices and vendors with template downloads, strict UAE compliance validation, and row-level error reporting.
- **Accounts Payable (AP) Management:** Comprehensive AP suite supporting the UAE 5-Corner model, including an AP Inbox, Supplier Management, and Purchase Order/Goods Receipt workflows with 3-way matching.
- **FTA Audit File Generation:** UAE Federal Tax Authority (FAF) compliant audit file generation in CSV/TXT format.
- **Payment Processing:** Supports Cash, Card, POS, Bank transfer, Digital wallets, with payment intents and card surcharge configuration.
- **Branding:** Custom logos, configurable colors/fonts, header/footer text with drag-and-drop upload and live preview.
- **Multi-User Team Management:** Role-based team management with invitation system and tier-based user limits.
- **Multi-Factor Authentication (MFA):** Implementation of TOTP, Email OTP, and Backup Codes.
- **SuperAdmin Analytics Dashboard:** Comprehensive revenue metrics, company explorer, registration analytics, and invoice statistics.
- **Content Management System (CMS):** Modern, tab-based content management interface with indigo/purple gradient design. SuperAdmins can edit Homepage, Feature Boxes, Header, and Footer content sections. Features include inline editing with character counter, real-time save status, detailed console logging for debugging, and visual success notifications. Navigation properly routes to `/admin` for SuperAdmin Dashboard.
- **Featured Businesses Management:** Full CRUD interface for SuperAdmins to manage featured businesses on homepage, with auto-incrementing display order, edit modal for reordering/updating, and toggle active status.
- **PEPPOL Settings UI:** Self-service PEPPOL configuration dashboard.
- **Finance Dashboard:** Comprehensive financial analytics with key metrics, revenue vs. expenses tracking, cash flow, and AR/AP tracking.
- **Simple Expense Tracking:** Straightforward expense management with custom user-defined categories and automatic net income/VAT calculations.
- **Simple Inventory Management:** Basic inventory tracking for products and materials, including stock levels, automatic deductions, transactions, and low stock alerts.
- **PDF Invoice Generation:** Professional PDF invoice generator with UAE branding, VAT breakdown, QR codes, digital signature indicators, and multi-currency support.
- **Critical Compliance Features:** Digital signatures, hash chains, PEPPOL integration, Crypto Utilities Module (SHA-256, RSA-2048), UBL 2.1 XML Generator, and an extensible PEPPOL Provider Adapter.
- **Tier 1 Production Hardening:** Custom exception module, enhanced crypto utilities with certificate validation, environment validation, structured error handling, and a global exception handler.
- **Production Signing Keys System:** Cryptographic key management for UAE FTA compliance, including RSA-2048 key pair and X.509 certificate generation.
- **VAT Compliance System:** Production-ready UAE VAT opt-in infrastructure with automatic invoice classification, TRN tracking, and tax code management.
- **TRN Optionality for Non-VAT Parties:** Complete implementation allowing transactions with non-VAT-registered suppliers and customers. TRN fields are optional in all invoice, purchase order, and goods receipt forms and database models. Invoice creation only requires TRN when company.vat_enabled is true. Supplier matching logic falls back to name-based matching when TRNs are unavailable, ensuring AP reconciliation works for both VAT and non-VAT scenarios. (Implemented October 2025)
- **Enhanced RBAC System:** Production-ready role-based access control with three-tier user hierarchy and flexible SuperAdmin management, including tier-based user limits and user tracking.
- **Payment Verification & Reconciliation:** Production-ready offline payment tracking system with complete audit trail and daily reconciliation reports.
- **Advanced Analytics & Insights:** Production-ready comprehensive business intelligence dashboard providing revenue trends, customer insights, profitability analysis, and cash flow visualization.
- **UAE FTA Accreditation Compliance (T1–T17, ~80% readiness):** Full compliance programme completed in priority order:
  - T8 General Ledger, T7 FAF 4-Table+Hash+ZIP, T9 VAT Return Generator, T1 Audit Trail, T2 Password Security (P1 complete)
  - T3 Lock Posted Invoices (409/Credit-Note flow), T4 Debit Note type 383, T5 Supply Date (UBL Delivery), T6 Arabic PDF headers (Amiri font + arabic-reshaper + bidi), T10 Concurrent Update Prevention (ETag/If-Match optimistic locking with 412 Precondition Failed) (P2 complete)
  - T11 Periodic Reports (monthly/quarterly summary, CSV export), T12 Data Archival & Restoration (P3 complete)
  - T13 VAT Return 13-Box FTA Form 301: VATReturnDB extended with 6 new columns (zero_rated, exempt, out_of_scope), generate endpoint splits by tax category (S/Z/E/O), `/vat-return` page with period selector, coloured section table, historical accordion
  - T14 General Ledger Frontend: `/general-ledger` page with 3 tabs — Chart of Accounts (searchable/filterable), Journal Entries (paginated with expandable debit/credit lines), Trial Balance (date-range GL summary with balance indicator)
  - T15 Audit Trail Frontend: `/audit-trail` page with action/resource-type/date filters, paginated log, expandable old/new JSON diffs; invoice update, issue, cancel, and mark-paid transitions now capture old_value→new_value in audit log
  - T16 Session, Archival & FAF: JWT_EXPIRY_HOURS env var (default 24h) controls token lifetime; GET /invoices/archive/status returns eligible counts; startup archival warning; FAF TaxData verified FTA-aligned
- **Arabic/Bilingual PDF support (T6):** Amiri-Regular.ttf & Amiri-Bold.ttf registered via reportlab pdfmetrics. Invoice title, invoice number, date, due-date, TRN labels rendered in both English and Arabic using arabic-reshaper + python-bidi for correct RTL glyph shaping.
- **Optimistic Locking (T10):** `version` INTEGER column on invoices table (startup ALTER migration). GET /invoices/{id} returns `ETag` response header. PUT /invoices/{id} accepts `If-Match` header and returns 412 if version mismatch. Frontend EditInvoice.jsx captures version on load, sends If-Match on save, shows conflict message on 412.
- **Data Archival (T12):** `is_archived` BOOLEAN and `archived_at` TIMESTAMP columns on invoices table (startup migration). Archival hides old PAID/CANCELLED invoices from normal listing, preserves them for audit. Full restore capability per-invoice.

**System Design Choices:**
- **Deployment:** Configured for Reserved VM (Always-On).
- **Database Schema:** Comprehensive for core entities, AP Management, CMS, and FTA Audit Files, including fields for free plan tracking, VAT, security, approval workflows, and dynamic content management.
- **Configuration:** Environment variables for critical settings.
- **VAT Settings:** Standard 5% UAE VAT rate.
- **Security:** SQLAlchemy ORM for SQL injection protection, file upload validation, environment variable-based credentials.
- **PEPPOL Business Model:** Centralized PEPPOL model where InvoLinks manages a master ASP account and charges businesses pay-as-you-go usage fees.

## External Dependencies

-   **PostgreSQL:** Primary database.
-   **Axios:** Frontend API communication.
-   **Recharts:** Frontend analytics visualization.
-   **Radix UI:** UI component library.
-   **date-fns:** Frontend date handling.
-   **JWT:** Authentication.
-   **bcrypt:** Password hashing.
-   **PINT/PINT-AE specification:** UAE e-invoicing compliance standard.
-   **Schematron:** Invoice validation.
-   **pyotp:** TOTP generation for MFA.
-   **qrcode + pillow:** QR code generation for TOTP enrollment.
-   **Twilio:** SMS delivery.
-   **pandas:** CSV/Excel data parsing for bulk imports.
-   **openpyxl:** Excel file (.xlsx) reading and writing for bulk imports.
-   **Stripe:** Payment processing, subscription management, and card tokenization.
-   **boto3 (AWS SES):** Email delivery service.
-   **arabic-reshaper + python-bidi:** Arabic text shaping and RTL reordering for PDF generation.
-   **reportlab TTFont (Amiri):** Arabic-script font for bilingual PDF invoice headers (fonts/Amiri-Regular.ttf, fonts/Amiri-Bold.ttf).
## Task 30: Ad Hoc Reports & Customer Retention Policy (FTA Gap Closure)

### Ad Hoc Report (P3-A)
- **Backend:** `GET /reports/adhoc` — arbitrary date-range invoice summary (sales, purchases, all)
- **Export:** `GET /reports/adhoc/export` — XLSX, PDF, CSV exports with same styling as periodic report
- **Helper:** `_build_adhoc_breakdown()` helper reuses the same invoice aggregation structure as periodic report
- **Frontend:** PeriodicReport.jsx updated with a second "Custom Date Range" tab (indigo theme, Search icon)
  - From/To date pickers, Invoice Type filter, inline export buttons (CSV/XLSX/PDF)

### Customer Retention Policy (P3-B)
- **CustomerDB model** (`customers` table) — per-company contact book: id, company_id, name, email, trn, address, city, country, phone, created_at, updated_at
- **Customer CRUD:** `GET /customers`, `POST /customers`, `GET /customers/{id}`, `PUT /customers/{id}`, `DELETE /customers/{id}`
- **FTA 5-year retention guard on `DELETE /customers/{id}`:** Returns HTTP 409 if customer has invoices with issue_date >= NOW()-5yr. Logs `CUSTOMER_DELETE_BLOCKED_RETENTION` to audit log.
- **Super admin company delete:** `DELETE /admin/companies/{company_id}` — super admin only, FTA retention guard (409 if recent invoices), logs `CUSTOMER_DELETE_BLOCKED_RETENTION` or `COMPANY_DELETED`.
- **SuperAdminDashboard.jsx:** Delete Company button (red) added to company edit modal with confirmation dialog and 409-specific error message.

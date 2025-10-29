# InvoLinks - Digital Invoicing for UAE

## Overview
InvoLinks is a full-stack digital invoicing platform for UAE businesses. Its purpose is to provide automated, VAT-compliant e-invoicing, subscription management, and payment processing, digitalizing operations, enhancing efficiency, ensuring tax compliance, and providing transparent financial operations.

**Key Capabilities:**
- Modern React UI with dual dashboards (Super Admin and Business Admin).
- Streamlined company onboarding and flexible subscription management.
- Automated UAE e-Invoicing with UBL/PINT-AE compliance and Schematron validation.
- Multiple payment methods and customizable company branding.
- Digital signatures, hash chains, multi-factor authentication, and PEPPOL integration for compliance and security.
- Comprehensive Accounts Payable (AP) Management supporting the UAE 5-Corner model with purchase orders, goods receipts, and 3-way matching.

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
- Reusable validation system: Centralized validation utilities (src/utils/validation.js) and validated input components (PhoneInput, EmailInput, PasswordInput, TRNInput) provide consistent UAE-specific validation across all forms with hidden-by-default error hints that only appear on invalid input.

**Core Features & Technical Implementations:**
1.  **Registration & Subscription:** Simplified signup, email verification, token-based workflow, automatic Free tier assignment, and flexible free plan configuration.
2.  **Company Management:** TRN validation, automatic VAT state transitions, Peppol endpoint ID support, and custom branding profiles.
3.  **Billing & Subscription System:** Complete monetization infrastructure with Stripe integration. Features include:
    - **Free Trial:** 100 invoices OR 30 days (whichever comes first) with automatic expiry and enforcement
    - **Subscription Tiers:** Basic (AED 99/mo), Pro (AED 299/mo), Enterprise (AED 799/mo) with multi-cycle billing (1/3/6 months) and volume discounts (5-15%)
    - **Payment Methods:** Stripe-powered card management with add/delete/default selection functionality
    - **Trial Tracking:** Real-time trial status with invoice count and days remaining, automatic trial-to-subscription conversion
    - **PEPPOL Usage Fees:** Pay-per-invoice pricing (AED 0.50-2.00 depending on tier) for centralized PEPPOL transmission
    - **Database Schema:** Dedicated tables for payment_methods, subscriptions, peppol_usage, and billing_invoices with Stripe customer ID tracking
    - **Frontend UI:** Modern Pricing page with tier comparison and Billing Settings dashboard with subscription management, payment methods, and trial progress indicators
    - **Backend API:** Comprehensive REST endpoints for trial status, payment methods (add/list/delete), subscription creation, and billing history
    - **Enforcement:** Invoice creation endpoint blocks expired trials and requires active subscription, with automatic trial counter increment
4.  **Invoice Generation & Management:** Full UAE e-Invoicing Compliance (UBL 2.1 / PINT-AE XML generation, Tax Invoice, Credit Note, Commercial types). Includes automatic validation, SHA-256 hash calculation, digital signatures, hash chain linking, CRUD operations, public sharing links, trial enforcement, and automatic PEPPOL usage fee recording (AED 2.00/1.00/0.50 per invoice based on subscription tier).
5.  **Excel/CSV Bulk Import:** Complete data import system for invoices and vendors with template downloads (CSV/Excel), strict UAE compliance validation (15-digit numeric TRN, YYYY-MM-DD dates), row-level error reporting, trial enforcement, and dual-format support (pandas + openpyxl). Includes frontend UI with tabs, drag-and-drop upload, and comprehensive error feedback.
6.  **Accounts Payable (AP) Management:** Comprehensive AP suite supporting the UAE 5-Corner model with:
    - **AP Inbox:** Receive and manage inward invoices from suppliers (Corner 4)
    - **Suppliers Management:** Complete supplier database with TRN tracking, spend analytics, payment terms, and category organization
    - **Purchase Orders & Goods Receipts:** Full PO lifecycle with 3-way matching and approval workflows
    - **Database Schema:** Tables for `purchase_orders`, `goods_receipts`, `inward_invoices` with relationship tracking
    - **Frontend UI:** Dedicated pages for AP Inbox (/ap/inbox), Purchase Orders (/ap/purchase-orders), and Suppliers (/ap/suppliers)
7.  **FTA Audit File Generation:** Production-ready UAE Federal Tax Authority compliant audit file system. Generates FTA Audit File (FAF) format in CSV/TXT with complete sales/purchase invoice data, VAT categorization (SR, ZR, EX, OOS), customer/supplier TRN tracking, and compliance statistics. Features comprehensive validation (mandatory fields, date ranges, company registration periods), automated file generation with status tracking (GENERATING, COMPLETED, FAILED), secure download functionality, and complete integration with Business Dashboard. Supports date range selection with safeguards (no future dates, max 5-year periods, post-registration only) and separate validation logic for sales vs purchase invoices.
8.  **Payment Processing:** Supports Cash, Card, POS, Bank transfer, Digital wallets, with payment intents pattern and card surcharge configuration.
9.  **Branding:** Custom logos, configurable colors/fonts, header/footer text with drag-and-drop upload, live preview, and asset management.
10. **Multi-User Team Management:** Unlimited team members, role-based access (Owner, Admin, Finance User), and invitation system.
11. **Multi-Factor Authentication (MFA):** Implementation of TOTP, Email OTP, and Backup Codes for secure user access, compliant with Ministerial Decision No. 64/2025.
12. **SuperAdmin Analytics Dashboard:** Comprehensive revenue metrics, company explorer, registration analytics, and invoice statistics.
13. **Content Management System (CMS):** Database-backed content management allowing SuperAdmins to edit all website text without code changes. Features include: content_blocks table with key/value pairs, dedicated SuperAdmin Content Manager UI with inline editing, ContentContext React hook for global content access, automatic content seeding on startup, and real-time updates. All homepage hero text and feature box content is now dynamically loaded from the database via the useContent() hook.
14. **PEPPOL Settings UI:** Self-service PEPPOL configuration dashboard for businesses. Features include: provider selection (Tradeshift, Basware, Mock), credential management with masked API keys, participant ID configuration, connection testing, and real-time status tracking. Fully integrated with Business Dashboard navigation. Backend API endpoints for GET/PUT /settings/peppol and POST /settings/peppol/test enable complete PEPPOL setup without code changes.
15. **Finance Dashboard:** Comprehensive financial analytics and health monitoring page (/finance) with:
    - **Key Metrics:** Total revenue, expenses, net profit, and profit margin with trend indicators
    - **Revenue vs Expenses:** Monthly bar chart showing revenue and expense trends
    - **Cash Flow:** Weekly line chart tracking inflows and outflows
    - **Expense Breakdown:** Pie chart showing expense categorization (salaries, operations, marketing, supplies)
    - **AR/AP Tracking:** Real-time accounts receivable and payable balances with invoice counts
    - **Recent Transactions:** Live feed of recent invoices (sent/received) with status indicators
    - **Top Customers:** Ranked customer list by revenue with visual progress bars
    - **Mock Data Structure:** Ready for backend API integration with consistent data shapes
16. **Critical Compliance Features:** Digital signatures, hash chains, PEPPOL integration, a robust Crypto Utilities Module (SHA-256, RSA-2048 signing/verification), UBL 2.1 XML Generator, and an extensible PEPPOL Provider Adapter.
17. **Tier 1 Production Hardening:** Custom exception module, enhanced crypto utilities with certificate validation, environment validation (development/production modes), structured error handling, and a global exception handler.

**System Design Choices:**
- **Deployment:** Configured for Reserved VM (Always-On) for persistence and availability.
- **Database Schema:** Comprehensive for core entities (companies, subscriptions, users, invoices, payments, assets, branding), AP Management (purchase orders, goods receipts, inward invoices), CMS (content_blocks), and FTA Audit Files (audit_files with status tracking) including fields for free plan tracking, VAT, security, approval workflows, and dynamic content management.
- **Configuration:** Environment variables for critical settings like `DATABASE_URL`, signing keys, and `PRODUCTION_MODE`.
- **VAT Settings:** Standard 5% UAE VAT rate.
- **Security:** SQLAlchemy ORM for SQL injection protection, file upload validation, environment variable-based credentials.
- **PEPPOL Business Model:** InvoLinks uses a centralized PEPPOL model where the platform manages a single master ASP account (Tradeshift/Basware) and charges businesses pay-as-you-go usage fees (AED 0.50-2.00 per invoice depending on subscription tier) for PEPPOL transmission and FTA submission. This eliminates the need for each business to set up individual ASP accounts.

## External Dependencies

-   **PostgreSQL:** Primary database.
-   **Axios:** Frontend API communication.
-   **Recharts:** Frontend analytics visualization.
-   **Radix UI:** UI component library.
-   **date-fns:** Frontend date handling.
-   **JWT:** Authentication.
-   **bcrypt:** Password hashing.
-   **PINT/PINT-AE specification:** UAE e-invoicing compliance standard.
-   **Schematron:** Invoice validation (global and UAE-specific rules).
-   **Genericode files:** Compliance-related data (`eas.gc`, `ISO4217.gc`, `UNCL*.gc`, etc.) from `/mnt/data/`.
-   **Schematron XSLT files:** Validation rules (`PINT-UBL-validation-preprocessed.xslt`, `PINT-jurisdiction-aligned-rules.xslt`) from `/mnt/data/`.
-   **pyotp:** TOTP generation for MFA.
-   **qrcode + pillow:** QR code generation for TOTP enrollment.
-   **twilio:** SMS delivery for SMS-based 2FA (requires manual credentials).
-   **pandas:** CSV/Excel data parsing for bulk imports.
-   **openpyxl:** Excel file (.xlsx) reading and writing for bulk imports.
-   **stripe:** Payment processing, subscription management, and card tokenization (test mode for development).
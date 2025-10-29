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
3.  **Invoice Generation & Management:** Full UAE e-Invoicing Compliance (UBL 2.1 / PINT-AE XML generation, Tax Invoice, Credit Note, Commercial types). Includes automatic validation, SHA-256 hash calculation, digital signatures, hash chain linking, CRUD operations, public sharing links, and free plan enforcement.
4.  **Excel/CSV Bulk Import:** Complete data import system for invoices and vendors with template downloads (CSV/Excel), strict UAE compliance validation (15-digit numeric TRN, YYYY-MM-DD dates), row-level error reporting, free plan enforcement, and dual-format support (pandas + openpyxl). Includes frontend UI with tabs, drag-and-drop upload, and comprehensive error feedback.
5.  **Accounts Payable (AP) Management:** Supports receiving invoices from suppliers (Corner 4 of UAE 5-Corner model) with database schema extensions for `purchase_orders`, `goods_receipts`, `inward_invoices`, 3-way matching, and approval workflows.
6.  **FTA Audit File Generation:** Production-ready UAE Federal Tax Authority compliant audit file system. Generates FTA Audit File (FAF) format in CSV/TXT with complete sales/purchase invoice data, VAT categorization (SR, ZR, EX, OOS), customer/supplier TRN tracking, and compliance statistics. Features comprehensive validation (mandatory fields, date ranges, company registration periods), automated file generation with status tracking (GENERATING, COMPLETED, FAILED), secure download functionality, and complete integration with Business Dashboard. Supports date range selection with safeguards (no future dates, max 5-year periods, post-registration only) and separate validation logic for sales vs purchase invoices.
7.  **Payment Processing:** Supports Cash, Card, POS, Bank transfer, Digital wallets, with payment intents pattern and card surcharge configuration.
8.  **Branding:** Custom logos, configurable colors/fonts, header/footer text with drag-and-drop upload, live preview, and asset management.
9.  **Multi-User Team Management:** Unlimited team members, role-based access (Owner, Admin, Finance User), and invitation system.
10. **Multi-Factor Authentication (MFA):** Implementation of TOTP, Email OTP, and Backup Codes for secure user access, compliant with Ministerial Decision No. 64/2025.
11. **SuperAdmin Analytics Dashboard:** Comprehensive revenue metrics, company explorer, registration analytics, and invoice statistics.
12. **Content Management System (CMS):** Database-backed content management allowing SuperAdmins to edit all website text without code changes. Features include: content_blocks table with key/value pairs, dedicated SuperAdmin Content Manager UI with inline editing, ContentContext React hook for global content access, automatic content seeding on startup, and real-time updates. All homepage hero text and feature box content is now dynamically loaded from the database via the useContent() hook.
13. **Critical Compliance Features:** Digital signatures, hash chains, PEPPOL integration, a robust Crypto Utilities Module (SHA-256, RSA-2048 signing/verification), UBL 2.1 XML Generator, and an extensible PEPPOL Provider Adapter.
14. **Tier 1 Production Hardening:** Custom exception module, enhanced crypto utilities with certificate validation, environment validation (development/production modes), structured error handling, and a global exception handler.

**System Design Choices:**
- **Deployment:** Configured for Reserved VM (Always-On) for persistence and availability.
- **Database Schema:** Comprehensive for core entities (companies, subscriptions, users, invoices, payments, assets, branding), AP Management (purchase orders, goods receipts, inward invoices), CMS (content_blocks), and FTA Audit Files (audit_files with status tracking) including fields for free plan tracking, VAT, security, approval workflows, and dynamic content management.
- **Configuration:** Environment variables for critical settings like `DATABASE_URL`, signing keys, and `PRODUCTION_MODE`.
- **VAT Settings:** Standard 5% UAE VAT rate.
- **Security:** SQLAlchemy ORM for SQL injection protection, file upload validation, environment variable-based credentials.
- **PEPPOL Business Model:** InvoLinks acts as billing software, partnering with Accredited Service Providers (ASPs) like Tradeshift/Basware for PEPPOL network transmission and FTA submission.

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
# InvoLinks - Digital Invoicing for UAE

## Overview
InvoLinks is a full-stack digital invoicing platform for UAE businesses, designed to provide automated, VAT-compliant e-invoicing, subscription management, and payment processing. Its core purpose is to digitalize operations, enhance efficiency, ensure tax compliance, and provide transparent financial operations for UAE businesses.

Key capabilities include modern React UI with dual dashboards, streamlined company onboarding, automated UAE e-Invoicing with UBL/PINT-AE compliance, multiple payment methods, customizable branding, digital signatures, hash chains, multi-factor authentication, and comprehensive Accounts Payable (AP) Management supporting the UAE 5-Corner model.

## User Preferences
Detailed explanations preferred.

## System Architecture

**UI/UX Decisions:**
- Groww/Toss-inspired design: clean, minimal, modern fintech style with bold hero sections, card-based feature highlights, and glassmorphism navbar.
- Rounded corners, enhanced shadows, hover states, and mobile-responsive design.
- Inter font family for professional typography.
- Reusable validation system with centralized utilities and validated input components for UAE-specific validation.

**Technical Implementations:**
- **Technology Stack:**
    - Frontend: React 19.2 (Vite 7.1), React Router 7.9, Tailwind CSS 3.4, Axios, Recharts, Radix UI, date-fns.
    - Backend: FastAPI 2.0 (Python async), PostgreSQL, SQLAlchemy 2.0.36 ORM, JWT authentication (bcrypt), CORS.
- **Registration & Subscription:** Simplified signup, email verification, token-based workflow, automatic Free tier assignment, and flexible free plan configuration.
- **Company Management:** TRN validation, automatic VAT state transitions, Peppol endpoint ID support, and custom branding profiles.
- **Billing & Subscription System:** Complete monetization infrastructure with Stripe integration supporting free trials, tiered subscriptions (Basic, Pro, Enterprise), multi-cycle billing, volume discounts, and various payment methods. Includes real-time trial tracking and automatic conversion.
- **Invoice Generation & Management:** Full UAE e-Invoicing Compliance (UBL 2.1 / PINT-AE XML generation, various invoice types). Features include automatic validation, SHA-256 hash calculation, digital signatures, hash chain linking, CRUD operations, public sharing links, trial enforcement, and automatic PEPPOL usage fee recording.
- **Email Integration:** Production-ready email service powered by AWS SES for automatic sending of verification, MFA, invoice notifications, and admin approvals using professional HTML templates.
- **Invoice Delivery System:** Multi-channel delivery via QR code generation, Email, SMS (Twilio), and WhatsApp, with a public invoice view accessible via share token.
- **Excel/CSV Bulk Import:** Data import system for invoices and vendors with template downloads, strict UAE compliance validation, row-level error reporting, and dual-format support (pandas + openpyxl).
- **Accounts Payable (AP) Management:** Comprehensive AP suite supporting the UAE 5-Corner model, including an AP Inbox, Supplier Management, and Purchase Order/Goods Receipt workflows with 3-way matching.
- **FTA Audit File Generation:** Production-ready UAE Federal Tax Authority (FAF) compliant audit file generation in CSV/TXT format, including sales/purchase invoice data, VAT categorization, and compliance statistics.
- **Payment Processing:** Supports Cash, Card, POS, Bank transfer, Digital wallets, with payment intents and card surcharge configuration.
- **Branding:** Custom logos, configurable colors/fonts, header/footer text with drag-and-drop upload and live preview.
- **Multi-User Team Management:** Role-based team management with invitation system and tier-based user limits.
- **Multi-Factor Authentication (MFA):** Implementation of TOTP, Email OTP, and Backup Codes for secure user access.
- **SuperAdmin Analytics Dashboard:** Comprehensive revenue metrics, company explorer, registration analytics, and invoice statistics.
- **Content Management System (CMS):** Database-backed content management allowing SuperAdmins to edit all website text without code changes, with a dedicated UI and dynamic content loading.
- **PEPPOL Settings UI:** Self-service PEPPOL configuration dashboard for businesses, including provider selection, credential management, participant ID configuration, and connection testing.
- **Finance Dashboard:** Comprehensive financial analytics with key metrics, revenue vs. expenses tracking, cash flow, expense breakdown, AR/AP tracking, recent transactions, and top customers.
- **Simple Expense Tracking:** Straightforward expense management with custom user-defined categories (no predefined limits). Allows manual recording of monthly expenses (rent, utilities, salaries, raw materials) with automatic net income and net VAT calculations. Auto-seeds 8 default categories on first use. Perfect for coffee shops, spas, and small businesses that need simple financial tracking without complex ERP features.
- **Simple Inventory Management:** Basic inventory tracking system for products and materials. Track stock levels, automatic deduction on sales/services, inventory transactions (purchases, sales, adjustments, service usage), low stock alerts, and complete audit trail. Supports diverse UAE businesses with simple stock management needs.
- **PDF Invoice Generation:** Professional PDF invoice generator with UAE branding, VAT breakdown, QR codes for public viewing, digital signature indicators, and multi-currency support. Full A4 layout with company logos and FTA compliance footer.
- **Critical Compliance Features:** Digital signatures, hash chains, PEPPOL integration, Crypto Utilities Module (SHA-256, RSA-2048), UBL 2.1 XML Generator, and an extensible PEPPOL Provider Adapter.
- **Tier 1 Production Hardening:** Custom exception module, enhanced crypto utilities with certificate validation, environment validation, structured error handling, and a global exception handler.
- **Production Signing Keys System:** Complete cryptographic key management for UAE FTA compliance, including RSA-2048 key pair and X.509 certificate generation, CSR support, and secure storage via Replit Secrets.
- **VAT Compliance System (Phase 1 Complete - Oct 30, 2025):** Production-ready UAE VAT opt-in infrastructure with automatic invoice classification, TRN tracking, and tax code management. Features include:
    - VAT Utilities Module (utils/vat_utils.py): 5 UAE tax codes (SR-Standard Rate 5%, ZR-Zero Rated 0%, ES-Exempt, RC-Reverse Charge, OP-Out of Scope), TRN validation (15-digit format), automatic invoice classification (Full >=AED 10k, Simplified <AED 10k)
    - Database Extensions: 7 new columns (companies.vat_enabled, vat_registration_date; invoices.tax_code, invoice_classification; invoice_line_items.tax_code; expenses.tax_code, vendor_id)
    - Backend API: GET/PUT /settings/vat endpoints with authentication, TRN validation, and automatic invoice classification on creation
    - Frontend VAT Settings: Opt-in toggle, TRN input with validation, registration date picker, accessible via Percent icon in sidebar
    - CreateInvoice Integration: Conditional UAE VAT tax code selector for each line item (only visible when VAT enabled), info banner for VAT-registered businesses, intelligent payload cleaning (strips tax_code when VAT disabled for zero impact)
    - PDF Invoice Generator: Conditional TRN display, invoice classification headers (FULL TAX INVOICE vs SIMPLIFIED TAX INVOICE), safe fallbacks for non-VAT businesses
    - Design Philosophy: Complete zero-impact add-on architecture - all VAT features are hidden by default, only visible when business opts into VAT registration via Settings toggle. Non-VAT businesses experience identical behavior to pre-VAT build.
    - Status: Phase 1 (A+B) complete and production-ready, architect-reviewed and approved
- **Enhanced RBAC System (Phase 2 Complete - Oct 30, 2025):** Production-ready role-based access control with three-tier user hierarchy and flexible SuperAdmin management. Features include:
    - Role Hierarchy: COMPANY_ADMIN (owner with billing access), BUSINESS_ADMIN (super admin without billing), FINANCE_USER (limited staff access for invoices/expenses)
    - Tier-Based User Limits: max_business_admins and max_finance_users per subscription plan, enforced in frontend and backend
    - User Tracking: created_by_user_id fields on invoices and expenses, payment verification tracking (payment_verified_by_user_id, payment_verified_at)
    - Team Management UI: Role selector with real-time tier limit display, automatic validation preventing over-limit invites, clear upgrade prompts
    - SuperAdmin Tier Management: Dedicated UI for editing all tier limits (max_business_admins, max_finance_users, max_invoices, etc.) without code changes
    - Platform Statistics Dashboard: Privacy-focused aggregated metrics showing total companies, active subscriptions, total invoices, platform revenue (NO individual business data access)
    - Featured Businesses Management: SuperAdmin panel to select businesses for homepage moving bar, with display order control
    - Homepage Integration: Real-time platform counters displaying actual aggregated data, featured businesses carousel
    - Security: Explicit tier limit validation in invitation flow preventing bypass, SuperAdmin-only endpoints with proper authentication
    - Status: Phase 2 complete and production-ready, architect-reviewed and approved with critical security fix for tier limit bypass
- **Payment Verification & Reconciliation (Phase 3 Complete - Oct 30, 2025):** Production-ready offline payment tracking system with complete audit trail and daily reconciliation reports. Features include:
    - Backend APIs: POST /invoices/{id}/verify-payment for recording offline payments, GET /invoices/pending-payment for unpaid invoices list, GET /reports/daily-reconciliation for daily reports
    - Payment Verification Dashboard: Pending invoices list with search/filters, summary metrics (pending count, total amount, overdue count), quick verification modal, status badges (overdue, due soon, active)
    - Daily Reconciliation Report: Date range selector, payment method breakdown with transaction details, outstanding invoices tracking (top 10 overdue), CSV export for accounting
    - Payment Method Support: Cash, Card, POS, Bank Transfer, Cheque, Digital Wallet with payment reference and notes tracking
    - Complete Audit Trail: Records payment_verified_by_user_id, payment_verified_at, payment_method, payment_reference, and payment_notes for full accountability
    - Role-Based Access: BUSINESS_ADMIN, FINANCE_USER, and COMPANY_ADMIN can verify payments and view reconciliation reports
    - UI Components: Created Dialog component (src/components/ui/dialog.jsx) for modal functionality
    - Navigation: Payment Verification and Reconciliation links added to sidebar with proper routing
    - Status: Phase 3 complete and production-ready, architect-reviewed and approved

**System Design Choices:**
- **Deployment:** Configured for Reserved VM (Always-On) for persistence and availability.
- **Database Schema:** Comprehensive for core entities, AP Management, CMS, and FTA Audit Files, including fields for free plan tracking, VAT, security, approval workflows, and dynamic content management.
- **Configuration:** Environment variables for critical settings like `DATABASE_URL` and signing keys.
- **VAT Settings:** Standard 5% UAE VAT rate.
- **Security:** SQLAlchemy ORM for SQL injection protection, file upload validation, environment variable-based credentials.
- **PEPPOL Business Model:** Centralized PEPPOL model where InvoLinks manages a master ASP account and charges businesses pay-as-you-go usage fees for transmission.

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
-   **pyotp:** TOTP generation for MFA.
-   **qrcode + pillow:** QR code generation for TOTP enrollment.
-   **Twilio:** SMS delivery.
-   **pandas:** CSV/Excel data parsing for bulk imports.
-   **openpyxl:** Excel file (.xlsx) reading and writing for bulk imports.
-   **Stripe:** Payment processing, subscription management, and card tokenization.
-   **boto3 (AWS SES):** Email delivery service, configured for Middle East (UAE) region (me-central-1).
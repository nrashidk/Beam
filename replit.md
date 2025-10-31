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

**Technical Implementations:**
- **Technology Stack:** Frontend: React 19.2 (Vite 7.1), React Router 7.9, Tailwind CSS 3.4, Axios, Recharts, Radix UI, date-fns. Backend: FastAPI 2.0 (Python async), PostgreSQL, SQLAlchemy 2.0.36 ORM, JWT authentication (bcrypt), CORS.
- **Registration & Subscription:** Simplified signup, email verification, token-based workflow, automatic Free tier assignment, and flexible free plan configuration.
- **Company Management:** TRN validation, automatic VAT state transitions, Peppol endpoint ID support, custom branding profiles, and comprehensive company approval workflow with status tracking (approved_at, rejected_at timestamps).
- **SuperAdmin Company Management:** Full-featured company database browser with status filtering (All, Pending, Active, Rejected), relative date displays (registration date for pending, approval date for active, rejection date for rejected), and interactive status cards for quick filtering.
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
- **Content Management System (CMS):** Database-backed content management for SuperAdmins to edit website text without code changes.
- **PEPPOL Settings UI:** Self-service PEPPOL configuration dashboard.
- **Finance Dashboard:** Comprehensive financial analytics with key metrics, revenue vs. expenses tracking, cash flow, and AR/AP tracking.
- **Simple Expense Tracking:** Straightforward expense management with custom user-defined categories and automatic net income/VAT calculations.
- **Simple Inventory Management:** Basic inventory tracking for products and materials, including stock levels, automatic deductions, transactions, and low stock alerts.
- **PDF Invoice Generation:** Professional PDF invoice generator with UAE branding, VAT breakdown, QR codes, digital signature indicators, and multi-currency support.
- **Critical Compliance Features:** Digital signatures, hash chains, PEPPOL integration, Crypto Utilities Module (SHA-256, RSA-2048), UBL 2.1 XML Generator, and an extensible PEPPOL Provider Adapter.
- **Tier 1 Production Hardening:** Custom exception module, enhanced crypto utilities with certificate validation, environment validation, structured error handling, and a global exception handler.
- **Production Signing Keys System:** Cryptographic key management for UAE FTA compliance, including RSA-2048 key pair and X.509 certificate generation.
- **VAT Compliance System:** Production-ready UAE VAT opt-in infrastructure with automatic invoice classification, TRN tracking, and tax code management.
- **Enhanced RBAC System:** Production-ready role-based access control with three-tier user hierarchy and flexible SuperAdmin management, including tier-based user limits and user tracking.
- **Payment Verification & Reconciliation:** Production-ready offline payment tracking system with complete audit trail and daily reconciliation reports.
- **Advanced Analytics & Insights:** Production-ready comprehensive business intelligence dashboard providing revenue trends, customer insights, profitability analysis, and cash flow visualization.

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
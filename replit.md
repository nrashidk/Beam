# InvoLinks - Digital Invoicing for UAE

## Overview
InvoLinks is a full-stack digital invoicing platform for UAE businesses, providing automated, VAT-compliant e-invoicing, subscription management, and payment processing. Its primary purpose is to digitalize operations, enhance efficiency, ensure tax compliance, and provide transparent financial operations for UAE businesses. Key capabilities include a modern React UI, streamlined onboarding, automated UAE e-Invoicing (UBL/PINT-AE compliant), multiple payment methods, customizable branding, digital signatures, hash chains, multi-factor authentication, and comprehensive Accounts Payable (AP) Management supporting the UAE 5-Corner model. The project aims to simplify financial management and ensure adherence to UAE tax regulations.

## User Preferences
Detailed explanations preferred.

## System Architecture

### UI/UX Decisions
The platform features a clean, minimal, and modern fintech-inspired design, drawing inspiration from Groww/Toss. This includes bold hero sections, card-based feature highlights, a glassmorphism navbar, rounded corners, enhanced shadows, and hover states. The design is mobile-responsive and utilizes the Inter font family. A persistent branding system ensures consistent InvoLinks branding across all admin interfaces.

### Technical Implementations
- **Technology Stack:** Frontend uses React 19.2 (Vite 7.1), React Router 7.9, Tailwind CSS 3.4. Backend is built with FastAPI 2.0 (Python async), PostgreSQL, and SQLAlchemy 2.0.36 ORM.
- **Registration & Subscription:** Features a simple signup process with email verification, token-based workflow, automatic Free tier assignment, and flexible free plan configuration.
- **Company Management:** Includes TRN validation, automatic VAT state transitions, Peppol endpoint ID support, custom branding profiles, and a comprehensive company approval workflow with status tracking. SuperAdmins have full company database browsing capabilities with subscription-aware filtering and editing features.
- **Billing & Subscription System:** Integrated with Stripe for complete monetization, supporting free trials, tiered subscriptions, multi-cycle billing, and various payment methods.
- **Invoice Generation & Management:** Ensures full UAE e-Invoicing Compliance (UBL 2.1 / PINT-AE XML generation) with automatic validation, SHA-256 hash calculation, digital signatures, and hash chain linking.
- **Email Integration:** A production-ready email service handles verifications, MFA, invoice notifications, and admin approvals using HTML templates.
- **Invoice Delivery System:** Multi-channel delivery via QR code, Email, SMS, and WhatsApp, with a public invoice view.
- **Data Import:** Supports Excel/CSV bulk import for invoices and vendors with strict UAE compliance validation.
- **Accounts Payable (AP) Management:** Comprehensive AP suite supporting the UAE 5-Corner model, including an AP Inbox, Supplier Management, and Purchase Order/Goods Receipt workflows with 3-way matching. TRN is optional for non-VAT parties in AP.
- **FTA Audit File Generation:** Generates UAE Federal Tax Authority (FAF) compliant audit files.
- **Payment Processing:** Supports various payment methods including Cash, Card, POS, Bank transfer, and Digital wallets.
- **Branding:** Customizable logos, colors, fonts, and header/footer text with live preview.
- **Multi-User Team Management:** Role-based team management with invitation system and tier-based user limits.
- **Multi-Factor Authentication (MFA):** Implements TOTP, Email OTP, and Backup Codes.
- **SuperAdmin Dashboards:** Provides analytics for revenue, registrations, invoices, and comprehensive company management. Includes a CMS for managing homepage content and featured businesses.
- **PEPPOL Settings UI:** Self-service PEPPOL configuration dashboard.
- **Finance Dashboard:** Comprehensive financial analytics with key metrics, revenue vs. expenses tracking, and cash flow.
- **Expense & Inventory Tracking:** Simple expense management with custom categories and basic inventory tracking with low stock alerts.
- **PDF Invoice Generation:** Professional PDF generator with UAE branding, VAT breakdown, QR codes, digital signature indicators, and multi-currency support, including full Arabic/bilingual support.
- **Critical Compliance Features:** Digital signatures, hash chains, PEPPOL integration, Crypto Utilities Module, UBL 2.1 XML Generator, and an extensible PEPPOL Provider Adapter.
- **Tier 1 Production Hardening:** Includes custom exception handling, enhanced crypto utilities, and environment validation.
- **Production Signing Keys System:** Cryptographic key management for UAE FTA compliance.
- **VAT Compliance System:** Production-ready UAE VAT opt-in infrastructure with automatic invoice classification and TRN tracking. TRN optionality for non-VAT parties is implemented across the system.
- **Enhanced RBAC System:** Production-ready role-based access control with a three-tier user hierarchy.
- **Payment Verification & Reconciliation:** Offline payment tracking with audit trails and daily reports.
- **Advanced Analytics & Insights:** Comprehensive business intelligence dashboard.
- **UAE FTA Accreditation Compliance:** Achieved high readiness across T1-T32 requirements, including General Ledger, FAF generation with `SupplyDate` in both SalesData and PurchaseData, VAT Return generation (Box 2 credit notes, Box 10/11 expenses), Audit Trail, security, invoice locking, debit notes, supply dates, concurrent update prevention (optimistic locking), periodic reports, data archival, and bulk archive XLSX export (`GET /invoices/archive/export`).
- **Ad Hoc Reports:** Backend and frontend support for arbitrary date-range invoice summaries with export capabilities.
- **Customer Retention Policy:** Implements a customer retention policy with a 5-year FTA retention guard on customer and company deletion, preventing deletion if recent invoices exist.

### System Design Choices
- **Deployment:** Configured for Reserved VM (Always-On).
- **Database Schema:** Comprehensive for all core entities, AP Management, CMS, and FTA Audit Files.
- **Configuration:** Utilizes environment variables for critical settings.
- **VAT Settings:** Standard 5% UAE VAT rate.
- **Security:** SQLAlchemy ORM for SQL injection protection, file upload validation, and environment variable-based credentials.
- **PEPPOL Business Model:** Centralized PEPPOL model with InvoLinks managing a master ASP account and charging pay-as-you-go usage fees.

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
-   **qrcode + pillow:** QR code generation.
-   **Twilio:** SMS delivery.
-   **pandas:** CSV/Excel data parsing for bulk imports.
-   **openpyxl:** Excel file reading/writing.
-   **Stripe:** Payment processing and subscription management.
-   **boto3 (AWS SES):** Email delivery service.
-   **arabic-reshaper + python-bidi:** Arabic text shaping and RTL reordering for PDF generation.
-   **reportlab TTFont (Amiri):** Arabic-script font for bilingual PDF invoice headers.
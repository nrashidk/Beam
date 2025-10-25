# Beam - Digital Invoicing for UAE

## Overview
Beam is a modern full-stack digital invoicing platform designed for UAE businesses. It offers an end-to-end solution for automated, VAT-compliant e-invoicing, subscription management, and payment processing. The platform aims to boost digitalization, enhance operational efficiency, eliminate paper invoices, ensure tax and audit compliance, and provide transparent financial operations for businesses.

**Key Capabilities:**
- Modern React UI inspired by leading fintech applications.
- Dual dashboards for Super Admin analytics and Business Admin portals.
- Streamlined company onboarding with a registration wizard.
- Flexible subscription management with Free, Starter, Professional, and Enterprise tiers.
- Automated UAE e-Invoicing with UBL/PINT-AE compliance and Schematron validation.
- Multiple payment methods and POS integration.
- Customizable company branding.
- Full compliance with UAE e-invoicing regulations.

**Business Flow:**
Registration → Email Verification → Admin Approval → Auto Free Tier Assignment → Dashboard Access → **Create Invoices → Issue (UBL XML Generated) → Send (ASP Transmission) → Customer Views**

## User Preferences
Detailed explanations preferred. Updated SuperAdminDashboard with advanced analytics, filtering, and revenue tracking capabilities.

## System Architecture

**Technology Stack:**
- **Frontend:** React 19.2 (with Vite 7.1), React Router 7.9, Tailwind CSS 3.4, Axios, Recharts, Radix UI, date-fns.
- **Backend:** FastAPI 2.0 (Python async), PostgreSQL, SQLAlchemy 2.0.36 ORM, JWT authentication (with bcrypt), CORS.

**UI/UX Decisions:**
- Groww/Toss-inspired design aesthetic with a clean, minimal, and modern fintech style.
- Bold hero sections with large typography and gradient backgrounds.
- Card-based feature highlights with hover effects.
- Glassmorphism navbar with blur effect.
- Rounded corners (16-20px), enhanced shadows, and hover states.
- Mobile-responsive design.
- Inter font family for professional typography.

**Core Features & Technical Implementations:**
1.  **Quick Registration with Email Verification:**
    *   Simplified signup requiring only email and company name.
    *   Email verification with token-based workflow.
    *   Automatic Free tier assignment upon admin approval.
    *   Simulated email notifications for verification and approval.
2.  **Subscription Plans:**
    *   Four predefined tiers: Free, Starter, Professional, Enterprise.
    *   Free tier automatically assigned upon company approval.
    *   **Flexible Free Plan Configuration:**
        -   Duration-based: Free plan active for a configurable number of months.
        -   Invoice count-based: Free plan with a configurable invoice limit.
        -   Admins configure free plan type and limits during company approval.
3.  **Admin Approval Workflow:**
    *   Admins review and approve/reject company registrations.
    *   Approval modal allows configuring free plan type (duration vs invoice count) and limits.
    *   Automatic Free tier assignment with custom configuration per company.
    *   **Invoice Tracking:**
        -   Per-company invoice counters displayed in admin dashboard.
        -   Total invoices across all companies tracked and displayed.
        -   Real-time invoice usage shown to logged-in users on homepage.
4.  **Company Management:**
    *   TRN (Tax Registration Number) validation.
    *   Automatic VAT state transitions based on turnover thresholds (AED 375,000).
    *   Peppol endpoint ID support.
    *   Custom branding profiles.
5.  **Invoice Generation & Management (IMPLEMENTED 2025-10-25):**
    *   **Full UAE e-Invoicing Compliance:**
        -   UBL 2.1 / PINT-AE XML generation with all mandatory fields
        -   Support for multiple invoice types: Tax Invoice (380), Credit Note (381), Commercial (480)
        -   Automatic validation against PINT-AE specification
        -   SHA-256 hash calculation for XML integrity
    *   **Invoice CRUD Operations:**
        -   Create invoices with line items, customer details, VAT calculations
        -   List invoices with filtering by status (Draft, Issued, Sent, Paid, Cancelled)
        -   View detailed invoice information with line items and tax breakdowns
        -   Issue invoices (generates UBL XML and increments company counter)
        -   Send invoices (simulated ASP transmission via Peppol network)
        -   Cancel invoices
    *   **Invoice Sharing:**
        -   Public share links with unique tokens for customer viewing
        -   Customer portal (no login required) to view invoices
        -   Email notification simulation for invoice delivery
    *   **Free Plan Enforcement:**
        -   Invoice counter increment on issuance
        -   Automatic blocking when invoice limit is reached for invoice-count free plans
    *   **Business Dashboard Integration:**
        -   Invoice creation form with multi-line item support
        -   Invoice list dashboard with status badges and filtering
        -   Seamless navigation between dashboard and invoice management
    *   **ASP Integration Architecture:**
        -   Ready for Accredited Service Provider API integration
        -   Simulated Peppol network transmission in send endpoint
        -   Designed for future production ASP connection (Pagero, EDICOM, Comarch, etc.)
6.  **Payment Processing:**
    *   Supports Cash, Card, POS, Bank transfer, and Digital wallets.
    *   Payment intents pattern, card surcharge configuration, metadata tracking, and POS device registration.
7.  **Branding:**
    *   Custom logos (PNG/SVG), configurable colors and fonts, custom header/footer text.
    *   Asset management with SHA-256 checksums.

**System Design Choices:**
- **Deployment:** Configured for Reserved VM (Always-On) due to persistent database connections, in-memory invoice counters, payment state handling, local artifact storage, and 24/7 availability requirement.
- **Database Schema:** Includes tables for `companies`, `subscription_plans`, `users`, `invoices`, `invoice_line_items`, `invoice_tax_breakdowns`, `payment_intents`, `assets`, etc., designed to support registration, invoicing, payments, and branding.
  - **Free Plan Tracking Fields (added 2025-10-25):**
    - `free_plan_type`: Type of free plan (DURATION or INVOICE_COUNT)
    - `free_plan_duration_months`: Duration in months for duration-based plans
    - `free_plan_invoice_limit`: Invoice limit for count-based plans
    - `free_plan_start_date`: When the free plan started
    - `invoices_generated`: Total lifetime invoice counter per company
    - `subscription_plan_id`: Foreign key to subscription plan
  - **Invoice Tables (added 2025-10-25):**
    - `invoices`: Core invoice data with UBL/PINT-AE fields (TRN, Peppol IDs, totals, status, XML hash)
    - `invoice_line_items`: Line item details (quantity, unit price, tax category, totals)
    - `invoice_tax_breakdowns`: Tax category breakdowns required for UBL compliance
    - Relationships: company → invoices → line_items + tax_breakdowns
- **Configuration:** Utilizes environment variables for `DATABASE_URL`, `ARTIFACT_ROOT`, `PEPPOL_ENDPOINT_SCHEME`, and `RETENTION_YEARS`.
- **VAT Settings:** Standard VAT rate of 5% and a mandatory registration threshold of AED 375,000.
- **Security:** Uses SQLAlchemy ORM for SQL injection protection, validates file uploads, and manages database credentials via environment variables.

## External Dependencies

-   **PostgreSQL:** Primary database, with Neon-backed via `DATABASE_URL`.
-   **Axios:** For API communication from the frontend.
-   **Recharts:** For analytics visualization on the frontend.
-   **Radix UI:** UI component library.
-   **date-fns:** For date handling in the frontend.
-   **JWT (JSON Web Tokens):** For authentication.
-   **bcrypt:** For password hashing.
-   **PINT/PINT-AE specification:** Compliance for UAE e-invoicing.
-   **Schematron:** For invoice validation using global and UAE-specific rules.
-   **Genericode files:** Required for compliance (e.g., `eas.gc`, `ISO4217.gc`, `UNCL*.gc`, etc.) located in `/mnt/data/`.
-   **Schematron XSLT files:** For validation rules (e.g., `PINT-UBL-validation-preprocessed.xslt`, `PINT-jurisdiction-aligned-rules.xslt`) located in `/mnt/data/`.
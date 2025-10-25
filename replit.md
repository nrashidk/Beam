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
Detailed explanations preferred. Comprehensive SuperAdminDashboard implemented with advanced analytics, revenue tracking, and company explorer. Multi-user team management system enables businesses to invite and manage team members with role-based access control.

## Recent Updates (2025-10-25)
1. **Company Branding System**: Complete UI for uploading logos and stamps with drag-and-drop interface, live preview, and invoice integration
2. **Multi-User Team Management**: Full team member invitation system with role-based access (Owner, Admin, Finance User)
3. **SuperAdmin Analytics Dashboard**: Comprehensive analytics with MRR/ARR tracking, company explorer, CSV export, and revenue breakdown by tier
4. **Enhanced Admin API**: New `/admin/stats` endpoint providing real-time metrics for revenue, companies, and invoices
5. **User Management APIs**: Three new endpoints for inviting, listing, and removing team members

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
7.  **Branding (IMPLEMENTED 2025-10-25):**
    *   Custom logos (PNG/SVG), configurable colors and fonts, custom header/footer text.
    *   Asset management with SHA-256 checksums.
    *   **Upload Interface:**
        -   Drag-and-drop logo and stamp upload via CompanyBranding.jsx
        -   File validation (PNG/SVG, max 2MB)
        -   Live preview before upload
        -   Replace/delete functionality
    *   **Display Integration:**
        -   Logo displayed in invoice header
        -   Stamp displayed in invoice footer signature area
        -   Graceful fallback for missing assets
        -   Subscription plan gating (paid tiers only)
8.  **Multi-User Team Management (IMPLEMENTED 2025-10-25):**
    *   **Team Structure:**
        -   Support for unlimited team members per company
        -   Owner designation for company registrant
        -   Role-based access: Super Admin, Company Admin, Finance User
        -   Invitation system with temporary passwords
    *   **User Management Features:**
        -   Invite team members via email
        -   Remove team members (except owner)
        -   View team member details (email, role, join date, last login)
        -   Role permissions clearly defined
    *   **Database Schema Updates:**
        -   `is_owner`: Boolean flag for company owner
        -   `full_name`: User's full name
        -   `invited_by`: Foreign key to user who invited this member
        -   `created_at`: User creation timestamp
        -   `last_login`: Last login timestamp
    *   **Security:**
        -   Owners cannot be removed
        -   Users cannot remove themselves
        -   Only admins can invite/remove users
        -   Cross-company protection (users cannot manage other companies' teams)
9.  **SuperAdmin Analytics Dashboard (IMPLEMENTED 2025-10-25):**
    *   **Comprehensive Revenue Metrics:**
        -   Monthly Recurring Revenue (MRR) calculation by subscription tier
        -   Annual Recurring Revenue (ARR) projection
        -   Revenue breakdown by plan (Free, Starter, Professional, Enterprise)
        -   Active companies per tier with ARPU (Average Revenue Per User)
    *   **Company Explorer:**
        -   Full company list with real-time invoice counts
        -   Advanced filtering: by plan, status, region, invoice count
        -   Search functionality by company name
        -   VAT compliance status indicators
        -   CSV export for reporting
    *   **Registration Analytics:**
        -   Pending, approved, and rejected registration counts
        -   Active vs inactive company tracking
    *   **Invoice Statistics:**
        -   Month-to-date invoice counts
        -   Month-over-month comparison
        -   Per-company invoice tracking
    *   **Quick Actions:**
        -   Navigate to approval workflow
        -   Manage companies and plans
        -   Export comprehensive data

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
  - **User Management Fields (added 2025-10-25):**
    - `is_owner`: Boolean flag indicating company owner (first registrant)
    - `full_name`: User's full name for display
    - `invited_by`: Foreign key to user who invited this member
    - `created_at`: User creation timestamp
    - `last_login`: Last successful login timestamp
    - Multi-user support: Multiple users can belong to same company
  - **Branding Tables (added 2025-10-25):**
    - `company_branding`: Logo and stamp storage with file metadata
    - Columns: logo_file_name, logo_file_path, stamp_file_name, stamp_file_path
    - File size and MIME type tracking for uploaded assets
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
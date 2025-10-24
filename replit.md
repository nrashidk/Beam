# Beam E-Invoicing API

A comprehensive FastAPI-based multi-tenant e-invoicing system for UAE businesses with integrated registration wizard, VAT compliance, invoice generation, and payment processing.

## Overview

This platform provides an end-to-end business solution combining:

- **🚀 Registration Wizard** - Multi-step company onboarding with document management
- **📊 Subscription Management** - Tiered pricing plans (Starter, Professional, Enterprise)
- **🧾 UAE e-Invoicing** - Automated invoice generation with VAT compliance
- **💳 Payment Processing** - Multiple payment methods and POS integration
- **👔 Company Branding** - Custom logos and styling for invoices
- **⚖️ Compliance** - UBL/PINT-AE format, Schematron validation, AS4 integration stub

## Complete Business Flow

```
1. Registration → 2. Admin Approval → 3. Subscription → 4. Invoice Generation → 5. Payment Collection
```

## Project Architecture

### Technology Stack

- **Backend**: FastAPI 2.0
- **Database**: PostgreSQL (Neon-backed via DATABASE_URL)
- **ORM**: SQLAlchemy 2.0.36
- **PDF Generation**: ReportLab 4.2.5
- **XML Processing**: lxml 5.3.0
- **Server**: Uvicorn (async)

### Directory Structure

```
.
├── main.py              # Complete application (all-in-one architecture)
├── requirements.txt     # Python dependencies
├── artifacts/          # Generated invoices, documents (XML/PDF)
├── .replit             # Replit configuration
├── .gitignore          # Git ignore rules
└── replit.md           # This documentation
```

## Core Features

### 1. Quick Registration

**Simple, fast company signup:**

- Email and company name
- Business type and phone
- Instant submission (no documents required upfront)
- Free tier activated automatically upon approval

**Endpoints:**
- `POST /register/init` - Initialize registration session
- `POST /register/{company_id}/step1` - Submit company info
- `POST /register/{company_id}/step2` - Submit business details (optional fields)
- `POST /register/{company_id}/finalize` - Submit for approval
- `GET /register/{company_id}/progress` - Check registration progress

### 2. Subscription Plans

**Four tiers available:**

**Free** ($0/month) **← Automatically assigned on approval**
- 100 invoices/month
- 1 user
- API access
- All core features
- No credit card required

**Starter** ($99/month, $990/year)
- 100 invoices/month
- 2 users
- API access
- Basic features

**Professional** ($299/month, $2990/year)
- 500 invoices/month
- 5 users
- API access
- Custom branding
- Multi-currency

**Enterprise** ($999/month, $9990/year)
- Unlimited invoices
- 50 users
- API access
- Custom branding
- Multi-currency
- Priority support

**Endpoints:**
- `GET /plans` - List all subscription plans (including Free tier)
- `GET /plans/{plan_id}` - Get plan details

### 3. Admin Approval Workflow

Admins review and approve/reject company registrations. **Upon approval, companies automatically receive free tier access.**

- `GET /admin/companies/pending` - List companies awaiting approval
- `POST /admin/companies/{company_id}/approve` - Approve and activate with free tier
- `POST /admin/companies/{company_id}/reject` - Reject registration

### 4. Company Management

After approval, companies can access full platform features:

- TRN (Tax Registration Number) validation (15 digits)
- Automatic VAT state transitions based on turnover thresholds (AED 375,000)
- Peppol endpoint ID support
- Custom branding profiles

**VAT State Machine:**
- `NON_VAT`: Company below VAT threshold
- `VAT_PENDING`: Above threshold, awaiting registration
- `VAT_ACTIVE`: Registered and issuing VAT invoices

**Endpoints:**
- `GET /companies/{company_id}` - Get company details
- `GET /companies/{company_id}/subscription` - View subscription

### 5. Invoice Generation

**Automated invoice creation:**
- Two invoice types: Commercial and VAT Tax Invoice
- UBL/PINT-AE compliant XML generation
- PDF invoices with embedded XML hash
- Schematron validation (global + UAE rules)
- Auto-generation from billing events

**Endpoints:**
- `POST /events` - Ingest billing event (auto-generates invoice)
- `GET /companies/{company_id}/invoices` - List company invoices
- `GET /invoices/{invoice_id}/pdf` - Download PDF
- `GET /invoices/{invoice_id}/xml` - Download XML

### 6. Payment Processing

**Multiple payment methods:**
- Cash
- Card (credit/debit)
- POS terminals
- Bank transfer
- Digital wallets

**Features:**
- Payment intents pattern
- Card surcharge configuration
- Metadata tracking for reconciliation
- POS device registration

**Endpoints:**
- `PUT /companies/{company_id}/payment-policy` - Configure payment methods
- `POST /companies/{company_id}/pos-devices` - Register POS device
- `POST /invoices/{invoice_id}/payment-intents` - Create payment intent
- `POST /payment-intents/{intent_id}/capture` - Capture payment

### 7. Branding

**Company customization:**
- Custom logos (PNG/SVG)
- Configurable colors and fonts
- Custom header/footer text
- Asset management with SHA-256 checksums

**Endpoints:**
- `POST /companies/{company_id}/branding/logo` - Upload company logo

## API Documentation

The complete interactive API documentation is available at:

**Swagger UI**: `https://your-repl-url.replit.dev/docs`

## Database Schema

### Core Tables

**Registration & Onboarding:**
- `companies` - Company profiles with extended registration data
- `subscription_plans` - Available subscription tiers
- `company_subscriptions` - Active subscriptions
- `company_documents` - Uploaded business licenses and TRN certificates
- `registration_progress` - Track multi-step registration status

**Invoicing & Payments:**
- `users` - User accounts with role-based access
- `branding_profiles` - Company branding configuration
- `assets` - Uploaded files (logos, documents)
- `billing_events` - Billable events that trigger invoices
- `invoices` - Generated invoices with XML/PDF paths
- `turnover_buckets` - Monthly turnover aggregates for VAT
- `payment_policies` - Company payment preferences
- `pos_devices` - Registered POS terminals
- `payment_intents` - Payment initiation records
- `payments` - Captured payment records

## Configuration

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection (auto-configured by Replit)
- `ARTIFACT_ROOT` - Directory for generated files (default: `./artifacts`)
- `PEPPOL_ENDPOINT_SCHEME` - Default Peppol scheme (default: `0088`)
- `RETENTION_YEARS` - Document retention period (default: `7`)

### VAT Settings

- Standard VAT rate: 5%
- Mandatory registration threshold: AED 375,000

## Running the Application

### Development

The application runs automatically via the configured workflow:

```bash
python main.py
```

Server starts on `http://0.0.0.0:5000` and is accessible via Replit webview.

### Testing the Complete Flow

**Via Web Interface:**
1. Open `/` in your browser to access the registration form
2. Fill in email, company name, business type, and phone
3. Click "Create Free Account"
4. View success message confirming submission

**Via API:**
1. **View Plans**: `GET /plans` to see all tiers including Free
2. **Start Registration**: `POST /register/init`
3. **Submit Company Info**: `POST /register/{company_id}/step1`
4. **Submit Business Details**: `POST /register/{company_id}/step2`
5. **Finalize**: `POST /register/{company_id}/finalize`
6. **Admin Approval**: `POST /admin/companies/{company_id}/approve` (auto-assigns free tier)
7. **Create Invoice**: `POST /events` (after approval)

### Production Deployment

**Deployment Type**: Reserved VM (Always-On)

This stateful application is configured for Reserved VM deployment because it:
- Maintains persistent database connections
- Uses in-memory invoice counters
- Handles payment state
- Stores artifacts locally
- Requires 24/7 availability

**To Deploy**: Click the "Deploy" button in Replit interface.

## Compliance Notes

### UAE E-Invoicing Requirements

**Implemented standards:**
- PINT/PINT-AE specification compliance
- Schematron validation (global + UAE jurisdiction rules)
- Required code lists: ISO4217, ISO3166, UNCL, EAS, ICD
- TRN validation (15-digit format)
- Proper tax categorization and exemption codes

### Required Data Files

The following Genericode files are expected in `/mnt/data/`:
- `eas.gc`, `ISO4217.gc`, `ISO3166.gc`
- `UNCL*.gc` (1001, 2005, 4461, 5189, 7161, 7143)
- `UNECERec20.gc`, `MimeCode.gc`
- `Aligned-TaxCategoryCodes.gc`, `Aligned-TaxExemptionCodes.gc`
- `transactiontype.gc`, `FreqBilling.gc`, `ICD.gc`

### Schematron XSLT Files

- `/mnt/data/PINT-UBL-validation-preprocessed.xslt` - Global rules
- `/mnt/data/PINT-jurisdiction-aligned-rules.xslt` - UAE-specific rules

## Security Considerations

- Authentication uses stub system (implement JWT/OAuth for production)
- Database credentials managed via environment variables
- File uploads validated for type and size (max 5MB)
- SQL injection protection via SQLAlchemy ORM
- CORS enabled for development
- Document storage with checksums (SHA-256)

## Known Limitations

1. **Authentication**: Currently stubbed - implement proper auth before production
2. **AS4 Client**: Mock implementation - integrate with real Peppol access point
3. **Invoice Counters**: In-memory - use database for distributed systems
4. **Rate Limiting**: Not implemented
5. **File Storage**: Local filesystem - consider S3/object storage for scale
6. **Document Verification**: Manual admin review - could automate with OCR/AI

## Recent Changes

### 2025-10-24: Major Integration Update

**✅ Registration Wizard Integration**
- Added multi-step company onboarding flow
- Integrated subscription plan management
- Added document upload functionality (Business License, TRN Certificate)
- Created admin approval workflow
- Enhanced company model with registration fields

**✅ Database Schema Updates**
- Recreated database with new registration tables
- Added subscription_plans, company_documents, registration_progress
- Enhanced companies table with business registration data
- Seeded subscription plans (Starter, Professional, Enterprise)

**✅ API Enhancements**
- Added 15+ new registration endpoints
- Integrated approval workflow
- Added plan selection functionality
- Created progress tracking system

**Initial Setup**
- Configured PostgreSQL database
- Set up Python 3.11 environment
- Fixed FastAPI response model issues (BillingEventOut)
- Configured workflow to run on port 5000
- Set up deployment configuration (VM mode)

## Support

For questions or issues, contact the development team at support@example.tld

## License

Proprietary - All rights reserved

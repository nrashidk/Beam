# UAE e-Invoicing Platform

A comprehensive FastAPI-based multi-tenant e-invoicing system for UAE compliance with VAT regulations, XML/PDF invoice generation, payment processing, and AS4 integration stub.

## Overview

This application provides a complete e-invoicing solution designed for UAE businesses, featuring:

- **Multi-tenant company management** with VAT state machine
- **Automated invoice generation** in UBL/PINT-AE format (XML + PDF)
- **VAT compliance** with automatic threshold detection
- **Payment processing** with multiple payment methods (Cash, Card, POS, Bank Transfer, Wallet)
- **Company branding** with custom logos and styling
- **Schematron validation** for invoice compliance
- **AS4 messaging stub** for Peppol network integration

## Project Architecture

### Technology Stack

- **Backend**: FastAPI 0.115.0
- **Database**: PostgreSQL (via DATABASE_URL environment variable)
- **ORM**: SQLAlchemy 2.0.36
- **PDF Generation**: ReportLab 4.2.5
- **XML Processing**: lxml 5.3.0
- **Server**: Uvicorn with async support

### Directory Structure

```
.
├── main.py              # Main application file (all-in-one)
├── requirements.txt     # Python dependencies
├── artifacts/          # Generated invoices (XML/PDF) and reports
├── .replit             # Replit configuration
├── .gitignore          # Git ignore rules
└── replit.md           # This documentation
```

## Features

### 1. Company Management

- Create companies with TRN (Tax Registration Number) validation
- Automatic VAT state transitions based on turnover thresholds (AED 375,000)
- Support for Peppol endpoint IDs
- Admin approval workflow

### 2. VAT State Machine

Three states tracked automatically:
- `NON_VAT`: Company below VAT threshold
- `VAT_PENDING`: Above threshold, awaiting registration
- `VAT_ACTIVE`: Registered and issuing VAT invoices

### 3. Invoice Generation

- Automatic invoice creation from billing events
- Two invoice types: Commercial and VAT Tax Invoice
- UBL/PINT-AE compliant XML generation
- PDF invoices with embedded XML hash
- Schematron validation (UAE + global rules)

### 4. Payment Integration

- Multiple payment methods supported
- Payment intents pattern for secure transactions
- POS device registration
- Card surcharge configuration
- Metadata tracking for reconciliation

### 5. Branding

- Custom company logos (PNG/SVG)
- Configurable colors and fonts
- Custom header/footer text
- Asset management with SHA-256 checksums

## API Endpoints

The API documentation is available at `/docs` when the server is running.

### Key Endpoints

- `POST /companies` - Create a new company
- `POST /admin/companies/approve/{company_id}` - Approve company
- `POST /companies/{company_id}/branding/logo` - Upload company logo
- `PUT /companies/{company_id}/payment-policy` - Set payment policy
- `POST /companies/{company_id}/pos-devices` - Register POS device
- `POST /events` - Ingest billing event (auto-generates invoice)
- `GET /companies/{company_id}/invoices` - List company invoices
- `GET /invoices/{invoice_id}/pdf` - Download invoice PDF
- `GET /invoices/{invoice_id}/xml` - Download invoice XML
- `POST /invoices/{invoice_id}/payment-intents` - Create payment intent
- `POST /payment-intents/{intent_id}/capture` - Capture payment

## Database Schema

### Core Tables

- `companies` - Company profiles with VAT state
- `users` - User accounts with role-based access
- `branding_profiles` - Company branding configuration
- `assets` - Uploaded files (logos, etc.)
- `billing_events` - Billable events that trigger invoices
- `invoices` - Generated invoices with XML/PDF paths
- `turnover_buckets` - Monthly turnover aggregates for VAT calculation
- `payment_policies` - Company payment preferences
- `pos_devices` - Registered POS terminals
- `payment_intents` - Payment initiation records
- `payments` - Captured payment records

## Configuration

### Environment Variables

The application uses the following environment variables:

- `DATABASE_URL` - PostgreSQL connection string (automatically configured)
- `ARTIFACT_ROOT` - Directory for generated files (default: `./artifacts`)
- `PEPPOL_ENDPOINT_SCHEME` - Default Peppol scheme (default: `0088`)
- `RETENTION_YEARS` - Document retention period (default: `7`)

### VAT Settings

- Standard VAT rate: 5% (AED_VAT_STANDARD)
- Mandatory registration threshold: AED 375,000

## Running the Application

### Development

The application runs automatically via the configured workflow:

```bash
python main.py
```

The server starts on `http://0.0.0.0:5000` and is accessible via the Replit webview.

### Production Deployment

The deployment is configured as a VM (always-on) deployment suitable for stateful applications. The server maintains:
- Database connections
- In-memory invoice counters
- Payment state

## Code Structure

The `main.py` file is organized into sections:

1. **SSL Availability Probe** - Handles environments without OpenSSL
2. **Database Setup** - SQLAlchemy models and engine configuration
3. **Enums** - Role, VATState, CompanyStatus, PaymentStatus, etc.
4. **SQLAlchemy Models** - Database schema definitions
5. **Security** - User authentication stub
6. **Helpers & Services** - Turnover tracking, VAT state evaluation
7. **Genericode Loader** - Code list validation (ISO currencies, UNCL codes, etc.)
8. **Schematron Validation** - UAE compliance checking
9. **Pydantic Schemas** - API request/response models
10. **Invoice Builders** - XML/PDF generation
11. **AS4 Client Stub** - Peppol integration placeholder
12. **FastAPI Routes** - API endpoint definitions

## Compliance Notes

### UAE E-Invoicing Requirements

The system implements:
- PINT/PINT-AE specification compliance
- Schematron validation (global + UAE jurisdiction rules)
- Required code lists: ISO4217, ISO3166, UNCL, EAS, ICD
- TRN validation (15-digit format)
- Proper tax categorization and exemption codes

### Data Files Required

The following Genericode files are expected in `/mnt/data/`:
- eas.gc, ISO4217.gc, ISO3166.gc
- UNCL*.gc (1001, 2005, 4461, 5189, 7161, 7143)
- UNECERec20.gc, MimeCode.gc
- Aligned-TaxCategoryCodes.gc, Aligned-TaxExemptionCodes.gc
- transactiontype.gc, FreqBilling.gc, ICD.gc

### Schematron XSLT Files

- `/mnt/data/PINT-UBL-validation-preprocessed.xslt` - Global rules
- `/mnt/data/PINT-jurisdiction-aligned-rules.xslt` - UAE-specific rules

## Security Considerations

- Current implementation uses a stub authentication system
- Production deployment requires proper JWT/OAuth integration
- Database credentials are managed via environment variables
- File uploads are validated for type and size
- SQL injection protection via SQLAlchemy ORM
- CORS enabled for development (configure for production)

## Known Limitations

1. Authentication is stubbed - implement proper auth before production
2. AS4 client is a mock - integrate with real Peppol access point
3. Invoice counters are in-memory - use database for distributed systems
4. No rate limiting implemented
5. File storage is local - consider S3/object storage for scale

## Recent Changes

- **2025-10-24**: Initial Replit setup
  - Configured PostgreSQL database
  - Set up Python 3.11 environment
  - Fixed FastAPI response model issues (BillingEventOut)
  - Configured workflow to run on port 5000
  - Set up deployment configuration (VM mode)

## Support

For questions or issues, contact the development team at support@example.tld.

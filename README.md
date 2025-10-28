# InvoLinks — UAE E-Invoicing Platform

**InvoLinks** is a modern, FTA-compliant digital invoicing and accounts payable platform designed for UAE businesses. It enables companies to issue, validate, and exchange VAT-compliant invoices using the PEPPOL network, while providing comprehensive AP management with purchase orders, goods receipts, and 3-way matching.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

---

## 🚀 Features

### 💼 **UAE VAT Compliance**
- Automatic VAT calculation with 5% UAE standard rate
- 15-digit numeric TRN validation
- Enforces FTA Phase 2 rules for invoice types, dates, and duplicate detection
- Credit note support with reference linking
- Multi-currency support with AED conversion

### 📄 **FTA-Ready UBL 2.1 Generation**
- Full UBL 2.1 compliant XML invoices
- PINT-AE (PEPPOL International Invoicing - UAE Profile) specification
- Includes InvoiceTypeCode, TaxTotal, TaxSubtotal, MonetaryTotal, and line-level details
- Support for Tax Invoice, Credit Note, and Commercial Invoice types
- Schematron validation support

### 🌐 **PEPPOL Integration**
- Send and receive invoices via accredited PEPPOL providers
- Modular provider adapter (Tradeshift, Basware)
- Mock provider for testing without real API credentials
- Status tracking and delivery confirmation
- Participant ID validation

### 🏢 **Multi-Tenant SaaS Architecture**
- Company registration workflow with email verification
- Flexible subscription management (Free, Pro, Enterprise tiers)
- SuperAdmin dashboard for platform management
- Role-based access control (Owner, Admin, Finance User)
- Isolated company data and audit logs
- Unlimited team members per company

### 🔐 **Chain-of-Trust & Digital Signatures**
- SHA-256 hash chain linking previous and current invoices
- RSA-2048 detached digital signatures
- Certificate serial tracking and validation
- Immutable audit trail for all invoice operations
- Verify invoice integrity via API endpoint

### 📊 **Accounts Payable (AP) Management**
- Purchase order creation and tracking
- Goods receipt notes (GRN) with quantity verification
- Receive inward invoices from suppliers (Corner 4 of UAE 5-Corner model)
- Automated 3-way matching (PO → GRN → Invoice)
- Variance detection and approval workflows
- Supplier/vendor management with PEPPOL ID support

### 🔒 **Multi-Factor Authentication (MFA)**
- Compliant with Ministerial Decision No. 64/2025
- TOTP (Time-based One-Time Password) with QR code enrollment
- Email OTP delivery
- Backup codes (10 one-time use codes)
- Mandatory for admin users, optional for others

### 💳 **Payment Processing**
- Multiple payment methods (Cash, Card, POS, Bank Transfer, Digital Wallets)
- Payment intents pattern for tracking
- Card surcharge configuration
- Payment reconciliation with invoices

### 🎨 **Custom Branding**
- Company logo upload with drag-and-drop
- Configurable brand colors and fonts
- Custom header/footer text for invoices
- Asset management with file validation
- Live preview in invoice templates

### 👥 **Team Collaboration**
- Invite team members via email
- Role-based permissions (Owner, Admin, Finance User)
- User activity tracking
- Team member management dashboard

### 📦 **Bulk Import**
- Import invoices from CSV/Excel files
- Import vendors/suppliers from CSV/Excel
- Template downloads for correct format
- Row-level error reporting with UAE compliance validation
- Free plan enforcement during import
- Dual-format support (pandas + openpyxl)

### 📈 **SuperAdmin Analytics**
- Revenue metrics and trends
- Company explorer with registration analytics
- Invoice statistics across all tenants
- Subscription distribution reports
- Real-time platform health monitoring

### 📝 **Content Management System (CMS)**
- Database-backed content management
- SuperAdmin-only content editor
- Inline editing for all website text
- Automatic content seeding on startup
- Real-time updates without code changes
- Dynamic homepage with 14+ configurable content blocks

### 🔄 **Password Recovery**
- Token-based password reset flow
- Secure one-time use tokens (1-hour validity)
- Email reset link generation
- User-friendly reset pages

---

## 🧩 Architecture & Technology Stack

### **Backend**
- **Framework:** FastAPI 2.0 (Python 3.11+) with async support
- **Database:** PostgreSQL 14+ (configurable via DATABASE_URL, defaults to SQLite for development)
- **ORM:** SQLAlchemy 2.0.36 with async-ready engine
- **Authentication:** JWT with bcrypt password hashing
- **CORS:** Configured for cross-origin requests

### **Frontend**
- **Framework:** React 19.2 with Vite 7.1
- **Routing:** React Router 7.9
- **Styling:** Tailwind CSS 3.4 with custom design system
- **UI Components:** Radix UI (Dialog, Dropdown, Select, Tabs)
- **Charts:** Recharts for analytics visualization
- **HTTP Client:** Axios with interceptors
- **Date Handling:** date-fns

### **Security & Compliance**
- **Cryptography:** RSA/ECDSA digital signatures, SHA-256 hash chains
- **XML Processing:** lxml for UBL 2.1 XML generation
- **MFA:** pyotp for TOTP, qrcode + pillow for QR generation
- **Validation:** Pydantic for request/response validation
- **SQL Injection Protection:** SQLAlchemy ORM

### **Data Processing**
- **CSV/Excel:** pandas + openpyxl for bulk imports
- **XML:** xml.etree.ElementTree for UBL generation

### **Design System**
- **Inspiration:** Groww/Toss fintech style
- **Typography:** Inter font family
- **Style:** Clean, minimal, card-based layouts
- **Effects:** Glassmorphism navbar, enhanced shadows, rounded corners
- **Responsive:** Mobile-first design approach

---

## ⚙️ Installation

### **Prerequisites**
- Python 3.11+
- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### **1. Clone Repository**
```bash
git clone https://github.com/your-org/InvoLinks.git
cd InvoLinks
```

### **2. Backend Setup**
```bash
# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section)

# The database will be automatically created by Replit
# Tables will be auto-created on first run
```

### **3. Frontend Setup**
```bash
# Install Node dependencies
npm install

# Frontend automatically configured to run on port 5000
```

### **4. Run the Application**
```bash
# Backend (runs on port 8000)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (runs on port 5000)
npm run dev
```

The application will be available at:
- **Frontend:** http://localhost:5000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs (Swagger UI)
- **Alternative Docs:** http://localhost:8000/redoc

---

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

### **Database**
```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost/involinks
```

### **Security**
```bash
# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Digital Signatures (for production)
SIGNING_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
SIGNING_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
SIGNING_CERTIFICATE_PEM="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
SIGNING_CERT_SERIAL="prod-cert-001"
```

### **PEPPOL (Production)**
```bash
# Provider: "tradeshift", "basware", or "mock" (default)
PEPPOL_PROVIDER=mock
PEPPOL_BASE_URL=https://api.tradeshift.com
PEPPOL_API_KEY=your-peppol-api-key
```

### **Company Settings**
```bash
# Auto-approve new company signups (true/false)
AUTO_APPROVE_SIGNUPS=true
```

### **File Paths**
```bash
# UBL XSD validation (optional)
UBL_XSD_PATH=/path/to/UBL-Invoice-2.1.xsd

# Compliance data files
GENERICODE_DIR=/mnt/data/
SCHEMATRON_DIR=/mnt/data/
```

### **Production Mode**
```bash
# Enable production validation (requires signing keys)
PRODUCTION_MODE=false
```

---

## 🧪 Testing Credentials

For development and testing:

### **SuperAdmin Account**
- **Email:** nrashidk@gmail.com
- **Password:** Admin@123
- **Access:** Full platform management, analytics, CMS

### **Test Business Account**
- **Email:** testuser@involinks.ae
- **Password:** SecurePass123!@#
- **TRN:** 123456789012345
- **Access:** Business operations, invoicing, AP management

---

## 📚 API Endpoints

### **Authentication**

#### `POST /auth/register`
Register a new company and admin user.
```json
{
  "email": "admin@company.ae",
  "password": "SecurePass123",
  "company_name": "ACME Trading LLC",
  "legal_name": "ACME Trading LLC",
  "trn": "123456789012345"
}
```

#### `POST /auth/login`
Authenticate and receive JWT token.
```json
{
  "email": "admin@company.ae",
  "password": "SecurePass123"
}
```

#### `POST /auth/forgot-password`
Request password reset token.
```json
{
  "email": "admin@company.ae"
}
```

#### `POST /auth/reset-password`
Reset password with token.
```json
{
  "token": "reset-token-here",
  "new_password": "NewSecurePass123"
}
```

### **Invoices**

#### `POST /invoices`
Create a new invoice.
```json
{
  "invoice_type": "Tax Invoice",
  "customer_trn": "987654321098765",
  "customer_name": "Client Corp",
  "customer_email": "client@corp.ae",
  "issue_date": "2025-10-28",
  "due_date": "2025-11-28",
  "currency_code": "AED",
  "line_items": [
    {
      "description": "Professional Services",
      "quantity": 10,
      "unit_price": 500.00,
      "tax_category": "S",
      "tax_percent": 5.0
    }
  ]
}
```

#### `GET /invoices`
List all invoices with filters.
```bash
GET /invoices?status=APPROVED&invoice_type=Tax+Invoice&limit=50
```

#### `GET /invoices/{invoice_id}`
Get invoice details including UBL XML.

#### `POST /invoices/{invoice_id}/finalize`
Finalize invoice (generates hash and signature).

#### `POST /invoices/{invoice_id}/approve`
Approve invoice for sending.

#### `POST /invoices/{invoice_id}/send`
Send invoice via PEPPOL network.

#### `GET /invoices/{invoice_id}/verify`
Verify invoice hash and signature integrity.

### **Accounts Payable**

#### `POST /purchase-orders`
Create a purchase order.

#### `GET /purchase-orders`
List all purchase orders.

#### `POST /purchase-orders/{po_id}/send`
Send PO to supplier.

#### `POST /goods-receipts`
Record goods receipt.

#### `POST /inward-invoices/receive`
Receive invoice from supplier (via PEPPOL or manual).

#### `GET /inward-invoices/{invoice_id}/match`
Perform 3-way matching.

### **Bulk Import**

#### `POST /invoices/bulk-import`
Upload CSV/Excel file for bulk invoice creation.

#### `GET /invoices/bulk-import/template`
Download CSV/Excel template.

#### `POST /vendors/bulk-import`
Upload CSV/Excel file for bulk vendor import.

### **SuperAdmin**

#### `GET /admin/companies`
List all companies (SuperAdmin only).

#### `PUT /admin/companies/{company_id}/approve`
Approve company registration.

#### `GET /admin/analytics/overview`
Platform-wide analytics dashboard.

#### `GET /admin/content`
List all CMS content blocks (SuperAdmin only).

#### `PUT /admin/content/{key}`
Update content block (SuperAdmin only).

### **Public**

#### `GET /content/public`
Get all public content blocks (for homepage).

For complete API documentation with examples, see [docs/API.md](docs/API.md).

---

## 🏗️ Project Structure

```
InvoLinks/
├── main.py                 # FastAPI application entry point
├── utils/
│   ├── crypto_utils.py     # Digital signatures, hash chains
│   ├── ubl_xml_generator.py # UBL 2.1 XML generation
│   ├── peppol_provider.py  # PEPPOL provider adapters
│   ├── exceptions.py       # Custom exception classes
│   └── bulk_import.py      # CSV/Excel bulk import validation
├── src/
│   ├── App.jsx             # React app routing
│   ├── pages/
│   │   ├── Homepage.jsx    # Public landing page
│   │   ├── Login.jsx       # Authentication
│   │   ├── Dashboard.jsx   # Business dashboard
│   │   ├── SuperAdminDashboard.jsx
│   │   ├── Invoices.jsx    # Invoice management
│   │   ├── ContentManager.jsx # CMS editor
│   │   └── ...
│   ├── contexts/
│   │   └── ContentContext.jsx # Global content state
│   └── utils/
│       └── validation.js   # UAE-specific validation
├── docs/
│   ├── TECHNICAL_SPECIFICATIONS.md
│   ├── API.md
│   └── ARCHITECTURE.md
├── package.json
├── requirements.txt
├── vite.config.js
└── README.md
```

---

## 🔐 Compliance & Security

### **UAE FTA Compliance**
- ✅ Cabinet Decision No. 52/2017 (UAE VAT Law)
- ✅ FTA e-Invoicing Phase 2 requirements
- ✅ PEPPOL BIS Billing 3.0
- ✅ UBL 2.1 with PINT-AE profile
- ✅ Ministerial Decision No. 64/2025 (MFA requirements)

### **Data Security**
- ✅ JWT authentication with secure token handling
- ✅ bcrypt password hashing (cost factor 12)
- ✅ SQL injection protection via SQLAlchemy ORM
- ✅ File upload validation and sanitization
- ✅ CORS configuration for API security
- ✅ Environment variable-based credentials
- ✅ SHA-256 hashing for backup codes

### **Immutable Audit Trail**
- ✅ Hash chain linking for invoice integrity
- ✅ Digital signatures for non-repudiation
- ✅ Timestamp tracking for all operations
- ✅ User action logging

### **Business Model**
InvoLinks acts as **billing software** (not an Accredited Service Provider). We integrate with accredited PEPPOL providers (Tradeshift, Basware) for PEPPOL network transmission and FTA submission. This allows us to focus on building great invoicing software while leveraging certified providers for compliance.

---

## 🧭 Roadmap

### **Phase 1: Core Platform** ✅ (Complete)
- ✅ Multi-tenant SaaS infrastructure
- ✅ UBL 2.1 XML generation
- ✅ Digital signatures and hash chains
- ✅ PEPPOL integration architecture
- ✅ AP Management (PO, GRN, 3-way matching)
- ✅ MFA implementation
- ✅ CMS for content management
- ✅ Password recovery

### **Phase 2: Compliance & Integration** 🚧 (In Progress)
- 🔲 FTA audit file generation
- 🔲 Production PEPPOL credentials (Tradeshift/Basware)
- 🔲 XSD validation for UBL XML
- 🔲 PDF invoice generation with QR codes
- 🔲 Partner management API formalization

### **Phase 3: Accounting System** 📅 (Planned)
- 🔲 Journal entries (Dr/Cr double-entry bookkeeping)
- 🔲 General ledger
- 🔲 Trial balance
- 🔲 Profit & Loss (P&L) reports
- 🔲 Balance sheet
- 🔲 Financial report exports (PDF/Excel)

### **Phase 4: Advanced Features** 📅 (Future)
- 🔲 Async task queue (Celery/RQ) for background jobs
- 🔲 Real-time analytics dashboard
- 🔲 Multi-provider PEPPOL routing
- 🔲 Mobile application (React Native)
- 🔲 Advanced reporting and business intelligence
- 🔲 API marketplace and integrations

### **Phase 5: Enterprise** 📅 (Future)
- 🔲 ISO 27001 certification
- 🔲 SOC 2 compliance
- 🔲 Multi-language support (Arabic/English)
- 🔲 White-label solutions
- 🔲 Advanced workflow automation
- 🔲 Custom reporting engine

---

## 🧑‍💻 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### **Development Workflow**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Code Standards**
- Follow PEP 8 for Python code
- Use ESLint/Prettier for JavaScript/React
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

### **Testing**
```bash
# Backend tests (when available)
pytest -v --cov=utils tests/

# Frontend tests (when available)
npm test
```

---

## 📜 License

MIT License © 2025 InvoLinks Technologies

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.

See [LICENSE](LICENSE) file for full details.

---

## 📞 Support

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/InvoLinks/issues)
- **Email:** support@involinks.ae
- **Website:** https://involinks.ae

---

## 🙏 Acknowledgments

- **UAE FTA** for e-invoicing specifications
- **PEPPOL** for international e-invoicing standards
- **FastAPI** and **React** communities for excellent frameworks
- **Replit** for cloud infrastructure and development environment

---

**Built with ❤️ for UAE businesses seeking digital transformation in invoicing and accounting.**

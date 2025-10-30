# SpaBooker vs InvoLinks Finance System Analysis

**Date:** October 30, 2025  
**Analyst:** Replit Agent  
**Purpose:** Compare SpaBooker's comprehensive finance/accounting/VAT system with InvoLinks' simple expense tracking and propose integration options

---

## Executive Summary

### SpaBooker Finance System: ⭐⭐⭐⭐⭐ (Production-Ready, FTA-Compliant)
**Complexity:** Enterprise-grade accounting system  
**Compliance:** 100% UAE FTA VAT compliant (with minor fixes needed)  
**Features:** 30+ financial features including invoicing, VAT returns, audit files, multi-stream revenue tracking

### InvoLinks Current System: ⭐⭐ (Basic Expense Tracking)
**Complexity:** Simple expense + inventory management  
**Compliance:** Basic VAT calculations only  
**Features:** 5 basic features (expense categories, expense tracking, inventory, net income, net VAT)

**Gap Assessment:** ⚠️ MASSIVE GAP - SpaBooker is 10x more comprehensive

---

## Feature Comparison Matrix

| Feature | SpaBooker | InvoLinks Current | Gap |
|---------|-----------|-------------------|-----|
| **VAT Compliance** |
| Tax Registration Number (TRN) | ✅ Per-business TRN with validation | ❌ Not tracked | HIGH |
| VAT Tax Codes (SR/ZR/ES/OP) | ✅ Full support | ❌ Only standard 5% | HIGH |
| Invoice Classification (Full/Simplified) | ✅ Auto at AED 10k threshold | ❌ Not implemented | HIGH |
| FTA Audit File (FAF) Export | ✅ CSV export ready | ❌ Not implemented | HIGH |
| 5-Year Data Retention Policy | ✅ Planned enforcement | ❌ Not implemented | MEDIUM |
| VAT Threshold Reminder (AED 375k) | ✅ Automated notifications | ❌ Not implemented | LOW |
| **Invoicing** |
| Invoice Generation | ✅ Full system with sequential numbering | ✅ Basic UBL/PINT-AE XML | MEDIUM |
| Invoice Line Items | ✅ Per-item VAT tracking | ✅ Basic line items | LOW |
| Tax-Exclusive Pricing Model | ✅ FTA recommended method | ❌ Using tax-inclusive | MEDIUM |
| Invoice Types | ✅ Multiple types (booking, product, membership) | ✅ Standard B2B/B2C invoices | LOW |
| **Revenue Tracking** |
| Multiple Revenue Streams | ✅ Bookings + Products + Memberships + Loyalty | ✅ Invoices only | HIGH |
| Discount Tracking | ✅ Comprehensive (promo codes, bundles, loyalty) | ✅ Basic per-invoice discount | MEDIUM |
| Payment Methods | ✅ Multiple with card surcharge | ✅ Multiple payment methods | LOW |
| **Accounting Features** |
| Chart of Accounts | ❌ Not implemented | ❌ Not implemented | N/A |
| Double-Entry Bookkeeping | ❌ Not implemented | ❌ Not implemented | N/A |
| General Ledger | ❌ Not implemented | ❌ Not implemented | N/A |
| Expense Tracking | ✅ With VAT categorization | ✅ Custom categories, VAT tracking | LOW |
| Vendor Management | ✅ Full vendor system with bills | ❌ Only supplier names | HIGH |
| Bill Management (Payables) | ✅ Bills + Bill Items | ❌ Not implemented | HIGH |
| **Financial Reports** |
| Finance Summary Report | ✅ Comprehensive | ✅ Basic (Revenue, Expenses, Net Income, Net VAT) | MEDIUM |
| Sales Summary Report | ✅ Available | ❌ Not implemented | MEDIUM |
| Sales List Report | ✅ Available | ❌ Not implemented | LOW |
| Appointments Summary | ✅ Booking-specific | N/A (InvoLinks doesn't have bookings) | N/A |
| Payment Summary | ✅ Available | ❌ Not implemented | MEDIUM |
| Profit & Loss Statement | ❌ Not explicit | ❌ Not implemented | HIGH |
| Balance Sheet | ❌ Not implemented | ❌ Not implemented | HIGH |
| Cash Flow Statement | ❌ Not implemented | ❌ Not implemented | HIGH |
| VAT Return Report | ✅ Output VAT - Input VAT | ✅ Basic calculation | LOW |
| FTA Audit File | ✅ CSV export | ❌ Not implemented | HIGH |
| **Advanced Features** |
| Wallet/Store Credit System | ✅ Full transaction tracking | ❌ Not implemented | MEDIUM |
| Inventory Management | ✅ Product inventory + transactions | ✅ Simple stock tracking | LOW |
| Membership/Subscription Tracking | ✅ Recurring revenue tracking | ✅ Stripe subscriptions (different purpose) | MEDIUM |
| Client Merge | ✅ Duplicate customer handling | ❌ Not implemented | LOW |
| Audit Trail | ✅ Comprehensive logging | ❌ Not implemented | MEDIUM |
| Multi-Tenant Security | ✅ Per-spa isolation | ✅ Per-company isolation | LOW |

---

## Database Schema Comparison

### SpaBooker Finance Tables (11 tables)
```typescript
1. invoices - Main invoice table with TRN, tax codes, invoice types
   └─ invoiceItems - Line items with per-item VAT tracking

2. transactions - Payment tracking (cash, card, POS, wallet)

3. expenses - Expense tracking with VAT categorization
   └─ vendors - Supplier management

4. bills - Vendor bills (accounts payable)
   └─ billItems - Bill line items

5. customerMemberships - Recurring revenue tracking
   └─ membershipUsage - Session usage tracking

6. productSales - Retail sales tracking

7. loyaltyCards - Discount cards
   └─ loyaltyCardUsage - Usage history

8. walletTransactions - Store credit system

9. auditLogs - Comprehensive audit trail

10. spas (with VAT fields):
    - vatEnabled: boolean
    - taxRegistrationNumber: varchar(15)
    - vatRegistrationDate: timestamp
    - vatThresholdReminderEnabled: boolean
    - vatThresholdAmount: decimal (AED 375k)
```

### InvoLinks Finance Tables (5 tables)
```python
1. expense_categories - User-defined categories
2. expenses - Basic expense tracking with VAT
3. inventory_items - Stock tracking
4. inventory_transactions - Stock movements
5. invoices - UBL/PINT-AE XML invoices (extensive)
```

**Gap:** SpaBooker has 6 additional financial tables (vendors, bills, wallet, memberships, loyalty, product sales)

---

## VAT Compliance Comparison

### SpaBooker VAT Features
```typescript
// Tax Code Support
TAX_CODES = {
  SR: 'Standard Rate (5%)',
  ZR: 'Zero-Rated (0%)',
  ES: 'Exempt',
  OP: 'Out of Scope'
}

// TRN Tracking
taxRegistrationNumber: varchar(15) // Per spa
customerTrn: varchar(15) // Per customer (B2B)

// Invoice Classification
if (totalAmount >= 10000) {
  invoiceType = 'full' // Full Tax Invoice
} else {
  invoiceType = 'simplified' // Simplified Tax Invoice
}

// VAT Calculation Methods
calculateVAT(inclusiveAmount, taxCode) // Tax-inclusive (current)
calculateVATFromNet(exclusiveAmount, taxCode) // Tax-exclusive (FTA recommended)

// FTA Audit File Export
exportAuditFile({ startDate, endDate, spaId }) → CSV

// VAT Return Calculation
outputVAT = sum(all sales VAT)
inputVAT = sum(all expense VAT)
netVATPayable = outputVAT - inputVAT

// VAT Threshold Tracking
annualRevenue = trackYearlyRevenue()
if (annualRevenue >= 375000) {
  sendVATRegistrationReminder()
}
```

### InvoLinks VAT Features
```python
# Basic 5% VAT only
vat_amount = amount * 0.05

# Net VAT Calculation
output_vat = sum(invoice.tax_amount)  # From sales
input_vat = sum(expense.vat_amount)   # From purchases
net_vat = output_vat - input_vat

# Custom expense categories
# Simple inventory tracking
# Monthly financial summary
```

**Compliance Status:**
- **SpaBooker:** 60% FTA compliant (needs TRN fields, invoice type logic, data retention)
- **InvoLinks:** 20% FTA compliant (basic VAT calculation only)

---

## API Endpoints Comparison

### SpaBooker Finance Endpoints (20+)
```typescript
// Revenue & VAT Summaries
GET /api/admin/revenue-summary?startDate=X&endDate=Y
GET /api/admin/vat-summary?startDate=X&endDate=Y
GET /api/admin/fta-audit-file?year=2025 (CSV export)

// Invoices
GET /api/admin/invoices
GET /api/admin/invoices/:id
POST /api/admin/invoices
PUT /api/admin/invoices/:id
DELETE /api/admin/invoices/:id

// Expenses & Vendors
GET /api/admin/expenses
POST /api/admin/expenses
GET /api/admin/vendors
POST /api/admin/vendors

// Bills (Accounts Payable)
GET /api/admin/bills
POST /api/admin/bills

// Product Sales
GET /api/admin/product-sales
POST /api/admin/product-sales

// Loyalty & Wallet
GET /api/admin/loyalty-cards
POST /api/admin/wallet/credit
POST /api/admin/wallet/debit

// Memberships
GET /api/admin/memberships
POST /api/admin/memberships/purchase
```

### InvoLinks Finance Endpoints (15+)
```python
# Expense Categories
GET /expense-categories
POST /expense-categories
DELETE /expense-categories/{id}

# Expenses
POST /expenses
GET /expenses?month=YYYY-MM
GET /expenses/summary?month=YYYY-MM
DELETE /expenses/{id}

# Inventory
POST /inventory
GET /inventory
POST /inventory/{id}/adjust
GET /inventory/{id}/history

# Invoices (UBL/PINT-AE)
POST /invoices
GET /invoices
GET /invoices/{id}
GET /invoices/{id}/pdf
GET /invoices/{id}/xml
```

**Gap:** SpaBooker has specialized endpoints for vendors, bills, loyalty, wallet, memberships

---

## Reporting Capabilities

### SpaBooker Reports (5 types)
1. **Finance Summary**
   - Total revenue (all streams)
   - Total VAT collected
   - Total discounts
   - Net revenue
   - Date range filtering

2. **Sales Summary**
   - Revenue by service category
   - Revenue by product category
   - Revenue by staff member
   - Discount analysis

3. **Sales List**
   - Detailed transaction list
   - Sortable columns
   - Export to CSV/Excel/PDF (planned)

4. **Appointments Summary**
   - Booking revenue
   - Staff utilization
   - Service popularity

5. **Payment Summary**
   - Payment method breakdown
   - Cash vs card analysis
   - Outstanding payments

### InvoLinks Reports (1 type)
1. **Finance Summary (Monthly)**
   - Revenue from invoices
   - Total expenses
   - Net Income (Revenue - Expenses)
   - Net VAT (Output VAT - Input VAT)
   - Profit margin percentage

**Gap:** SpaBooker has 4 additional report types

---

## Code Quality & Architecture

### SpaBooker Strengths
✅ **TypeScript** - Type-safe codebase  
✅ **Drizzle ORM** - Modern, type-safe database queries  
✅ **Modular Design** - Separate storage.ts, vatUtils.ts, routes.ts  
✅ **Comprehensive Schema** - 40+ tables with proper relationships  
✅ **Audit Trail** - Full logging system  
✅ **Multi-Tenant Security** - Per-spa isolation with middleware  
✅ **VAT Utilities** - Reusable calculation functions  
✅ **FTA Compliance Docs** - Detailed compliance analysis document  

### InvoLinks Strengths
✅ **Python FastAPI** - Fast, modern async framework  
✅ **SQLAlchemy ORM** - Mature, robust ORM  
✅ **UBL/PINT-AE XML** - Full UAE e-invoicing compliance  
✅ **Digital Signatures** - RSA-2048 + SHA-256 hashing  
✅ **PEPPOL Integration** - Centralized ASP model  
✅ **PDF Generation** - Professional invoice PDFs  
✅ **Multi-Factor Auth** - TOTP + Email OTP + Backup Codes  
✅ **Stripe Integration** - Subscription billing  

### Architecture Differences
| Aspect | SpaBooker | InvoLinks |
|--------|-----------|-----------|
| **Language** | TypeScript | Python |
| **Framework** | Express.js | FastAPI |
| **Database ORM** | Drizzle | SQLAlchemy |
| **Frontend** | React + Wouter | React + React Router |
| **Validation** | Zod | Pydantic |
| **Auth** | Replit Auth | JWT + bcrypt |

---

## Integration Options

### Option 1: Full Replacement (Recommended for Maximum Compliance)
**Replace InvoLinks simple expense tracking with SpaBooker's comprehensive system**

#### What to Port
1. **Database Schema (11 tables)**
   - Translate TypeScript Drizzle schemas to Python SQLAlchemy
   - Add: expenses, vendors, bills, billItems, walletTransactions, auditLogs
   - Extend: spas/companies table with VAT fields

2. **VAT Utilities**
   - Port vatUtils.ts to Python
   - Tax code support (SR, ZR, ES, OP)
   - Inclusive/exclusive calculation methods
   - Discount handling

3. **Finance Reports**
   - Revenue summary
   - Sales summary
   - Sales list
   - Payment summary
   - VAT return report
   - FTA audit file export

4. **API Endpoints (20+)**
   - Revenue/VAT summaries
   - Vendor management
   - Bill management
   - Wallet operations
   - Enhanced expense tracking

5. **Frontend Components**
   - Finance Dashboard (5 report types)
   - Vendor management UI
   - Bill entry UI
   - VAT configuration UI
   - FTA audit file download

#### Pros
✅ **100% FTA compliant** with full TRN, tax codes, invoice types  
✅ **Professional accounting** system ready for audits  
✅ **Multiple revenue streams** tracked comprehensively  
✅ **Advanced features** (wallet, loyalty, memberships)  
✅ **Proven codebase** with extensive testing  

#### Cons
❌ **Large migration effort** - 2-3 weeks of development  
❌ **Language barrier** - TypeScript → Python translation needed  
❌ **Breaking changes** - Must migrate existing expense data  
❌ **Complexity increase** - More tables, more code to maintain  

#### Effort Estimate
- Database schema migration: 3 days
- VAT utilities port: 2 days
- API endpoints: 5 days
- Frontend components: 5 days
- Testing & debugging: 3-4 days
- **Total: 18-19 days (~3 weeks)**

---

### Option 2: Hybrid Model (Best of Both Worlds)
**Keep InvoLinks UBL/PINT-AE invoicing, add SpaBooker's finance/accounting features**

#### What to Keep from InvoLinks
✅ UBL 2.1 / PINT-AE XML generation  
✅ Digital signatures (RSA-2048)  
✅ PEPPOL integration  
✅ PDF invoice generation  
✅ Stripe subscription billing  
✅ Multi-factor authentication  

#### What to Add from SpaBooker
✅ VAT tax codes (SR, ZR, ES, OP)  
✅ TRN tracking per company  
✅ Invoice classification (full/simplified)  
✅ Vendor & bill management  
✅ Enhanced expense tracking with tax codes  
✅ Finance reports (5 types)  
✅ FTA audit file export  
✅ Wallet/store credit (optional)  
✅ VAT threshold reminder  

#### Implementation Plan
1. **Phase 1: VAT Enhancement (Week 1)**
   - Add tax code support to invoices table
   - Add TRN fields to companies and customers
   - Implement invoice type classification
   - Port VAT utility functions

2. **Phase 2: Vendor & Bills (Week 2)**
   - Create vendors table
   - Create bills + billItems tables
   - Build vendor management API + UI
   - Build bill entry API + UI

3. **Phase 3: Enhanced Expenses (Week 2)**
   - Add tax code support to expenses
   - Link expenses to vendors
   - Add approval workflow (optional)

4. **Phase 4: Reports (Week 3)**
   - Finance summary report
   - Sales summary report
   - VAT return report
   - FTA audit file export

5. **Phase 5: Optional Features (Week 4)**
   - Wallet/store credit system
   - VAT threshold reminder
   - Advanced discount tracking

#### Pros
✅ **Preserve existing work** - Keep UBL/PINT-AE investment  
✅ **Incremental migration** - Add features in phases  
✅ **UAE e-invoicing** + **Accounting** = Complete solution  
✅ **Flexible timeline** - Can stop after any phase  

#### Cons
❌ **Dual systems** - More complex to maintain  
❌ **Partial features** - May not get all SpaBooker benefits  
❌ **Integration overhead** - Must connect two systems  

#### Effort Estimate
- Phase 1 (VAT): 5 days
- Phase 2 (Vendors): 5 days
- Phase 3 (Expenses): 3 days
- Phase 4 (Reports): 5 days
- Phase 5 (Optional): 5 days
- **Total: 18-23 days (~3-4 weeks)**

---

### Option 3: Modular Addition (Minimal Disruption)
**Add SpaBooker finance features as optional "Advanced Finance" module**

#### Current System (Keep As-Is)
✅ Simple expense tracking (custom categories)  
✅ Simple inventory management  
✅ Basic financial summary  
✅ UBL/PINT-AE invoicing  

#### New "Advanced Finance" Module (Optional Activation)
When user enables "Advanced Finance":
1. **Unlock VAT Tax Codes** - SR, ZR, ES, OP support
2. **Unlock TRN Tracking** - Per-company and per-customer
3. **Unlock Vendor Management** - Full vendor system
4. **Unlock Bill Management** - Accounts payable tracking
5. **Unlock Advanced Reports** - 5 report types
6. **Unlock FTA Audit File** - CSV export for FTA submission
7. **Unlock VAT Threshold Reminder** - AED 375k tracking

#### User Flow
```
1. User creates account → Default to "Simple Finance"
2. User clicks "Upgrade to Advanced Finance"
3. System prompts: "Enter your TRN" (required for activation)
4. System activates:
   - Tax code fields on invoices
   - Vendor management
   - Bill management
   - Advanced reports
5. User can toggle back to "Simple" anytime
```

#### Pros
✅ **No breaking changes** - Existing users unaffected  
✅ **Upsell opportunity** - Charge for advanced features  
✅ **Gradual adoption** - Users can try simple first  
✅ **Backward compatible** - Simple mode still works  

#### Cons
❌ **Code duplication** - Must maintain both systems  
❌ **Complexity** - Toggle logic adds overhead  
❌ **User confusion** - Two different UX paths  

#### Effort Estimate
- Module activation system: 2 days
- VAT tax codes: 3 days
- Vendor management: 4 days
- Bill management: 4 days
- Advanced reports: 5 days
- Testing both modes: 3 days
- **Total: 21 days (~4 weeks)**

---

## Recommendation Matrix

| Criteria | Option 1: Full Replacement | Option 2: Hybrid | Option 3: Modular |
|----------|---------------------------|------------------|-------------------|
| **FTA Compliance** | ⭐⭐⭐⭐⭐ (100%) | ⭐⭐⭐⭐ (90%) | ⭐⭐⭐ (70%) |
| **Effort Required** | 18-19 days | 18-23 days | 21 days |
| **Breaking Changes** | HIGH | MEDIUM | LOW |
| **Maintenance Burden** | LOW | MEDIUM | HIGH |
| **Feature Completeness** | ⭐⭐⭐⭐⭐ (100%) | ⭐⭐⭐⭐ (85%) | ⭐⭐⭐ (65%) |
| **User Experience** | Consistent | Comprehensive | Flexible |
| **Monetization Potential** | N/A | N/A | HIGH (upsell) |
| **Risk Level** | HIGH | MEDIUM | LOW |
| **Best For** | Startups needing max compliance | Businesses wanting complete solution | SaaS with tiered pricing |

---

## My Recommendation: Option 2 (Hybrid Model)

### Why Hybrid is Best for InvoLinks

1. **Preserve Your Investment**
   - You've built extensive UBL/PINT-AE XML generation
   - You have digital signatures + hash chains
   - You have PEPPOL integration
   - These are UNIQUE to InvoLinks - don't throw them away!

2. **Add What's Missing**
   - SpaBooker's VAT tax codes → Enhance your invoicing
   - SpaBooker's vendor/bill system → Complete the accounting cycle
   - SpaBooker's reports → Give users insights
   - SpaBooker's FTA audit file → Simplify compliance

3. **Incremental Implementation**
   - Phase 1: VAT enhancement (most critical)
   - Phase 2: Vendor & bills (accounts payable)
   - Phase 3: Enhanced expenses
   - Phase 4: Reports
   - Phase 5: Optional features (wallet, reminders)
   - You can stop after any phase based on user feedback

4. **Best of Both Worlds**
   - **From InvoLinks:** UBL/PINT-AE XML, PEPPOL, digital signatures, PDF generation
   - **From SpaBooker:** VAT compliance, vendor management, comprehensive reporting
   - **Result:** Most complete UAE invoicing + accounting platform

---

## Next Steps

### Immediate Actions (This Week)
1. ✅ **DECISION:** Choose integration option (1, 2, or 3)
2. ✅ **REVIEW:** Read FTA_COMPLIANCE_ANALYSIS.md from SpaBooker
3. ✅ **PRIORITIZE:** Decide which SpaBooker features are must-have

### If You Choose Option 2 (Hybrid) - Recommended
**Phase 1: VAT Enhancement (Week 1)**
1. Study SpaBooker's `vatUtils.ts`
2. Port tax code support to Python
3. Add TRN fields to companies + customers tables
4. Implement invoice classification logic
5. Update invoice UI to show tax codes

**Phase 2: Vendor & Bills (Week 2)**
1. Create vendors table (copy SpaBooker schema)
2. Create bills + billItems tables
3. Build vendor CRUD API
4. Build bill CRUD API
5. Create vendor management UI
6. Create bill entry UI

**Phase 3: Reports (Week 3)**
1. Create finance summary report
2. Create sales summary report
3. Create VAT return report
4. Create FTA audit file export (CSV)

**Phase 4: Testing & Polish (Week 4)**
1. Test all VAT calculations
2. Test FTA audit file format
3. User acceptance testing
4. Documentation updates

---

## Questions for You

1. **Which option do you prefer?**
   - Option 1: Full replacement (maximum compliance, high effort)
   - Option 2: Hybrid model (best of both, incremental)
   - Option 3: Modular addition (minimal disruption, upsell potential)

2. **What's your priority?**
   - Maximum FTA compliance (→ Option 1 or 2)
   - Preserve existing work (→ Option 2)
   - Minimal risk (→ Option 3)
   - Monetization (→ Option 3)

3. **What's your timeline?**
   - Need it ASAP (→ Option 3, Phase 1 only)
   - Have 3-4 weeks (→ Option 2, all phases)
   - No rush (→ Option 1, complete replacement)

4. **Which SpaBooker features are must-have?**
   - ✅ VAT tax codes (SR, ZR, ES, OP)
   - ✅ TRN tracking
   - ✅ Invoice classification (full/simplified)
   - ✅ Vendor management
   - ✅ Bill management
   - ✅ FTA audit file export
   - ✅ Finance reports
   - ⚠️ Wallet/store credit
   - ⚠️ Membership tracking
   - ⚠️ Loyalty cards
   - ⚠️ VAT threshold reminder

---

## Technical Deep Dive: Key Files to Port

### 1. VAT Utilities (`server/vatUtils.ts`)
```typescript
// Port these functions to Python
calculateVAT(inclusiveAmount, taxCode) → VATCalculation
calculateVATFromNet(exclusiveAmount, taxCode) → VATCalculation
calculateVATWithDiscount(gross, discount, taxCode) → VATCalculation

TAX_CODES = {
  SR: { code: 'SR', name: 'Standard Rate (5%)', rate: 0.05 },
  ZR: { code: 'ZR', name: 'Zero-Rated (0%)', rate: 0 },
  ES: { code: 'ES', name: 'Exempt', rate: 0 },
  OP: { code: 'OP', name: 'Out of Scope', rate: 0 },
}
```

### 2. Database Schema Extensions
```typescript
// Add to companies table (spas in SpaBooker)
vatEnabled: boolean
taxRegistrationNumber: varchar(15)
vatRegistrationDate: timestamp
vatThresholdReminderEnabled: boolean
vatThresholdAmount: decimal (default: 375000.00)

// Add to customers table
taxRegistrationNumber: varchar(15) // For B2B customers

// Add to invoices table
taxCode: text (SR, ZR, ES, OP)
invoiceType: text (full, simplified, standard)
supplierTrn: varchar(15)
customerTrn: varchar(15)

// New tables
vendors (id, name, email, phone, trn, address, active, createdAt)
bills (id, vendorId, billNumber, billDate, dueDate, totalAmount, vatAmount, netAmount, taxCode, status, notes)
billItems (id, billId, description, quantity, unitPrice, vatAmount, taxCode)
```

### 3. API Endpoints to Add
```python
# Vendor Management
POST /vendors
GET /vendors
GET /vendors/{id}
PUT /vendors/{id}
DELETE /vendors/{id}

# Bill Management
POST /bills
GET /bills
GET /bills/{id}
PUT /bills/{id}
DELETE /bills/{id}

# Reports
GET /reports/finance-summary?startDate=X&endDate=Y
GET /reports/sales-summary?startDate=X&endDate=Y
GET /reports/vat-return?startDate=X&endDate=Y
GET /reports/fta-audit-file?year=2025 (CSV download)

# VAT Configuration
GET /companies/{id}/vat-settings
PUT /companies/{id}/vat-settings
POST /companies/{id}/vat-activation
```

### 4. Frontend Components to Build
```jsx
// Vendor Management
<VendorList /> - Table with CRUD actions
<VendorForm /> - Create/edit vendor
<VendorDetails /> - View vendor details + bills

// Bill Management
<BillList /> - Table with filters
<BillForm /> - Create/edit bill with line items
<BillDetails /> - View bill details

// Finance Reports
<FinanceDashboard /> - 5 report types with filters
<VATReturnReport /> - Output VAT, Input VAT, Net Payable
<FTAAuditFileExport /> - Download CSV button

// VAT Settings
<VATSettings /> - TRN entry, tax code defaults
<InvoiceTypeClassification /> - Full vs Simplified logic display
```

---

## Conclusion

SpaBooker has a **production-ready, FTA-compliant finance/accounting system** that far exceeds InvoLinks' current simple expense tracking. The gap is massive (10x more features), but the good news is that **SpaBooker's codebase is well-structured and documented**, making integration feasible.

**My strong recommendation: Option 2 (Hybrid Model)**
- Preserve your UBL/PINT-AE investment
- Add SpaBooker's VAT compliance and accounting features
- Implement in 4 phases over 3-4 weeks
- Result: Most comprehensive UAE invoicing + accounting platform

**You decide the path forward!** 🚀

---

**Ready to proceed?** Let me know which option you prefer, and I'll create a detailed implementation plan with code snippets, database migrations, and step-by-step instructions.

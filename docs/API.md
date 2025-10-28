# InvoLinks API Documentation

**Version:** 1.0  
**Base URL:** `http://localhost:8000` (Development) | `https://api.involinks.ae` (Production)  
**Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Authentication](#authentication)
2. [Invoices](#invoices)
3. [Accounts Payable](#accounts-payable)
4. [Company Management](#company-management)
5. [SuperAdmin](#superadmin)
6. [Bulk Import](#bulk-import)
7. [Content Management](#content-management)
8. [Error Handling](#error-handling)

---

## Authentication

All API endpoints except `/auth/*` and `/content/public` require authentication via JWT Bearer token.

### Header Format
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### POST `/auth/register`

Register a new company and admin user.

**Request:**
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acmecorp.ae",
    "password": "SecurePass123!",
    "company_name": "ACME Trading LLC",
    "legal_name": "ACME Trading LLC",
    "trn": "123456789012345"
  }'
```

**Response:** `201 Created`
```json
{
  "message": "Registration successful! Please verify your email.",
  "company_id": "comp_abc123",
  "user_id": "user_xyz789",
  "email": "admin@acmecorp.ae",
  "verification_sent": true
}
```

**Validation:**
- `email`: Valid email format
- `password`: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
- `trn`: Exactly 15 numeric digits

---

### POST `/auth/login`

Authenticate user and receive JWT token.

**Request:**
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acmecorp.ae",
    "password": "SecurePass123!"
  }'
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX3h5ejc4OSIsImVtYWlsIjoiYWRtaW5AYWNtZWNvcnAuYWUiLCJyb2xlIjoiQURNSU4iLCJjb21wYW55X2lkIjoiY29tcF9hYmMxMjMiLCJleHAiOjE2OTg3OTY4MDAsImlhdCI6MTY5ODcxMDQwMH0.signature",
  "token_type": "bearer",
  "user": {
    "id": "user_xyz789",
    "email": "admin@acmecorp.ae",
    "role": "COMPANY_ADMIN",
    "company_id": "comp_abc123"
  }
}
```

**Error Response:** `401 Unauthorized`
```json
{
  "detail": "Invalid credentials"
}
```

---

### POST `/auth/forgot-password`

Request password reset token.

**Request:**
```bash
curl -X POST http://localhost:8000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acmecorp.ae"
  }'
```

**Response:** `200 OK`
```json
{
  "message": "Password reset link sent to admin@acmecorp.ae",
  "email": "admin@acmecorp.ae",
  "reset_link": "http://localhost:5000/reset-password?token=abc123xyz..."
}
```

**Notes:**
- Reset token valid for 1 hour
- Token is one-time use only
- In production, sends email instead of returning link

---

### POST `/auth/reset-password`

Reset password using token from email.

**Request:**
```bash
curl -X POST http://localhost:8000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123xyz...",
    "new_password": "NewSecurePass456!"
  }'
```

**Response:** `200 OK`
```json
{
  "message": "Password reset successful",
  "email": "admin@acmecorp.ae"
}
```

**Error Response:** `400 Bad Request`
```json
{
  "detail": "Invalid or expired reset token"
}
```

---

## Invoices

### POST `/invoices`

Create a new draft invoice.

**Request:**
```bash
curl -X POST http://localhost:8000/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_type": "Tax Invoice",
    "customer_trn": "987654321098765",
    "customer_name": "Client Corporation LLC",
    "customer_email": "client@corp.ae",
    "customer_address": "Business Bay, Dubai, UAE",
    "customer_city": "Dubai",
    "customer_country": "AE",
    "customer_peppol_id": "0191:987654321098765",
    "issue_date": "2025-10-28",
    "due_date": "2025-11-28",
    "currency_code": "AED",
    "payment_terms": "Net 30 days",
    "payment_due_days": 30,
    "invoice_notes": "Thank you for your business!",
    "reference_number": "PO-2025-001",
    "line_items": [
      {
        "item_name": "Professional Consulting Services",
        "item_description": "Strategy consulting for Q4 2025",
        "item_code": "CONS-001",
        "quantity": 10,
        "unit_code": "HUR",
        "unit_price": 500.00,
        "tax_category": "S",
        "tax_percent": 5.0,
        "discount_percent": 0
      },
      {
        "item_name": "Software License",
        "item_description": "Annual enterprise license",
        "item_code": "LIC-002",
        "quantity": 1,
        "unit_code": "EA",
        "unit_price": 2000.00,
        "tax_category": "S",
        "tax_percent": 5.0,
        "discount_percent": 10
      }
    ]
  }'
```

**Response:** `201 Created`
```json
{
  "id": "inv_abc123def456",
  "invoice_number": "INV-COMP-00001",
  "status": "DRAFT",
  "issue_date": "2025-10-28",
  "due_date": "2025-11-28",
  "currency_code": "AED",
  "subtotal_amount": 6800.00,
  "tax_amount": 340.00,
  "total_amount": 7140.00,
  "amount_due": 7140.00,
  "line_items": [
    {
      "id": "line_001",
      "line_number": 1,
      "item_name": "Professional Consulting Services",
      "quantity": 10,
      "unit_price": 500.00,
      "line_total": 5000.00,
      "tax_amount": 250.00
    },
    {
      "id": "line_002",
      "line_number": 2,
      "item_name": "Software License",
      "quantity": 1,
      "unit_price": 2000.00,
      "line_total": 1800.00,
      "tax_amount": 90.00
    }
  ],
  "created_at": "2025-10-28T10:30:00Z"
}
```

**Validation:**
- `invoice_type`: Must be "Tax Invoice", "Credit Note", or "Commercial Invoice"
- `customer_trn`: 15 digits (optional for B2C)
- `issue_date`: Cannot be future date
- `due_date`: Must be >= issue_date
- `line_items`: At least 1 required
- `tax_percent`: 0.0, 5.0, or exempt categories only

---

### GET `/invoices`

List all invoices with optional filters.

**Request:**
```bash
curl -X GET "http://localhost:8000/invoices?status=ISSUED&limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters:**
- `status`: Filter by status (DRAFT, ISSUED, SENT, VIEWED, PAID, CANCELLED, OVERDUE)
- `invoice_type`: Filter by type (Tax Invoice, Credit Note, Commercial Invoice)
- `from_date`: Filter invoices issued after this date (YYYY-MM-DD)
- `to_date`: Filter invoices issued before this date (YYYY-MM-DD)
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

**Response:** `200 OK`
```json
{
  "invoices": [
    {
      "id": "inv_abc123",
      "invoice_number": "INV-COMP-00001",
      "status": "ISSUED",
      "issue_date": "2025-10-28",
      "customer_name": "Client Corporation LLC",
      "total_amount": 7140.00,
      "currency_code": "AED",
      "created_at": "2025-10-28T10:30:00Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

### GET `/invoices/{invoice_id}`

Get detailed invoice information including line items and UBL XML.

**Request:**
```bash
curl -X GET http://localhost:8000/invoices/inv_abc123 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "id": "inv_abc123",
  "company_id": "comp_xyz789",
  "invoice_number": "INV-COMP-00001",
  "invoice_type": "Tax Invoice",
  "status": "ISSUED",
  "issue_date": "2025-10-28",
  "due_date": "2025-11-28",
  "currency_code": "AED",
  
  "supplier": {
    "trn": "123456789012345",
    "name": "ACME Trading LLC",
    "address": "Business Bay, Dubai, UAE",
    "city": "Dubai",
    "country": "AE",
    "peppol_id": "0191:123456789012345"
  },
  
  "customer": {
    "trn": "987654321098765",
    "name": "Client Corporation LLC",
    "email": "client@corp.ae",
    "address": "Business Bay, Dubai, UAE",
    "city": "Dubai",
    "country": "AE",
    "peppol_id": "0191:987654321098765"
  },
  
  "amounts": {
    "subtotal": 6800.00,
    "tax": 340.00,
    "total": 7140.00,
    "amount_due": 7140.00
  },
  
  "line_items": [...],
  
  "compliance": {
    "xml_hash": "sha256:abc123...",
    "signature": "base64:xyz789...",
    "signing_cert_serial": "prod-cert-001",
    "signing_timestamp": "2025-10-28T11:00:00Z",
    "prev_invoice_hash": "sha256:def456..."
  },
  
  "peppol": {
    "message_id": "PEPPOL-MSG-001",
    "status": "DELIVERED",
    "provider": "tradeshift",
    "sent_at": "2025-10-28T11:05:00Z"
  },
  
  "ubl_xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>...",
  
  "created_at": "2025-10-28T10:30:00Z",
  "updated_at": "2025-10-28T11:00:00Z"
}
```

---

### POST `/invoices/{invoice_id}/finalize`

Finalize invoice (generate hash, signature, UBL XML).

**Request:**
```bash
curl -X POST http://localhost:8000/invoices/inv_abc123/finalize \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "message": "Invoice finalized and issued successfully",
  "invoice_id": "inv_abc123",
  "invoice_number": "INV-COMP-00001",
  "status": "ISSUED",
  "xml_hash": "sha256:abc123...",
  "signature": "base64:xyz789...",
  "prev_invoice_hash": "sha256:def456...",
  "xml_file_path": "artifacts/invoices/comp_xyz789/inv_abc123.xml"
}
```

**Notes:**
- Changes status from DRAFT → ISSUED
- Generates UBL 2.1 XML file
- Computes SHA-256 hash of invoice data
- Creates RSA-2048 digital signature
- Links to previous invoice in hash chain
- Invoice is ready for sending after this step

---

### POST `/invoices/{invoice_id}/send`

Send invoice via PEPPOL network.

**Request:**
```bash
curl -X POST http://localhost:8000/invoices/inv_abc123/send \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "message": "Invoice sent via PEPPOL",
  "invoice_id": "inv_abc123",
  "invoice_number": "INV-COMP-00001",
  "peppol_message_id": "TSHIFT-MSG-20251028-001",
  "peppol_status": "SENT",
  "peppol_provider": "tradeshift",
  "sent_at": "2025-10-28T11:05:00Z",
  "recipient": {
    "peppol_id": "0191:987654321098765",
    "name": "Client Corporation LLC"
  }
}
```

**Requirements:**
- Invoice must be ISSUED status
- Customer must have valid PEPPOL ID
- PEPPOL provider must be configured

---

### GET `/invoices/{invoice_id}/verify`

Verify invoice integrity (hash and signature).

**Request:**
```bash
curl -X GET http://localhost:8000/invoices/inv_abc123/verify \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "invoice_id": "inv_abc123",
  "invoice_number": "INV-COMP-00001",
  "verification": {
    "hash_valid": true,
    "signature_valid": true,
    "chain_valid": true,
    "xml_hash_valid": true
  },
  "details": {
    "computed_hash": "sha256:abc123...",
    "stored_hash": "sha256:abc123...",
    "prev_invoice_hash": "sha256:def456...",
    "signing_cert_serial": "prod-cert-001",
    "signing_timestamp": "2025-10-28T11:00:00Z"
  },
  "status": "VERIFIED"
}
```

**Verification Steps:**
1. Recompute invoice hash
2. Compare with stored hash
3. Verify digital signature with public key
4. Validate hash chain link to previous invoice
5. Verify XML hash matches stored value

---

### DELETE `/invoices/{invoice_id}`

Cancel/delete an invoice.

**Request:**
```bash
curl -X DELETE http://localhost:8000/invoices/inv_abc123 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "message": "Invoice cancelled successfully",
  "invoice_id": "inv_abc123",
  "invoice_number": "INV-COMP-00001",
  "status": "CANCELLED"
}
```

**Notes:**
- DRAFT invoices: Soft delete (status → CANCELLED)
- ISSUED/SENT/VIEWED/PAID: Cannot delete (create Credit Note instead)

---

## Accounts Payable

### POST `/purchase-orders`

Create a new purchase order.

**Request:**
```bash
curl -X POST http://localhost:8000/purchase-orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "po_number": "PO-2025-001",
    "supplier_trn": "555666777888999",
    "supplier_name": "Supplier Inc",
    "supplier_contact_email": "supplier@inc.ae",
    "supplier_address": "Industrial Area, Sharjah, UAE",
    "supplier_peppol_id": "0191:555666777888999",
    "order_date": "2025-10-28",
    "expected_delivery_date": "2025-11-15",
    "delivery_address": "Warehouse 5, Dubai Industrial City",
    "currency_code": "AED",
    "reference_number": "REQ-2025-100",
    "notes": "Urgent order - please expedite",
    "line_items": [
      {
        "item_name": "Widget A",
        "item_description": "High-quality widget",
        "item_code": "WID-A-001",
        "quantity_ordered": 100,
        "unit_code": "EA",
        "unit_price": 25.00,
        "tax_category": "S",
        "tax_percent": 5.0
      }
    ]
  }'
```

**Response:** `201 Created`
```json
{
  "id": "po_xyz123",
  "po_number": "PO-2025-001",
  "status": "DRAFT",
  "supplier_name": "Supplier Inc",
  "order_date": "2025-10-28",
  "expected_delivery_date": "2025-11-15",
  "expected_subtotal": 2500.00,
  "expected_tax": 125.00,
  "expected_total": 2625.00,
  "line_items": [...]
}
```

---

### GET `/purchase-orders`

List all purchase orders.

**Request:**
```bash
curl -X GET "http://localhost:8000/purchase-orders?status=SENT&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "purchase_orders": [
    {
      "id": "po_xyz123",
      "po_number": "PO-2025-001",
      "status": "SENT",
      "supplier_name": "Supplier Inc",
      "expected_total": 2625.00,
      "order_date": "2025-10-28",
      "expected_delivery_date": "2025-11-15"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### POST `/purchase-orders/{po_id}/send`

Send purchase order to supplier.

**Request:**
```bash
curl -X POST http://localhost:8000/purchase-orders/po_xyz123/send \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "message": "Purchase order sent to supplier",
  "po_id": "po_xyz123",
  "po_number": "PO-2025-001",
  "status": "SENT",
  "supplier_email": "supplier@inc.ae"
}
```

---

### POST `/goods-receipts`

Record goods receipt.

**Request:**
```bash
curl -X POST http://localhost:8000/goods-receipts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "po_id": "po_xyz123",
    "grn_number": "GRN-2025-001",
    "receipt_date": "2025-11-15",
    "supplier_delivery_note": "DN-12345",
    "notes": "All items received in good condition",
    "line_items": [
      {
        "po_line_item_id": "poli_001",
        "quantity_received": 100,
        "quantity_accepted": 100,
        "quantity_rejected": 0,
        "rejection_reason": null
      }
    ]
  }'
```

**Response:** `201 Created`
```json
{
  "id": "grn_abc456",
  "grn_number": "GRN-2025-001",
  "po_id": "po_xyz123",
  "status": "RECEIVED",
  "receipt_date": "2025-11-15",
  "total_quantity_received": 100,
  "line_items": [...]
}
```

---

### POST `/inward-invoices/receive`

Receive invoice from supplier.

**Request:**
```bash
curl -X POST http://localhost:8000/inward-invoices/receive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_invoice_number": "SI-2025-500",
    "supplier_trn": "555666777888999",
    "supplier_name": "Supplier Inc",
    "supplier_email": "supplier@inc.ae",
    "supplier_peppol_id": "0191:555666777888999",
    "customer_trn": "123456789012345",
    "customer_name": "ACME Trading LLC",
    "invoice_date": "2025-11-15",
    "due_date": "2025-12-15",
    "currency_code": "AED",
    "subtotal_amount": 2500.00,
    "tax_amount": 125.00,
    "total_amount": 2625.00,
    "xml_content": "<?xml version=\"1.0\"?>...",
    "line_items": [
      {
        "line_number": 1,
        "item_name": "Widget A",
        "item_code": "WID-A-001",
        "quantity": 100,
        "unit_price": 25.00,
        "tax_percent": 5.0
      }
    ]
  }'
```

**Response:** `201 Created`
```json
{
  "id": "inw_inv_789",
  "supplier_invoice_number": "SI-2025-500",
  "supplier_name": "Supplier Inc",
  "total_amount": 2625.00,
  "matching_status": "FULL_MATCH",
  "po_id": "po_xyz123",
  "grn_id": "grn_abc456",
  "amount_variance": 0.00,
  "approval_status": "PENDING",
  "payment_status": "UNPAID"
}
```

**Notes:**
- Automatically attempts 3-way matching
- `FULL_MATCH`: variance < 0.01 AED
- `VARIANCE_DETECTED`: variance < 5%
- `PARTIAL_MATCH`: variance >= 5%
- `NOT_MATCHED`: no matching PO found

---

### GET `/inward-invoices/{invoice_id}/match`

Get 3-way matching details.

**Request:**
```bash
curl -X GET http://localhost:8000/inward-invoices/inw_inv_789/match \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "invoice_id": "inw_inv_789",
  "matching_status": "FULL_MATCH",
  "matching_details": {
    "po": {
      "id": "po_xyz123",
      "po_number": "PO-2025-001",
      "expected_total": 2625.00
    },
    "grn": {
      "id": "grn_abc456",
      "grn_number": "GRN-2025-001",
      "quantity_received": 100
    },
    "invoice": {
      "total_amount": 2625.00,
      "quantity": 100
    },
    "variance": {
      "amount_variance": 0.00,
      "quantity_variance": 0,
      "percentage_variance": 0.00
    }
  },
  "approval_required": false
}
```

---

## Company Management

### GET `/company/profile`

Get company profile.

**Request:**
```bash
curl -X GET http://localhost:8000/company/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "id": "comp_xyz789",
  "legal_name": "ACME Trading LLC",
  "trn": "123456789012345",
  "status": "ACTIVE",
  "email": "admin@acmecorp.ae",
  "phone": "+971501234567",
  "address": {
    "line1": "Office 501, Business Tower",
    "line2": "Business Bay",
    "city": "Dubai",
    "emirate": "Dubai",
    "po_box": "12345"
  },
  "subscription": {
    "plan": "Pro",
    "status": "ACTIVE",
    "billing_cycle": "monthly",
    "current_period_end": "2025-11-28"
  },
  "stats": {
    "total_invoices": 150,
    "invoices_this_month": 12,
    "total_revenue": 350000.00
  }
}
```

---

### PUT `/company/profile`

Update company profile.

**Request:**
```bash
curl -X PUT http://localhost:8000/company/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+971501234567",
    "website": "https://acmecorp.ae",
    "address_line1": "Office 501, Business Tower",
    "city": "Dubai",
    "emirate": "Dubai"
  }'
```

**Response:** `200 OK`
```json
{
  "message": "Company profile updated successfully",
  "company": {...}
}
```

---

### POST `/company/branding/upload`

Upload company logo or stamp.

**Request:**
```bash
curl -X POST http://localhost:8000/company/branding/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@logo.png" \
  -F "asset_type=logo"
```

**Response:** `200 OK`
```json
{
  "message": "Logo uploaded successfully",
  "asset_type": "logo",
  "file_name": "logo_1698710400.png",
  "file_size": 125840,
  "mime_type": "image/png",
  "url": "/artifacts/company_assets/comp_xyz789/logo_1698710400.png"
}
```

**Allowed Types:**
- Images: PNG, JPG, JPEG
- Max Size: 5 MB
- `asset_type`: "logo" or "stamp"

---

## SuperAdmin

### GET `/admin/companies`

List all companies (SuperAdmin only).

**Request:**
```bash
curl -X GET "http://localhost:8000/admin/companies?status=ACTIVE&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "companies": [
    {
      "id": "comp_001",
      "legal_name": "Company A LLC",
      "trn": "111222333444555",
      "status": "ACTIVE",
      "email": "admin@companya.ae",
      "created_at": "2025-01-15T10:00:00Z",
      "subscription_plan": "Pro",
      "total_invoices": 245
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### PUT `/admin/companies/{company_id}/approve`

Approve company registration (SuperAdmin only).

**Request:**
```bash
curl -X PUT http://localhost:8000/admin/companies/comp_001/approve \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "message": "Company approved successfully",
  "company_id": "comp_001",
  "legal_name": "Company A LLC",
  "status": "ACTIVE",
  "approved_at": "2025-10-28T12:00:00Z"
}
```

---

### GET `/admin/analytics/overview`

Platform-wide analytics (SuperAdmin only).

**Request:**
```bash
curl -X GET http://localhost:8000/admin/analytics/overview \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "total_companies": 125,
  "active_companies": 98,
  "pending_companies": 12,
  "suspended_companies": 5,
  "total_invoices": 45678,
  "invoices_this_month": 3245,
  "total_revenue": 12500000.00,
  "revenue_this_month": 875000.00,
  "subscription_distribution": {
    "Free": 45,
    "Pro": 60,
    "Enterprise": 20
  },
  "top_companies": [
    {
      "company_name": "Top Corp LLC",
      "invoice_count": 1500,
      "total_revenue": 2500000.00
    }
  ]
}
```

---

### GET `/admin/content`

List all CMS content blocks (SuperAdmin only).

**Request:**
```bash
curl -X GET http://localhost:8000/admin/content \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** `200 OK`
```json
{
  "content_blocks": [
    {
      "key": "homepage_hero_title",
      "value": "Digital Invoicing for UAE Businesses",
      "description": "Homepage hero section main title",
      "section": "homepage",
      "updated_at": "2025-10-28T10:00:00Z",
      "updated_by": "superadmin@involinks.ae"
    }
  ],
  "total": 14
}
```

---

### PUT `/admin/content/{key}`

Update content block (SuperAdmin only).

**Request:**
```bash
curl -X PUT http://localhost:8000/admin/content/homepage_hero_title \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "FTA-Compliant Digital Invoicing for UAE"
  }'
```

**Response:** `200 OK`
```json
{
  "message": "Content updated successfully",
  "key": "homepage_hero_title",
  "value": "FTA-Compliant Digital Invoicing for UAE",
  "updated_at": "2025-10-28T12:30:00Z",
  "updated_by": "superadmin@involinks.ae"
}
```

---

## Bulk Import

### POST `/invoices/bulk-import`

Bulk import invoices from CSV/Excel.

**Request:**
```bash
curl -X POST http://localhost:8000/invoices/bulk-import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@invoices.csv"
```

**Response:** `200 OK`
```json
{
  "success": true,
  "total_rows": 50,
  "valid_rows": 48,
  "created": 48,
  "errors": [
    {
      "row": 5,
      "field": "customer_trn",
      "error": "TRN must be exactly 15 numeric digits"
    },
    {
      "row": 12,
      "field": "issue_date",
      "error": "Date must be in YYYY-MM-DD format"
    }
  ],
  "message": "Successfully imported 48 invoices with 2 errors"
}
```

**CSV Format:**
```csv
customer_trn,customer_name,customer_email,issue_date,due_date,item_name,quantity,unit_price,tax_percent
123456789012345,Client A,client@a.ae,2025-10-28,2025-11-28,Service A,10,500.00,5.0
987654321098765,Client B,client@b.ae,2025-10-28,2025-11-28,Product B,5,1000.00,5.0
```

---

### GET `/invoices/bulk-import/template`

Download CSV/Excel template.

**Request:**
```bash
curl -X GET "http://localhost:8000/invoices/bulk-import/template?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o invoice_template.csv
```

**Query Parameters:**
- `format`: "csv" or "excel" (default: "csv")

**Response:** `200 OK`
- Content-Type: `text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File download with proper headers

---

## Content Management

### GET `/content/public`

Get all public content blocks (no authentication required).

**Request:**
```bash
curl -X GET http://localhost:8000/content/public
```

**Response:** `200 OK`
```json
{
  "content": {
    "homepage_hero_title": "Digital Invoicing for UAE Businesses",
    "homepage_hero_subtitle": "FTA-compliant e-invoicing platform",
    "feature_box_1_title": "UAE VAT Compliance",
    "feature_box_1_description": "Automatic 5% VAT calculation...",
    "feature_box_2_title": "PEPPOL Integration",
    "feature_box_2_description": "Send invoices electronically..."
  }
}
```

**Notes:**
- Used by frontend to load dynamic content
- Cached for performance
- No authentication required

---

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "detail": "Error message describing what went wrong",
  "status_code": 400,
  "error_type": "ValidationError"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET/PUT/DELETE |
| `201` | Created | Successful POST (resource created) |
| `400` | Bad Request | Invalid input data |
| `401` | Unauthorized | Missing or invalid auth token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate resource (e.g., TRN already exists) |
| `422` | Unprocessable Entity | Validation failed |
| `500` | Internal Server Error | Server-side error |

### Common Error Examples

**Invalid TRN:**
```json
{
  "detail": "TRN must be exactly 15 numeric digits",
  "status_code": 400,
  "error_type": "ValidationError"
}
```

**Unauthorized:**
```json
{
  "detail": "Invalid or expired token",
  "status_code": 401,
  "error_type": "AuthenticationError"
}
```

**Resource Not Found:**
```json
{
  "detail": "Invoice not found",
  "status_code": 404,
  "error_type": "NotFoundError"
}
```

**Subscription Limit Reached:**
```json
{
  "detail": "Invoice limit reached for free plan. Please upgrade your subscription.",
  "status_code": 403,
  "error_type": "SubscriptionLimitError"
}
```

---

## Rate Limiting

**Current Implementation:** None (planned for future)

**Planned Limits:**
- Free Plan: 60 requests/minute
- Pro Plan: 300 requests/minute
- Enterprise: 1000 requests/minute
- SuperAdmin: Unlimited

---

## Versioning

**Current Version:** `v1`  
**Base Path:** `/` (no version prefix yet)

**Future Versioning:**
- `/api/v1/*` - Current stable API
- `/api/v2/*` - Next generation (when introduced)
- Backward compatibility maintained for 12 months after new version release

---

## OpenAPI/Swagger Documentation

Interactive API documentation available at:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

These provide:
- Interactive API testing
- Request/response examples
- Schema definitions
- Authentication testing

---

## Testing Credentials

### SuperAdmin
```
Email: nrashidk@gmail.com
Password: Admin@123
```

### Test Business
```
Email: testuser@involinks.ae
Password: SecurePass123!@#
TRN: 123456789012345
```

---

## Support

For API support and questions:
- **Email:** developers@involinks.ae
- **Documentation:** https://docs.involinks.ae
- **Status Page:** https://status.involinks.ae

---

**Last Updated:** October 28, 2025  
**API Version:** 1.0  
**Maintained By:** InvoLinks Development Team

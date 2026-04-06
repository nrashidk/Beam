-- 001_init_neon.sql
-- Migration: create enums and tables for InvoLinks (Neon/Postgres)
-- NOTE: ids are varchar/text to match SQLAlchemy String primary keys.

-- ------------------------------
-- ENUM TYPES
-- ------------------------------
DO $$ BEGIN
    CREATE TYPE role_t AS ENUM ('SUPER_ADMIN','COMPANY_ADMIN','BUSINESS_ADMIN','FINANCE_USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE company_status_t AS ENUM ('PENDING_REVIEW','ACTIVE','SUSPENDED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status_t AS ENUM ('TRIAL','ACTIVE','PAST_DUE','CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE document_type_t AS ENUM ('BUSINESS_LICENSE','TRN_CERTIFICATE','TRADE_LICENSE','PASSPORT','EMIRATES_ID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE document_status_t AS ENUM ('PENDING_REVIEW','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_type_t AS ENUM ('380','381','480','81');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status_t AS ENUM ('DRAFT','ISSUED','SENT','VIEWED','PAID','CANCELLED','OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tax_category_t AS ENUM ('S','Z','E','O');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE purchase_order_status_t AS ENUM ('DRAFT','SENT','ACKNOWLEDGED','FULFILLED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE goods_receipt_status_t AS ENUM ('PENDING','RECEIVED','PARTIAL','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inward_invoice_status_t AS ENUM ('RECEIVED','PENDING_REVIEW','MATCHED','APPROVED','REJECTED','PAID','DISPUTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE matching_status_t AS ENUM ('NOT_MATCHED','PARTIAL_MATCH','FULL_MATCH','VARIANCE_DETECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE audit_file_status_t AS ENUM ('GENERATING','COMPLETED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------
-- TABLES
-- ------------------------------

-- users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role role_t NOT NULL,
    company_id TEXT REFERENCES companies (id) ON DELETE CASCADE,
    is_owner BOOLEAN DEFAULT FALSE,
    full_name TEXT,
    invited_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITHOUT TIME ZONE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_method TEXT,
    mfa_secret TEXT,
    mfa_backup_codes TEXT,
    mfa_enrolled_at TIMESTAMP WITHOUT TIME ZONE,
    mfa_last_verified_at TIMESTAMP WITHOUT TIME ZONE
);

-- companies
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    legal_name TEXT,
    country TEXT DEFAULT 'AE',
    status company_status_t DEFAULT 'PENDING_REVIEW',
    trn TEXT,
    vat_enabled BOOLEAN DEFAULT FALSE,
    vat_registration_date DATE,
    vat_certificate_path TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_method TEXT,
    mfa_secret TEXT,
    mfa_backup_codes TEXT,
    mfa_enrolled_at TIMESTAMP WITHOUT TIME ZONE,
    mfa_last_verified_at TIMESTAMP WITHOUT TIME ZONE,
    business_type TEXT,
    business_activity TEXT,
    registration_number TEXT,
    registration_date DATE,
    email TEXT,
    phone TEXT,
    website TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    emirate TEXT,
    po_box TEXT,
    authorized_person_name TEXT,
    authorized_person_title TEXT,
    authorized_person_email TEXT,
    authorized_person_phone TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_sent_at TIMESTAMP WITHOUT TIME ZONE,
    password_hash TEXT,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP WITHOUT TIME ZONE,
    free_plan_type TEXT,
    free_plan_duration_months INTEGER,
    free_plan_invoice_limit INTEGER,
    free_plan_start_date TIMESTAMP WITHOUT TIME ZONE,
    invoices_generated INTEGER DEFAULT 0,
    subscription_plan_id TEXT REFERENCES subscription_plans (id) ON DELETE SET NULL,
    trial_status TEXT DEFAULT 'ACTIVE',
    trial_start_date TIMESTAMP WITHOUT TIME ZONE,
    trial_invoice_count INTEGER DEFAULT 0,
    trial_ended_at TIMESTAMP WITHOUT TIME ZONE,
    stripe_customer_id TEXT UNIQUE,
    peppol_enabled BOOLEAN DEFAULT FALSE,
    peppol_provider TEXT,
    peppol_participant_id TEXT,
    peppol_base_url TEXT,
    peppol_api_key TEXT,
    peppol_configured_at TIMESTAMP WITHOUT TIME ZONE,
    peppol_last_tested_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    rejected_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_companies_trn ON companies (trn);

-- subscription_plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly DOUBLE PRECISION DEFAULT 0.0,
    price_yearly DOUBLE PRECISION DEFAULT 0.0,
    max_invoices_per_month INTEGER,
    max_users INTEGER DEFAULT 1,
    max_business_admins INTEGER DEFAULT 0,
    max_finance_users INTEGER DEFAULT 1,
    max_pos_devices INTEGER DEFAULT 0,
    allow_api_access BOOLEAN DEFAULT TRUE,
    allow_branding BOOLEAN DEFAULT FALSE,
    allow_multi_currency BOOLEAN DEFAULT FALSE,
    priority_support BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- company_subscriptions
CREATE TABLE IF NOT EXISTS company_subscriptions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans (id) ON DELETE CASCADE,
    status subscription_status_t DEFAULT 'TRIAL',
    billing_cycle TEXT DEFAULT 'monthly',
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    invoices_this_period INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_subs_company ON company_subscriptions (company_id);

-- company_documents
CREATE TABLE IF NOT EXISTS company_documents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    document_type document_type_t NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    status document_status_t DEFAULT 'PENDING_REVIEW',
    issue_date DATE,
    expiry_date DATE,
    document_number TEXT,
    uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- company_branding
CREATE TABLE IF NOT EXISTS company_branding (
    id TEXT PRIMARY KEY,
    company_id TEXT UNIQUE NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    logo_file_name TEXT,
    logo_file_path TEXT,
    logo_file_size INTEGER,
    logo_mime_type TEXT,
    logo_uploaded_at TIMESTAMP WITHOUT TIME ZONE,
    stamp_file_name TEXT,
    stamp_file_path TEXT,
    stamp_file_size INTEGER,
    stamp_mime_type TEXT,
    stamp_uploaded_at TIMESTAMP WITHOUT TIME ZONE,
    primary_color TEXT,
    secondary_color TEXT,
    font_family TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- registration_progress
CREATE TABLE IF NOT EXISTS registration_progress (
    id TEXT PRIMARY KEY,
    company_id TEXT UNIQUE NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 1,
    step_company_info BOOLEAN DEFAULT FALSE,
    step_business_details BOOLEAN DEFAULT FALSE,
    step_documents BOOLEAN DEFAULT FALSE,
    step_plan_selection BOOLEAN DEFAULT FALSE,
    step_review BOOLEAN DEFAULT FALSE,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- content_blocks
CREATE TABLE IF NOT EXISTS content_blocks (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    section TEXT,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_section ON content_blocks (section);

-- featured_businesses
CREATE TABLE IF NOT EXISTS featured_businesses (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    display_name TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    added_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_featured_company ON featured_businesses (company_id);

-- invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    invoice_type invoice_type_t NOT NULL,
    status invoice_status_t DEFAULT 'DRAFT',
    issue_date DATE NOT NULL,
    due_date DATE,
    currency_code TEXT DEFAULT 'AED',
    supplier_trn TEXT,
    supplier_name TEXT NOT NULL,
    supplier_address TEXT,
    supplier_city TEXT,
    supplier_country TEXT DEFAULT 'AE',
    supplier_peppol_id TEXT,
    customer_trn TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    customer_city TEXT,
    customer_country TEXT DEFAULT 'AE',
    customer_peppol_id TEXT,
    tax_code TEXT DEFAULT 'SR',
    invoice_classification TEXT DEFAULT 'standard',
    subtotal_amount DOUBLE PRECISION DEFAULT 0.0,
    tax_amount DOUBLE PRECISION DEFAULT 0.0,
    total_amount DOUBLE PRECISION DEFAULT 0.0,
    amount_due DOUBLE PRECISION DEFAULT 0.0,
    total_amount_aed DOUBLE PRECISION,
    payment_terms TEXT,
    payment_due_days INTEGER DEFAULT 30,
    invoice_notes TEXT,
    reference_number TEXT,
    preceding_invoice_id TEXT REFERENCES invoices (id) ON DELETE SET NULL,
    credit_note_reason TEXT,
    xml_file_path TEXT,
    pdf_file_path TEXT,
    xml_hash TEXT,
    prev_invoice_hash TEXT,
    signature_b64 TEXT,
    signing_cert_serial TEXT,
    signing_timestamp TIMESTAMP WITHOUT TIME ZONE,
    peppol_message_id TEXT,
    peppol_status TEXT,
    peppol_provider TEXT,
    peppol_sent_at TIMESTAMP WITHOUT TIME ZONE,
    peppol_response TEXT,
    share_token TEXT,
    sent_at TIMESTAMP WITHOUT TIME ZONE,
    viewed_at TIMESTAMP WITHOUT TIME ZONE,
    paid_at TIMESTAMP WITHOUT TIME ZONE,
    created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    payment_verified_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    payment_verified_at TIMESTAMP WITHOUT TIME ZONE,
    payment_method TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices (company_id);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices (invoice_number);

-- invoice_line_items
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_code TEXT,
    quantity DOUBLE PRECISION NOT NULL,
    unit_code TEXT DEFAULT 'C62',
    unit_price DOUBLE PRECISION NOT NULL,
    line_extension_amount DOUBLE PRECISION NOT NULL,
    tax_category tax_category_t NOT NULL,
    tax_percent DOUBLE PRECISION DEFAULT 0.0,
    tax_amount DOUBLE PRECISION DEFAULT 0.0,
    tax_code TEXT DEFAULT 'SR',
    line_total_amount DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ili_invoice ON invoice_line_items (invoice_id);

-- invoice_tax_breakdowns
CREATE TABLE IF NOT EXISTS invoice_tax_breakdowns (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    tax_category tax_category_t NOT NULL,
    taxable_amount DOUBLE PRECISION NOT NULL,
    tax_percent DOUBLE PRECISION NOT NULL,
    tax_amount DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    status purchase_order_status_t DEFAULT 'DRAFT',
    supplier_trn TEXT,
    supplier_name TEXT NOT NULL,
    supplier_contact_email TEXT,
    supplier_address TEXT,
    supplier_peppol_id TEXT,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    delivery_address TEXT,
    currency_code TEXT DEFAULT 'AED',
    expected_subtotal DOUBLE PRECISION DEFAULT 0.0,
    expected_tax DOUBLE PRECISION DEFAULT 0.0,
    expected_total DOUBLE PRECISION NOT NULL,
    received_invoice_count INTEGER DEFAULT 0,
    matched_invoice_count INTEGER DEFAULT 0,
    received_amount_total DOUBLE PRECISION DEFAULT 0.0,
    variance_amount DOUBLE PRECISION DEFAULT 0.0,
    reference_number TEXT,
    notes TEXT,
    approved_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_company ON purchase_orders (company_id);

CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders (po_number);

-- purchase_order_line_items
CREATE TABLE IF NOT EXISTS purchase_order_line_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_code TEXT,
    quantity_ordered DOUBLE PRECISION NOT NULL,
    quantity_received DOUBLE PRECISION DEFAULT 0.0,
    unit_code TEXT DEFAULT 'C62',
    unit_price DOUBLE PRECISION NOT NULL,
    line_total DOUBLE PRECISION NOT NULL,
    tax_category tax_category_t DEFAULT 'S',
    tax_percent DOUBLE PRECISION DEFAULT 5.0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poli_po ON purchase_order_line_items (po_id);

-- goods_receipts
CREATE TABLE IF NOT EXISTS goods_receipts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    po_id TEXT REFERENCES purchase_orders (id) ON DELETE SET NULL,
    grn_number TEXT NOT NULL,
    status goods_receipt_status_t DEFAULT 'PENDING',
    receipt_date DATE NOT NULL,
    received_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    supplier_trn TEXT,
    supplier_name TEXT NOT NULL,
    supplier_delivery_note TEXT,
    total_items_received INTEGER DEFAULT 0,
    total_value DOUBLE PRECISION DEFAULT 0.0,
    inspection_passed BOOLEAN DEFAULT TRUE,
    quality_notes TEXT,
    damaged_items_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grn_company ON goods_receipts (company_id);

CREATE INDEX IF NOT EXISTS idx_grn_number ON goods_receipts (grn_number);

-- goods_receipt_line_items
CREATE TABLE IF NOT EXISTS goods_receipt_line_items (
    id TEXT PRIMARY KEY,
    grn_id TEXT NOT NULL REFERENCES goods_receipts (id) ON DELETE CASCADE,
    po_line_item_id TEXT REFERENCES purchase_order_line_items (id) ON DELETE SET NULL,
    line_number INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    item_code TEXT,
    quantity_received DOUBLE PRECISION NOT NULL,
    quantity_accepted DOUBLE PRECISION NOT NULL,
    quantity_rejected DOUBLE PRECISION DEFAULT 0.0,
    unit_code TEXT DEFAULT 'C62',
    condition TEXT,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- inward_invoices
CREATE TABLE IF NOT EXISTS inward_invoices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    supplier_invoice_number TEXT NOT NULL,
    invoice_type invoice_type_t DEFAULT '380',
    status inward_invoice_status_t DEFAULT 'RECEIVED',
    invoice_date DATE NOT NULL,
    due_date DATE,
    received_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    supplier_trn TEXT,
    supplier_name TEXT NOT NULL,
    supplier_address TEXT,
    supplier_peppol_id TEXT,
    supplier_company_id TEXT REFERENCES companies (id) ON DELETE SET NULL,
    customer_trn TEXT,
    customer_name TEXT NOT NULL,
    currency_code TEXT DEFAULT 'AED',
    subtotal_amount DOUBLE PRECISION NOT NULL,
    tax_amount DOUBLE PRECISION NOT NULL,
    total_amount DOUBLE PRECISION NOT NULL,
    amount_due DOUBLE PRECISION NOT NULL,
    xml_file_path TEXT,
    pdf_file_path TEXT,
    xml_hash TEXT,
    peppol_message_id TEXT,
    peppol_sender_id TEXT,
    peppol_provider TEXT,
    peppol_received_at TIMESTAMP WITHOUT TIME ZONE,
    po_id TEXT REFERENCES purchase_orders (id) ON DELETE SET NULL,
    grn_id TEXT REFERENCES goods_receipts (id) ON DELETE SET NULL,
    matching_status matching_status_t DEFAULT 'NOT_MATCHED',
    po_match_score DOUBLE PRECISION DEFAULT 0.0,
    grn_match_score DOUBLE PRECISION DEFAULT 0.0,
    amount_variance DOUBLE PRECISION DEFAULT 0.0,
    quantity_variance DOUBLE PRECISION DEFAULT 0.0,
    reviewed_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE,
    approved_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    rejection_reason TEXT,
    payment_status TEXT,
    payment_method TEXT,
    paid_amount DOUBLE PRECISION DEFAULT 0.0,
    paid_at TIMESTAMP WITHOUT TIME ZONE,
    payment_reference TEXT,
    disputed_at TIMESTAMP WITHOUT TIME ZONE,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    reference_number TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inward_company ON inward_invoices (company_id);

CREATE INDEX IF NOT EXISTS idx_inward_supplier_invoice_number ON inward_invoices (supplier_invoice_number);

-- inward_invoice_line_items
CREATE TABLE IF NOT EXISTS inward_invoice_line_items (
    id TEXT PRIMARY KEY,
    inward_invoice_id TEXT NOT NULL REFERENCES inward_invoices (id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_code TEXT,
    quantity DOUBLE PRECISION NOT NULL,
    unit_code TEXT DEFAULT 'C62',
    unit_price DOUBLE PRECISION NOT NULL,
    line_extension_amount DOUBLE PRECISION NOT NULL,
    tax_category tax_category_t NOT NULL,
    tax_percent DOUBLE PRECISION DEFAULT 0.0,
    tax_amount DOUBLE PRECISION DEFAULT 0.0,
    line_total_amount DOUBLE PRECISION NOT NULL,
    po_line_item_id TEXT REFERENCES purchase_order_line_items (id) ON DELETE SET NULL,
    grn_line_item_id TEXT REFERENCES goods_receipt_line_items (id) ON DELETE SET NULL,
    match_status TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- audit_files
CREATE TABLE IF NOT EXISTS audit_files (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    format TEXT DEFAULT 'CSV',
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    status audit_file_status_t DEFAULT 'GENERATING',
    generated_by_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE SET NULL,
    generated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    total_invoices INTEGER DEFAULT 0,
    total_customers INTEGER DEFAULT 0,
    total_amount DOUBLE PRECISION DEFAULT 0.0,
    total_vat DOUBLE PRECISION DEFAULT 0.0,
    error_message TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT NOT NULL UNIQUE,
    card_brand TEXT,
    card_last4 TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    billing_email TEXT,
    billing_name TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_company ON payment_methods (company_id);

-- subscriptions (company subscriptions in stripe style)
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    tier TEXT NOT NULL,
    billing_cycle_months INTEGER DEFAULT 1,
    monthly_price DOUBLE PRECISION DEFAULT 0.0,
    discount_percent DOUBLE PRECISION DEFAULT 0.0,
    status TEXT DEFAULT 'ACTIVE',
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    current_period_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    cancelled_at TIMESTAMP WITHOUT TIME ZONE
);

-- peppol_usage
CREATE TABLE IF NOT EXISTS peppol_usage (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    invoice_id TEXT REFERENCES invoices (id) ON DELETE SET NULL,
    transmission_date TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    status TEXT NOT NULL,
    fee_amount DOUBLE PRECISION DEFAULT 1.0,
    month_year TEXT NOT NULL,
    billed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- billing_invoices
CREATE TABLE IF NOT EXISTS billing_invoices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    subscription_fee DOUBLE PRECISION DEFAULT 0.0,
    peppol_usage_count INTEGER DEFAULT 0,
    peppol_usage_fee DOUBLE PRECISION DEFAULT 0.0,
    total_amount DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'DRAFT',
    stripe_invoice_id TEXT UNIQUE,
    paid_at TIMESTAMP WITHOUT TIME ZONE,
    payment_method_id TEXT REFERENCES payment_methods (id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    sent_at TIMESTAMP WITHOUT TIME ZONE
);

-- expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    expense_date DATE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount DOUBLE PRECISION NOT NULL,
    vat_amount DOUBLE PRECISION DEFAULT 0.0,
    total_amount DOUBLE PRECISION NOT NULL,
    currency_code TEXT DEFAULT 'AED',
    reference_number TEXT,
    supplier_name TEXT,
    notes TEXT,
    tax_code TEXT DEFAULT 'SR',
    vendor_id TEXT,
    created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses (company_id);

-- inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_code TEXT,
    description TEXT,
    unit TEXT DEFAULT 'unit',
    current_stock DOUBLE PRECISION DEFAULT 0.0,
    min_stock_level DOUBLE PRECISION DEFAULT 0.0,
    unit_cost DOUBLE PRECISION,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_company ON inventory_items (company_id);

-- inventory_transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    transaction_date DATE NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    stock_after DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invtrx_item ON inventory_transactions (inventory_item_id);

-- Final: ensure extension for UUID if needed (optional)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Done
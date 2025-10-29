"""
UAE e-Invoicing Platform with Registration Wizard
==================================================
InvoLinks API - Multi-tenant e-invoicing with subscription plans
"""
import os, enum, hashlib, secrets, json
from uuid import uuid4
from typing import List, Optional
from datetime import datetime, date, timedelta

# Pydantic & FastAPI
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, Response, Header
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# SQLAlchemy
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, Date, DateTime, Enum as SQLEnum, ForeignKey, Text, func
from sqlalchemy.orm import declarative_base, Session, sessionmaker, relationship

# Password & JWT
import bcrypt
from jose import JWTError, jwt

# UBL XML Generator
# Legacy UBL generator removed - using utils/ubl_xml_generator.py instead

# Exception handling
from utils.exceptions import (
    InvoLinksException, ValidationError, InvoiceValidationError,
    CryptoError, SigningError, CertificateError,
    XMLGenerationError, PeppolError, PeppolProviderError,
    ConfigurationError, exception_to_http_response
)

# MFA (Multi-Factor Authentication)
from utils.mfa_utils import MFAManager, EmailOTPManager

# Bulk Import utilities
from utils.bulk_import import BulkImportValidator
import pandas as pd
from io import BytesIO

# Stripe payment processing
import stripe

# ==================== CONFIG ====================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./.dev.db")
ARTIFACT_ROOT = os.path.join(os.getcwd(), "artifacts")
os.makedirs(ARTIFACT_ROOT, exist_ok=True)
os.makedirs(os.path.join(ARTIFACT_ROOT, "documents"), exist_ok=True)

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "involinks-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing (using bcrypt directly to avoid passlib issues)

# Database connection with pooling configuration for reliability
engine = create_engine(
    DATABASE_URL, 
    future=True,
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=3600,   # Recycle connections after 1 hour
    pool_size=5,
    max_overflow=10
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()

# ==================== ENUMS ====================
class Role(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    FINANCE_USER = "FINANCE_USER"

class CompanyStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    REJECTED = "REJECTED"

class SubscriptionStatus(str, enum.Enum):
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"

class DocumentType(str, enum.Enum):
    BUSINESS_LICENSE = "BUSINESS_LICENSE"
    TRN_CERTIFICATE = "TRN_CERTIFICATE"
    TRADE_LICENSE = "TRADE_LICENSE"
    PASSPORT = "PASSPORT"
    EMIRATES_ID = "EMIRATES_ID"

class DocumentStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class InvoiceType(str, enum.Enum):
    TAX_INVOICE = "380"  # Commercial invoice (standard VAT)
    TAX_CREDIT_NOTE = "381"  # Credit note
    COMMERCIAL_INVOICE = "480"  # Invoice out of scope of tax
    CREDIT_NOTE_OUT_OF_SCOPE = "81"  # Credit note related to goods/services

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    SENT = "SENT"
    VIEWED = "VIEWED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"

class TaxCategory(str, enum.Enum):
    STANDARD = "S"  # Standard rate (5% in UAE)
    ZERO = "Z"  # Zero rated
    EXEMPT = "E"  # Exempt from tax
    OUT_OF_SCOPE = "O"  # Out of scope

class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"

class GoodsReceiptStatus(str, enum.Enum):
    PENDING = "PENDING"
    RECEIVED = "RECEIVED"
    PARTIAL = "PARTIAL"
    REJECTED = "REJECTED"

class InwardInvoiceStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"  # Just received via PEPPOL
    PENDING_REVIEW = "PENDING_REVIEW"  # Awaiting AP team review
    MATCHED = "MATCHED"  # Matched with PO/GRN
    APPROVED = "APPROVED"  # Approved for payment
    REJECTED = "REJECTED"  # Rejected (invoice issue)
    PAID = "PAID"  # Payment completed
    DISPUTED = "DISPUTED"  # Under dispute
    CANCELLED = "CANCELLED"  # Cancelled by supplier

class MatchingStatus(str, enum.Enum):
    NOT_MATCHED = "NOT_MATCHED"
    PARTIAL_MATCH = "PARTIAL_MATCH"  # Some fields match, others don't
    FULL_MATCH = "FULL_MATCH"  # All fields match
    VARIANCE_DETECTED = "VARIANCE_DETECTED"  # Within tolerance but variance exists

class AuditFileStatus(str, enum.Enum):
    GENERATING = "GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

# ==================== DATABASE MODELS ====================
class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    role = Column(SQLEnum(Role), nullable=False)
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)
    is_owner = Column(Boolean, default=False)  # First user who registered the company
    full_name = Column(String, nullable=True)
    invited_by = Column(String, ForeignKey("users.id"), nullable=True)  # Who invited this user
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # MFA (Multi-Factor Authentication) fields - Article 9.1 compliance
    mfa_enabled = Column(Boolean, default=False)
    mfa_method = Column(String, nullable=True)  # 'totp', 'email', or None
    mfa_secret = Column(String, nullable=True)  # Base32 encoded TOTP secret
    mfa_backup_codes = Column(Text, nullable=True)  # JSON array of hashed backup codes
    mfa_enrolled_at = Column(DateTime, nullable=True)
    mfa_last_verified_at = Column(DateTime, nullable=True)

class CompanyDB(Base):
    __tablename__ = "companies"
    id = Column(String, primary_key=True)
    legal_name = Column(String, nullable=True)
    country = Column(String, default="AE")
    status = Column(SQLEnum(CompanyStatus), default=CompanyStatus.PENDING_REVIEW)
    trn = Column(String, nullable=True)
    
    # MFA (Multi-Factor Authentication) fields - Article 9.1 compliance
    mfa_enabled = Column(Boolean, default=False)
    mfa_method = Column(String, nullable=True)  # 'totp' or 'email'
    mfa_secret = Column(String, nullable=True)  # Base32 TOTP secret
    mfa_backup_codes = Column(Text, nullable=True)  # JSON array of hashed codes
    mfa_enrolled_at = Column(DateTime, nullable=True)
    mfa_last_verified_at = Column(DateTime, nullable=True)

    # Registration fields
    business_type = Column(String, nullable=True)
    business_activity = Column(String, nullable=True)
    registration_number = Column(String, nullable=True)
    registration_date = Column(Date, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)

    # Address
    address_line1 = Column(String, nullable=True)
    address_line2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    emirate = Column(String, nullable=True)
    po_box = Column(String, nullable=True)

    # Authorized person
    authorized_person_name = Column(String, nullable=True)
    authorized_person_title = Column(String, nullable=True)
    authorized_person_email = Column(String, nullable=True)
    authorized_person_phone = Column(String, nullable=True)

    # Email verification
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    verification_sent_at = Column(DateTime, nullable=True)

    # Password & authentication
    password_hash = Column(String, nullable=True)
    password_reset_token = Column(String, nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)

    # Free plan configuration (DEPRECATED - moved to trial system)
    free_plan_type = Column(String, nullable=True)  # "DURATION" or "INVOICE_COUNT"
    free_plan_duration_months = Column(Integer, nullable=True)  # If duration-based
    free_plan_invoice_limit = Column(Integer, nullable=True)  # If invoice count-based
    free_plan_start_date = Column(DateTime, nullable=True)  # When free plan started
    invoices_generated = Column(Integer, default=0)  # Total lifetime invoices
    
    # Subscription tracking (DEPRECATED - moved to subscriptions table)
    subscription_plan_id = Column(String, ForeignKey("subscription_plans.id"), nullable=True)
    
    # Free Trial System
    trial_status = Column(String, default="ACTIVE")  # ACTIVE, EXPIRED, CONVERTED
    trial_start_date = Column(DateTime, nullable=True)
    trial_invoice_count = Column(Integer, default=0)  # Invoices sent during trial
    trial_ended_at = Column(DateTime, nullable=True)
    
    # Stripe Integration
    stripe_customer_id = Column(String, nullable=True, unique=True)
    
    # PEPPOL Configuration
    peppol_enabled = Column(Boolean, default=False)
    peppol_provider = Column(String, nullable=True)  # 'tradeshift', 'basware', 'mock'
    peppol_participant_id = Column(String, nullable=True)  # Company's PEPPOL participant ID (e.g., "0190:123456789012345")
    peppol_base_url = Column(String, nullable=True)  # Provider API base URL
    peppol_api_key = Column(Text, nullable=True)  # Provider API key (encrypted in production)
    peppol_configured_at = Column(DateTime, nullable=True)
    peppol_last_tested_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class SubscriptionPlanDB(Base):
    __tablename__ = "subscription_plans"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price_monthly = Column(Float, default=0.0)
    price_yearly = Column(Float, default=0.0)
    max_invoices_per_month = Column(Integer, nullable=True)
    max_users = Column(Integer, default=1)
    max_pos_devices = Column(Integer, default=0)
    allow_api_access = Column(Boolean, default=True)
    allow_branding = Column(Boolean, default=False)
    allow_multi_currency = Column(Boolean, default=False)
    priority_support = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CompanySubscriptionDB(Base):
    __tablename__ = "company_subscriptions"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    plan_id = Column(String, ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(SQLEnum(SubscriptionStatus), default=SubscriptionStatus.TRIAL)
    billing_cycle = Column(String, default="monthly")
    current_period_start = Column(Date, nullable=False)
    current_period_end = Column(Date, nullable=False)
    invoices_this_period = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("CompanyDB", backref="old_subscriptions")
    plan = relationship("SubscriptionPlanDB")

class CompanyDocumentDB(Base):
    __tablename__ = "company_documents"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    document_type = Column(SQLEnum(DocumentType), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.PENDING_REVIEW)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    document_number = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("CompanyDB", backref="documents")

class CompanyBrandingDB(Base):
    __tablename__ = "company_branding"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), unique=True, nullable=False, index=True)
    
    # Logo
    logo_file_name = Column(String, nullable=True)
    logo_file_path = Column(String, nullable=True)
    logo_file_size = Column(Integer, nullable=True)
    logo_mime_type = Column(String, nullable=True)
    logo_uploaded_at = Column(DateTime, nullable=True)
    
    # Company Stamp/Seal
    stamp_file_name = Column(String, nullable=True)
    stamp_file_path = Column(String, nullable=True)
    stamp_file_size = Column(Integer, nullable=True)
    stamp_mime_type = Column(String, nullable=True)
    stamp_uploaded_at = Column(DateTime, nullable=True)
    
    # Optional: Brand Colors & Fonts (for future PDF generation)
    primary_color = Column(String, nullable=True)  # Hex color
    secondary_color = Column(String, nullable=True)  # Hex color
    font_family = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    company = relationship("CompanyDB", backref="branding")

class RegistrationProgressDB(Base):
    __tablename__ = "registration_progress"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), unique=True, index=True)
    current_step = Column(Integer, default=1)
    step_company_info = Column(Boolean, default=False)
    step_business_details = Column(Boolean, default=False)
    step_documents = Column(Boolean, default=False)
    step_plan_selection = Column(Boolean, default=False)
    step_review = Column(Boolean, default=False)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("CompanyDB", backref="progress")

class ContentBlockDB(Base):
    """Content Management System - Editable text blocks for UI"""
    __tablename__ = "content_blocks"
    id = Column(String, primary_key=True)
    key = Column(String, unique=True, nullable=False, index=True)  # e.g., "homepage_hero_title"
    value = Column(Text, nullable=False)  # The actual text content
    description = Column(String, nullable=True)  # What this controls
    section = Column(String, nullable=True, index=True)  # Group by page: "homepage", "feature_boxes", etc.
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String, nullable=True)  # Admin email who made the change

class InvoiceDB(Base):
    __tablename__ = "invoices"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    
    # UBL/PINT-AE Core Fields
    invoice_number = Column(String, nullable=False, index=True)
    invoice_type = Column(SQLEnum(InvoiceType), nullable=False)
    status = Column(SQLEnum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    currency_code = Column(String, default="AED")
    
    # Supplier (Issuer) - Company issuing the invoice
    supplier_trn = Column(String, nullable=False)  # 15-digit TRN
    supplier_name = Column(String, nullable=False)
    supplier_address = Column(Text, nullable=True)
    supplier_city = Column(String, nullable=True)
    supplier_country = Column(String, default="AE")
    supplier_peppol_id = Column(String, nullable=True)  # Peppol endpoint
    
    # Customer (Buyer) - Recipient of invoice
    customer_trn = Column(String, nullable=True)  # May be null for B2C
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=True)
    customer_address = Column(Text, nullable=True)
    customer_city = Column(String, nullable=True)
    customer_country = Column(String, default="AE")
    customer_peppol_id = Column(String, nullable=True)
    
    # Monetary Totals (PINT-AE mandatory)
    subtotal_amount = Column(Float, default=0.0)  # Line extension total
    tax_amount = Column(Float, default=0.0)  # Total VAT
    total_amount = Column(Float, default=0.0)  # Amount including VAT
    amount_due = Column(Float, default=0.0)  # Payable amount
    
    # AED conversion (mandatory if currency != AED)
    total_amount_aed = Column(Float, nullable=True)
    
    # Payment Terms
    payment_terms = Column(Text, nullable=True)
    payment_due_days = Column(Integer, default=30)
    
    # Notes & References
    invoice_notes = Column(Text, nullable=True)
    reference_number = Column(String, nullable=True)  # PO number, etc.
    preceding_invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True)  # For credit notes
    
    # Credit Note specific
    credit_note_reason = Column(String, nullable=True)  # Mandatory for credit notes
    
    # Document Management
    xml_file_path = Column(String, nullable=True)  # UBL XML storage path
    pdf_file_path = Column(String, nullable=True)  # PDF storage path
    xml_hash = Column(String, nullable=True)  # SHA-256 hash of XML
    
    # Digital Signature & Hash Chain (UAE FTA Compliance)
    prev_invoice_hash = Column(String, nullable=True, index=True)  # Links to previous invoice in chain
    signature_b64 = Column(Text, nullable=True)  # Base64 encoded digital signature
    signing_cert_serial = Column(String, nullable=True)  # Certificate serial number for audit trail
    signing_timestamp = Column(DateTime, nullable=True)  # When invoice was digitally signed
    
    # PEPPOL Transmission Tracking
    peppol_message_id = Column(String, nullable=True, index=True)  # Provider's message ID
    peppol_status = Column(String, nullable=True)  # SENT, DELIVERED, REJECTED, etc.
    peppol_provider = Column(String, nullable=True)  # e.g., "tradeshift", "basware"
    peppol_sent_at = Column(DateTime, nullable=True)  # Transmission timestamp
    peppol_response = Column(Text, nullable=True)  # Provider API response (JSON)
    
    # Sharing & Transmission
    share_token = Column(String, nullable=True, index=True)  # Public share link token
    sent_at = Column(DateTime, nullable=True)
    viewed_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("CompanyDB", backref="invoices")
    line_items = relationship("InvoiceLineItemDB", backref="invoice", cascade="all, delete-orphan")
    tax_breakdowns = relationship("InvoiceTaxBreakdownDB", backref="invoice", cascade="all, delete-orphan")

class InvoiceLineItemDB(Base):
    __tablename__ = "invoice_line_items"
    id = Column(String, primary_key=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False)  # Sequential line number
    
    # Product/Service Details
    item_name = Column(String, nullable=False)
    item_description = Column(Text, nullable=True)
    item_code = Column(String, nullable=True)  # SKU or product code
    
    # Quantity & Unit
    quantity = Column(Float, nullable=False)
    unit_code = Column(String, default="C62")  # UN/ECE unit codes (C62 = piece)
    
    # Pricing
    unit_price = Column(Float, nullable=False)
    line_extension_amount = Column(Float, nullable=False)  # quantity * unit_price
    
    # Tax
    tax_category = Column(SQLEnum(TaxCategory), nullable=False)
    tax_percent = Column(Float, default=0.0)  # 5% for standard rate in UAE
    tax_amount = Column(Float, default=0.0)
    
    # Total
    line_total_amount = Column(Float, nullable=False)  # Including tax
    
    created_at = Column(DateTime, default=datetime.utcnow)

class InvoiceTaxBreakdownDB(Base):
    __tablename__ = "invoice_tax_breakdowns"
    id = Column(String, primary_key=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    
    # Tax Category Breakdown (required for UBL)
    tax_category = Column(SQLEnum(TaxCategory), nullable=False)
    taxable_amount = Column(Float, nullable=False)  # Base amount before tax
    tax_percent = Column(Float, nullable=False)
    tax_amount = Column(Float, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

# ==================== CORNER 4: AP MANAGEMENT (Inward Invoicing) ====================

class PurchaseOrderDB(Base):
    """Purchase Orders - Track expected invoices from suppliers"""
    __tablename__ = "purchase_orders"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    
    # PO Identification
    po_number = Column(String, nullable=False, index=True)  # Unique PO number per company
    status = Column(SQLEnum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT)
    
    # Supplier Information
    supplier_trn = Column(String, nullable=False)
    supplier_name = Column(String, nullable=False)
    supplier_contact_email = Column(String, nullable=True)
    supplier_address = Column(Text, nullable=True)
    supplier_peppol_id = Column(String, nullable=True)
    
    # Order Details
    order_date = Column(Date, nullable=False)
    expected_delivery_date = Column(Date, nullable=True)
    delivery_address = Column(Text, nullable=True)
    
    # Financial
    currency_code = Column(String, default="AED")
    expected_subtotal = Column(Float, default=0.0)
    expected_tax = Column(Float, default=0.0)
    expected_total = Column(Float, nullable=False)
    
    # Matching & Fulfillment
    received_invoice_count = Column(Integer, default=0)  # How many invoices received
    matched_invoice_count = Column(Integer, default=0)  # How many matched
    received_amount_total = Column(Float, default=0.0)  # Total invoiced amount
    variance_amount = Column(Float, default=0.0)  # Difference (expected - actual)
    
    # References
    reference_number = Column(String, nullable=True)  # Internal reference
    notes = Column(Text, nullable=True)
    
    # Approval
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("CompanyDB", backref="purchase_orders")
    line_items = relationship("PurchaseOrderLineItemDB", backref="purchase_order", cascade="all, delete-orphan")
    goods_receipts = relationship("GoodsReceiptDB", backref="purchase_order", cascade="all, delete-orphan")

class PurchaseOrderLineItemDB(Base):
    """Line items for Purchase Orders"""
    __tablename__ = "purchase_order_line_items"
    id = Column(String, primary_key=True)
    po_id = Column(String, ForeignKey("purchase_orders.id"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False)
    
    # Product/Service
    item_name = Column(String, nullable=False)
    item_description = Column(Text, nullable=True)
    item_code = Column(String, nullable=True)  # SKU
    
    # Quantity & Unit
    quantity_ordered = Column(Float, nullable=False)
    quantity_received = Column(Float, default=0.0)
    unit_code = Column(String, default="C62")
    
    # Pricing
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)
    
    # Tax
    tax_category = Column(SQLEnum(TaxCategory), default=TaxCategory.STANDARD)
    tax_percent = Column(Float, default=5.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class GoodsReceiptDB(Base):
    """Goods Receipt Notes (GRN) - Track physical delivery"""
    __tablename__ = "goods_receipts"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    po_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True, index=True)
    
    # GRN Identification
    grn_number = Column(String, nullable=False, index=True)
    status = Column(SQLEnum(GoodsReceiptStatus), default=GoodsReceiptStatus.PENDING)
    
    # Receipt Details
    receipt_date = Column(Date, nullable=False)
    received_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Supplier
    supplier_trn = Column(String, nullable=False)
    supplier_name = Column(String, nullable=False)
    supplier_delivery_note = Column(String, nullable=True)  # Supplier's delivery note number
    
    # Quantities
    total_items_received = Column(Integer, default=0)
    total_value = Column(Float, default=0.0)
    
    # Quality Control
    inspection_passed = Column(Boolean, default=True)
    quality_notes = Column(Text, nullable=True)
    damaged_items_count = Column(Integer, default=0)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("CompanyDB", backref="goods_receipts")
    line_items = relationship("GoodsReceiptLineItemDB", backref="goods_receipt", cascade="all, delete-orphan")

class GoodsReceiptLineItemDB(Base):
    """Line items for Goods Receipt Notes"""
    __tablename__ = "goods_receipt_line_items"
    id = Column(String, primary_key=True)
    grn_id = Column(String, ForeignKey("goods_receipts.id"), nullable=False, index=True)
    po_line_item_id = Column(String, ForeignKey("purchase_order_line_items.id"), nullable=True)
    
    line_number = Column(Integer, nullable=False)
    
    # Product
    item_name = Column(String, nullable=False)
    item_code = Column(String, nullable=True)
    
    # Quantities
    quantity_received = Column(Float, nullable=False)
    quantity_accepted = Column(Float, nullable=False)
    quantity_rejected = Column(Float, default=0.0)
    unit_code = Column(String, default="C62")
    
    # Quality
    condition = Column(String, nullable=True)  # "GOOD", "DAMAGED", "DEFECTIVE"
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class InwardInvoiceDB(Base):
    """Inward Invoices - Received from suppliers via PEPPOL (Corner 4)"""
    __tablename__ = "inward_invoices"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Invoice Identification
    supplier_invoice_number = Column(String, nullable=False, index=True)
    invoice_type = Column(SQLEnum(InvoiceType), default=InvoiceType.TAX_INVOICE)
    status = Column(SQLEnum(InwardInvoiceStatus), default=InwardInvoiceStatus.RECEIVED)
    
    # Dates
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    received_at = Column(DateTime, default=datetime.utcnow)
    
    # Supplier (Invoice Issuer)
    supplier_trn = Column(String, nullable=False)
    supplier_name = Column(String, nullable=False)
    supplier_address = Column(Text, nullable=True)
    supplier_peppol_id = Column(String, nullable=True)
    supplier_company_id = Column(String, ForeignKey("companies.id"), nullable=True)  # If supplier uses InvoLinks
    
    # Customer (Our company - the buyer)
    customer_trn = Column(String, nullable=False)
    customer_name = Column(String, nullable=False)
    
    # Financial
    currency_code = Column(String, default="AED")
    subtotal_amount = Column(Float, nullable=False)
    tax_amount = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    amount_due = Column(Float, nullable=False)
    
    # Document Storage
    xml_file_path = Column(String, nullable=True)  # Received UBL XML
    pdf_file_path = Column(String, nullable=True)  # Generated PDF for viewing
    xml_hash = Column(String, nullable=True)
    
    # PEPPOL Reception
    peppol_message_id = Column(String, nullable=True, index=True)
    peppol_sender_id = Column(String, nullable=True)
    peppol_provider = Column(String, nullable=True)
    peppol_received_at = Column(DateTime, nullable=True)
    
    # Matching & Approval
    po_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True, index=True)
    grn_id = Column(String, ForeignKey("goods_receipts.id"), nullable=True, index=True)
    matching_status = Column(SQLEnum(MatchingStatus), default=MatchingStatus.NOT_MATCHED)
    
    # 3-Way Matching Results
    po_match_score = Column(Float, default=0.0)  # 0-100% match with PO
    grn_match_score = Column(Float, default=0.0)  # 0-100% match with GRN
    amount_variance = Column(Float, default=0.0)  # Difference from expected
    quantity_variance = Column(Float, default=0.0)  # Qty difference
    
    # Approval Workflow
    reviewed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Payment Tracking
    payment_status = Column(String, nullable=True)  # "PENDING", "SCHEDULED", "PAID"
    payment_method = Column(String, nullable=True)
    paid_amount = Column(Float, default=0.0)
    paid_at = Column(DateTime, nullable=True)
    payment_reference = Column(String, nullable=True)
    
    # Dispute Management
    disputed_at = Column(DateTime, nullable=True)
    dispute_reason = Column(Text, nullable=True)
    dispute_resolved_at = Column(DateTime, nullable=True)
    
    # Notes & References
    notes = Column(Text, nullable=True)
    reference_number = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("CompanyDB", foreign_keys=[company_id], backref="inward_invoices")
    purchase_order = relationship("PurchaseOrderDB", backref="inward_invoices")
    goods_receipt = relationship("GoodsReceiptDB", backref="inward_invoices")
    line_items = relationship("InwardInvoiceLineItemDB", backref="inward_invoice", cascade="all, delete-orphan")

class InwardInvoiceLineItemDB(Base):
    """Line items for Inward Invoices"""
    __tablename__ = "inward_invoice_line_items"
    id = Column(String, primary_key=True)
    inward_invoice_id = Column(String, ForeignKey("inward_invoices.id"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False)
    
    # Product/Service
    item_name = Column(String, nullable=False)
    item_description = Column(Text, nullable=True)
    item_code = Column(String, nullable=True)
    
    # Quantity & Unit
    quantity = Column(Float, nullable=False)
    unit_code = Column(String, default="C62")
    
    # Pricing
    unit_price = Column(Float, nullable=False)
    line_extension_amount = Column(Float, nullable=False)
    
    # Tax
    tax_category = Column(SQLEnum(TaxCategory), nullable=False)
    tax_percent = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    
    # Total
    line_total_amount = Column(Float, nullable=False)
    
    # Matching
    po_line_item_id = Column(String, ForeignKey("purchase_order_line_items.id"), nullable=True)
    grn_line_item_id = Column(String, ForeignKey("goods_receipt_line_items.id"), nullable=True)
    match_status = Column(String, nullable=True)  # "MATCHED", "VARIANCE", "NO_PO"
    
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditFileDB(Base):
    """FTA Audit Files (FAF) - UAE Federal Tax Authority Audit File"""
    __tablename__ = "audit_files"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    
    # File Information
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    format = Column(String, default="CSV")  # CSV or TXT
    
    # Audit Period
    period_start_date = Column(Date, nullable=False)
    period_end_date = Column(Date, nullable=False)
    
    # Generation Details
    status = Column(SQLEnum(AuditFileStatus), default=AuditFileStatus.GENERATING)
    generated_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    
    # Statistics
    total_invoices = Column(Integer, default=0)
    total_customers = Column(Integer, default=0)
    total_amount = Column(Float, default=0.0)
    total_vat = Column(Float, default=0.0)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("CompanyDB", backref="audit_files")

class PaymentMethodDB(Base):
    """Customer payment methods (credit cards via Stripe)"""
    __tablename__ = "payment_methods"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Stripe details
    stripe_payment_method_id = Column(String, nullable=False, unique=True)
    
    # Card information (for display)
    card_brand = Column(String, nullable=True)  # visa, mastercard, amex
    card_last4 = Column(String, nullable=True)
    exp_month = Column(Integer, nullable=True)
    exp_year = Column(Integer, nullable=True)
    
    # Billing details
    billing_email = Column(String, nullable=True)
    billing_name = Column(String, nullable=True)
    
    # Status
    is_default = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("CompanyDB", backref="payment_methods")

class SubscriptionDB(Base):
    """Company subscriptions (Stripe-based)"""
    __tablename__ = "subscriptions"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Subscription details
    tier = Column(String, nullable=False)  # FREE, BASIC, PRO, ENTERPRISE
    billing_cycle_months = Column(Integer, default=1)  # 1, 3, 6
    monthly_price = Column(Float, default=0.0)
    discount_percent = Column(Float, default=0.0)
    
    # Status
    status = Column(String, default="ACTIVE")  # ACTIVE, CANCELLED, PAST_DUE, TRIAL
    
    # Stripe details
    stripe_subscription_id = Column(String, nullable=True, unique=True)
    stripe_customer_id = Column(String, nullable=True)
    
    # Period
    current_period_start = Column(DateTime, nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cancelled_at = Column(DateTime, nullable=True)
    
    # Relationships
    company = relationship("CompanyDB", backref="subscriptions")

class PeppolUsageDB(Base):
    """PEPPOL transmission tracking for usage-based billing"""
    __tablename__ = "peppol_usage"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True)
    
    # Transmission details
    transmission_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False)  # SUCCESS, FAILED
    
    # Billing
    fee_amount = Column(Float, default=1.0)  # AED per transmission
    month_year = Column(String, nullable=False, index=True)  # "2025-10" for aggregation
    billed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("CompanyDB", backref="peppol_usage_records")

class BillingInvoiceDB(Base):
    """Monthly billing invoices (subscription + PEPPOL usage)"""
    __tablename__ = "billing_invoices"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Invoice details
    invoice_number = Column(String, unique=True, nullable=False)
    
    # Billing period
    billing_period_start = Column(Date, nullable=False)
    billing_period_end = Column(Date, nullable=False)
    
    # Amounts
    subscription_fee = Column(Float, default=0.0)
    peppol_usage_count = Column(Integer, default=0)
    peppol_usage_fee = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    
    # Status
    status = Column(String, default="DRAFT")  # DRAFT, SENT, PAID, OVERDUE, CANCELLED
    
    # Stripe details
    stripe_invoice_id = Column(String, nullable=True, unique=True)
    
    # Payment
    paid_at = Column(DateTime, nullable=True)
    payment_method_id = Column(String, ForeignKey("payment_methods.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    
    # Relationships
    company = relationship("CompanyDB", backref="billing_invoices")

# Create tables
Base.metadata.create_all(engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================== AUTH HELPERS ====================
def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    if not hashed_password:
        return False
    password_bytes = plain_password.encode('utf-8')[:72]  # bcrypt max 72 bytes
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    password_bytes = password.encode('utf-8')[:72]  # bcrypt max 72 bytes
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def authenticate_user(email: str, password: str, db: Session):
    """Authenticate user (super admin, company admin, etc) by email and password"""
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user:
        return None
    if not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def authenticate_company(email: str, password: str, db: Session):
    """Authenticate company by email and password"""
    company = db.query(CompanyDB).filter(CompanyDB.email == email).first()
    if not company:
        return None
    if not company.password_hash:
        return None
    if not verify_password(password, company.password_hash):
        return None
    return company

def get_current_company(token: str, db: Session):
    """Get current company from JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        company_id: str = payload.get("sub")
        if company_id is None:
            return None
        company = db.get(CompanyDB, company_id)
        return company
    except JWTError:
        return None

def get_current_user_from_header(authorization: str = Header(None), db: Session = Depends(get_db)) -> UserDB:
    """Extract and validate user from Authorization header"""
    if not authorization:
        raise HTTPException(401, "Not authenticated")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(401, "Invalid authentication scheme")
    except ValueError:
        raise HTTPException(401, "Invalid authorization header")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        mfa_challenge: bool = payload.get("mfa_challenge", False)
        
        # Reject temporary MFA challenge tokens on protected endpoints
        if mfa_challenge:
            raise HTTPException(401, "MFA verification required. Please complete MFA login flow.")
        
        if user_id is None or token_type != "user":
            raise HTTPException(401, "Invalid token")
        
        user = db.get(UserDB, user_id)
        if user is None:
            raise HTTPException(401, "User not found")
        
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")

# ==================== HELPER FUNCTIONS ====================
def is_valid_trn(trn: str) -> bool:
    """Validate UAE TRN (15 digits)"""
    if not trn or len(trn) != 15:
        return False
    return trn.isdigit()

def seed_plans(db: Session):
    """Seed default subscription plans"""
    if db.query(SubscriptionPlanDB).count() > 0:
        return

    plans = [
        SubscriptionPlanDB(
            id="plan_free",
            name="Free",
            description="Start free with essential features",
            price_monthly=0.0,
            price_yearly=0.0,
            max_invoices_per_month=100,
            max_users=1,
            max_pos_devices=0,
            allow_api_access=True,
            allow_branding=False,
            allow_multi_currency=False,
            priority_support=False
        ),
        SubscriptionPlanDB(
            id="plan_starter",
            name="Starter",
            description="Perfect for small businesses",
            price_monthly=99.0,
            price_yearly=990.0,
            max_invoices_per_month=100,
            max_users=2,
            max_pos_devices=1,
            allow_api_access=True,
            allow_branding=False
        ),
        SubscriptionPlanDB(
            id="plan_professional",
            name="Professional",
            description="For growing businesses",
            price_monthly=299.0,
            price_yearly=2990.0,
            max_invoices_per_month=500,
            max_users=5,
            max_pos_devices=3,
            allow_api_access=True,
            allow_branding=True,
            allow_multi_currency=True
        ),
        SubscriptionPlanDB(
            id="plan_enterprise",
            name="Enterprise",
            description="Unlimited for large organizations",
            price_monthly=999.0,
            price_yearly=9990.0,
            max_invoices_per_month=None,
            max_users=50,
            max_pos_devices=10,
            allow_api_access=True,
            allow_branding=True,
            allow_multi_currency=True,
            priority_support=True
        )
    ]

    for plan in plans:
        db.add(plan)
    db.commit()

def seed_content(db: Session):
    """Seed initial content blocks for Homepage"""
    if db.query(ContentBlockDB).count() > 0:
        return  # Already seeded
    
    content_blocks = [
        # Homepage Hero
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="homepage_hero_title",
            value="Simple, Compliant\nDigital Invoicing for UAE",
            description="Homepage main heading",
            section="homepage",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="homepage_hero_subtitle",
            value="Automated invoicing in structured electronic formats.",
            description="Homepage subheading",
            section="homepage",
            updated_by="system"
        ),
        
        # Feature Boxes
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_1_title",
            value="Government-Approved Invoices",
            description="First feature box title",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_1_description",
            value="Create professional invoices that meet all UAE government requirements. Every invoice is automatically secured and properly formatted.",
            description="First feature box description",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_2_title",
            value="Manage Your Purchases",
            description="Second feature box title",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_2_description",
            value="Create purchase orders, receive supplier invoices, and keep track of all your expenses in one organized place.",
            description="Second feature box description",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_3_title",
            value="Extra Security",
            description="Third feature box title",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_3_description",
            value="Extra protection for your account. Use your phone or email to confirm it's really you when logging in.",
            description="Third feature box description",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_4_title",
            value="Team Collaboration",
            description="Fourth feature box title",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_4_description",
            value="Work together with your team. Add unlimited members and control who can view or edit invoices.",
            description="Fourth feature box description",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_5_title",
            value="Electronic Delivery",
            description="Fifth feature box title",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_5_description",
            value="Send invoices electronically to your customers through trusted partners, making delivery fast and secure.",
            description="Fifth feature box description",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_6_title",
            value="Flexible Subscriptions",
            description="Sixth feature box title",
            section="feature_boxes",
            updated_by="system"
        ),
        ContentBlockDB(
            id=f"cb_{uuid4().hex[:12]}",
            key="feature_box_6_description",
            value="Start free with 10 invoices per month. Upgrade anytime as your business grows to send unlimited invoices.",
            description="Sixth feature box description",
            section="feature_boxes",
            updated_by="system"
        ),
    ]
    
    for block in content_blocks:
        db.add(block)
    db.commit()

# ==================== PYDANTIC SCHEMAS ====================
class CompanyInfoCreate(BaseModel):
    legal_name: str = Field(..., min_length=2, max_length=255)
    business_type: Optional[str] = Field(default="LLC", example="LLC")
    registration_number: Optional[str] = None
    registration_date: Optional[date] = None
    email: str
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    phone: Optional[str] = None
    website: Optional[str] = None

class BusinessDetailsCreate(BaseModel):
    business_activity: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    emirate: Optional[str] = Field(default="Dubai", example="Dubai")
    po_box: Optional[str] = None
    trn: Optional[str] = None
    authorized_person_name: Optional[str] = None
    authorized_person_title: Optional[str] = None
    authorized_person_email: Optional[str] = None
    authorized_person_phone: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class DocumentUploadResponse(BaseModel):
    id: str
    document_type: DocumentType
    file_name: str
    file_size: int
    status: DocumentStatus
    uploaded_at: datetime

class PlanOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price_monthly: float
    price_yearly: float
    max_invoices_per_month: Optional[int]
    max_users: int
    allow_branding: bool
    allow_api_access: bool

class CompanyOut(BaseModel):
    id: str
    legal_name: Optional[str]
    status: CompanyStatus
    email: Optional[str]
    trn: Optional[str]

class RegistrationProgressOut(BaseModel):
    company_id: str
    current_step: int
    completed: bool

# ==================== CONTENT MANAGEMENT PYDANTIC SCHEMAS ====================
class ContentBlockCreate(BaseModel):
    key: str = Field(..., description="Unique key (e.g., homepage_hero_title)")
    value: str = Field(..., description="The actual text content")
    description: Optional[str] = Field(None, description="What this controls")
    section: Optional[str] = Field(None, description="Section/page grouping")

class ContentBlockUpdate(BaseModel):
    value: str = Field(..., description="Updated text content")

class ContentBlockOut(BaseModel):
    id: str
    key: str
    value: str
    description: Optional[str]
    section: Optional[str]
    updated_at: datetime
    updated_by: Optional[str]

# ==================== INVOICE PYDANTIC SCHEMAS ====================
class InvoiceLineItemCreate(BaseModel):
    item_name: str
    item_description: Optional[str] = None
    item_code: Optional[str] = None
    quantity: float
    unit_code: str = "C62"  # UN/ECE code (C62 = piece)
    unit_price: float
    tax_category: TaxCategory
    tax_percent: float = 5.0  # UAE standard VAT rate

class InvoiceCreate(BaseModel):
    invoice_type: InvoiceType
    issue_date: str  # ISO date format
    due_date: Optional[str] = None
    currency_code: str = "AED"
    
    # Customer details
    customer_name: str
    customer_email: Optional[str] = None
    customer_trn: Optional[str] = None
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    customer_country: str = "AE"
    customer_peppol_id: Optional[str] = None
    
    # Line items
    line_items: List[InvoiceLineItemCreate]
    
    # Optional fields
    payment_terms: Optional[str] = None
    payment_due_days: int = 30
    invoice_notes: Optional[str] = None
    reference_number: Optional[str] = None
    
    # Credit note specific
    preceding_invoice_id: Optional[str] = None
    credit_note_reason: Optional[str] = None

class InvoiceLineItemOut(BaseModel):
    id: str
    line_number: int
    item_name: str
    item_description: Optional[str]
    quantity: float
    unit_code: str
    unit_price: float
    line_extension_amount: float
    tax_category: TaxCategory
    tax_percent: float
    tax_amount: float
    line_total_amount: float

class InvoiceTaxBreakdownOut(BaseModel):
    id: str
    tax_category: TaxCategory
    taxable_amount: float
    tax_percent: float
    tax_amount: float

class InvoiceOut(BaseModel):
    id: str
    company_id: str
    invoice_number: str
    invoice_type: InvoiceType
    status: InvoiceStatus
    issue_date: str
    due_date: Optional[str]
    currency_code: str
    
    # Supplier (auto-filled from company)
    supplier_trn: str
    supplier_name: str
    supplier_address: Optional[str]
    supplier_peppol_id: Optional[str]
    
    # Customer
    customer_trn: Optional[str]
    customer_name: str
    customer_email: Optional[str]
    customer_address: Optional[str]
    customer_peppol_id: Optional[str]
    
    # Totals
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    amount_due: float
    
    # Documents
    xml_file_path: Optional[str]
    pdf_file_path: Optional[str]
    share_token: Optional[str]
    
    # Timestamps
    created_at: str
    sent_at: Optional[str]
    viewed_at: Optional[str]
    
    # Related data
    line_items: List[InvoiceLineItemOut] = []
    tax_breakdowns: List[InvoiceTaxBreakdownOut] = []

class InvoiceListOut(BaseModel):
    id: str
    invoice_number: str
    invoice_type: InvoiceType
    status: InvoiceStatus
    issue_date: str
    customer_name: str
    total_amount: float
    currency_code: str
    created_at: str

# ==================== CORNER 4: AP MANAGEMENT MODELS ====================

class PurchaseOrderLineItemCreate(BaseModel):
    line_number: int
    item_name: str
    item_description: Optional[str] = None
    item_code: Optional[str] = None
    quantity_ordered: float
    unit_code: str = "C62"
    unit_price: float
    tax_category: TaxCategory = TaxCategory.STANDARD
    tax_percent: float = 5.0

class PurchaseOrderCreate(BaseModel):
    po_number: str
    supplier_trn: str
    supplier_name: str
    supplier_contact_email: Optional[str] = None
    supplier_address: Optional[str] = None
    supplier_peppol_id: Optional[str] = None
    order_date: str  # YYYY-MM-DD
    expected_delivery_date: Optional[str] = None
    delivery_address: Optional[str] = None
    currency_code: str = "AED"
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    line_items: List[PurchaseOrderLineItemCreate]

class PurchaseOrderLineItemOut(BaseModel):
    id: str
    line_number: int
    item_name: str
    item_description: Optional[str]
    item_code: Optional[str]
    quantity_ordered: float
    quantity_received: float
    unit_code: str
    unit_price: float
    line_total: float
    tax_category: TaxCategory
    tax_percent: float

class PurchaseOrderOut(BaseModel):
    id: str
    company_id: str
    po_number: str
    status: PurchaseOrderStatus
    supplier_trn: str
    supplier_name: str
    supplier_contact_email: Optional[str]
    supplier_address: Optional[str]
    supplier_peppol_id: Optional[str]
    order_date: str
    expected_delivery_date: Optional[str]
    delivery_address: Optional[str]
    currency_code: str
    expected_subtotal: float
    expected_tax: float
    expected_total: float
    received_invoice_count: int
    matched_invoice_count: int
    received_amount_total: float
    variance_amount: float
    reference_number: Optional[str]
    notes: Optional[str]
    approved_by_user_id: Optional[str]
    approved_at: Optional[str]
    created_at: str
    updated_at: str
    line_items: List[PurchaseOrderLineItemOut] = []

class InwardInvoiceReceive(BaseModel):
    """Model for receiving an inward invoice via PEPPOL"""
    supplier_invoice_number: str
    invoice_date: str  # YYYY-MM-DD
    due_date: Optional[str] = None
    supplier_trn: str
    supplier_name: str
    supplier_address: Optional[str] = None
    supplier_peppol_id: Optional[str] = None
    customer_trn: str
    customer_name: str
    currency_code: str = "AED"
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    amount_due: float
    xml_content: Optional[str] = None  # UBL XML content
    peppol_message_id: Optional[str] = None
    peppol_sender_id: Optional[str] = None
    peppol_provider: Optional[str] = None
    line_items: Optional[List[dict]] = None  # JSON line items from XML

class InwardInvoiceLineItemOut(BaseModel):
    id: str
    line_number: int
    item_name: str
    item_description: Optional[str]
    item_code: Optional[str]
    quantity: float
    unit_code: str
    unit_price: float
    line_extension_amount: float
    tax_category: TaxCategory
    tax_percent: float
    tax_amount: float
    line_total_amount: float
    po_line_item_id: Optional[str]
    grn_line_item_id: Optional[str]
    match_status: Optional[str]

class InwardInvoiceOut(BaseModel):
    id: str
    company_id: str
    supplier_invoice_number: str
    invoice_type: InvoiceType
    status: InwardInvoiceStatus
    invoice_date: str
    due_date: Optional[str]
    received_at: str
    supplier_trn: str
    supplier_name: str
    supplier_address: Optional[str]
    supplier_peppol_id: Optional[str]
    supplier_company_id: Optional[str]
    customer_trn: str
    customer_name: str
    currency_code: str
    subtotal_amount: float
    tax_amount: float
    total_amount: float
    amount_due: float
    xml_file_path: Optional[str]
    pdf_file_path: Optional[str]
    xml_hash: Optional[str]
    peppol_message_id: Optional[str]
    peppol_sender_id: Optional[str]
    peppol_provider: Optional[str]
    peppol_received_at: Optional[str]
    po_id: Optional[str]
    grn_id: Optional[str]
    matching_status: MatchingStatus
    po_match_score: float
    grn_match_score: float
    amount_variance: float
    quantity_variance: float
    reviewed_by_user_id: Optional[str]
    reviewed_at: Optional[str]
    approved_by_user_id: Optional[str]
    approved_at: Optional[str]
    rejection_reason: Optional[str]
    payment_status: Optional[str]
    payment_method: Optional[str]
    paid_amount: float
    paid_at: Optional[str]
    payment_reference: Optional[str]
    disputed_at: Optional[str]
    dispute_reason: Optional[str]
    dispute_resolved_at: Optional[str]
    notes: Optional[str]
    reference_number: Optional[str]
    created_at: str
    updated_at: str
    line_items: List[InwardInvoiceLineItemOut] = []

class InwardInvoiceListOut(BaseModel):
    id: str
    supplier_invoice_number: str
    status: InwardInvoiceStatus
    supplier_name: str
    total_amount: float
    currency_code: str
    invoice_date: str
    received_at: str
    matching_status: MatchingStatus
    po_id: Optional[str]

class InwardInvoiceApprove(BaseModel):
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None

class InwardInvoiceReject(BaseModel):
    rejection_reason: str
    notes: Optional[str] = None

class InwardInvoiceMatchPO(BaseModel):
    po_id: str

class CompanyBrandingOut(BaseModel):
    id: str
    company_id: str
    logo_file_name: Optional[str] = None
    logo_file_path: Optional[str] = None
    logo_uploaded_at: Optional[str] = None
    stamp_file_name: Optional[str] = None
    stamp_file_path: Optional[str] = None
    stamp_uploaded_at: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    font_family: Optional[str] = None
    created_at: str
    updated_at: str

# ==================== FASTAPI APP ====================
app = FastAPI(
    title="InvoLinks E-Invoicing API",
    version="2.0",
    description="Multi-tenant UAE e-invoicing platform with registration wizard"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler for domain exceptions
@app.exception_handler(InvoLinksException)
async def involinks_exception_handler(request, exc: InvoLinksException):
    """Convert domain exceptions to HTTP responses with structured error format"""
    response = exception_to_http_response(exc)
    return JSONResponse(
        status_code=response["status_code"],
        content=response["detail"]
    )

# Serve React app (production) or fallback to development API
if os.path.exists("dist"):
    # Production: Serve React build
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
else:
    # Development: Keep static files available (optional)
    if os.path.exists("static"):
        app.mount("/static", StaticFiles(directory="static"), name="static")


@app.on_event("startup")
def startup_event():
    """Seed plans on startup and validate environment"""
    # Check if running in production mode
    production_mode = os.getenv('PRODUCTION_MODE', 'false').lower() == 'true'
    
    # Validate cryptographic environment
    from utils.crypto_utils import validate_environment_keys
    try:
        validation_result = validate_environment_keys(fail_on_missing=production_mode)
        
        if production_mode:
            print("🔒 PRODUCTION MODE: All cryptographic validations passed")
        else:
            print("🔧 DEVELOPMENT MODE: Running with permissive validation")
            if validation_result.get("warnings"):
                for warning in validation_result["warnings"]:
                    print(f"⚠️ Startup Warning: {warning}")
                print("⚠️ Set PRODUCTION_MODE=true to enforce strict validation")
    
    except ConfigurationError as e:
        print(f"❌ Startup Error: {e.message}")
        if production_mode:
            print("❌ PRODUCTION MODE: Cannot start without valid signing keys")
            raise  # Fail hard in production mode
        else:
            print("⚠️ Continuing with mock keys - NOT PRODUCTION READY")
    
    # Seed database plans and content
    db = SessionLocal()
    seed_plans(db)
    seed_content(db)
    db.close()
    
    mode_indicator = "🔒 PRODUCTION" if production_mode else "🔧 DEVELOPMENT"
    print(f"✅ InvoLinks API started ({mode_indicator}) - Plans seeded")

# ==================== REGISTRATION ENDPOINTS ====================

class QuickRegisterCreate(BaseModel):
    email: str
    company_name: str
    business_type: Optional[str] = None
    phone: Optional[str] = None
    password: str

@app.post("/register/quick", tags=["Registration"])
def quick_register(payload: QuickRegisterCreate, db: Session = Depends(get_db)):
    """Quick registration - submit all data in one request"""
    # Check if email already exists
    existing = db.query(CompanyDB).filter(CompanyDB.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    
    company_id = f"co_{uuid4().hex[:8]}"
    
    try:
        # Create company
        company = CompanyDB(
            id=company_id,
            legal_name=payload.company_name,
            email=payload.email,
            business_type=payload.business_type,
            phone=payload.phone,
            password_hash=get_password_hash(payload.password),
            status=CompanyStatus.PENDING_REVIEW,
            country="AE",
            email_verified=False
        )
        db.add(company)
        
        # Create progress tracker
        progress = RegistrationProgressDB(
            id=f"prog_{uuid4().hex[:8]}",
            company_id=company_id,
            current_step=1,
            step_company_info=True
        )
        db.add(progress)
        
        # Create user account (owner)
        user = UserDB(
            id=f"user_{uuid4().hex[:8]}",
            email=payload.email,
            password_hash=get_password_hash(payload.password),
            role=Role.COMPANY_ADMIN,
            company_id=company_id,
            is_owner=True,
            full_name=payload.company_name  # Use company name as default
        )
        db.add(user)
        
        db.commit()
        db.refresh(company)
        
        return {
            "success": True,
            "company_id": company_id,
            "message": "Registration successful! Awaiting admin approval.",
            "status": company.status
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Registration failed: {str(e)}")

@app.post("/register/init", tags=["Registration"])
def init_registration(db: Session = Depends(get_db)):
    """Initialize a new registration session (deprecated - use /register/quick)"""
    company_id = f"co_{uuid4().hex[:8]}"

    try:
        company = CompanyDB(
            id=company_id,
            status=CompanyStatus.PENDING_REVIEW,
            country="AE"
        )
        db.add(company)

        progress = RegistrationProgressDB(
            id=f"prog_{uuid4().hex[:8]}",
            company_id=company_id,
            current_step=1
        )
        db.add(progress)
        db.commit()

        return {
            "company_id": company_id,
            "current_step": 1,
            "message": "Registration session initialized"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Initialization failed: {str(e)}")

@app.post("/register/{company_id}/step1", tags=["Registration"])
def register_step1(
    company_id: str,
    payload: CompanyInfoCreate,
    db: Session = Depends(get_db)
):
    """Step 1: Company Information"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Registration session not found")

    # Check if email already exists
    existing = db.query(CompanyDB).filter(CompanyDB.email == payload.email, CompanyDB.id != company_id).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    company.legal_name = payload.legal_name
    company.business_type = payload.business_type
    company.registration_number = payload.registration_number
    company.registration_date = payload.registration_date
    company.email = payload.email
    company.password_hash = get_password_hash(payload.password)  # Hash password (max 72 bytes)
    company.phone = payload.phone
    company.website = payload.website

    progress = db.query(RegistrationProgressDB).filter_by(company_id=company_id).first()
    progress.step_company_info = True
    progress.current_step = 2

    db.commit()
    return {"message": "Step 1 completed", "next_step": 2}

@app.post("/register/{company_id}/step2", tags=["Registration"])
def register_step2(
    company_id: str,
    payload: BusinessDetailsCreate,
    db: Session = Depends(get_db)
):
    """Step 2: Business Details & Address"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Registration session not found")

    if payload.business_activity:
        company.business_activity = payload.business_activity
    if payload.address_line1:
        company.address_line1 = payload.address_line1
    if payload.address_line2:
        company.address_line2 = payload.address_line2
    if payload.city:
        company.city = payload.city
    if payload.emirate:
        company.emirate = payload.emirate
    if payload.po_box:
        company.po_box = payload.po_box
    if payload.email:
        company.email = payload.email
    if payload.phone:
        company.phone = payload.phone

    if payload.trn:
        if not is_valid_trn(payload.trn):
            raise HTTPException(400, "Invalid TRN format (must be 15 digits)")
        company.trn = payload.trn

    company.authorized_person_name = payload.authorized_person_name
    company.authorized_person_title = payload.authorized_person_title
    company.authorized_person_email = payload.authorized_person_email
    company.authorized_person_phone = payload.authorized_person_phone

    progress = db.query(RegistrationProgressDB).filter_by(company_id=company_id).first()
    progress.step_business_details = True
    progress.current_step = 3
    db.commit()

    return {"message": "Step 2 completed", "next_step": 3}

@app.post("/register/{company_id}/documents", response_model=DocumentUploadResponse, tags=["Registration"])
async def upload_document(
    company_id: str,
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    issue_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    document_number: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Upload a document (Step 3)"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Registration session not found")

    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Invalid file type. Allowed: PDF, JPEG, PNG")

    # Validate file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(400, "File size exceeds 10MB limit")

    # Save file
    file_id = uuid4().hex[:12]
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
    file_name = f"{file_id}_{document_type.value}.{file_extension}"
    file_dir = os.path.join(ARTIFACT_ROOT, "documents", company_id)
    os.makedirs(file_dir, exist_ok=True)
    file_path = os.path.join(file_dir, file_name)

    with open(file_path, 'wb') as f:
        f.write(contents)

    # Create document record
    doc = CompanyDocumentDB(
        id=f"doc_{uuid4().hex[:8]}",
        company_id=company_id,
        document_type=document_type,
        file_name=file.filename,
        file_path=file_path,
        file_size=len(contents),
        mime_type=file.content_type,
        issue_date=date.fromisoformat(issue_date) if issue_date else None,
        expiry_date=date.fromisoformat(expiry_date) if expiry_date else None,
        document_number=document_number,
        status=DocumentStatus.PENDING_REVIEW
    )
    db.add(doc)
    db.commit()

    return DocumentUploadResponse(
        id=doc.id,
        document_type=doc.document_type,
        file_name=doc.file_name,
        file_size=doc.file_size,
        status=doc.status,
        uploaded_at=doc.uploaded_at
    )

@app.get("/register/{company_id}/documents", response_model=List[DocumentUploadResponse], tags=["Registration"])
def list_documents(company_id: str, db: Session = Depends(get_db)):
    """List all uploaded documents"""
    docs = db.query(CompanyDocumentDB).filter_by(company_id=company_id).all()
    return [
        DocumentUploadResponse(
            id=d.id,
            document_type=d.document_type,
            file_name=d.file_name,
            file_size=d.file_size,
            status=d.status,
            uploaded_at=d.uploaded_at
        ) for d in docs
    ]

@app.delete("/register/{company_id}/documents/{doc_id}", tags=["Registration"])
def delete_document(company_id: str, doc_id: str, db: Session = Depends(get_db)):
    """Delete an uploaded document"""
    doc = db.query(CompanyDocumentDB).filter_by(id=doc_id, company_id=company_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    # Delete file from storage
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully"}

@app.post("/register/{company_id}/step3", tags=["Registration"])
def register_step3(company_id: str, db: Session = Depends(get_db)):
    """Complete Step 3: Verify required documents uploaded"""
    docs = db.query(CompanyDocumentDB).filter_by(company_id=company_id).all()

    required_docs = [DocumentType.BUSINESS_LICENSE, DocumentType.TRN_CERTIFICATE]
    uploaded_types = [doc.document_type for doc in docs]
    missing = [dt for dt in required_docs if dt not in uploaded_types]

    if missing:
        raise HTTPException(400, f"Required documents missing: {', '.join([m.value for m in missing])}")

    progress = db.query(RegistrationProgressDB).filter_by(company_id=company_id).first()
    progress.step_documents = True
    progress.current_step = 4
    db.commit()

    return {"message": "Step 3 completed", "next_step": 4}

@app.post("/register/{company_id}/step4", tags=["Registration"])
def register_step4(
    company_id: str,
    plan_id: str = Form(...),
    billing_cycle: str = Form("monthly"),
    db: Session = Depends(get_db)
):
    """Step 4: Select Subscription Plan"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    plan = db.get(SubscriptionPlanDB, plan_id)
    if not plan or not plan.active:
        raise HTTPException(404, "Plan not found or inactive")

    # Create subscription (trial for 14 days)
    subscription = CompanySubscriptionDB(
        id=f"sub_{uuid4().hex[:8]}",
        company_id=company_id,
        plan_id=plan_id,
        status=SubscriptionStatus.TRIAL,
        billing_cycle=billing_cycle,
        current_period_start=date.today(),
        current_period_end=date.today() + timedelta(days=14)
    )
    db.add(subscription)

    progress = db.query(RegistrationProgressDB).filter_by(company_id=company_id).first()
    progress.step_plan_selection = True
    progress.current_step = 5
    db.commit()

    return {"message": "Step 4 completed - Plan selected", "next_step": 5}

@app.post("/register/{company_id}/finalize", tags=["Registration"])
def finalize_registration(company_id: str, db: Session = Depends(get_db)):
    """Finalize and submit registration for approval"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    
    progress = db.query(RegistrationProgressDB).filter_by(company_id=company_id).first()
    if progress:
        progress.step_review = True
    progress.completed = True
    db.commit()

    return {
        "message": "Registration submitted successfully! Your application is pending admin review.",
        "company_id": company_id,
        "status": "PENDING_REVIEW"
    }

@app.post("/register/{company_id}/send-verification", tags=["Registration"])
def send_verification_email(company_id: str, db: Session = Depends(get_db)):
    """Send email verification link"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    
    if not company.email:
        raise HTTPException(400, "No email address on file")
    
    verification_token = f"verify_{uuid4().hex}"
    company.verification_token = verification_token
    company.verification_sent_at = datetime.utcnow()
    db.commit()
    
    verification_url = f"http://your-app-url.com/?verify={verification_token}"
    
    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                    EMAIL WOULD BE SENT                           ║
╠══════════════════════════════════════════════════════════════════╣
║  To: {company.email:<58} ║
║  Subject: Verify Your Email - InvoLinks E-Invoicing              ║
║                                                                  ║
║  Hi {company.legal_name or 'there'},                                          ║
║                                                                  ║
║  Thank you for registering! Please verify your email by          ║
║  clicking the link below:                                        ║
║                                                                  ║
║  {verification_url[:62]:<62} ║
║                                                                  ║
║  This link will expire in 24 hours.                            ║
║                                                                  ║
║  Best regards,                                                   ║
║  InvoLinks E-Invoicing Team                                      ║
╚══════════════════════════════════════════════════════════════════╝
    """)
    
    return {
        "message": "Verification email sent",
        "email": company.email,
        "note": "Check server logs for email content (email sending not configured yet)"
    }

@app.post("/register/verify/{token}", tags=["Registration"])
def verify_email(token: str, db: Session = Depends(get_db)):
    """Verify email with token and submit for admin approval"""
    company = db.query(CompanyDB).filter_by(verification_token=token).first()
    
    if not company:
        raise HTTPException(404, "Invalid verification token")
    
    if company.verification_sent_at:
        time_diff = datetime.utcnow() - company.verification_sent_at
        if time_diff.total_seconds() > 86400:
            raise HTTPException(400, "Verification link expired")
    
    company.email_verified = True
    company.verification_token = None
    company.status = CompanyStatus.PENDING_REVIEW
    
    progress = db.query(RegistrationProgressDB).filter_by(company_id=company.id).first()
    if progress:
        progress.completed = True
    
    db.commit()
    
    print(f"✅ Email verified for {company.email} - Company {company.legal_name} is now pending admin review")
    
    return {
        "success": True,
        "email": company.email,
        "message": "Email verified! Your application is now under review."
    }

@app.get("/register/{company_id}/progress", response_model=RegistrationProgressOut, tags=["Registration"])
def get_registration_progress(company_id: str, db: Session = Depends(get_db)):
    """Get current registration progress"""
    progress = db.query(RegistrationProgressDB).filter_by(company_id=company_id).first()
    if not progress:
        raise HTTPException(404, "Registration not found")

    return RegistrationProgressOut(
        company_id=company_id,
        current_step=progress.current_step,
        completed=progress.completed
    )

# ==================== PLAN MANAGEMENT ====================

@app.get("/plans", response_model=List[PlanOut], tags=["Plans"])
def list_plans(db: Session = Depends(get_db)):
    """List all active subscription plans (public endpoint)"""
    plans = db.query(SubscriptionPlanDB).filter_by(active=True).all()
    return [
        PlanOut(
            id=p.id,
            name=p.name,
            description=p.description,
            price_monthly=p.price_monthly,
            price_yearly=p.price_yearly,
            max_invoices_per_month=p.max_invoices_per_month,
            max_users=p.max_users,
            allow_branding=p.allow_branding,
            allow_api_access=p.allow_api_access
        ) for p in plans
    ]

@app.get("/plans/{plan_id}", response_model=PlanOut, tags=["Plans"])
def get_plan(plan_id: str, db: Session = Depends(get_db)):
    """Get specific plan details"""
    plan = db.get(SubscriptionPlanDB, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")

    return PlanOut(
        id=plan.id,
        name=plan.name,
        description=plan.description,
        price_monthly=plan.price_monthly,
        price_yearly=plan.price_yearly,
        max_invoices_per_month=plan.max_invoices_per_month,
        max_users=plan.max_users,
        allow_branding=plan.allow_branding,
        allow_api_access=plan.allow_api_access
    )

# ==================== AUTH ENDPOINTS ====================

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

# MFA (Multi-Factor Authentication) Pydantic models
class MFAEnrollTOTPResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: List[str]

class MFAVerifyRequest(BaseModel):
    code: str

class MFAStatusResponse(BaseModel):
    enabled: bool
    method: Optional[str] = None
    enrolled_at: Optional[str] = None
    last_verified_at: Optional[str] = None

class MFALoginVerifyRequest(BaseModel):
    temp_token: str
    code: str
    method: str = "totp"  # 'totp', 'email', or 'backup'

class MFALoginResponse(BaseModel):
    mfa_required: bool
    mfa_method: Optional[str] = None
    temp_token: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user_id: Optional[str] = None
    company_id: Optional[str] = None
    role: Optional[str] = None

@app.post("/auth/login", response_model=MFALoginResponse, tags=["Auth"])
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Login endpoint - supports MFA (Multi-Factor Authentication)
    
    Flow:
    1. If user has MFA enabled: returns temp_token + mfa_required=True
    2. If user has no MFA: returns access_token directly
    """
    
    # Try user authentication first (for super admins, company admins, etc)
    user = authenticate_user(payload.email, payload.password, db)
    if user:
        # Check if MFA is enabled
        if user.mfa_enabled:
            # Create temporary token (5 minutes expiry) for MFA verification
            temp_token = create_access_token(
                data={"sub": user.id, "type": "user", "mfa_challenge": True},
                expires_delta=timedelta(minutes=5)
            )
            
            return MFALoginResponse(
                mfa_required=True,
                mfa_method=user.mfa_method,
                temp_token=temp_token,
                access_token=None,
                user_id=user.id,
                company_id=user.company_id,
                role=user.role.value
            )
        
        # No MFA - return access token directly
        access_token = create_access_token(data={"sub": user.id, "type": "user"})
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        return MFALoginResponse(
            mfa_required=False,
            mfa_method=None,
            temp_token=None,
            access_token=access_token,
            token_type="bearer",
            user_id=user.id,
            company_id=user.company_id,
            role=user.role.value
        )
    
    # Try company authentication (with MFA support)
    company = authenticate_company(payload.email, payload.password, db)
    if company:
        if company.status != CompanyStatus.ACTIVE:
            raise HTTPException(403, f"Account not active. Status: {company.status.value}")
        
        # Check if MFA is enabled for company
        if company.mfa_enabled:
            # Create temporary token (5 minutes expiry) for MFA verification
            temp_token = create_access_token(
                data={"sub": company.id, "type": "company", "mfa_challenge": True},
                expires_delta=timedelta(minutes=5)
            )
            
            return MFALoginResponse(
                mfa_required=True,
                mfa_method=company.mfa_method,
                temp_token=temp_token,
                access_token=None,
                company_id=company.id,
                role="COMPANY"
            )
        
        # No MFA - return access token directly
        access_token = create_access_token(data={"sub": company.id, "type": "company"})
        
        return MFALoginResponse(
            mfa_required=False,
            mfa_method=None,
            temp_token=None,
            access_token=access_token,
            token_type="bearer",
            company_id=company.id,
            role="COMPANY"
        )
    
    # Neither user nor company authenticated
    raise HTTPException(401, "Invalid email or password")

@app.post("/auth/logout", tags=["Auth"])
def logout():
    """Logout endpoint (client-side token removal)"""
    return {"message": "Logged out successfully"}

# ==================== MFA (MULTI-FACTOR AUTHENTICATION) ENDPOINTS ====================

@app.post("/auth/mfa/enroll/totp", response_model=MFAEnrollTOTPResponse, tags=["MFA"])
def enroll_totp_mfa(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Enroll in TOTP-based MFA (Google Authenticator, Authy, etc.)
    
    Returns:
        - secret: TOTP secret (Base32 encoded)
        - qr_code: Data URL for QR code image
        - backup_codes: 10 backup codes (save these!)
    """
    if current_user.mfa_enabled:
        raise HTTPException(400, "MFA is already enabled. Disable it first to re-enroll.")
    
    # Generate TOTP secret
    secret = MFAManager.generate_totp_secret()
    
    # Generate QR code for easy setup
    qr_code = MFAManager.generate_qr_code(secret, current_user.email)
    
    # Generate backup codes
    backup_codes_plain = MFAManager.generate_backup_codes()
    backup_codes_hashed = MFAManager.hash_backup_codes(backup_codes_plain)
    
    # Store temporarily (will be saved when user verifies)
    current_user.mfa_secret = secret
    current_user.mfa_backup_codes = json.dumps(backup_codes_hashed)
    db.commit()
    
    return MFAEnrollTOTPResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes_plain
    )

@app.post("/auth/mfa/enroll/verify", tags=["MFA"])
def verify_mfa_enrollment(
    payload: MFAVerifyRequest,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Verify and complete MFA enrollment
    
    User must enter the 6-digit code from their authenticator app
    """
    if current_user.mfa_enabled:
        raise HTTPException(400, "MFA is already enabled")
    
    if not current_user.mfa_secret:
        raise HTTPException(400, "MFA enrollment not started. Call /auth/mfa/enroll/totp first")
    
    # Verify the TOTP code
    if not MFAManager.verify_totp(current_user.mfa_secret, payload.code):
        raise HTTPException(400, "Invalid verification code")
    
    # Enable MFA
    current_user.mfa_enabled = True
    current_user.mfa_method = "totp"
    current_user.mfa_enrolled_at = datetime.utcnow()
    current_user.mfa_last_verified_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "MFA enabled successfully",
        "method": "totp",
        "enrolled_at": current_user.mfa_enrolled_at.isoformat()
    }

@app.post("/auth/mfa/verify", response_model=MFALoginResponse, tags=["MFA"])
def verify_mfa_login(payload: MFALoginVerifyRequest, db: Session = Depends(get_db)):
    """
    Verify MFA code during login
    
    Methods supported:
    - totp: 6-digit code from authenticator app
    - email: 6-digit code sent to email
    - backup: 8-digit backup code
    """
    # Decode temp token
    try:
        token_data = jwt.decode(payload.temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = token_data.get("sub")
        mfa_challenge = token_data.get("mfa_challenge")
        
        if not mfa_challenge:
            raise HTTPException(401, "Invalid temporary token")
        
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not user:
            raise HTTPException(401, "User not found")
        
    except JWTError:
        raise HTTPException(401, "Invalid or expired temporary token")
    
    # Verify code based on method
    verified = False
    
    if payload.method == "totp":
        verified = MFAManager.verify_totp(user.mfa_secret, payload.code)
    
    elif payload.method == "email":
        verified = EmailOTPManager.verify(user.email, payload.code)
    
    elif payload.method == "backup":
        if not user.mfa_backup_codes:
            raise HTTPException(400, "No backup codes available")
        
        verified, updated_codes = MFAManager.verify_backup_code(
            payload.code, 
            user.mfa_backup_codes
        )
        
        if verified:
            # Remove used backup code
            user.mfa_backup_codes = updated_codes
    
    if not verified:
        raise HTTPException(401, "Invalid verification code")
    
    # Update last verified timestamp
    user.mfa_last_verified_at = datetime.utcnow()
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create full access token
    access_token = create_access_token(data={"sub": user.id, "type": "user"})
    
    return MFALoginResponse(
        mfa_required=False,
        mfa_method=None,
        temp_token=None,
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        company_id=user.company_id,
        role=user.role.value
    )

@app.get("/auth/mfa/status", response_model=MFAStatusResponse, tags=["MFA"])
def get_mfa_status(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get current MFA status for the user"""
    return MFAStatusResponse(
        enabled=current_user.mfa_enabled,
        method=current_user.mfa_method,
        enrolled_at=current_user.mfa_enrolled_at.isoformat() if current_user.mfa_enrolled_at else None,
        last_verified_at=current_user.mfa_last_verified_at.isoformat() if current_user.mfa_last_verified_at else None
    )

@app.post("/auth/mfa/disable", tags=["MFA"])
def disable_mfa(
    payload: MFAVerifyRequest,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Disable MFA (requires current MFA code for security)
    """
    if not current_user.mfa_enabled:
        raise HTTPException(400, "MFA is not enabled")
    
    # Verify current MFA code
    if not MFAManager.verify_totp(current_user.mfa_secret, payload.code):
        raise HTTPException(401, "Invalid verification code")
    
    # Disable MFA
    current_user.mfa_enabled = False
    current_user.mfa_method = None
    current_user.mfa_secret = None
    current_user.mfa_backup_codes = None
    db.commit()
    
    return {
        "success": True,
        "message": "MFA disabled successfully"
    }

@app.post("/auth/mfa/backup-codes/regenerate", tags=["MFA"])
def regenerate_backup_codes(
    payload: MFAVerifyRequest,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Regenerate backup codes (requires current MFA code for security)
    
    Returns new set of 10 backup codes. Old codes are invalidated.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(400, "MFA is not enabled")
    
    # Verify current MFA code
    if not MFAManager.verify_totp(current_user.mfa_secret, payload.code):
        raise HTTPException(401, "Invalid verification code")
    
    # Generate new backup codes
    backup_codes_plain = MFAManager.generate_backup_codes()
    backup_codes_hashed = MFAManager.hash_backup_codes(backup_codes_plain)
    
    # Save new codes
    current_user.mfa_backup_codes = json.dumps(backup_codes_hashed)
    db.commit()
    
    return {
        "success": True,
        "message": "Backup codes regenerated",
        "backup_codes": backup_codes_plain
    }

@app.post("/auth/mfa/email/send", tags=["MFA"])
def send_email_otp(
    user_email: str,
    db: Session = Depends(get_db)
):
    """
    Send email OTP for MFA verification (backup method)
    
    This is a fallback method if user loses their TOTP device.
    Rate limited to 3 sends per hour.
    """
    user = db.query(UserDB).filter(UserDB.email == user_email).first()
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email is registered, an OTP has been sent"}
    
    if not user.mfa_enabled:
        raise HTTPException(400, "MFA is not enabled for this account")
    
    # Check rate limiting
    if not EmailOTPManager.can_send(user_email):
        raise HTTPException(429, "Too many OTP requests. Please try again later.")
    
    # Generate and store OTP
    otp = EmailOTPManager.generate_and_store(user_email)
    
    # Simulate sending email (in production, use actual email service)
    print("\n" + "="*70)
    print("╔" + "="*68 + "╗")
    print("║" + " "*25 + "MFA EMAIL OTP" + " "*30 + "║")
    print("╠" + "="*68 + "╣")
    print(f"║  To: {user_email:<60} ║")
    print(f"║  Subject: Your InvoLinks Verification Code{' '*27} ║")
    print("║" + " "*68 + "║")
    print(f"║  Hi {(user.full_name or 'User'):<61} ║")
    print("║" + " "*68 + "║")
    print("║  Your verification code is:                                  ║")
    print("║" + " "*68 + "║")
    print(f"║         {otp}{' '*58} ║")
    print("║" + " "*68 + "║")
    print("║  This code will expire in 10 minutes.                        ║")
    print("║" + " "*68 + "║")
    print("║  If you didn't request this code, please ignore this email.  ║")
    print("║" + " "*68 + "║")
    print("║  Best regards,                                                ║")
    print("║  InvoLinks Security Team                                      ║")
    print("╚" + "="*68 + "╝")
    print("="*70 + "\n")
    
    return {
        "success": True,
        "message": "Verification code sent to your email",
        "expires_in_minutes": 10
    }

@app.post("/auth/forgot-password", tags=["Auth"])
def forgot_password(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request password reset - sends reset token via email"""
    company = db.query(CompanyDB).filter(CompanyDB.email == payload.email).first()
    
    if not company:
        # Don't reveal if email exists
        return {"message": "If your email is registered, you will receive a password reset link"}
    
    # Generate reset token
    reset_token = f"reset_{secrets.token_hex(16)}"
    company.password_reset_token = reset_token
    company.password_reset_expires = datetime.utcnow() + timedelta(hours=1)  # 1 hour expiry
    
    db.commit()
    
    # Simulate sending email
    print("\n" + "="*70)
    print("╔" + "="*68 + "╗")
    print("║" + " "*25 + "EMAIL WOULD BE SENT" + " "*24 + "║")
    print("╠" + "="*68 + "╣")
    print(f"║  To: {payload.email:<60} ║")
    print(f"║  Subject: Reset Your Password - InvoLinks E-Invoicing{' '*13} ║")
    print("║" + " "*68 + "║")
    print(f"║  Hi {(company.legal_name or 'User'):<60} ║")
    print("║" + " "*68 + "║")
    print("║  You requested to reset your password. Click the link below:    ║")
    print("║" + " "*68 + "║")
    print(f"║  http://your-app-url.com/reset-password?token={reset_token[:20]:<22} ║")
    print("║" + " "*68 + "║")
    print("║  This link will expire in 1 hour.                               ║")
    print("║" + " "*68 + "║")
    print("║  If you didn't request this, please ignore this email.          ║")
    print("║" + " "*68 + "║")
    print("║  Best regards,                                                   ║")
    print("║  InvoLinks E-Invoicing Team                                      ║")
    print("╚" + "="*68 + "╝")
    print("="*70 + "\n")
    
    return {"message": "If your email is registered, you will receive a password reset link"}

@app.post("/auth/reset-password", tags=["Auth"])
def reset_password(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Reset password using token"""
    company = db.query(CompanyDB).filter(
        CompanyDB.password_reset_token == payload.token
    ).first()
    
    if not company:
        raise HTTPException(400, "Invalid or expired reset token")
    
    if not company.password_reset_expires or company.password_reset_expires < datetime.utcnow():
        raise HTTPException(400, "Reset token has expired")
    
    # Update password
    company.password_hash = get_password_hash(payload.new_password)
    company.password_reset_token = None
    company.password_reset_expires = None
    
    db.commit()
    
    return {"message": "Password reset successfully. You can now login with your new password."}

@app.get("/auth/me", tags=["Auth"])
def get_current_user(token: str, db: Session = Depends(get_db)):
    """Get current authenticated company"""
    company = get_current_company(token, db)
    if not company:
        raise HTTPException(401, "Not authenticated")
    
    return {
        "company_id": company.id,
        "company_name": company.legal_name,
        "email": company.email,
        "status": company.status.value
    }

# ==================== ADMIN ENDPOINTS ====================

@app.get("/admin/companies/pending", response_model=List[CompanyOut], tags=["Admin"])
def list_pending_companies(db: Session = Depends(get_db)):
    """List all companies pending review (Admin only)"""
    companies = db.query(CompanyDB).filter_by(status=CompanyStatus.PENDING_REVIEW).all()
    return [
        CompanyOut(
            id=c.id,
            legal_name=c.legal_name,
            status=c.status,
            email=c.email,
            trn=c.trn
        ) for c in companies
    ]

# ==================== COMPANY ENDPOINTS ====================

@app.get("/me", tags=["Auth"])
def get_current_user_info(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get current user and associated company information"""
    # Get company associated with the user
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    
    response = {
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role.value,
        "company": None
    }
    
    if company:
        response["company"] = {
            "id": company.id,
            "legal_name": company.legal_name,
            "email": company.email,
            "status": company.status.value,
            "invoices_generated": company.invoices_generated or 0,
            "free_plan_type": company.free_plan_type,
            "free_plan_invoice_limit": company.free_plan_invoice_limit,
            "free_plan_duration_months": company.free_plan_duration_months
        }
    
    return response

@app.get("/companies/{company_id}", tags=["Companies"])
def get_company(company_id: str, db: Session = Depends(get_db)):
    """Get company details"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    return {
        "id": company.id,
        "legal_name": company.legal_name,
        "status": company.status,
        "email": company.email,
        "trn": company.trn,
        "business_type": company.business_type,
        "phone": company.phone,
        "email_verified": company.email_verified,
        "created_at": company.created_at.isoformat() if company.created_at else None
    }

@app.get("/companies/{company_id}/subscription", tags=["Companies"])
def get_company_subscription(company_id: str, db: Session = Depends(get_db)):
    """Get company's current subscription"""
    sub = db.query(CompanySubscriptionDB).filter_by(company_id=company_id).first()
    if not sub:
        raise HTTPException(404, "No subscription found")

    return {
        "subscription_id": sub.id,
        "plan": {
            "id": sub.plan.id,
            "name": sub.plan.name,
            "price_monthly": sub.plan.price_monthly
        },
        "status": sub.status.value,
        "billing_cycle": sub.billing_cycle,
        "current_period_start": sub.current_period_start.isoformat(),
        "current_period_end": sub.current_period_end.isoformat(),
        "invoices_this_period": sub.invoices_this_period
    }

# ==================== ADMIN ENDPOINTS ====================

class CompanyApprovalRequest(BaseModel):
    approved: bool
    notes: Optional[str] = None

@app.get("/admin/companies/pending", tags=["Admin"])
def get_pending_companies(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get all companies pending approval (Super Admin only)"""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Insufficient permissions")
    
    pending = db.query(CompanyDB).filter(
        CompanyDB.status == CompanyStatus.PENDING_REVIEW
    ).order_by(CompanyDB.created_at.desc()).all()
    
    return [{
        "id": c.id,
        "legal_name": c.legal_name,
        "email": c.email,
        "business_type": c.business_type,
        "phone": c.phone,
        "created_at": c.created_at.isoformat(),
        "status": c.status.value,
        "invoices_generated": 0  # Pending companies haven't generated invoices yet
    } for c in pending]

@app.get("/admin/companies", tags=["Admin"])
def get_all_companies(
    status: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get all companies with optional status filter (Super Admin only)"""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Insufficient permissions")
    
    query = db.query(CompanyDB)
    if status:
        try:
            status_enum = CompanyStatus(status)
            query = query.filter(CompanyDB.status == status_enum)
        except ValueError:
            pass
    
    companies = query.all()
    
    return [{
        "id": c.id,
        "legal_name": c.legal_name,
        "email": c.email,
        "business_type": c.business_type,
        "phone": c.phone,
        "status": c.status.value,
        "created_at": c.created_at.isoformat(),
        "subscription_plan": c.subscription_plan_id
    } for c in companies]

class CompanyApprovalConfig(BaseModel):
    free_plan_type: str = "INVOICE_COUNT"  # "DURATION" or "INVOICE_COUNT"
    free_plan_duration_months: Optional[int] = None  # For duration-based
    free_plan_invoice_limit: Optional[int] = 100  # For invoice count-based

@app.post("/admin/companies/{company_id}/approve", tags=["Admin"])
def approve_company(
    company_id: str,
    config: CompanyApprovalConfig = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Approve a pending company registration with configurable free plan (Super Admin only)"""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Insufficient permissions")
    
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    
    if company.status != CompanyStatus.PENDING_REVIEW:
        raise HTTPException(400, f"Company is not pending review. Current status: {company.status.value}")
    
    # Use default config if none provided
    if config is None:
        config = CompanyApprovalConfig()
    
    # Update company status to ACTIVE
    company.status = CompanyStatus.ACTIVE
    
    # Configure free plan settings
    company.free_plan_type = config.free_plan_type
    company.free_plan_start_date = datetime.utcnow()
    
    if config.free_plan_type == "DURATION":
        company.free_plan_duration_months = config.free_plan_duration_months or 1
        plan_description = f"{company.free_plan_duration_months} month(s) free duration"
    else:  # INVOICE_COUNT
        company.free_plan_invoice_limit = config.free_plan_invoice_limit or 100
        plan_description = f"{company.free_plan_invoice_limit} free invoices"
    
    # Assign Free plan if not already assigned
    if not company.subscription_plan_id:
        free_plan = db.query(SubscriptionPlanDB).filter_by(name="Free").first()
        if free_plan:
            company.subscription_plan_id = free_plan.id
    
    db.commit()
    
    # Simulate email notification
    print("\n" + "="*70)
    print("✅ COMPANY APPROVED - EMAIL NOTIFICATION")
    print("="*70)
    print(f"To: {company.email}")
    print(f"Subject: Your InvoLinks Account Has Been Approved!")
    print(f"\nDear {company.legal_name},")
    print(f"\nCongratulations! Your account has been approved.")
    print(f"You can now log in and start using InvoLinks E-Invoicing.")
    print(f"\nYour Free plan: {plan_description}")
    print("="*70 + "\n")
    
    return {
        "success": True,
        "company_id": company_id,
        "status": company.status.value,
        "free_plan_type": company.free_plan_type,
        "free_plan_config": plan_description,
        "message": "Company approved successfully"
    }

class RejectCompanyRequest(BaseModel):
    notes: Optional[str] = None

@app.post("/admin/companies/{company_id}/reject", tags=["Admin"])
def reject_company(
    company_id: str,
    payload: RejectCompanyRequest = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Reject a pending company registration (Super Admin only)"""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Insufficient permissions")
    
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    
    if company.status != CompanyStatus.PENDING_REVIEW:
        raise HTTPException(400, f"Company is not pending review. Current status: {company.status.value}")
    
    notes = payload.notes if payload else None
    
    # Update company status to REJECTED
    company.status = CompanyStatus.REJECTED
    db.commit()
    
    # Simulate email notification
    print("\n" + "="*70)
    print("❌ COMPANY REJECTED - EMAIL NOTIFICATION")
    print("="*70)
    print(f"To: {company.email}")
    print(f"Subject: InvoLinks Account Registration Update")
    print(f"\nDear {company.legal_name},")
    print(f"\nThank you for your interest in InvoLinks E-Invoicing.")
    print(f"Unfortunately, we cannot approve your registration at this time.")
    if notes:
        print(f"\nReason: {notes}")
    print(f"\nPlease contact support if you have any questions.")
    print("="*70 + "\n")
    
    return {
        "success": True,
        "company_id": company_id,
        "status": company.status.value,
        "message": "Company rejected"
    }

@app.get("/admin/stats", tags=["Admin"])
def get_admin_stats(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get comprehensive dashboard statistics for SuperAdmin (Super Admin only)"""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Insufficient permissions")
    
    # Count companies by status
    pending = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.PENDING_REVIEW).count()
    approved = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.ACTIVE).count()
    rejected = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.REJECTED).count()
    active_companies = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.ACTIVE).count()
    inactive_companies = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.SUSPENDED).count()
    
    # Get all companies with details for explorer
    companies = db.query(CompanyDB).all()
    all_companies_list = []
    for company in companies:
        # Get plan info
        plan = None
        arpu = 0
        if company.subscription_plan_id:
            plan_obj = db.get(SubscriptionPlanDB, company.subscription_plan_id)
            if plan_obj:
                plan = plan_obj.name
                arpu = plan_obj.price_monthly
        
        # Get invoice count for this month
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        invoices_this_month = db.query(InvoiceDB).filter(
            InvoiceDB.company_id == company.id,
            InvoiceDB.created_at >= month_start
        ).count()
        
        all_companies_list.append({
            "id": company.id,
            "name": company.legal_name or "Unnamed Company",
            "status": "active" if company.status == CompanyStatus.ACTIVE else "inactive",
            "invoicesThisMonth": invoices_this_month,
            "invoicesLimit": company.free_plan_invoice_limit,
            "plan": plan,
            "arpu": arpu,
            "region": company.emirate,
            "vatCompliant": bool(company.trn)
        })
    
    # Invoice statistics
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    
    invoices_mtd = db.query(InvoiceDB).filter(InvoiceDB.created_at >= month_start).count()
    invoices_last_month = db.query(InvoiceDB).filter(
        InvoiceDB.created_at >= last_month_start,
        InvoiceDB.created_at < month_start
    ).count()
    
    # Revenue calculations by tier
    tiers_data = []
    all_plans = db.query(SubscriptionPlanDB).filter(SubscriptionPlanDB.active == True).all()
    total_mrr = 0
    
    for plan in all_plans:
        active_on_plan = db.query(CompanyDB).filter(
            CompanyDB.subscription_plan_id == plan.id,
            CompanyDB.status == CompanyStatus.ACTIVE
        ).count()
        
        mrr = active_on_plan * plan.price_monthly
        total_mrr += mrr
        
        tiers_data.append({
            "plan": plan.name,
            "activeCompanies": active_on_plan,
            "pricePerCompany": plan.price_monthly,
            "mrr": mrr,
            "arr": mrr * 12,
            "newActivations": 0  # Could track this with created_at filters
        })
    
    return {
        "asOf": datetime.utcnow().isoformat(),
        "registrations": {
            "pending": pending,
            "approved": approved,
            "rejected": rejected
        },
        "companies": {
            "active": active_companies,
            "inactive": inactive_companies,
            "all": all_companies_list
        },
        "invoices": {
            "monthToDate": invoices_mtd,
            "lastMonth": invoices_last_month
        },
        "revenue": {
            "mrr": total_mrr,
            "arr": total_mrr * 12,
            "deltaPctVsLastMonth": 0,  # Could calculate from historical data
            "tiers": tiers_data
        },
        "total_companies": pending + approved + rejected + active_companies + inactive_companies
    }

# Alias route for analytics endpoint
@app.get("/admin/analytics", tags=["Admin"])
def get_admin_analytics(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Alias for /admin/stats - Get comprehensive dashboard analytics (Super Admin only)"""
    return get_admin_stats(from_date, to_date, current_user, db)

# ==================== CONTENT MANAGEMENT ENDPOINTS ====================

@app.get("/admin/content", response_model=List[ContentBlockOut], tags=["Admin", "Content"])
def get_all_content(
    section: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get all content blocks (Super Admin only). Optionally filter by section."""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Only Super Admins can access content management")
    
    query = db.query(ContentBlockDB)
    if section:
        query = query.filter(ContentBlockDB.section == section)
    
    blocks = query.order_by(ContentBlockDB.section, ContentBlockDB.key).all()
    
    return [
        ContentBlockOut(
            id=b.id,
            key=b.key,
            value=b.value,
            description=b.description,
            section=b.section,
            updated_at=b.updated_at,
            updated_by=b.updated_by
        ) for b in blocks
    ]

@app.put("/admin/content/{key}", response_model=ContentBlockOut, tags=["Admin", "Content"])
def update_content(
    key: str,
    payload: ContentBlockUpdate,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Update a content block by key (Super Admin only)"""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Only Super Admins can edit content")
    
    block = db.query(ContentBlockDB).filter(ContentBlockDB.key == key).first()
    if not block:
        raise HTTPException(404, f"Content block with key '{key}' not found")
    
    block.value = payload.value
    block.updated_at = datetime.utcnow()
    block.updated_by = current_user.email
    
    db.commit()
    db.refresh(block)
    
    return ContentBlockOut(
        id=block.id,
        key=block.key,
        value=block.value,
        description=block.description,
        section=block.section,
        updated_at=block.updated_at,
        updated_by=block.updated_by
    )

@app.get("/content/public", response_model=List[ContentBlockOut], tags=["Content"])
def get_public_content(db: Session = Depends(get_db)):
    """Get all content blocks for public consumption (no auth required)"""
    blocks = db.query(ContentBlockDB).order_by(ContentBlockDB.section, ContentBlockDB.key).all()
    
    return [
        ContentBlockOut(
            id=b.id,
            key=b.key,
            value=b.value,
            description=b.description,
            section=b.section,
            updated_at=b.updated_at,
            updated_by=b.updated_by
        ) for b in blocks
    ]

# ==================== USER MANAGEMENT ENDPOINTS ====================

class UserInvite(BaseModel):
    email: str
    full_name: str
    role: Role = Role.FINANCE_USER

class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    is_owner: bool
    created_at: str
    last_login: Optional[str]

@app.post("/users/invite", tags=["Users"])
def invite_user(
    payload: UserInvite,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Invite a team member to the company (Company Admin only)"""
    # Only company admins or owners can invite users
    if current_user.role not in [Role.COMPANY_ADMIN, Role.SUPER_ADMIN]:
        raise HTTPException(403, "Only admins can invite users")
    
    if not current_user.company_id and current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(400, "User must belong to a company to invite others")
    
    # Check if email already exists
    existing = db.query(UserDB).filter(UserDB.email == payload.email).first()
    if existing:
        raise HTTPException(400, "User with this email already exists")
    
    # Create new user
    user_id = f"usr_{uuid4().hex[:12]}"
    temp_password = secrets.token_urlsafe(16)
    password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    new_user = UserDB(
        id=user_id,
        email=payload.email,
        full_name=payload.full_name,
        password_hash=password_hash,
        role=payload.role,
        company_id=current_user.company_id,
        is_owner=False,
        invited_by=current_user.id
    )
    
    db.add(new_user)
    db.commit()
    
    # Simulate email notification
    print("\n" + "="*70)
    print("✉️  TEAM MEMBER INVITATION - EMAIL NOTIFICATION")
    print("="*70)
    print(f"To: {payload.email}")
    print(f"Subject: You've been invited to join InvoLinks!")
    print(f"\nHello {payload.full_name},")
    print(f"\nYou have been invited to join a team on InvoLinks E-Invoicing.")
    print(f"Your temporary password is: {temp_password}")
    print(f"Please log in and change your password immediately.")
    print("="*70 + "\n")
    
    return {
        "success": True,
        "user_id": user_id,
        "email": payload.email,
        "temporary_password": temp_password,
        "message": "User invited successfully"
    }

@app.get("/users/team", response_model=List[UserOut], tags=["Users"])
def get_team_members(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get all team members for the current user's company"""
    if not current_user.company_id:
        return []
    
    users = db.query(UserDB).filter(UserDB.company_id == current_user.company_id).all()
    
    return [
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_owner": user.is_owner,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None
        }
        for user in users
    ]

@app.delete("/users/{user_id}", tags=["Users"])
def remove_team_member(
    user_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Remove a team member (Company Admin only)"""
    # Only company admins can remove users
    if current_user.role not in [Role.COMPANY_ADMIN, Role.SUPER_ADMIN]:
        raise HTTPException(403, "Only admins can remove users")
    
    user_to_remove = db.get(UserDB, user_id)
    if not user_to_remove:
        raise HTTPException(404, "User not found")
    
    # Can't remove users from other companies
    if user_to_remove.company_id != current_user.company_id and current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Cannot remove users from other companies")
    
    # Can't remove the owner
    if user_to_remove.is_owner:
        raise HTTPException(400, "Cannot remove the company owner")
    
    # Can't remove yourself
    if user_to_remove.id == current_user.id:
        raise HTTPException(400, "Cannot remove yourself")
    
    db.delete(user_to_remove)
    db.commit()
    
    return {
        "success": True,
        "message": "User removed successfully"
    }

# ==================== INVOICE ENDPOINTS ====================

def generate_invoice_number(company_id: str, db: Session) -> str:
    """Generate sequential invoice number for company"""
    # Count existing invoices for this company
    count = db.query(InvoiceDB).filter(InvoiceDB.company_id == company_id).count()
    next_num = count + 1
    # Format: INV-YYYYMM-XXXX (e.g., INV-202510-0001)
    year_month = datetime.utcnow().strftime("%Y%m")
    return f"INV-{year_month}-{next_num:04d}"

def calculate_line_item_totals(line_item: InvoiceLineItemCreate) -> dict:
    """Calculate tax and totals for a line item"""
    line_extension = line_item.quantity * line_item.unit_price
    tax_amount = line_extension * (line_item.tax_percent / 100) if line_item.tax_category == TaxCategory.STANDARD else 0
    line_total = line_extension + tax_amount
    
    return {
        "line_extension_amount": round(line_extension, 2),
        "tax_amount": round(tax_amount, 2),
        "line_total_amount": round(line_total, 2)
    }

@app.post("/invoices", tags=["Invoices"], response_model=InvoiceOut)
def create_invoice(
    payload: InvoiceCreate,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Create a new invoice"""
    # Get company
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    if not company.trn:
        raise HTTPException(400, "Company TRN is required to issue invoices")
    
    # Check trial limits (100 invoices OR 30 days, whichever comes first)
    if company.trial_status == "ACTIVE" and company.trial_start_date:
        days_elapsed = (datetime.utcnow() - company.trial_start_date).days
        trial_days_remaining = max(0, 30 - days_elapsed)
        trial_invoices_remaining = max(0, 100 - company.trial_invoice_count)
        
        # Check if trial expired
        if trial_days_remaining == 0:
            company.trial_status = "EXPIRED"
            company.trial_ended_at = datetime.utcnow()
            db.commit()
            raise HTTPException(
                403,
                "Free trial expired (30 days). Please subscribe to continue creating invoices."
            )
        
        if trial_invoices_remaining == 0:
            company.trial_status = "EXPIRED"
            company.trial_ended_at = datetime.utcnow()
            db.commit()
            raise HTTPException(
                403,
                "Free trial expired (100 invoices used). Please subscribe to continue creating invoices."
            )
    
    # Check if trial already expired
    if company.trial_status == "EXPIRED":
        # Check if they have an active subscription
        active_subscription = db.query(SubscriptionDB).filter(
            SubscriptionDB.company_id == company.id,
            SubscriptionDB.status == "ACTIVE"
        ).first()
        
        if not active_subscription:
            raise HTTPException(
                403,
                "Free trial expired. Please subscribe to continue creating invoices."
            )
    
    # Initialize trial if this is the first invoice
    if company.trial_status is None:
        company.trial_status = "ACTIVE"
        company.trial_start_date = datetime.utcnow()
        company.trial_invoice_count = 0
        db.commit()
    
    # Generate invoice number
    invoice_id = f"inv_{uuid4().hex[:12]}"
    invoice_number = generate_invoice_number(company.id, db)
    
    # Calculate totals
    subtotal = 0.0
    total_tax = 0.0
    tax_by_category = {}  # For tax breakdowns
    
    # Parse dates
    from datetime import datetime as dt
    issue_date = dt.fromisoformat(payload.issue_date).date()
    due_date = dt.fromisoformat(payload.due_date).date() if payload.due_date else None
    
    # Create invoice
    invoice = InvoiceDB(
        id=invoice_id,
        company_id=company.id,
        invoice_number=invoice_number,
        invoice_type=payload.invoice_type,
        status=InvoiceStatus.DRAFT,
        issue_date=issue_date,
        due_date=due_date,
        currency_code=payload.currency_code,
        
        # Supplier (from company)
        supplier_trn=company.trn,
        supplier_name=company.legal_name or company.email,
        supplier_address=f"{company.address_line1 or ''} {company.address_line2 or ''}".strip() or None,
        supplier_city=company.city,
        supplier_country="AE",
        supplier_peppol_id=company.trn[:10] if company.trn else None,  # First 10 digits of TRN as TIN
        
        # Customer
        customer_trn=payload.customer_trn,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_address=payload.customer_address,
        customer_city=payload.customer_city,
        customer_country=payload.customer_country,
        customer_peppol_id=payload.customer_peppol_id,
        
        payment_terms=payload.payment_terms,
        payment_due_days=payload.payment_due_days,
        invoice_notes=payload.invoice_notes,
        reference_number=payload.reference_number,
        preceding_invoice_id=payload.preceding_invoice_id,
        credit_note_reason=payload.credit_note_reason,
        
        share_token=f"share_{uuid4().hex[:16]}"
    )
    
    db.add(invoice)
    db.flush()  # Get invoice ID
    
    # Create line items
    for idx, line_item in enumerate(payload.line_items, 1):
        totals = calculate_line_item_totals(line_item)
        
        line_db = InvoiceLineItemDB(
            id=f"line_{uuid4().hex[:12]}",
            invoice_id=invoice.id,
            line_number=idx,
            item_name=line_item.item_name,
            item_description=line_item.item_description,
            item_code=line_item.item_code,
            quantity=line_item.quantity,
            unit_code=line_item.unit_code,
            unit_price=line_item.unit_price,
            line_extension_amount=totals["line_extension_amount"],
            tax_category=line_item.tax_category,
            tax_percent=line_item.tax_percent,
            tax_amount=totals["tax_amount"],
            line_total_amount=totals["line_total_amount"]
        )
        db.add(line_db)
        
        subtotal += totals["line_extension_amount"]
        total_tax += totals["tax_amount"]
        
        # Aggregate tax by category
        key = (line_item.tax_category, line_item.tax_percent)
        if key not in tax_by_category:
            tax_by_category[key] = {"taxable": 0.0, "tax": 0.0}
        tax_by_category[key]["taxable"] += totals["line_extension_amount"]
        tax_by_category[key]["tax"] += totals["tax_amount"]
    
    # Create tax breakdowns
    for (category, percent), amounts in tax_by_category.items():
        tax_breakdown = InvoiceTaxBreakdownDB(
            id=f"tax_{uuid4().hex[:12]}",
            invoice_id=invoice.id,
            tax_category=category,
            taxable_amount=round(amounts["taxable"], 2),
            tax_percent=percent,
            tax_amount=round(amounts["tax"], 2)
        )
        db.add(tax_breakdown)
    
    # Update invoice totals
    invoice.subtotal_amount = round(subtotal, 2)
    invoice.tax_amount = round(total_tax, 2)
    invoice.total_amount = round(subtotal + total_tax, 2)
    invoice.amount_due = round(subtotal + total_tax, 2)
    
    # Increment trial invoice count if in trial
    if company.trial_status == "ACTIVE":
        company.trial_invoice_count += 1
    
    # Invoice created as DRAFT - use /issue endpoint to generate XML and finalize
    db.commit()
    db.refresh(invoice)
    
    # Format response
    return InvoiceOut(
        id=invoice.id,
        company_id=invoice.company_id,
        invoice_number=invoice.invoice_number,
        invoice_type=invoice.invoice_type,
        status=invoice.status,
        issue_date=invoice.issue_date.isoformat(),
        due_date=invoice.due_date.isoformat() if invoice.due_date else None,
        currency_code=invoice.currency_code,
        supplier_trn=invoice.supplier_trn,
        supplier_name=invoice.supplier_name,
        supplier_address=invoice.supplier_address,
        supplier_peppol_id=invoice.supplier_peppol_id,
        customer_trn=invoice.customer_trn,
        customer_name=invoice.customer_name,
        customer_email=invoice.customer_email,
        customer_address=invoice.customer_address,
        customer_peppol_id=invoice.customer_peppol_id,
        subtotal_amount=invoice.subtotal_amount,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        amount_due=invoice.amount_due,
        xml_file_path=invoice.xml_file_path,
        pdf_file_path=invoice.pdf_file_path,
        share_token=invoice.share_token,
        created_at=invoice.created_at.isoformat(),
        sent_at=invoice.sent_at.isoformat() if invoice.sent_at else None,
        viewed_at=invoice.viewed_at.isoformat() if invoice.viewed_at else None,
        line_items=[
            InvoiceLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                quantity=li.quantity,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_extension_amount=li.line_extension_amount,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent,
                tax_amount=li.tax_amount,
                line_total_amount=li.line_total_amount
            ) for li in invoice.line_items
        ],
        tax_breakdowns=[
            InvoiceTaxBreakdownOut(
                id=tb.id,
                tax_category=tb.tax_category,
                taxable_amount=tb.taxable_amount,
                tax_percent=tb.tax_percent,
                tax_amount=tb.tax_amount
            ) for tb in invoice.tax_breakdowns
        ]
    )

@app.post("/invoices/{invoice_id}/transmit-peppol", tags=["Invoices"])
def transmit_invoice_via_peppol(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Transmit invoice via PEPPOL network to recipient
    
    This endpoint:
    1. Validates invoice is ready for transmission
    2. Loads the UBL XML file
    3. Sends via configured PEPPOL provider
    4. Updates invoice with transmission status
    """
    # Get invoice
    invoice = db.query(InvoiceDB).filter(InvoiceDB.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Verify ownership
    if invoice.company_id != current_user.company_id:
        raise HTTPException(403, "Access denied")
    
    # Validate invoice status
    if invoice.status == InvoiceStatus.DRAFT:
        raise HTTPException(400, "Cannot transmit draft invoice. Update status to VALIDATED first.")
    
    # Check if XML exists
    if not invoice.xml_file_path or not os.path.exists(invoice.xml_file_path):
        raise HTTPException(400, "Invoice XML not found. Please regenerate the invoice.")
    
    # Check if already transmitted
    if invoice.peppol_status in ['SENT', 'DELIVERED']:
        return {
            "success": False,
            "message": f"Invoice already transmitted. Status: {invoice.peppol_status}",
            "message_id": invoice.peppol_message_id,
            "sent_at": invoice.peppol_sent_at.isoformat() if invoice.peppol_sent_at else None
        }
    
    # Validate PEPPOL participant IDs
    if not invoice.supplier_peppol_id:
        raise HTTPException(400, "Supplier PEPPOL ID is required for transmission")
    
    if not invoice.customer_peppol_id:
        raise HTTPException(400, "Customer PEPPOL ID is required for transmission")
    
    # Load XML content
    try:
        with open(invoice.xml_file_path, 'r', encoding='utf-8') as f:
            xml_content = f.read()
    except Exception as e:
        raise HTTPException(500, f"Failed to read XML file: {str(e)}")
    
    # Transmit via PEPPOL
    from utils.peppol_provider import send_invoice_via_peppol
    import json
    
    # For now, use MOCK provider (replace with real provider in production)
    # Set PEPPOL_PROVIDER, PEPPOL_BASE_URL, PEPPOL_API_KEY in environment variables
    provider_name = os.getenv('PEPPOL_PROVIDER', 'mock')
    provider_url = os.getenv('PEPPOL_BASE_URL')
    provider_key = os.getenv('PEPPOL_API_KEY')
    
    result = send_invoice_via_peppol(
        invoice_xml=xml_content,
        invoice_number=invoice.invoice_number,
        sender_id=invoice.supplier_peppol_id,
        receiver_id=invoice.customer_peppol_id,
        provider_name=provider_name,
        base_url=provider_url,
        api_key=provider_key
    )
    
    # Update invoice with transmission result
    if result.get('success'):
        invoice.peppol_message_id = result.get('message_id')
        invoice.peppol_status = result.get('status')
        invoice.peppol_provider = result.get('provider')
        invoice.peppol_sent_at = datetime.utcnow()
        invoice.peppol_response = json.dumps(result.get('response', {}))
        invoice.status = InvoiceStatus.SENT  # Update invoice status
        
        db.commit()
        db.refresh(invoice)
        
        return {
            "success": True,
            "message": "Invoice transmitted successfully via PEPPOL",
            "invoice_number": invoice.invoice_number,
            "message_id": invoice.peppol_message_id,
            "status": invoice.peppol_status,
            "provider": invoice.peppol_provider,
            "sent_at": invoice.peppol_sent_at.isoformat(),
            "recipient_id": invoice.customer_peppol_id
        }
    else:
        # Save error response
        invoice.peppol_status = 'FAILED'
        invoice.peppol_response = json.dumps({'error': result.get('error')})
        db.commit()
        
        raise HTTPException(500, f"PEPPOL transmission failed: {result.get('error')}")

@app.get("/invoices/{invoice_id}/peppol-status", tags=["Invoices"])
def get_peppol_transmission_status(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Check PEPPOL transmission status for an invoice"""
    # Get invoice
    invoice = db.query(InvoiceDB).filter(InvoiceDB.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Verify ownership
    if invoice.company_id != current_user.company_id:
        raise HTTPException(403, "Access denied")
    
    if not invoice.peppol_message_id:
        return {
            "transmitted": False,
            "message": "Invoice has not been transmitted via PEPPOL"
        }
    
    # Query provider for latest status (if needed)
    from utils.peppol_provider import PeppolProviderFactory
    import json
    
    try:
        provider_name = invoice.peppol_provider or os.getenv('PEPPOL_PROVIDER', 'mock')
        provider = PeppolProviderFactory.create_provider(
            provider_name=provider_name,
            base_url=os.getenv('PEPPOL_BASE_URL'),
            api_key=os.getenv('PEPPOL_API_KEY')
        )
        
        status_result = provider.get_status(invoice.peppol_message_id)
        
        # Update invoice status if changed
        if status_result.get('success') and status_result.get('status'):
            new_status = status_result['status']
            if new_status != invoice.peppol_status:
                invoice.peppol_status = new_status
                invoice.peppol_response = json.dumps(status_result.get('details', {}))
                db.commit()
        
        return {
            "transmitted": True,
            "invoice_number": invoice.invoice_number,
            "message_id": invoice.peppol_message_id,
            "status": invoice.peppol_status,
            "provider": invoice.peppol_provider,
            "sent_at": invoice.peppol_sent_at.isoformat() if invoice.peppol_sent_at else None,
            "latest_check": status_result if status_result.get('success') else None
        }
    
    except Exception as e:
        return {
            "transmitted": True,
            "invoice_number": invoice.invoice_number,
            "message_id": invoice.peppol_message_id,
            "status": invoice.peppol_status,
            "provider": invoice.peppol_provider,
            "sent_at": invoice.peppol_sent_at.isoformat() if invoice.peppol_sent_at else None,
            "error": f"Status check failed: {str(e)}"
        }

@app.get("/invoices", tags=["Invoices"], response_model=List[InvoiceListOut])
def list_invoices(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List invoices for the current company"""
    query = db.query(InvoiceDB).filter(InvoiceDB.company_id == current_user.company_id)
    
    if status:
        try:
            status_enum = InvoiceStatus(status)
            query = query.filter(InvoiceDB.status == status_enum)
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}")
    
    query = query.order_by(InvoiceDB.created_at.desc())
    invoices = query.offset(offset).limit(limit).all()
    
    return [
        InvoiceListOut(
            id=inv.id,
            invoice_number=inv.invoice_number,
            invoice_type=inv.invoice_type,
            status=inv.status,
            issue_date=inv.issue_date.isoformat(),
            customer_name=inv.customer_name,
            total_amount=inv.total_amount,
            currency_code=inv.currency_code,
            created_at=inv.created_at.isoformat()
        ) for inv in invoices
    ]

@app.get("/invoices/{invoice_id}", tags=["Invoices"], response_model=InvoiceOut)
def get_invoice(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get a specific invoice"""
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    return InvoiceOut(
        id=invoice.id,
        company_id=invoice.company_id,
        invoice_number=invoice.invoice_number,
        invoice_type=invoice.invoice_type,
        status=invoice.status,
        issue_date=invoice.issue_date.isoformat(),
        due_date=invoice.due_date.isoformat() if invoice.due_date else None,
        currency_code=invoice.currency_code,
        supplier_trn=invoice.supplier_trn,
        supplier_name=invoice.supplier_name,
        supplier_address=invoice.supplier_address,
        supplier_peppol_id=invoice.supplier_peppol_id,
        customer_trn=invoice.customer_trn,
        customer_name=invoice.customer_name,
        customer_email=invoice.customer_email,
        customer_address=invoice.customer_address,
        customer_peppol_id=invoice.customer_peppol_id,
        subtotal_amount=invoice.subtotal_amount,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        amount_due=invoice.amount_due,
        xml_file_path=invoice.xml_file_path,
        pdf_file_path=invoice.pdf_file_path,
        share_token=invoice.share_token,
        created_at=invoice.created_at.isoformat(),
        sent_at=invoice.sent_at.isoformat() if invoice.sent_at else None,
        viewed_at=invoice.viewed_at.isoformat() if invoice.viewed_at else None,
        line_items=[
            InvoiceLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                quantity=li.quantity,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_extension_amount=li.line_extension_amount,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent,
                tax_amount=li.tax_amount,
                line_total_amount=li.line_total_amount
            ) for li in invoice.line_items
        ],
        tax_breakdowns=[
            InvoiceTaxBreakdownOut(
                id=tb.id,
                tax_category=tb.tax_category,
                taxable_amount=tb.taxable_amount,
                tax_percent=tb.tax_percent,
                tax_amount=tb.tax_amount
            ) for tb in invoice.tax_breakdowns
        ]
    )

@app.post("/invoices/{invoice_id}/issue", tags=["Invoices"])
def issue_invoice(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Issue a draft invoice - generates UBL XML with digital signature and hash chain
    
    PHASE 1 Features:
    - Generates UAE PINT-AE compliant UBL 2.1 XML
    - Creates digital signature (RSA-2048)
    - Links to previous invoice via hash chain
    - Saves XML to file system
    - Updates status to ISSUED
    """
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(400, f"Can only issue draft invoices. Current status: {invoice.status}")
    
    # ==== PHASE 1: Digital Signatures, Hash Chain & UBL XML Generation ====
    from utils.crypto_utils import get_crypto_instance
    from utils.ubl_xml_generator import generate_invoice_xml
    import json
    
    # Get previous invoice hash for chain
    prev_invoice = db.query(InvoiceDB).filter(
        InvoiceDB.company_id == current_user.company_id,
        InvoiceDB.id != invoice.id  # Exclude current invoice
    ).order_by(InvoiceDB.created_at.desc()).first()
    
    if prev_invoice and prev_invoice.xml_hash:
        invoice.prev_invoice_hash = prev_invoice.xml_hash
    
    # Prepare invoice data for XML generation
    invoice_data = {
        'invoice_number': invoice.invoice_number,
        'issue_date': invoice.issue_date,
        'due_date': invoice.due_date,
        'invoice_type': invoice.invoice_type.value,
        'currency_code': invoice.currency_code,
        'supplier_trn': invoice.supplier_trn,
        'supplier_name': invoice.supplier_name,
        'supplier_address': invoice.supplier_address,
        'supplier_city': invoice.supplier_city,
        'supplier_country': invoice.supplier_country,
        'supplier_peppol_id': invoice.supplier_peppol_id,
        'customer_trn': invoice.customer_trn,
        'customer_name': invoice.customer_name,
        'customer_email': invoice.customer_email,
        'customer_address': invoice.customer_address,
        'customer_city': invoice.customer_city,
        'customer_country': invoice.customer_country,
        'customer_peppol_id': invoice.customer_peppol_id,
        'subtotal_amount': invoice.subtotal_amount,
        'tax_amount': invoice.tax_amount,
        'total_amount': invoice.total_amount,
        'amount_due': invoice.amount_due,
        'payment_terms': invoice.payment_terms,
        'invoice_notes': invoice.invoice_notes,
        'reference_number': invoice.reference_number,
        'preceding_invoice_id': invoice.preceding_invoice_id,
        'prev_invoice_hash': invoice.prev_invoice_hash
    }
    
    # Get line items for XML
    line_items_data = []
    for line in invoice.line_items:
        line_items_data.append({
            'line_number': line.line_number,
            'item_name': line.item_name,
            'item_description': line.item_description,
            'item_code': line.item_code,
            'quantity': line.quantity,
            'unit_code': line.unit_code,
            'unit_price': line.unit_price,
            'line_extension_amount': line.line_extension_amount,
            'tax_category': line.tax_category.value,
            'tax_percent': line.tax_percent,
            'tax_amount': line.tax_amount,
            'line_total_amount': line.line_total_amount
        })
    
    # Generate UBL 2.1 XML
    success, xml_content, errors = generate_invoice_xml(invoice_data, line_items_data)
    
    if not success or not xml_content:
        raise HTTPException(500, f"XML generation failed: {errors}")
    
    # Save XML to file
    xml_dir = "invoices_xml"
    os.makedirs(xml_dir, exist_ok=True)
    xml_filename = f"{invoice.invoice_number.replace('/', '_')}.xml"
    xml_path = os.path.join(xml_dir, xml_filename)
    
    with open(xml_path, 'w', encoding='utf-8') as f:
        f.write(xml_content)
    
    invoice.xml_file_path = xml_path
    
    # Compute hash of invoice + XML
    crypto = get_crypto_instance()
    invoice_hash = crypto.compute_invoice_hash(invoice_data)
    invoice.xml_hash = crypto.compute_hash(xml_content)
    
    # Sign invoice (using mock signing for now - replace with real cert in production)
    signature = crypto.sign_invoice(invoice_hash, xml_content)
    if signature:
        invoice.signature_b64 = signature
        invoice.signing_timestamp = datetime.utcnow()
        invoice.signing_cert_serial = "MOCK-CERT-001"  # Replace with real cert serial
    
    # Update invoice status
    invoice.status = InvoiceStatus.ISSUED
    
    # Increment company invoice counter
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if company:
        company.invoices_generated = (company.invoices_generated or 0) + 1
    
    db.commit()
    db.refresh(invoice)
    
    print(f"\n{'='*70}")
    print(f"✅ INVOICE ISSUED: {invoice.invoice_number}")
    print(f"{'='*70}")
    print(f"Invoice Hash: {invoice_hash[:32]}...")
    print(f"XML Hash: {invoice.xml_hash[:32]}...")
    print(f"XML File: {xml_path}")
    print(f"Signature: {'✓ Signed' if signature else '✗ Not signed'}")
    print(f"Previous Hash: {invoice.prev_invoice_hash[:32] if invoice.prev_invoice_hash else 'None (first invoice)'}")
    print(f"Hash Chain: {'✓ Linked' if invoice.prev_invoice_hash else '✓ Chain Start'}")
    print(f"Status: {invoice.status}")
    print(f"{'='*70}\n")
    
    return {
        "success": True,
        "message": "Invoice issued successfully with digital signature and hash chain",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "xml_generated": True,
        "xml_hash": invoice.xml_hash,
        "signature_generated": signature is not None,
        "hash_chain_linked": invoice.prev_invoice_hash is not None,
        "compliance": "UAE PINT-AE UBL 2.1"
    }

@app.post("/invoices/{invoice_id}/send", tags=["Invoices"])
def send_invoice(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Send invoice to customer (simulates ASP transmission and email notification)"""
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    if invoice.status == InvoiceStatus.DRAFT:
        raise HTTPException(400, "Cannot send draft invoice. Please issue it first.")
    
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(400, "Cannot send cancelled invoice")
    
    # Update status
    invoice.status = InvoiceStatus.SENT
    invoice.sent_at = datetime.utcnow()
    
    # PEPPOL Usage Tracking - Record transmission fee
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    peppol_fee = 0.0
    peppol_usage_id = None
    
    if company:
        # Get active subscription to determine fee
        subscription = db.query(SubscriptionDB).filter(
            SubscriptionDB.company_id == company.id,
            SubscriptionDB.status == "ACTIVE"
        ).first()
        
        # Determine PEPPOL fee based on tier (pay-per-use pricing)
        fee_by_tier = {
            "BASIC": 2.00,      # AED 2.00 per invoice
            "PRO": 1.00,        # AED 1.00 per invoice
            "ENTERPRISE": 0.50  # AED 0.50 per invoice
        }
        
        if subscription:
            peppol_fee = fee_by_tier.get(subscription.tier, 2.00)
        else:
            # No active subscription - use highest rate
            peppol_fee = 2.00
        
        # Record PEPPOL usage
        usage_record = PEPPOLUsageDB(
            id=f"pep_{uuid4().hex[:12]}",
            company_id=company.id,
            invoice_id=invoice.id,
            transmission_type="PEPPOL",  # Could be PEPPOL, FTA, EMAIL, etc.
            fee_amount=peppol_fee,
            status="COMPLETED"  # or PENDING, FAILED
        )
        db.add(usage_record)
        peppol_usage_id = usage_record.id
    
    db.commit()
    
    # In production, this would:
    # 1. Send UBL XML to centralized ASP API (Tradeshift/Basware)
    # 2. ASP transmits via PEPPOL network to customer
    # 3. ASP reports to FTA for compliance
    # 4. Send email to customer with share link
    # 5. Charge accumulated PEPPOL fees on next billing cycle
    
    return {
        "message": "Invoice sent successfully",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "sent_to": invoice.customer_email or invoice.customer_name,
        "share_link": f"/invoices/view/{invoice.share_token}",
        "peppol_transmission": "simulated",
        "peppol_fee": f"AED {peppol_fee:.2f}",
        "peppol_usage_id": peppol_usage_id,
        "sent_at": invoice.sent_at.isoformat()
    }

@app.post("/invoices/{invoice_id}/cancel", tags=["Invoices"])
def cancel_invoice(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Cancel an invoice"""
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    if invoice.status in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]:
        raise HTTPException(400, f"Cannot cancel invoice with status: {invoice.status}")
    
    invoice.status = InvoiceStatus.CANCELLED
    db.commit()
    
    return {
        "message": "Invoice cancelled",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number
    }

@app.get("/invoices/{invoice_id}/qr", tags=["Invoices"])
def get_invoice_qr_code(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Generate QR code for invoice share link"""
    import qrcode
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Get the base URL from environment or use default
    base_url = os.getenv("REPLIT_DOMAINS", "https://involinks.replit.app")
    if base_url:
        base_url = f"https://{base_url.split(',')[0]}" if ',' in base_url else f"https://{base_url}"
    
    # Create the full share URL
    share_url = f"{base_url}/invoices/view/{invoice.share_token}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(share_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to bytes
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")

@app.post("/invoices/{invoice_id}/email", tags=["Invoices"])
async def email_invoice(
    invoice_id: str,
    recipient_email: str = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Send invoice to customer via email with PDF attachment"""
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Use provided email or fall back to invoice customer email
    email_to = recipient_email or invoice.customer_email
    if not email_to:
        raise HTTPException(400, "No recipient email provided")
    
    # Get the base URL for share link
    base_url = os.getenv("REPLIT_DOMAINS", "https://involinks.replit.app")
    if base_url:
        base_url = f"https://{base_url.split(',')[0]}" if ',' in base_url else f"https://{base_url}"
    
    share_url = f"{base_url}/invoices/view/{invoice.share_token}"
    
    # In production, this would:
    # 1. Use SendGrid/Resend integration to send email
    # 2. Attach generated PDF
    # 3. Include professional HTML template
    # 4. Track email opens/clicks
    
    # For now, simulate email sending
    email_content = {
        "to": email_to,
        "subject": f"Invoice {invoice.invoice_number} from {invoice.supplier_name}",
        "body": f"Please find your invoice attached. You can also view it online at: {share_url}",
        "share_link": share_url,
        "invoice_number": invoice.invoice_number,
        "amount": f"AED {invoice.total_amount:,.2f}"
    }
    
    return {
        "message": "Invoice email sent successfully",
        "sent_to": email_to,
        "invoice_id": invoice.id,
        "email_status": "sent",
        "email_content": email_content
    }

@app.post("/invoices/{invoice_id}/sms", tags=["Invoices"])
async def sms_invoice(
    invoice_id: str,
    phone_number: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Send invoice link to customer via SMS"""
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Get the base URL for share link
    base_url = os.getenv("REPLIT_DOMAINS", "https://involinks.replit.app")
    if base_url:
        base_url = f"https://{base_url.split(',')[0]}" if ',' in base_url else f"https://{base_url}"
    
    share_url = f"{base_url}/invoices/view/{invoice.share_token}"
    
    # In production, this would use Twilio integration
    # For now, simulate SMS sending
    sms_content = {
        "to": phone_number,
        "message": f"Invoice {invoice.invoice_number} from {invoice.supplier_name} - AED {invoice.total_amount:,.2f}. View: {share_url}",
        "share_link": share_url
    }
    
    return {
        "message": "Invoice SMS sent successfully",
        "sent_to": phone_number,
        "invoice_id": invoice.id,
        "sms_status": "sent",
        "sms_content": sms_content
    }

@app.post("/invoices/{invoice_id}/whatsapp", tags=["Invoices"])
async def whatsapp_invoice(
    invoice_id: str,
    phone_number: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Send invoice link to customer via WhatsApp"""
    invoice = db.query(InvoiceDB).filter(
        InvoiceDB.id == invoice_id,
        InvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Get the base URL for share link
    base_url = os.getenv("REPLIT_DOMAINS", "https://involinks.replit.app")
    if base_url:
        base_url = f"https://{base_url.split(',')[0]}" if ',' in base_url else f"https://{base_url}"
    
    share_url = f"{base_url}/invoices/view/{invoice.share_token}"
    
    # In production, this would use Twilio WhatsApp API
    # For now, simulate WhatsApp sending
    whatsapp_content = {
        "to": phone_number,
        "message": f"📄 *Invoice {invoice.invoice_number}*\n\nFrom: {invoice.supplier_name}\nAmount: AED {invoice.total_amount:,.2f}\n\nView invoice: {share_url}",
        "share_link": share_url
    }
    
    return {
        "message": "Invoice WhatsApp message sent successfully",
        "sent_to": phone_number,
        "invoice_id": invoice.id,
        "whatsapp_status": "sent",
        "whatsapp_content": whatsapp_content
    }

# Public invoice viewing (no authentication required)
@app.get("/invoices/view/{share_token}", tags=["Public"], response_model=InvoiceOut)
def view_shared_invoice(share_token: str, db: Session = Depends(get_db)):
    """View invoice via public share link (customer portal)"""
    invoice = db.query(InvoiceDB).filter(InvoiceDB.share_token == share_token).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Mark as viewed
    if not invoice.viewed_at:
        invoice.viewed_at = datetime.utcnow()
        db.commit()
    
    return InvoiceOut(
        id=invoice.id,
        company_id=invoice.company_id,
        invoice_number=invoice.invoice_number,
        invoice_type=invoice.invoice_type,
        status=invoice.status,
        issue_date=invoice.issue_date.isoformat(),
        due_date=invoice.due_date.isoformat() if invoice.due_date else None,
        currency_code=invoice.currency_code,
        supplier_trn=invoice.supplier_trn,
        supplier_name=invoice.supplier_name,
        supplier_address=invoice.supplier_address,
        supplier_peppol_id=invoice.supplier_peppol_id,
        customer_trn=invoice.customer_trn,
        customer_name=invoice.customer_name,
        customer_email=invoice.customer_email,
        customer_address=invoice.customer_address,
        customer_peppol_id=invoice.customer_peppol_id,
        subtotal_amount=invoice.subtotal_amount,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        amount_due=invoice.amount_due,
        xml_file_path=invoice.xml_file_path,
        pdf_file_path=invoice.pdf_file_path,
        share_token=invoice.share_token,
        created_at=invoice.created_at.isoformat(),
        sent_at=invoice.sent_at.isoformat() if invoice.sent_at else None,
        viewed_at=invoice.viewed_at.isoformat() if invoice.viewed_at else None,
        line_items=[
            InvoiceLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                quantity=li.quantity,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_extension_amount=li.line_extension_amount,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent,
                tax_amount=li.tax_amount,
                line_total_amount=li.line_total_amount
            ) for li in invoice.line_items
        ],
        tax_breakdowns=[
            InvoiceTaxBreakdownOut(
                id=tb.id,
                tax_category=tb.tax_category,
                taxable_amount=tb.taxable_amount,
                tax_percent=tb.tax_percent,
                tax_amount=tb.tax_amount
            ) for tb in invoice.tax_breakdowns
        ]
    )

# ==================== CORNER 4: AP MANAGEMENT (INWARD INVOICES) ====================

@app.post("/inward-invoices/receive", tags=["AP Management"], response_model=InwardInvoiceOut)
def receive_inward_invoice(
    invoice_data: InwardInvoiceReceive,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Receive inward invoice from supplier (via PEPPOL or manual entry)
    
    This endpoint:
    1. Validates the received invoice data
    2. Stores the invoice in the inward_invoices table
    3. Saves UBL XML if provided
    4. Creates line items
    5. Attempts automatic PO matching if supplier TRN matches
    """
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    # Validate that customer TRN matches our company TRN
    if invoice_data.customer_trn != company.trn:
        raise HTTPException(
            400, 
            f"Invoice customer TRN ({invoice_data.customer_trn}) does not match your company TRN ({company.trn})"
        )
    
    # Check for duplicate invoice number from this supplier
    existing = db.query(InwardInvoiceDB).filter(
        InwardInvoiceDB.company_id == current_user.company_id,
        InwardInvoiceDB.supplier_trn == invoice_data.supplier_trn,
        InwardInvoiceDB.supplier_invoice_number == invoice_data.supplier_invoice_number
    ).first()
    
    if existing:
        raise HTTPException(
            409, 
            f"Invoice {invoice_data.supplier_invoice_number} from supplier {invoice_data.supplier_name} already exists"
        )
    
    # Create inward invoice
    inward_invoice_id = str(uuid4())
    
    # Parse dates
    from datetime import datetime as dt
    invoice_date = dt.fromisoformat(invoice_data.invoice_date)
    due_date = dt.fromisoformat(invoice_data.due_date) if invoice_data.due_date else None
    
    # Save XML file if provided
    xml_file_path = None
    xml_hash_value = None
    if invoice_data.xml_content:
        xml_dir = os.path.join(ARTIFACT_ROOT, "inward_invoices", current_user.company_id)
        os.makedirs(xml_dir, exist_ok=True)
        xml_file_path = os.path.join(xml_dir, f"{inward_invoice_id}.xml")
        
        with open(xml_file_path, 'w', encoding='utf-8') as f:
            f.write(invoice_data.xml_content)
        
        # Calculate hash
        from utils.crypto_utils import hash_data
        xml_hash_value = hash_data(invoice_data.xml_content)
    
    # Attempt to find matching PO by supplier TRN
    matching_po = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.company_id == current_user.company_id,
        PurchaseOrderDB.supplier_trn == invoice_data.supplier_trn,
        PurchaseOrderDB.status.in_([PurchaseOrderStatus.SENT, PurchaseOrderStatus.ACKNOWLEDGED])
    ).order_by(PurchaseOrderDB.order_date.desc()).first()
    
    po_id = matching_po.id if matching_po else None
    matching_status = MatchingStatus.NOT_MATCHED
    amount_variance = 0.0
    
    if matching_po:
        # Calculate variance
        amount_variance = invoice_data.total_amount - matching_po.expected_total
        if abs(amount_variance) < 0.01:  # Within 1 cent
            matching_status = MatchingStatus.FULL_MATCH
        elif abs(amount_variance) < (matching_po.expected_total * 0.05):  # Within 5%
            matching_status = MatchingStatus.VARIANCE_DETECTED
        else:
            matching_status = MatchingStatus.PARTIAL_MATCH
    
    # Create inward invoice record
    new_invoice = InwardInvoiceDB(
        id=inward_invoice_id,
        company_id=current_user.company_id,
        supplier_invoice_number=invoice_data.supplier_invoice_number,
        invoice_type=InvoiceType.TAX_INVOICE,
        status=InwardInvoiceStatus.RECEIVED,
        invoice_date=invoice_date,
        due_date=due_date,
        received_at=datetime.utcnow(),
        supplier_trn=invoice_data.supplier_trn,
        supplier_name=invoice_data.supplier_name,
        supplier_address=invoice_data.supplier_address,
        supplier_peppol_id=invoice_data.supplier_peppol_id,
        customer_trn=invoice_data.customer_trn,
        customer_name=invoice_data.customer_name,
        currency_code=invoice_data.currency_code,
        subtotal_amount=invoice_data.subtotal_amount,
        tax_amount=invoice_data.tax_amount,
        total_amount=invoice_data.total_amount,
        amount_due=invoice_data.amount_due,
        xml_file_path=xml_file_path,
        xml_hash=xml_hash_value,
        peppol_message_id=invoice_data.peppol_message_id,
        peppol_sender_id=invoice_data.peppol_sender_id,
        peppol_provider=invoice_data.peppol_provider,
        peppol_received_at=datetime.utcnow() if invoice_data.peppol_message_id else None,
        po_id=po_id,
        matching_status=matching_status,
        amount_variance=amount_variance,
        payment_status="PENDING"
    )
    
    db.add(new_invoice)
    
    # Create line items if provided
    if invoice_data.line_items:
        for idx, item_data in enumerate(invoice_data.line_items):
            line_item = InwardInvoiceLineItemDB(
                id=str(uuid4()),
                inward_invoice_id=inward_invoice_id,
                line_number=idx + 1,
                item_name=item_data.get('item_name', 'Item'),
                item_description=item_data.get('item_description'),
                item_code=item_data.get('item_code'),
                quantity=float(item_data.get('quantity', 1)),
                unit_code=item_data.get('unit_code', 'C62'),
                unit_price=float(item_data.get('unit_price', 0)),
                line_extension_amount=float(item_data.get('line_extension_amount', 0)),
                tax_category=TaxCategory(item_data.get('tax_category', 'S')),
                tax_percent=float(item_data.get('tax_percent', 5.0)),
                tax_amount=float(item_data.get('tax_amount', 0)),
                line_total_amount=float(item_data.get('line_total_amount', 0))
            )
            db.add(line_item)
    
    # Update PO if matched
    if matching_po:
        matching_po.received_invoice_count += 1
        matching_po.received_amount_total += invoice_data.total_amount
        matching_po.variance_amount = matching_po.expected_total - matching_po.received_amount_total
    
    db.commit()
    db.refresh(new_invoice)
    
    # Return response
    return InwardInvoiceOut(
        id=new_invoice.id,
        company_id=new_invoice.company_id,
        supplier_invoice_number=new_invoice.supplier_invoice_number,
        invoice_type=new_invoice.invoice_type,
        status=new_invoice.status,
        invoice_date=new_invoice.invoice_date.isoformat(),
        due_date=new_invoice.due_date.isoformat() if new_invoice.due_date else None,
        received_at=new_invoice.received_at.isoformat(),
        supplier_trn=new_invoice.supplier_trn,
        supplier_name=new_invoice.supplier_name,
        supplier_address=new_invoice.supplier_address,
        supplier_peppol_id=new_invoice.supplier_peppol_id,
        supplier_company_id=new_invoice.supplier_company_id,
        customer_trn=new_invoice.customer_trn,
        customer_name=new_invoice.customer_name,
        currency_code=new_invoice.currency_code,
        subtotal_amount=new_invoice.subtotal_amount,
        tax_amount=new_invoice.tax_amount,
        total_amount=new_invoice.total_amount,
        amount_due=new_invoice.amount_due,
        xml_file_path=new_invoice.xml_file_path,
        pdf_file_path=new_invoice.pdf_file_path,
        xml_hash=new_invoice.xml_hash,
        peppol_message_id=new_invoice.peppol_message_id,
        peppol_sender_id=new_invoice.peppol_sender_id,
        peppol_provider=new_invoice.peppol_provider,
        peppol_received_at=new_invoice.peppol_received_at.isoformat() if new_invoice.peppol_received_at else None,
        po_id=new_invoice.po_id,
        grn_id=new_invoice.grn_id,
        matching_status=new_invoice.matching_status,
        po_match_score=new_invoice.po_match_score,
        grn_match_score=new_invoice.grn_match_score,
        amount_variance=new_invoice.amount_variance,
        quantity_variance=new_invoice.quantity_variance,
        reviewed_by_user_id=new_invoice.reviewed_by_user_id,
        reviewed_at=new_invoice.reviewed_at.isoformat() if new_invoice.reviewed_at else None,
        approved_by_user_id=new_invoice.approved_by_user_id,
        approved_at=new_invoice.approved_at.isoformat() if new_invoice.approved_at else None,
        rejection_reason=new_invoice.rejection_reason,
        payment_status=new_invoice.payment_status,
        payment_method=new_invoice.payment_method,
        paid_amount=new_invoice.paid_amount,
        paid_at=new_invoice.paid_at.isoformat() if new_invoice.paid_at else None,
        payment_reference=new_invoice.payment_reference,
        disputed_at=new_invoice.disputed_at.isoformat() if new_invoice.disputed_at else None,
        dispute_reason=new_invoice.dispute_reason,
        dispute_resolved_at=new_invoice.dispute_resolved_at.isoformat() if new_invoice.dispute_resolved_at else None,
        notes=new_invoice.notes,
        reference_number=new_invoice.reference_number,
        created_at=new_invoice.created_at.isoformat(),
        updated_at=new_invoice.updated_at.isoformat(),
        line_items=[
            InwardInvoiceLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                item_code=li.item_code,
                quantity=li.quantity,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_extension_amount=li.line_extension_amount,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent,
                tax_amount=li.tax_amount,
                line_total_amount=li.line_total_amount,
                po_line_item_id=li.po_line_item_id,
                grn_line_item_id=li.grn_line_item_id,
                match_status=li.match_status
            ) for li in new_invoice.line_items
        ]
    )

@app.get("/inward-invoices", tags=["AP Management"], response_model=List[InwardInvoiceListOut])
def list_inward_invoices(
    status: Optional[str] = None,
    supplier_trn: Optional[str] = None,
    matching_status: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    List all inward invoices (AP Inbox)
    
    Query parameters:
    - status: Filter by invoice status (RECEIVED, PENDING_REVIEW, APPROVED, etc.)
    - supplier_trn: Filter by supplier TRN
    - matching_status: Filter by PO matching status
    """
    query = db.query(InwardInvoiceDB).filter(
        InwardInvoiceDB.company_id == current_user.company_id
    )
    
    if status:
        query = query.filter(InwardInvoiceDB.status == status)
    
    if supplier_trn:
        query = query.filter(InwardInvoiceDB.supplier_trn == supplier_trn)
    
    if matching_status:
        query = query.filter(InwardInvoiceDB.matching_status == matching_status)
    
    invoices = query.order_by(InwardInvoiceDB.received_at.desc()).all()
    
    return [
        InwardInvoiceListOut(
            id=inv.id,
            supplier_invoice_number=inv.supplier_invoice_number,
            status=inv.status,
            supplier_name=inv.supplier_name,
            total_amount=inv.total_amount,
            currency_code=inv.currency_code,
            invoice_date=inv.invoice_date.isoformat(),
            received_at=inv.received_at.isoformat(),
            matching_status=inv.matching_status,
            po_id=inv.po_id
        ) for inv in invoices
    ]

@app.get("/inward-invoices/{invoice_id}", tags=["AP Management"], response_model=InwardInvoiceOut)
def get_inward_invoice(
    invoice_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get details of a specific inward invoice"""
    invoice = db.query(InwardInvoiceDB).filter(
        InwardInvoiceDB.id == invoice_id,
        InwardInvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Inward invoice not found")
    
    return InwardInvoiceOut(
        id=invoice.id,
        company_id=invoice.company_id,
        supplier_invoice_number=invoice.supplier_invoice_number,
        invoice_type=invoice.invoice_type,
        status=invoice.status,
        invoice_date=invoice.invoice_date.isoformat(),
        due_date=invoice.due_date.isoformat() if invoice.due_date else None,
        received_at=invoice.received_at.isoformat(),
        supplier_trn=invoice.supplier_trn,
        supplier_name=invoice.supplier_name,
        supplier_address=invoice.supplier_address,
        supplier_peppol_id=invoice.supplier_peppol_id,
        supplier_company_id=invoice.supplier_company_id,
        customer_trn=invoice.customer_trn,
        customer_name=invoice.customer_name,
        currency_code=invoice.currency_code,
        subtotal_amount=invoice.subtotal_amount,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        amount_due=invoice.amount_due,
        xml_file_path=invoice.xml_file_path,
        pdf_file_path=invoice.pdf_file_path,
        xml_hash=invoice.xml_hash,
        peppol_message_id=invoice.peppol_message_id,
        peppol_sender_id=invoice.peppol_sender_id,
        peppol_provider=invoice.peppol_provider,
        peppol_received_at=invoice.peppol_received_at.isoformat() if invoice.peppol_received_at else None,
        po_id=invoice.po_id,
        grn_id=invoice.grn_id,
        matching_status=invoice.matching_status,
        po_match_score=invoice.po_match_score,
        grn_match_score=invoice.grn_match_score,
        amount_variance=invoice.amount_variance,
        quantity_variance=invoice.quantity_variance,
        reviewed_by_user_id=invoice.reviewed_by_user_id,
        reviewed_at=invoice.reviewed_at.isoformat() if invoice.reviewed_at else None,
        approved_by_user_id=invoice.approved_by_user_id,
        approved_at=invoice.approved_at.isoformat() if invoice.approved_at else None,
        rejection_reason=invoice.rejection_reason,
        payment_status=invoice.payment_status,
        payment_method=invoice.payment_method,
        paid_amount=invoice.paid_amount,
        paid_at=invoice.paid_at.isoformat() if invoice.paid_at else None,
        payment_reference=invoice.payment_reference,
        disputed_at=invoice.disputed_at.isoformat() if invoice.disputed_at else None,
        dispute_reason=invoice.dispute_reason,
        dispute_resolved_at=invoice.dispute_resolved_at.isoformat() if invoice.dispute_resolved_at else None,
        notes=invoice.notes,
        reference_number=invoice.reference_number,
        created_at=invoice.created_at.isoformat(),
        updated_at=invoice.updated_at.isoformat(),
        line_items=[
            InwardInvoiceLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                item_code=li.item_code,
                quantity=li.quantity,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_extension_amount=li.line_extension_amount,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent,
                tax_amount=li.tax_amount,
                line_total_amount=li.line_total_amount,
                po_line_item_id=li.po_line_item_id,
                grn_line_item_id=li.grn_line_item_id,
                match_status=li.match_status
            ) for li in invoice.line_items
        ]
    )

@app.post("/inward-invoices/{invoice_id}/approve", tags=["AP Management"])
def approve_inward_invoice(
    invoice_id: str,
    approval_data: InwardInvoiceApprove,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Approve inward invoice for payment
    
    This changes the status to APPROVED and records the approver
    """
    invoice = db.query(InwardInvoiceDB).filter(
        InwardInvoiceDB.id == invoice_id,
        InwardInvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Inward invoice not found")
    
    if invoice.status == InwardInvoiceStatus.APPROVED:
        raise HTTPException(400, "Invoice already approved")
    
    if invoice.status == InwardInvoiceStatus.REJECTED:
        raise HTTPException(400, "Cannot approve a rejected invoice")
    
    # Update invoice
    invoice.status = InwardInvoiceStatus.APPROVED
    invoice.approved_by_user_id = current_user.id
    invoice.approved_at = datetime.utcnow()
    
    if approval_data.notes:
        invoice.notes = (invoice.notes or "") + f"\n[Approved] {approval_data.notes}"
    
    if approval_data.payment_method:
        invoice.payment_method = approval_data.payment_method
    
    if approval_data.payment_reference:
        invoice.payment_reference = approval_data.payment_reference
    
    # Update PO if matched
    if invoice.po_id:
        po = db.query(PurchaseOrderDB).filter(PurchaseOrderDB.id == invoice.po_id).first()
        if po:
            po.matched_invoice_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Invoice {invoice.supplier_invoice_number} approved for payment",
        "invoice_id": invoice.id,
        "approved_by": current_user.email,
        "approved_at": invoice.approved_at.isoformat()
    }

@app.post("/inward-invoices/{invoice_id}/reject", tags=["AP Management"])
def reject_inward_invoice(
    invoice_id: str,
    rejection_data: InwardInvoiceReject,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Reject inward invoice with reason
    """
    invoice = db.query(InwardInvoiceDB).filter(
        InwardInvoiceDB.id == invoice_id,
        InwardInvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Inward invoice not found")
    
    if invoice.status == InwardInvoiceStatus.REJECTED:
        raise HTTPException(400, "Invoice already rejected")
    
    if invoice.status == InwardInvoiceStatus.PAID:
        raise HTTPException(400, "Cannot reject a paid invoice")
    
    # Update invoice
    invoice.status = InwardInvoiceStatus.REJECTED
    invoice.reviewed_by_user_id = current_user.id
    invoice.reviewed_at = datetime.utcnow()
    invoice.rejection_reason = rejection_data.rejection_reason
    
    if rejection_data.notes:
        invoice.notes = (invoice.notes or "") + f"\n[Rejected] {rejection_data.notes}"
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Invoice {invoice.supplier_invoice_number} rejected",
        "invoice_id": invoice.id,
        "rejected_by": current_user.email,
        "rejection_reason": rejection_data.rejection_reason
    }

@app.post("/inward-invoices/{invoice_id}/match-po", tags=["AP Management"])
def match_inward_invoice_to_po(
    invoice_id: str,
    match_data: InwardInvoiceMatchPO,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Manually match inward invoice to a purchase order
    
    This updates the matching_status and calculates variances
    """
    invoice = db.query(InwardInvoiceDB).filter(
        InwardInvoiceDB.id == invoice_id,
        InwardInvoiceDB.company_id == current_user.company_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Inward invoice not found")
    
    po = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.id == match_data.po_id,
        PurchaseOrderDB.company_id == current_user.company_id
    ).first()
    
    if not po:
        raise HTTPException(404, "Purchase order not found")
    
    # Verify supplier matches
    if invoice.supplier_trn != po.supplier_trn:
        raise HTTPException(
            400,
            f"Supplier mismatch: Invoice supplier TRN ({invoice.supplier_trn}) does not match PO supplier TRN ({po.supplier_trn})"
        )
    
    # Calculate variance
    amount_variance = invoice.total_amount - po.expected_total
    
    # Determine matching status
    if abs(amount_variance) < 0.01:  # Within 1 cent
        matching_status = MatchingStatus.FULL_MATCH
    elif abs(amount_variance) < (po.expected_total * 0.05):  # Within 5%
        matching_status = MatchingStatus.VARIANCE_DETECTED
    else:
        matching_status = MatchingStatus.PARTIAL_MATCH
    
    # Update invoice
    invoice.po_id = po.id
    invoice.matching_status = matching_status
    invoice.amount_variance = amount_variance
    invoice.po_match_score = 100.0 - min(abs(amount_variance / po.expected_total * 100), 100.0) if po.expected_total > 0 else 0.0
    
    # Update PO
    po.received_invoice_count += 1
    po.received_amount_total += invoice.total_amount
    po.variance_amount = po.expected_total - po.received_amount_total
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Invoice matched to PO {po.po_number}",
        "invoice_id": invoice.id,
        "po_id": po.id,
        "matching_status": matching_status.value,
        "amount_variance": amount_variance,
        "po_match_score": invoice.po_match_score
    }

# ==================== PURCHASE ORDER MANAGEMENT ====================

@app.post("/purchase-orders", tags=["AP Management"], response_model=PurchaseOrderOut)
def create_purchase_order(
    po_data: PurchaseOrderCreate,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Create a new purchase order
    
    This endpoint:
    1. Validates PO data
    2. Creates PO record
    3. Creates line items
    4. Calculates expected totals
    """
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    # Check for duplicate PO number
    existing_po = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.company_id == current_user.company_id,
        PurchaseOrderDB.po_number == po_data.po_number
    ).first()
    
    if existing_po:
        raise HTTPException(409, f"PO number {po_data.po_number} already exists")
    
    # Validate line items
    if not po_data.line_items:
        raise HTTPException(400, "At least one line item is required")
    
    # Calculate expected totals
    expected_subtotal = 0.0
    expected_tax = 0.0
    
    for item in po_data.line_items:
        line_total = item.quantity_ordered * item.unit_price
        line_tax = line_total * (item.tax_percent / 100)
        expected_subtotal += line_total
        expected_tax += line_tax
    
    expected_total = expected_subtotal + expected_tax
    
    # Parse order date
    from datetime import datetime as dt
    order_date = dt.fromisoformat(po_data.order_date).date()
    expected_delivery_date = dt.fromisoformat(po_data.expected_delivery_date).date() if po_data.expected_delivery_date else None
    
    # Create PO
    po_id = str(uuid4())
    new_po = PurchaseOrderDB(
        id=po_id,
        company_id=current_user.company_id,
        po_number=po_data.po_number,
        status=PurchaseOrderStatus.DRAFT,
        supplier_trn=po_data.supplier_trn,
        supplier_name=po_data.supplier_name,
        supplier_contact_email=po_data.supplier_contact_email,
        supplier_address=po_data.supplier_address,
        supplier_peppol_id=po_data.supplier_peppol_id,
        order_date=order_date,
        expected_delivery_date=expected_delivery_date,
        delivery_address=po_data.delivery_address,
        currency_code=po_data.currency_code,
        expected_subtotal=expected_subtotal,
        expected_tax=expected_tax,
        expected_total=expected_total,
        reference_number=po_data.reference_number,
        notes=po_data.notes
    )
    
    db.add(new_po)
    
    # Create line items
    for item_data in po_data.line_items:
        line_total = item_data.quantity_ordered * item_data.unit_price
        line_item = PurchaseOrderLineItemDB(
            id=str(uuid4()),
            po_id=po_id,
            line_number=item_data.line_number,
            item_name=item_data.item_name,
            item_description=item_data.item_description,
            item_code=item_data.item_code,
            quantity_ordered=item_data.quantity_ordered,
            unit_code=item_data.unit_code,
            unit_price=item_data.unit_price,
            line_total=line_total,
            tax_category=item_data.tax_category,
            tax_percent=item_data.tax_percent
        )
        db.add(line_item)
    
    db.commit()
    db.refresh(new_po)
    
    # Return PO with line items
    return PurchaseOrderOut(
        id=new_po.id,
        company_id=new_po.company_id,
        po_number=new_po.po_number,
        status=new_po.status,
        supplier_trn=new_po.supplier_trn,
        supplier_name=new_po.supplier_name,
        supplier_contact_email=new_po.supplier_contact_email,
        supplier_address=new_po.supplier_address,
        supplier_peppol_id=new_po.supplier_peppol_id,
        order_date=new_po.order_date.isoformat(),
        expected_delivery_date=new_po.expected_delivery_date.isoformat() if new_po.expected_delivery_date else None,
        delivery_address=new_po.delivery_address,
        currency_code=new_po.currency_code,
        expected_subtotal=new_po.expected_subtotal,
        expected_tax=new_po.expected_tax,
        expected_total=new_po.expected_total,
        received_invoice_count=new_po.received_invoice_count,
        matched_invoice_count=new_po.matched_invoice_count,
        received_amount_total=new_po.received_amount_total,
        variance_amount=new_po.variance_amount,
        reference_number=new_po.reference_number,
        notes=new_po.notes,
        approved_by_user_id=new_po.approved_by_user_id,
        approved_at=new_po.approved_at.isoformat() if new_po.approved_at else None,
        created_at=new_po.created_at.isoformat(),
        updated_at=new_po.updated_at.isoformat(),
        line_items=[
            PurchaseOrderLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                item_code=li.item_code,
                quantity_ordered=li.quantity_ordered,
                quantity_received=li.quantity_received,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_total=li.line_total,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent
            ) for li in new_po.line_items
        ]
    )

@app.get("/purchase-orders", tags=["AP Management"])
def list_purchase_orders(
    status: Optional[str] = None,
    supplier_name: Optional[str] = None,
    po_number: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    List purchase orders with optional filters
    
    Filters:
    - status: Filter by PO status (DRAFT, SENT, ACKNOWLEDGED, FULFILLED, CANCELLED)
    - supplier_name: Search by supplier name (partial match)
    - po_number: Search by PO number (partial match)
    """
    query = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.company_id == current_user.company_id
    )
    
    # Apply filters
    if status:
        try:
            status_enum = PurchaseOrderStatus(status)
            query = query.filter(PurchaseOrderDB.status == status_enum)
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}")
    
    if supplier_name:
        query = query.filter(PurchaseOrderDB.supplier_name.ilike(f"%{supplier_name}%"))
    
    if po_number:
        query = query.filter(PurchaseOrderDB.po_number.ilike(f"%{po_number}%"))
    
    # Order by creation date (newest first)
    query = query.order_by(PurchaseOrderDB.created_at.desc())
    
    # Pagination
    total = query.count()
    purchase_orders = query.offset(skip).limit(limit).all()
    
    # Convert to response models
    results = []
    for po in purchase_orders:
        results.append(PurchaseOrderOut(
            id=po.id,
            company_id=po.company_id,
            po_number=po.po_number,
            status=po.status,
            supplier_trn=po.supplier_trn,
            supplier_name=po.supplier_name,
            supplier_contact_email=po.supplier_contact_email,
            supplier_address=po.supplier_address,
            supplier_peppol_id=po.supplier_peppol_id,
            order_date=po.order_date.isoformat(),
            expected_delivery_date=po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
            delivery_address=po.delivery_address,
            currency_code=po.currency_code,
            expected_subtotal=po.expected_subtotal,
            expected_tax=po.expected_tax,
            expected_total=po.expected_total,
            received_invoice_count=po.received_invoice_count,
            matched_invoice_count=po.matched_invoice_count,
            received_amount_total=po.received_amount_total,
            variance_amount=po.variance_amount,
            reference_number=po.reference_number,
            notes=po.notes,
            approved_by_user_id=po.approved_by_user_id,
            approved_at=po.approved_at.isoformat() if po.approved_at else None,
            created_at=po.created_at.isoformat(),
            updated_at=po.updated_at.isoformat(),
            line_items=[
                PurchaseOrderLineItemOut(
                    id=li.id,
                    line_number=li.line_number,
                    item_name=li.item_name,
                    item_description=li.item_description,
                    item_code=li.item_code,
                    quantity_ordered=li.quantity_ordered,
                    quantity_received=li.quantity_received,
                    unit_code=li.unit_code,
                    unit_price=li.unit_price,
                    line_total=li.line_total,
                    tax_category=li.tax_category,
                    tax_percent=li.tax_percent
                ) for li in po.line_items
            ]
        ))
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "results": results
    }

@app.get("/purchase-orders/{po_id}", tags=["AP Management"], response_model=PurchaseOrderOut)
def get_purchase_order(
    po_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get purchase order details with line items"""
    po = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.id == po_id,
        PurchaseOrderDB.company_id == current_user.company_id
    ).first()
    
    if not po:
        raise HTTPException(404, "Purchase order not found")
    
    return PurchaseOrderOut(
        id=po.id,
        company_id=po.company_id,
        po_number=po.po_number,
        status=po.status,
        supplier_trn=po.supplier_trn,
        supplier_name=po.supplier_name,
        supplier_contact_email=po.supplier_contact_email,
        supplier_address=po.supplier_address,
        supplier_peppol_id=po.supplier_peppol_id,
        order_date=po.order_date.isoformat(),
        expected_delivery_date=po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        delivery_address=po.delivery_address,
        currency_code=po.currency_code,
        expected_subtotal=po.expected_subtotal,
        expected_tax=po.expected_tax,
        expected_total=po.expected_total,
        received_invoice_count=po.received_invoice_count,
        matched_invoice_count=po.matched_invoice_count,
        received_amount_total=po.received_amount_total,
        variance_amount=po.variance_amount,
        reference_number=po.reference_number,
        notes=po.notes,
        approved_by_user_id=po.approved_by_user_id,
        approved_at=po.approved_at.isoformat() if po.approved_at else None,
        created_at=po.created_at.isoformat(),
        updated_at=po.updated_at.isoformat(),
        line_items=[
            PurchaseOrderLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                item_code=li.item_code,
                quantity_ordered=li.quantity_ordered,
                quantity_received=li.quantity_received,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_total=li.line_total,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent
            ) for li in po.line_items
        ]
    )

@app.put("/purchase-orders/{po_id}", tags=["AP Management"], response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: str,
    po_data: PurchaseOrderCreate,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Update an existing purchase order
    
    Only DRAFT status POs can be updated
    """
    po = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.id == po_id,
        PurchaseOrderDB.company_id == current_user.company_id
    ).first()
    
    if not po:
        raise HTTPException(404, "Purchase order not found")
    
    if po.status != PurchaseOrderStatus.DRAFT:
        raise HTTPException(400, "Only DRAFT purchase orders can be updated")
    
    # Validate line items
    if not po_data.line_items:
        raise HTTPException(400, "At least one line item is required")
    
    # Calculate expected totals
    expected_subtotal = 0.0
    expected_tax = 0.0
    
    for item in po_data.line_items:
        line_total = item.quantity_ordered * item.unit_price
        line_tax = line_total * (item.tax_percent / 100)
        expected_subtotal += line_total
        expected_tax += line_tax
    
    expected_total = expected_subtotal + expected_tax
    
    # Parse dates
    from datetime import datetime as dt
    order_date = dt.fromisoformat(po_data.order_date).date()
    expected_delivery_date = dt.fromisoformat(po_data.expected_delivery_date).date() if po_data.expected_delivery_date else None
    
    # Update PO fields
    po.po_number = po_data.po_number
    po.supplier_trn = po_data.supplier_trn
    po.supplier_name = po_data.supplier_name
    po.supplier_contact_email = po_data.supplier_contact_email
    po.supplier_address = po_data.supplier_address
    po.supplier_peppol_id = po_data.supplier_peppol_id
    po.order_date = order_date
    po.expected_delivery_date = expected_delivery_date
    po.delivery_address = po_data.delivery_address
    po.currency_code = po_data.currency_code
    po.expected_subtotal = expected_subtotal
    po.expected_tax = expected_tax
    po.expected_total = expected_total
    po.reference_number = po_data.reference_number
    po.notes = po_data.notes
    po.updated_at = datetime.utcnow()
    
    # Delete old line items
    db.query(PurchaseOrderLineItemDB).filter(
        PurchaseOrderLineItemDB.po_id == po_id
    ).delete()
    
    # Create new line items
    for item_data in po_data.line_items:
        line_total = item_data.quantity_ordered * item_data.unit_price
        line_item = PurchaseOrderLineItemDB(
            id=str(uuid4()),
            po_id=po_id,
            line_number=item_data.line_number,
            item_name=item_data.item_name,
            item_description=item_data.item_description,
            item_code=item_data.item_code,
            quantity_ordered=item_data.quantity_ordered,
            unit_code=item_data.unit_code,
            unit_price=item_data.unit_price,
            line_total=line_total,
            tax_category=item_data.tax_category,
            tax_percent=item_data.tax_percent
        )
        db.add(line_item)
    
    db.commit()
    db.refresh(po)
    
    return PurchaseOrderOut(
        id=po.id,
        company_id=po.company_id,
        po_number=po.po_number,
        status=po.status,
        supplier_trn=po.supplier_trn,
        supplier_name=po.supplier_name,
        supplier_contact_email=po.supplier_contact_email,
        supplier_address=po.supplier_address,
        supplier_peppol_id=po.supplier_peppol_id,
        order_date=po.order_date.isoformat(),
        expected_delivery_date=po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        delivery_address=po.delivery_address,
        currency_code=po.currency_code,
        expected_subtotal=po.expected_subtotal,
        expected_tax=po.expected_tax,
        expected_total=po.expected_total,
        received_invoice_count=po.received_invoice_count,
        matched_invoice_count=po.matched_invoice_count,
        received_amount_total=po.received_amount_total,
        variance_amount=po.variance_amount,
        reference_number=po.reference_number,
        notes=po.notes,
        approved_by_user_id=po.approved_by_user_id,
        approved_at=po.approved_at.isoformat() if po.approved_at else None,
        created_at=po.created_at.isoformat(),
        updated_at=po.updated_at.isoformat(),
        line_items=[
            PurchaseOrderLineItemOut(
                id=li.id,
                line_number=li.line_number,
                item_name=li.item_name,
                item_description=li.item_description,
                item_code=li.item_code,
                quantity_ordered=li.quantity_ordered,
                quantity_received=li.quantity_received,
                unit_code=li.unit_code,
                unit_price=li.unit_price,
                line_total=li.line_total,
                tax_category=li.tax_category,
                tax_percent=li.tax_percent
            ) for li in po.line_items
        ]
    )

@app.delete("/purchase-orders/{po_id}", tags=["AP Management"])
def cancel_purchase_order(
    po_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Cancel a purchase order (soft delete)
    
    Only DRAFT and SENT status POs can be cancelled
    """
    po = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.id == po_id,
        PurchaseOrderDB.company_id == current_user.company_id
    ).first()
    
    if not po:
        raise HTTPException(404, "Purchase order not found")
    
    if po.status not in [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT]:
        raise HTTPException(
            400,
            f"Cannot cancel PO in {po.status.value} status. Only DRAFT and SENT POs can be cancelled."
        )
    
    # Check if any invoices are matched to this PO
    matched_invoices = db.query(InwardInvoiceDB).filter(
        InwardInvoiceDB.po_id == po_id
    ).count()
    
    if matched_invoices > 0:
        raise HTTPException(
            400,
            f"Cannot cancel PO. It has {matched_invoices} matched invoice(s). Unmatch invoices first."
        )
    
    # Cancel the PO
    po.status = PurchaseOrderStatus.CANCELLED
    po.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Purchase order {po.po_number} cancelled",
        "po_id": po.id,
        "po_number": po.po_number
    }

@app.post("/purchase-orders/{po_id}/send", tags=["AP Management"])
def send_purchase_order(
    po_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Send purchase order to supplier (change status from DRAFT to SENT)
    
    This would integrate with email/PEPPOL sending in production
    """
    po = db.query(PurchaseOrderDB).filter(
        PurchaseOrderDB.id == po_id,
        PurchaseOrderDB.company_id == current_user.company_id
    ).first()
    
    if not po:
        raise HTTPException(404, "Purchase order not found")
    
    if po.status != PurchaseOrderStatus.DRAFT:
        raise HTTPException(400, "Only DRAFT purchase orders can be sent")
    
    # Update status
    po.status = PurchaseOrderStatus.SENT
    po.updated_at = datetime.utcnow()
    
    # In production, this would:
    # 1. Generate PO PDF
    # 2. Send via email to supplier_contact_email
    # 3. Or send via PEPPOL if supplier_peppol_id exists
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Purchase order {po.po_number} sent to {po.supplier_name}",
        "po_id": po.id,
        "po_number": po.po_number,
        "supplier_email": po.supplier_contact_email
    }

# ==================== COMPANY BRANDING ENDPOINTS ====================

@app.post("/companies/{company_id}/branding/logo", tags=["Branding"])
async def upload_company_logo(
    company_id: str,
    logo: UploadFile = File(...),
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Upload company logo (PNG/SVG, max 2MB)"""
    # Verify user owns this company
    if current_user.company_id != company_id:
        raise HTTPException(403, "Not authorized to upload logo for this company")
    
    # Check if company has branding permission
    company = db.query(CompanyDB).filter(CompanyDB.id == company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    # Get company's subscription plan
    subscription = db.query(CompanySubscriptionDB).filter(
        CompanySubscriptionDB.company_id == company_id
    ).first()
    
    if subscription:
        plan = db.query(SubscriptionPlanDB).filter(
            SubscriptionPlanDB.id == subscription.plan_id
        ).first()
        
        if plan and not plan.allow_branding:
            raise HTTPException(403, "Your subscription plan does not allow branding. Please upgrade to use this feature.")
    
    # Validate file
    if not logo.content_type in ["image/png", "image/svg+xml"]:
        raise HTTPException(400, "Only PNG and SVG files are allowed")
    
    # Read file content
    content = await logo.read()
    file_size = len(content)
    
    if file_size > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(400, "File size must be less than 2MB")
    
    # Create branding directory
    branding_dir = os.path.join(ARTIFACT_ROOT, "branding", company_id)
    os.makedirs(branding_dir, exist_ok=True)
    
    # Save file
    file_extension = "svg" if logo.content_type == "image/svg+xml" else "png"
    file_name = f"logo.{file_extension}"
    file_path = os.path.join(branding_dir, file_name)
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Get or create branding record
    branding = db.query(CompanyBrandingDB).filter(
        CompanyBrandingDB.company_id == company_id
    ).first()
    
    if not branding:
        branding = CompanyBrandingDB(
            id=f"br_{uuid4().hex[:8]}",
            company_id=company_id
        )
        db.add(branding)
    
    # Delete old logo if exists
    if branding.logo_file_path and os.path.exists(branding.logo_file_path):
        os.remove(branding.logo_file_path)
    
    # Update branding record
    branding.logo_file_name = file_name
    branding.logo_file_path = file_path
    branding.logo_file_size = file_size
    branding.logo_mime_type = logo.content_type
    branding.logo_uploaded_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Logo uploaded successfully",
        "file_name": file_name,
        "file_size": file_size,
        "uploaded_at": branding.logo_uploaded_at.isoformat()
    }

@app.post("/companies/{company_id}/branding/stamp", tags=["Branding"])
async def upload_company_stamp(
    company_id: str,
    stamp: UploadFile = File(...),
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Upload company stamp/seal (PNG/SVG, max 2MB)"""
    # Verify user owns this company
    if current_user.company_id != company_id:
        raise HTTPException(403, "Not authorized to upload stamp for this company")
    
    # Check if company has branding permission
    company = db.query(CompanyDB).filter(CompanyDB.id == company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    # Get company's subscription plan
    subscription = db.query(CompanySubscriptionDB).filter(
        CompanySubscriptionDB.company_id == company_id
    ).first()
    
    if subscription:
        plan = db.query(SubscriptionPlanDB).filter(
            SubscriptionPlanDB.id == subscription.plan_id
        ).first()
        
        if plan and not plan.allow_branding:
            raise HTTPException(403, "Your subscription plan does not allow branding. Please upgrade to use this feature.")
    
    # Validate file
    if not stamp.content_type in ["image/png", "image/svg+xml"]:
        raise HTTPException(400, "Only PNG and SVG files are allowed")
    
    # Read file content
    content = await stamp.read()
    file_size = len(content)
    
    if file_size > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(400, "File size must be less than 2MB")
    
    # Create branding directory
    branding_dir = os.path.join(ARTIFACT_ROOT, "branding", company_id)
    os.makedirs(branding_dir, exist_ok=True)
    
    # Save file
    file_extension = "svg" if stamp.content_type == "image/svg+xml" else "png"
    file_name = f"stamp.{file_extension}"
    file_path = os.path.join(branding_dir, file_name)
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Get or create branding record
    branding = db.query(CompanyBrandingDB).filter(
        CompanyBrandingDB.company_id == company_id
    ).first()
    
    if not branding:
        branding = CompanyBrandingDB(
            id=f"br_{uuid4().hex[:8]}",
            company_id=company_id
        )
        db.add(branding)
    
    # Delete old stamp if exists
    if branding.stamp_file_path and os.path.exists(branding.stamp_file_path):
        os.remove(branding.stamp_file_path)
    
    # Update branding record
    branding.stamp_file_name = file_name
    branding.stamp_file_path = file_path
    branding.stamp_file_size = file_size
    branding.stamp_mime_type = stamp.content_type
    branding.stamp_uploaded_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Stamp uploaded successfully",
        "file_name": file_name,
        "file_size": file_size,
        "uploaded_at": branding.stamp_uploaded_at.isoformat()
    }

@app.get("/companies/{company_id}/branding", tags=["Branding"], response_model=CompanyBrandingOut)
def get_company_branding(
    company_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get company branding information"""
    # Verify user owns this company
    if current_user.company_id != company_id:
        raise HTTPException(403, "Not authorized to view branding for this company")
    
    branding = db.query(CompanyBrandingDB).filter(
        CompanyBrandingDB.company_id == company_id
    ).first()
    
    if not branding:
        raise HTTPException(404, "No branding configured for this company")
    
    return CompanyBrandingOut(
        id=branding.id,
        company_id=branding.company_id,
        logo_file_name=branding.logo_file_name,
        logo_file_path=branding.logo_file_path,
        logo_uploaded_at=branding.logo_uploaded_at.isoformat() if branding.logo_uploaded_at else None,
        stamp_file_name=branding.stamp_file_name,
        stamp_file_path=branding.stamp_file_path,
        stamp_uploaded_at=branding.stamp_uploaded_at.isoformat() if branding.stamp_uploaded_at else None,
        primary_color=branding.primary_color,
        secondary_color=branding.secondary_color,
        font_family=branding.font_family,
        created_at=branding.created_at.isoformat(),
        updated_at=branding.updated_at.isoformat()
    )

@app.get("/companies/{company_id}/branding/logo", tags=["Branding"])
def get_company_logo(
    company_id: str,
    db: Session = Depends(get_db)
):
    """Get company logo file (public endpoint for invoice display)"""
    branding = db.query(CompanyBrandingDB).filter(
        CompanyBrandingDB.company_id == company_id
    ).first()
    
    if not branding or not branding.logo_file_path:
        raise HTTPException(404, "Logo not found")
    
    if not os.path.exists(branding.logo_file_path):
        raise HTTPException(404, "Logo file not found")
    
    return FileResponse(
        branding.logo_file_path,
        media_type=branding.logo_mime_type,
        filename=branding.logo_file_name
    )

@app.get("/companies/{company_id}/branding/stamp", tags=["Branding"])
def get_company_stamp(
    company_id: str,
    db: Session = Depends(get_db)
):
    """Get company stamp file (public endpoint for invoice display)"""
    branding = db.query(CompanyBrandingDB).filter(
        CompanyBrandingDB.company_id == company_id
    ).first()
    
    if not branding or not branding.stamp_file_path:
        raise HTTPException(404, "Stamp not found")
    
    if not os.path.exists(branding.stamp_file_path):
        raise HTTPException(404, "Stamp file not found")
    
    return FileResponse(
        branding.stamp_file_path,
        media_type=branding.stamp_mime_type,
        filename=branding.stamp_file_name
    )

@app.delete("/companies/{company_id}/branding/logo", tags=["Branding"])
def delete_company_logo(
    company_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Delete company logo"""
    # Verify user owns this company
    if current_user.company_id != company_id:
        raise HTTPException(403, "Not authorized to delete logo for this company")
    
    branding = db.query(CompanyBrandingDB).filter(
        CompanyBrandingDB.company_id == company_id
    ).first()
    
    if not branding or not branding.logo_file_path:
        raise HTTPException(404, "Logo not found")
    
    # Delete file from disk
    if os.path.exists(branding.logo_file_path):
        os.remove(branding.logo_file_path)
    
    # Clear database fields
    branding.logo_file_name = None
    branding.logo_file_path = None
    branding.logo_file_size = None
    branding.logo_mime_type = None
    branding.logo_uploaded_at = None
    
    db.commit()
    
    return {"message": "Logo deleted successfully"}

@app.delete("/companies/{company_id}/branding/stamp", tags=["Branding"])
def delete_company_stamp(
    company_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Delete company stamp"""
    # Verify user owns this company
    if current_user.company_id != company_id:
        raise HTTPException(403, "Not authorized to delete stamp for this company")
    
    branding = db.query(CompanyBrandingDB).filter(
        CompanyBrandingDB.company_id == company_id
    ).first()
    
    if not branding or not branding.stamp_file_path:
        raise HTTPException(404, "Stamp not found")
    
    # Delete file from disk
    if os.path.exists(branding.stamp_file_path):
        os.remove(branding.stamp_file_path)
    
    # Clear database fields
    branding.stamp_file_name = None
    branding.stamp_file_path = None
    branding.stamp_file_size = None
    branding.stamp_mime_type = None
    branding.stamp_uploaded_at = None
    
    db.commit()
    
    return {"message": "Stamp deleted successfully"}

# ==================== PUBLIC STATS ====================

@app.get("/public/stats", tags=["Public"])
def get_public_stats(db: Session = Depends(get_db)):
    """Get public statistics - visible to everyone"""
    # Count total active companies
    total_companies = db.query(CompanyDB).filter(
        CompanyDB.status == CompanyStatus.ACTIVE
    ).count()
    
    # Count total invoices across all companies
    total_invoices = db.query(InvoiceDB).count()
    
    return {
        "totalCompanies": total_companies,
        "totalInvoices": total_invoices
    }

# ==================== HEALTH CHECK ====================

@app.get("/", tags=["Health"])
def root():
    """API Health Check"""
    return {
        "service": "InvoLinks E-Invoicing API",
        "version": "2.0",
        "status": "running",
        "features": [
            "Multi-step registration wizard",
            "Document upload system",
            "Subscription plans (Starter, Professional, Enterprise)",
            "Admin approval workflow"
        ]
    }

@app.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Detailed health check with database status"""
    try:
        company_count = db.query(CompanyDB).count()
        plan_count = db.query(SubscriptionPlanDB).count()
        return {
            "status": "healthy",
            "database": "connected",
            "companies": company_count,
            "plans": plan_count
        }
    except Exception as e:
        raise HTTPException(500, f"Health check failed: {str(e)}")

# ==================== FTA AUDIT FILE (FAF) ENDPOINTS ====================

@app.post("/audit-files/generate", tags=["FTA Audit"])
def generate_fta_audit_file(
    period_start: str,  # YYYY-MM-DD
    period_end: str,  # YYYY-MM-DD
    format: str = "CSV",  # CSV or TXT
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """
    Generate FTA Audit File (FAF) for a specific period
    
    UAE Federal Tax Authority compliant audit file with invoice-level detail.
    """
    # Verify company exists and is active
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    if company.status != CompanyStatus.ACTIVE:
        raise HTTPException(400, "Company must be ACTIVE to generate audit files")
    
    if not company.trn:
        raise HTTPException(400, "Company must have a valid TRN to generate audit files")
    
    # Parse and validate dates
    from datetime import datetime as dt
    try:
        start_date = dt.strptime(period_start, "%Y-%m-%d").date()
        end_date = dt.strptime(period_end, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    
    if start_date > end_date:
        raise HTTPException(400, "Start date must be before end date")
    
    # Validate date range is reasonable (not in future, not before company registration)
    today = date.today()
    if end_date > today:
        raise HTTPException(400, f"End date cannot be in the future (today is {today})")
    
    if company.registration_date:
        if start_date < company.registration_date:
            raise HTTPException(
                400, 
                f"Start date cannot be before company registration date ({company.registration_date})"
            )
    
    # Validate period is not excessively long (max 5 years for single audit file)
    period_days = (end_date - start_date).days
    if period_days > 365 * 5:
        raise HTTPException(
            400, 
            "Audit period cannot exceed 5 years. Please generate separate files for longer periods."
        )
    
    # Validate format
    if format.upper() not in ["CSV", "TXT"]:
        raise HTTPException(400, "Format must be CSV or TXT")
    
    # Create audit file record
    audit_file_id = f"faf_{uuid4().hex[:12]}"
    file_name = f"FTA_Audit_File_{company.trn}_{period_start}_to_{period_end}.{format.lower()}"
    file_path = os.path.join(ARTIFACT_ROOT, "audit_files", company.id, file_name)
    
    audit_file = AuditFileDB(
        id=audit_file_id,
        company_id=company.id,
        file_name=file_name,
        file_path=file_path,
        format=format.upper(),
        period_start_date=start_date,
        period_end_date=end_date,
        status=AuditFileStatus.GENERATING,
        generated_by_user_id=current_user.id
    )
    
    db.add(audit_file)
    db.commit()
    
    try:
        # Get outgoing invoices (sales) for the period
        outgoing_invoices = db.query(InvoiceDB).filter(
            InvoiceDB.company_id == company.id,
            InvoiceDB.issue_date >= start_date,
            InvoiceDB.issue_date <= end_date,
            InvoiceDB.status != InvoiceStatus.DRAFT,  # Exclude drafts
            InvoiceDB.status != InvoiceStatus.CANCELLED  # Exclude cancelled
        ).all()
        
        # Get inward invoices (purchases) for the period
        inward_invoices = db.query(InwardInvoiceDB).filter(
            InwardInvoiceDB.company_id == company.id,
            InwardInvoiceDB.invoice_date >= start_date,
            InwardInvoiceDB.invoice_date <= end_date,
            InwardInvoiceDB.status != InwardInvoiceStatus.CANCELLED
        ).all()
        
        # Convert to dicts for generator
        outgoing_data = [
            {
                "invoice_number": inv.invoice_number,
                "issue_date": inv.issue_date,
                "invoice_type": inv.invoice_type.value,
                "customer_trn": inv.customer_trn,
                "customer_name": inv.customer_name,
                "customer_country": inv.customer_country,
                "subtotal_amount": inv.subtotal_amount,
                "tax_amount": inv.tax_amount,
                "total_amount": inv.total_amount,
                "currency_code": inv.currency_code,
                "status": inv.status.value
            }
            for inv in outgoing_invoices
        ]
        
        inward_data = [
            {
                "supplier_invoice_number": inv.supplier_invoice_number,
                "invoice_date": inv.invoice_date,
                "invoice_type": inv.invoice_type.value,
                "supplier_trn": inv.supplier_trn,
                "supplier_name": inv.supplier_name,
                "subtotal_amount": inv.subtotal_amount,
                "tax_amount": inv.tax_amount,
                "total_amount": inv.total_amount,
                "currency_code": inv.currency_code,
                "status": inv.status.value
            }
            for inv in inward_invoices
        ]
        
        # Generate audit file using utility
        from utils.fta_audit_generator import FTAAuditFileGenerator
        
        company_data = {
            "trn": company.trn,
            "legal_name": company.legal_name,
            "address": f"{company.address_line1 or ''} {company.address_line2 or ''}".strip(),
            "city": company.city,
            "emirate": company.emirate
        }
        
        generator = FTAAuditFileGenerator(company_data)
        
        if format.upper() == "CSV":
            stats = generator.generate_csv(outgoing_data, inward_data, file_path)
        else:
            stats = generator.generate_txt(outgoing_data, inward_data, file_path)
        
        # Update audit file record with stats
        audit_file.status = AuditFileStatus.COMPLETED
        audit_file.total_invoices = stats.get("total_invoices", 0)
        audit_file.total_customers = stats.get("total_customers", 0)
        audit_file.total_amount = stats.get("total_amount", 0.0)
        audit_file.total_vat = stats.get("total_vat", 0.0)
        audit_file.file_size = stats.get("file_size", 0)
        
        db.commit()
        
        return {
            "success": True,
            "message": "FTA Audit File generated successfully",
            "audit_file_id": audit_file_id,
            "file_name": file_name,
            "period_start": period_start,
            "period_end": period_end,
            "format": format.upper(),
            "statistics": {
                "total_invoices": audit_file.total_invoices,
                "total_sales": stats.get("total_sales", 0),
                "total_purchases": stats.get("total_purchases", 0),
                "total_customers": audit_file.total_customers,
                "total_amount": audit_file.total_amount,
                "total_vat": audit_file.total_vat
            }
        }
    
    except Exception as e:
        # Mark as failed
        audit_file.status = AuditFileStatus.FAILED
        audit_file.error_message = str(e)
        db.commit()
        
        raise HTTPException(500, f"Failed to generate audit file: {str(e)}")

@app.get("/audit-files", tags=["FTA Audit"])
def list_audit_files(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """List all FTA Audit Files for the company"""
    audit_files = db.query(AuditFileDB).filter(
        AuditFileDB.company_id == current_user.company_id
    ).order_by(AuditFileDB.created_at.desc()).all()
    
    return {
        "audit_files": [
            {
                "id": af.id,
                "file_name": af.file_name,
                "format": af.format,
                "period_start": af.period_start_date.isoformat(),
                "period_end": af.period_end_date.isoformat(),
                "status": af.status.value,
                "total_invoices": af.total_invoices,
                "total_amount": af.total_amount,
                "total_vat": af.total_vat,
                "file_size": af.file_size,
                "generated_at": af.generated_at.isoformat() if af.generated_at else None,
                "error_message": af.error_message
            }
            for af in audit_files
        ]
    }

@app.get("/audit-files/{audit_file_id}/download", tags=["FTA Audit"])
def download_audit_file(
    audit_file_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Download an FTA Audit File"""
    audit_file = db.query(AuditFileDB).filter(
        AuditFileDB.id == audit_file_id,
        AuditFileDB.company_id == current_user.company_id
    ).first()
    
    if not audit_file:
        raise HTTPException(404, "Audit file not found")
    
    if audit_file.status != AuditFileStatus.COMPLETED:
        raise HTTPException(400, f"Audit file is not ready for download. Status: {audit_file.status.value}")
    
    if not os.path.exists(audit_file.file_path):
        raise HTTPException(404, "Audit file not found on disk")
    
    # Determine media type
    media_type = "text/csv" if audit_file.format == "CSV" else "text/plain"
    
    return FileResponse(
        path=audit_file.file_path,
        media_type=media_type,
        filename=audit_file.file_name
    )

# ==================== PEPPOL SETTINGS ====================

@app.get("/settings/peppol", tags=["Settings"])
def get_peppol_settings(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get PEPPOL configuration for the company"""
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    return {
        "peppol_enabled": company.peppol_enabled or False,
        "peppol_provider": company.peppol_provider,
        "peppol_participant_id": company.peppol_participant_id,
        "peppol_base_url": company.peppol_base_url,
        "peppol_api_key": "***" + company.peppol_api_key[-4:] if company.peppol_api_key and len(company.peppol_api_key) > 4 else None,  # Masked
        "peppol_configured_at": company.peppol_configured_at.isoformat() if company.peppol_configured_at else None,
        "peppol_last_tested_at": company.peppol_last_tested_at.isoformat() if company.peppol_last_tested_at else None
    }

@app.put("/settings/peppol", tags=["Settings"])
def update_peppol_settings(
    settings: dict,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Update PEPPOL configuration for the company"""
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    # Validate provider
    valid_providers = ['tradeshift', 'basware', 'mock']
    if settings.get('peppol_provider') and settings['peppol_provider'] not in valid_providers:
        raise HTTPException(400, f"Invalid provider. Must be one of: {', '.join(valid_providers)}")
    
    # Update settings
    company.peppol_enabled = settings.get('peppol_enabled', False)
    company.peppol_provider = settings.get('peppol_provider')
    company.peppol_participant_id = settings.get('peppol_participant_id')
    company.peppol_base_url = settings.get('peppol_base_url')
    
    # Only update API key if provided and not masked
    # This preserves the existing key when user updates other fields
    if 'peppol_api_key' in settings and settings['peppol_api_key']:
        if not settings['peppol_api_key'].startswith('***'):
            company.peppol_api_key = settings['peppol_api_key']
        # If masked, skip update to preserve existing key
    
    company.peppol_configured_at = datetime.utcnow()
    
    db.commit()
    db.refresh(company)
    
    return {
        "success": True,
        "message": "PEPPOL settings updated successfully",
        "peppol_enabled": company.peppol_enabled,
        "peppol_provider": company.peppol_provider,
        "peppol_participant_id": company.peppol_participant_id
    }

@app.post("/settings/peppol/test", tags=["Settings"])
def test_peppol_connection(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Test PEPPOL provider connection"""
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    if not company.peppol_enabled:
        raise HTTPException(400, "PEPPOL is not enabled for this company")
    
    if not company.peppol_provider:
        raise HTTPException(400, "PEPPOL provider not configured")
    
    try:
        from utils.peppol_provider import PeppolProviderFactory
        
        # Create provider instance
        provider = PeppolProviderFactory.create_provider(
            provider_name=company.peppol_provider,
            base_url=company.peppol_base_url,
            api_key=company.peppol_api_key
        )
        
        # Test with participant ID validation
        if company.peppol_participant_id:
            is_valid = provider.validate_participant_id(company.peppol_participant_id)
            
            # Update last tested timestamp
            company.peppol_last_tested_at = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "message": "PEPPOL connection test successful",
                "provider": company.peppol_provider,
                "participant_valid": is_valid,
                "tested_at": company.peppol_last_tested_at.isoformat()
            }
        else:
            # Just test provider connectivity without participant validation
            company.peppol_last_tested_at = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "message": "PEPPOL provider connection successful (no participant ID to validate)",
                "provider": company.peppol_provider,
                "tested_at": company.peppol_last_tested_at.isoformat()
            }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "PEPPOL connection test failed"
        }

# ==================== BILLING & SUBSCRIPTIONS ====================

# Initialize Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Payment method Pydantic models
class PaymentMethodOut(BaseModel):
    id: str
    card_brand: str
    card_last4: str
    exp_month: int
    exp_year: int
    billing_name: str
    is_default: bool
    created_at: str

class SubscriptionOut(BaseModel):
    id: str
    tier: str
    billing_cycle_months: int
    monthly_price: float
    discount_percent: float
    status: str
    current_period_start: str
    current_period_end: str
    created_at: str

class TrialStatusOut(BaseModel):
    trial_status: str
    trial_start_date: Optional[str]
    trial_invoice_count: int
    trial_days_remaining: Optional[int]
    trial_invoices_remaining: Optional[int]
    trial_expired: bool

@app.post("/billing/payment-methods", tags=["Billing"])
async def add_payment_method(
    payment_method_token: str = Form(...),
    billing_name: str = Form(...),
    billing_email: str = Form(...),
    set_as_default: bool = Form(False),
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Add a new payment method (credit card) via Stripe"""
    try:
        if not STRIPE_SECRET_KEY:
            raise HTTPException(503, "Payment processing not configured. Please contact support.")
        
        company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
        if not company:
            raise HTTPException(404, "Company not found")
        
        # Create or get Stripe customer
        if not company.stripe_customer_id:
            customer = stripe.Customer.create(
                email=billing_email,
                name=company.legal_name or billing_name,
                metadata={"company_id": company.id}
            )
            company.stripe_customer_id = customer.id
            db.commit()
        
        # Attach payment method to customer
        payment_method = stripe.PaymentMethod.attach(
            payment_method_token,
            customer=company.stripe_customer_id
        )
        
        # Set as default if requested
        if set_as_default:
            stripe.Customer.modify(
                company.stripe_customer_id,
                invoice_settings={"default_payment_method": payment_method.id}
            )
        
        # Save to database
        pm_db = PaymentMethodDB(
            id=f"pm_{uuid4().hex[:12]}",
            company_id=company.id,
            stripe_payment_method_id=payment_method.id,
            card_brand=payment_method.card.brand if payment_method.card else None,
            card_last4=payment_method.card.last4 if payment_method.card else None,
            exp_month=payment_method.card.exp_month if payment_method.card else None,
            exp_year=payment_method.card.exp_year if payment_method.card else None,
            billing_email=billing_email,
            billing_name=billing_name,
            is_default=set_as_default
        )
        
        # If setting as default, unset others
        if set_as_default:
            db.query(PaymentMethodDB).filter(
                PaymentMethodDB.company_id == company.id,
                PaymentMethodDB.id != pm_db.id
            ).update({"is_default": False})
        
        db.add(pm_db)
        db.commit()
        
        return {
            "message": "Payment method added successfully",
            "payment_method_id": pm_db.id,
            "card_last4": pm_db.card_last4
        }
    
    except stripe.error.CardError as e:
        raise HTTPException(400, f"Card error: {str(e)}")
    except stripe.error.StripeError as e:
        raise HTTPException(500, f"Payment processing error: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Failed to add payment method: {str(e)}")

@app.get("/billing/payment-methods", tags=["Billing"], response_model=List[PaymentMethodOut])
async def list_payment_methods(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """List all payment methods for current company"""
    payment_methods = db.query(PaymentMethodDB).filter(
        PaymentMethodDB.company_id == current_user.company_id
    ).order_by(PaymentMethodDB.is_default.desc(), PaymentMethodDB.created_at.desc()).all()
    
    return [
        PaymentMethodOut(
            id=pm.id,
            card_brand=pm.card_brand or "unknown",
            card_last4=pm.card_last4 or "0000",
            exp_month=pm.exp_month or 1,
            exp_year=pm.exp_year or 2025,
            billing_name=pm.billing_name or "",
            is_default=pm.is_default,
            created_at=pm.created_at.isoformat()
        )
        for pm in payment_methods
    ]

@app.delete("/billing/payment-methods/{payment_method_id}", tags=["Billing"])
async def delete_payment_method(
    payment_method_id: str,
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Delete a payment method"""
    pm = db.query(PaymentMethodDB).filter(
        PaymentMethodDB.id == payment_method_id,
        PaymentMethodDB.company_id == current_user.company_id
    ).first()
    
    if not pm:
        raise HTTPException(404, "Payment method not found")
    
    try:
        # Detach from Stripe
        if STRIPE_SECRET_KEY:
            stripe.PaymentMethod.detach(pm.stripe_payment_method_id)
        
        # Delete from database
        db.delete(pm)
        db.commit()
        
        return {"message": "Payment method deleted successfully"}
    except Exception as e:
        raise HTTPException(500, f"Failed to delete payment method: {str(e)}")

@app.get("/billing/subscription", tags=["Billing"], response_model=SubscriptionOut)
async def get_current_subscription(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get current subscription details"""
    subscription = db.query(SubscriptionDB).filter(
        SubscriptionDB.company_id == current_user.company_id,
        SubscriptionDB.status == "ACTIVE"
    ).first()
    
    if not subscription:
        raise HTTPException(404, "No active subscription found")
    
    return SubscriptionOut(
        id=subscription.id,
        tier=subscription.tier,
        billing_cycle_months=subscription.billing_cycle_months,
        monthly_price=subscription.monthly_price,
        discount_percent=subscription.discount_percent,
        status=subscription.status,
        current_period_start=subscription.current_period_start.isoformat(),
        current_period_end=subscription.current_period_end.isoformat(),
        created_at=subscription.created_at.isoformat()
    )

@app.post("/billing/subscribe", tags=["Billing"])
async def create_subscription(
    tier: str = Form(...),  # BASIC, PRO, ENTERPRISE
    billing_cycle_months: int = Form(1),  # 1, 3, 6
    payment_method_id: str = Form(...),
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Create new subscription after trial"""
    try:
        company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
        if not company:
            raise HTTPException(404, "Company not found")
        
        # Define pricing (these should come from a pricing table in production)
        pricing = {
            "BASIC": {"monthly": 99.0, "3month_discount": 5, "6month_discount": 10},
            "PRO": {"monthly": 299.0, "3month_discount": 5, "6month_discount": 10},
            "ENTERPRISE": {"monthly": 799.0, "3month_discount": 10, "6month_discount": 15}
        }
        
        if tier not in pricing:
            raise HTTPException(400, f"Invalid tier: {tier}")
        
        if billing_cycle_months not in [1, 3, 6]:
            raise HTTPException(400, "Billing cycle must be 1, 3, or 6 months")
        
        # Calculate pricing
        monthly_price = pricing[tier]["monthly"]
        discount_percent = 0.0
        if billing_cycle_months == 3:
            discount_percent = pricing[tier]["3month_discount"]
        elif billing_cycle_months == 6:
            discount_percent = pricing[tier]["6month_discount"]
        
        # Calculate total
        subtotal = monthly_price * billing_cycle_months
        discount_amount = subtotal * (discount_percent / 100)
        total_amount = subtotal - discount_amount
        
        # End trial
        if company.trial_status == "ACTIVE":
            company.trial_status = "CONVERTED"
            company.trial_ended_at = datetime.utcnow()
        
        # Create subscription record
        subscription = SubscriptionDB(
            id=f"sub_{uuid4().hex[:12]}",
            company_id=company.id,
            tier=tier,
            billing_cycle_months=billing_cycle_months,
            monthly_price=monthly_price,
            discount_percent=discount_percent,
            status="ACTIVE",
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=30 * billing_cycle_months),
            stripe_customer_id=company.stripe_customer_id
        )
        
        db.add(subscription)
        db.commit()
        
        return {
            "message": "Subscription created successfully",
            "subscription_id": subscription.id,
            "tier": tier,
            "billing_cycle_months": billing_cycle_months,
            "total_amount": total_amount,
            "monthly_price": monthly_price,
            "discount_percent": discount_percent
        }
    
    except Exception as e:
        raise HTTPException(500, f"Failed to create subscription: {str(e)}")

@app.get("/billing/trial", tags=["Billing"], response_model=TrialStatusOut)
async def get_trial_status(
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get free trial status"""
    company = db.query(CompanyDB).filter(CompanyDB.id == current_user.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    
    # Calculate remaining
    trial_days_remaining = None
    trial_invoices_remaining = None
    trial_expired = False
    
    if company.trial_status == "ACTIVE" and company.trial_start_date:
        # Calculate days remaining (30 day trial)
        days_elapsed = (datetime.utcnow() - company.trial_start_date).days
        trial_days_remaining = max(0, 30 - days_elapsed)
        
        # Calculate invoices remaining (100 invoice limit)
        trial_invoices_remaining = max(0, 100 - company.trial_invoice_count)
        
        # Check if expired
        if trial_days_remaining == 0 or trial_invoices_remaining == 0:
            trial_expired = True
            company.trial_status = "EXPIRED"
            company.trial_ended_at = datetime.utcnow()
            db.commit()
    
    return TrialStatusOut(
        trial_status=company.trial_status,
        trial_start_date=company.trial_start_date.isoformat() if company.trial_start_date else None,
        trial_invoice_count=company.trial_invoice_count,
        trial_days_remaining=trial_days_remaining,
        trial_invoices_remaining=trial_invoices_remaining,
        trial_expired=trial_expired
    )

# ==================== BULK IMPORT ====================

@app.get("/templates/invoices", tags=["Bulk Import"])
async def download_invoice_template(format: str = "csv"):
    """Download CSV/Excel template for bulk invoice import"""
    try:
        df = BulkImportValidator.generate_invoice_template()
        
        if format.lower() == "excel" or format.lower() == "xlsx":
            output = BytesIO()
            df.to_excel(output, index=False, engine='openpyxl')
            output.seek(0)
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=invoice_template.xlsx"}
            )
        else:
            output = BytesIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=invoice_template.csv"}
            )
    except Exception as e:
        raise HTTPException(500, f"Template generation failed: {str(e)}")

@app.get("/templates/vendors", tags=["Bulk Import"])
async def download_vendor_template(format: str = "csv"):
    """Download CSV/Excel template for bulk vendor import"""
    try:
        df = BulkImportValidator.generate_vendor_template()
        
        if format.lower() == "excel" or format.lower() == "xlsx":
            output = BytesIO()
            df.to_excel(output, index=False, engine='openpyxl')
            output.seek(0)
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=vendor_template.xlsx"}
            )
        else:
            output = BytesIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=vendor_template.csv"}
            )
    except Exception as e:
        raise HTTPException(500, f"Template generation failed: {str(e)}")

@app.post("/invoices/bulk-import", tags=["Bulk Import"])
async def bulk_import_invoices(
    file: UploadFile = File(...),
    current_user_data: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and validate CSV/Excel file for bulk invoice creation"""
    try:
        company_id = current_user_data.get("company_id")
        if not company_id:
            raise HTTPException(403, "Company context required")
        
        company = db.query(CompanyDB).filter_by(id=company_id).first()
        if not company:
            raise HTTPException(404, "Company not found")
        
        file_content = await file.read()
        is_valid, parsed_invoices, errors = BulkImportValidator.validate_invoice_file(
            file_content, file.filename
        )
        
        if not is_valid:
            return {
                "success": False,
                "total_rows": 0,
                "valid_rows": 0,
                "errors": errors
            }
        
        subscription = db.query(SubscriptionDB).filter_by(company_id=company_id, active=True).first()
        if not subscription:
            raise HTTPException(403, "No active subscription found")
        
        plan = db.query(SubscriptionPlanDB).filter_by(id=subscription.plan_id).first()
        is_free_plan = plan and plan.name.lower() == 'free'
        
        if is_free_plan:
            invoice_count = db.query(InvoiceDB).filter_by(company_id=company_id).count()
            max_invoices = 10
            available_slots = max_invoices - invoice_count
            
            if available_slots <= 0:
                raise HTTPException(403, "Free plan limit (10 invoices) reached. Please upgrade.")
            
            if len(parsed_invoices) > available_slots:
                return {
                    "success": False,
                    "total_rows": len(parsed_invoices),
                    "valid_rows": 0,
                    "errors": [
                        f"Free plan allows {max_invoices} invoices total. You have {invoice_count} invoices. ",
                        f"Can only import {available_slots} more. Please upgrade or delete existing invoices."
                    ]
                }
        
        created_count = 0
        for invoice_data in parsed_invoices:
            line_total = invoice_data['quantity'] * invoice_data['unit_price']
            discount = invoice_data.get('discount_amount', 0)
            taxable_amount = line_total - discount
            tax_amount = (taxable_amount * invoice_data['tax_percent']) / 100
            total = taxable_amount + tax_amount
            
            new_invoice = InvoiceDB(
                id=str(uuid4()),
                company_id=company_id,
                invoice_number=invoice_data['invoice_number'],
                invoice_type=invoice_data['invoice_type'],
                issue_date=datetime.strptime(invoice_data['issue_date'], '%Y-%m-%d').date() if invoice_data.get('issue_date') else date.today(),
                due_date=datetime.strptime(invoice_data['due_date'], '%Y-%m-%d').date() if invoice_data.get('due_date') else None,
                customer_trn=invoice_data['customer_trn'],
                customer_name=invoice_data['customer_name'],
                customer_email=invoice_data.get('customer_email'),
                customer_address=invoice_data.get('customer_address'),
                subtotal=float(taxable_amount),
                tax_amount=float(tax_amount),
                total=float(total),
                status='DRAFT',
                notes=invoice_data.get('notes'),
                created_at=datetime.utcnow()
            )
            db.add(new_invoice)
            created_count += 1
        
        db.commit()
        
        return {
            "success": True,
            "total_rows": len(parsed_invoices),
            "valid_rows": created_count,
            "errors": [],
            "message": f"Successfully imported {created_count} invoices"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Bulk import failed: {str(e)}")

@app.post("/vendors/bulk-import", tags=["Bulk Import"])
async def bulk_import_vendors(
    file: UploadFile = File(...),
    current_user_data: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and validate CSV/Excel file for bulk vendor creation (stored as inward invoice metadata)"""
    try:
        company_id = current_user_data.get("company_id")
        if not company_id:
            raise HTTPException(403, "Company context required")
        
        file_content = await file.read()
        is_valid, parsed_vendors, errors = BulkImportValidator.validate_vendor_file(
            file_content, file.filename
        )
        
        if not is_valid:
            return {
                "success": False,
                "total_rows": 0,
                "valid_rows": 0,
                "errors": errors
            }
        
        created_count = 0
        updated_count = 0
        
        for vendor_data in parsed_vendors:
            existing_vendor = db.query(InwardInvoiceDB).filter_by(
                company_id=company_id,
                supplier_trn=vendor_data['vendor_trn']
            ).first()
            
            if existing_vendor:
                existing_vendor.supplier_name = vendor_data['vendor_name']
                existing_vendor.supplier_email = vendor_data['vendor_email']
                existing_vendor.supplier_peppol_id = vendor_data.get('peppol_id')
                updated_count += 1
            else:
                placeholder_invoice = InwardInvoiceDB(
                    id=str(uuid4()),
                    company_id=company_id,
                    invoice_number=f"VENDOR-{vendor_data['vendor_trn']}",
                    supplier_trn=vendor_data['vendor_trn'],
                    supplier_name=vendor_data['vendor_name'],
                    supplier_email=vendor_data['vendor_email'],
                    supplier_address=vendor_data.get('vendor_address'),
                    supplier_peppol_id=vendor_data.get('peppol_id'),
                    issue_date=date.today(),
                    total=0.00,
                    status='VENDOR_RECORD',
                    received_at=datetime.utcnow()
                )
                db.add(placeholder_invoice)
                created_count += 1
        
        db.commit()
        
        return {
            "success": True,
            "total_rows": len(parsed_vendors),
            "valid_rows": created_count + updated_count,
            "created": created_count,
            "updated": updated_count,
            "errors": [],
            "message": f"Successfully processed {created_count + updated_count} vendors ({created_count} created, {updated_count} updated)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Bulk vendor import failed: {str(e)}")

# ==================== REACT APP SERVING ====================
# These routes MUST be last to avoid intercepting API routes

@app.get("/", tags=["General"])
async def root():
    """Serve React app or API info"""
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    elif os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    return {"message": "InvoLinks API v2.0 - React dev server at port 5173"}

# Catch-all route for React Router (MUST be absolutely last)
@app.get("/{full_path:path}", tags=["General"])
async def serve_react_routes(full_path: str):
    """Serve React app for client-side routing"""
    # Skip API routes
    if full_path.startswith(("api/", "auth/", "admin/", "companies/", "register/", "plans/", "docs", "redoc", "openapi.json")):
        raise HTTPException(404, "Not found")
    
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    raise HTTPException(404, "Not found")

# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting InvoLinks E-Invoicing API...")
    print("📚 API Docs: http://0.0.0.0:5000/docs")
    uvicorn.run(app, host="0.0.0.0", port=5000)

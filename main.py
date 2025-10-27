"""
UAE e-Invoicing Platform with Registration Wizard
==================================================
InvoLinks API - Multi-tenant e-invoicing with subscription plans
"""
import os, enum, hashlib, secrets
from uuid import uuid4
from typing import List, Optional
from datetime import datetime, date, timedelta

# Pydantic & FastAPI
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, Response, Header
from fastapi.responses import FileResponse
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

class CompanyDB(Base):
    __tablename__ = "companies"
    id = Column(String, primary_key=True)
    legal_name = Column(String, nullable=True)
    country = Column(String, default="AE")
    status = Column(SQLEnum(CompanyStatus), default=CompanyStatus.PENDING_REVIEW)
    trn = Column(String, nullable=True)

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

    # Free plan configuration
    free_plan_type = Column(String, nullable=True)  # "DURATION" or "INVOICE_COUNT"
    free_plan_duration_months = Column(Integer, nullable=True)  # If duration-based
    free_plan_invoice_limit = Column(Integer, nullable=True)  # If invoice count-based
    free_plan_start_date = Column(DateTime, nullable=True)  # When free plan started
    invoices_generated = Column(Integer, default=0)  # Total lifetime invoices
    
    # Subscription tracking
    subscription_plan_id = Column(String, ForeignKey("subscription_plans.id"), nullable=True)

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

    company = relationship("CompanyDB", backref="subscriptions")
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
    """Seed plans on startup"""
    db = SessionLocal()
    seed_plans(db)
    db.close()
    print("✅ InvoLinks API started - Plans seeded")

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

@app.post("/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Login endpoint - returns JWT token for both users and companies"""
    
    # Try user authentication first (for super admins, company admins, etc)
    user = authenticate_user(payload.email, payload.password, db)
    if user:
        # Create access token with user ID
        access_token = create_access_token(data={"sub": user.id, "type": "user"})
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user.id,
            company_id=user.company_id,
            company_name=None,
            role=user.role.value
        )
    
    # Try company authentication
    company = authenticate_company(payload.email, payload.password, db)
    if company:
        if company.status != CompanyStatus.ACTIVE:
            raise HTTPException(403, f"Account not active. Status: {company.status.value}")
        
        # Create access token with company ID
        access_token = create_access_token(data={"sub": company.id, "type": "company"})
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            company_id=company.id,
            company_name=company.legal_name or "Company",
            role="COMPANY"
        )
    
    # Neither user nor company authenticated
    raise HTTPException(401, "Invalid email or password")

@app.post("/auth/logout", tags=["Auth"])
def logout():
    """Logout endpoint (client-side token removal)"""
    return {"message": "Logged out successfully"}

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
        }
    }

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
    
    # Check free plan limits
    if company.free_plan_type == "INVOICE_COUNT" and company.free_plan_invoice_limit:
        if company.invoices_generated >= company.free_plan_invoice_limit:
            raise HTTPException(403, "Invoice limit reached for free plan. Please upgrade your subscription.")
    
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
    db.commit()
    
    # In production, this would:
    # 1. Generate UBL XML
    # 2. Send to ASP API for Peppol transmission
    # 3. Send email to customer with share link
    # 4. ASP reports to FTA
    
    return {
        "message": "Invoice sent successfully",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "sent_to": invoice.customer_email or invoice.customer_name,
        "share_link": f"/invoices/view/{invoice.share_token}",
        "peppol_transmission": "simulated",
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

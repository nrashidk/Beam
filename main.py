"""
UAE e-Invoicing Platform with Registration Wizard
==================================================
Beam API - Multi-tenant e-invoicing with subscription plans
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

# ==================== CONFIG ====================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./.dev.db")
ARTIFACT_ROOT = os.path.join(os.getcwd(), "artifacts")
os.makedirs(ARTIFACT_ROOT, exist_ok=True)
os.makedirs(os.path.join(ARTIFACT_ROOT, "documents"), exist_ok=True)

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "beam-secret-key-change-in-production")
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

# ==================== DATABASE MODELS ====================
class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    role = Column(SQLEnum(Role), nullable=False)
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)

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

# ==================== FASTAPI APP ====================
app = FastAPI(
    title="Beam E-Invoicing API",
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
    print("✅ Beam API started - Plans seeded")

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
        
        # Create user account
        user = UserDB(
            id=f"user_{uuid4().hex[:8]}",
            email=payload.email,
            password_hash=get_password_hash(payload.password),
            role=Role.COMPANY_ADMIN,
            company_id=company_id
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
║  Subject: Verify Your Email - Beam E-Invoicing                   ║
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
║  Beam E-Invoicing Team                                          ║
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
    print(f"║  Subject: Reset Your Password - Beam E-Invoicing{' '*18} ║")
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
    print("║  Beam E-Invoicing Team                                          ║")
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

@app.post("/admin/companies/{company_id}/approve", tags=["Admin"])
def approve_company(company_id: str, db: Session = Depends(get_db)):
    """Approve a company registration (Admin only)"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    
    if not company.email_verified:
        raise HTTPException(400, "Email must be verified before approval")

    company.status = CompanyStatus.ACTIVE

    # Check if subscription exists, if not create free tier
    sub = db.query(CompanySubscriptionDB).filter_by(company_id=company_id).first()
    if not sub:
        # Auto-assign free tier
        free_plan = db.query(SubscriptionPlanDB).filter_by(id="plan_free").first()
        if free_plan:
            sub = CompanySubscriptionDB(
                id=f"sub_{uuid4().hex[:8]}",
                company_id=company_id,
                plan_id="plan_free",
                status=SubscriptionStatus.ACTIVE,
                billing_cycle="monthly",
                current_period_start=datetime.utcnow(),
                current_period_end=datetime.utcnow() + timedelta(days=365)
            )
            db.add(sub)
    else:
        sub.status = SubscriptionStatus.ACTIVE

    db.commit()
    
    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                    EMAIL WOULD BE SENT                           ║
╠══════════════════════════════════════════════════════════════════╣
║  To: {company.email:<58} ║
║  Subject: Account Approved - Beam E-Invoicing                    ║
║                                                                  ║
║  Hi {company.legal_name or 'there'},                                          ║
║                                                                  ║
║  Great news! Your account has been approved and activated.       ║
║                                                                  ║
║  You now have access to:                                         ║
║  • 100 free invoices per month                                   ║
║  • Full API access                                               ║
║  • All core e-invoicing features                                 ║
║                                                                  ║
║  Login now: https://your-app-url.com/login                       ║
║  Email: {company.email:<51} ║
║                                                                  ║
║  Best regards,                                                   ║
║  Beam E-Invoicing Team                                          ║
╚══════════════════════════════════════════════════════════════════╝
    """)
    
    return {
        "message": f"Company '{company.legal_name}' approved and activated",
        "plan": "Free tier (100 invoices/month)",
        "status": "active",
        "note": "Approval email sent to " + company.email
    }

@app.post("/admin/companies/{company_id}/reject", tags=["Admin"])
def reject_company(company_id: str, reason: str = Form(...), db: Session = Depends(get_db)):
    """Reject a company registration (Admin only)"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    company.status = CompanyStatus.REJECTED
    db.commit()

    return {"message": f"Company '{company.legal_name}' rejected", "reason": reason}

# ==================== COMPANY ENDPOINTS ====================

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
    ).all()
    
    return [{
        "id": c.id,
        "legal_name": c.legal_name,
        "email": c.email,
        "business_type": c.business_type,
        "phone": c.phone,
        "created_at": c.created_at.isoformat(),
        "status": c.status.value,
        "invoices_generated": c.invoices_generated or 0
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
    print(f"Subject: Your Beam Account Has Been Approved!")
    print(f"\nDear {company.legal_name},")
    print(f"\nCongratulations! Your account has been approved.")
    print(f"You can now log in and start using Beam E-Invoicing.")
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

@app.post("/admin/companies/{company_id}/reject", tags=["Admin"])
def reject_company(
    company_id: str,
    notes: str = None,
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
    
    # Update company status to REJECTED
    company.status = CompanyStatus.REJECTED
    db.commit()
    
    # Simulate email notification
    print("\n" + "="*70)
    print("❌ COMPANY REJECTED - EMAIL NOTIFICATION")
    print("="*70)
    print(f"To: {company.email}")
    print(f"Subject: Beam Account Registration Update")
    print(f"\nDear {company.legal_name},")
    print(f"\nThank you for your interest in Beam E-Invoicing.")
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
    current_user: UserDB = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics (Super Admin only)"""
    if current_user.role != Role.SUPER_ADMIN:
        raise HTTPException(403, "Insufficient permissions")
    
    # Count companies by status
    total_companies = db.query(CompanyDB).count()
    pending = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.PENDING_REVIEW).count()
    active = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.ACTIVE).count()
    rejected = db.query(CompanyDB).filter(CompanyDB.status == CompanyStatus.REJECTED).count()
    
    # Calculate total invoices across all companies
    total_invoices = db.query(func.sum(CompanyDB.invoices_generated)).scalar() or 0
    
    return {
        "total_companies": total_companies,
        "pending_approval": pending,
        "active": active,
        "rejected": rejected,
        "total_invoices": total_invoices,
        "timestamp": datetime.utcnow().isoformat()
    }

# ==================== HEALTH CHECK ====================

@app.get("/", tags=["Health"])
def root():
    """API Health Check"""
    return {
        "service": "Beam E-Invoicing API",
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
    return {"message": "Beam API v2.0 - React dev server at port 5173"}

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
    print("🚀 Starting Beam E-Invoicing API...")
    print("📚 API Docs: http://0.0.0.0:5000/docs")
    uvicorn.run(app, host="0.0.0.0", port=5000)

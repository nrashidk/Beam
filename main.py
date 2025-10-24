"""
UAE e-Invoicing Platform with Registration Wizard
==================================================
Beam API - Multi-tenant e-invoicing with subscription plans
"""
import os, enum, hashlib
from uuid import uuid4
from typing import List, Optional
from datetime import datetime, date, timedelta

# Pydantic & FastAPI
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# SQLAlchemy
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, Date, DateTime, Enum as SQLEnum, ForeignKey, Text
from sqlalchemy.orm import declarative_base, Session, sessionmaker, relationship

# ==================== CONFIG ====================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./.dev.db")
ARTIFACT_ROOT = os.path.join(os.getcwd(), "artifacts")
os.makedirs(ARTIFACT_ROOT, exist_ok=True)
os.makedirs(os.path.join(ARTIFACT_ROOT, "documents"), exist_ok=True)

engine = create_engine(DATABASE_URL, future=True)
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
    business_type: str = Field(..., example="LLC")
    registration_number: str
    registration_date: date
    email: str
    phone: str
    website: Optional[str] = None

class BusinessDetailsCreate(BaseModel):
    business_activity: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    emirate: str = Field(..., example="Dubai")
    po_box: Optional[str] = None
    trn: Optional[str] = None
    authorized_person_name: str
    authorized_person_title: str
    authorized_person_email: str
    authorized_person_phone: str

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

@app.on_event("startup")
def startup_event():
    """Seed plans on startup"""
    db = SessionLocal()
    seed_plans(db)
    db.close()
    print("✅ Beam API started - Plans seeded")

# ==================== REGISTRATION ENDPOINTS ====================

@app.post("/register/init", tags=["Registration"])
def init_registration(db: Session = Depends(get_db)):
    """Initialize a new registration session"""
    company_id = f"co_{uuid4().hex[:8]}"

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

    company.legal_name = payload.legal_name
    company.business_type = payload.business_type
    company.registration_number = payload.registration_number
    company.registration_date = payload.registration_date
    company.email = payload.email
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

    company.business_activity = payload.business_activity
    company.address_line1 = payload.address_line1
    company.address_line2 = payload.address_line2
    company.city = payload.city
    company.emirate = payload.emirate
    company.po_box = payload.po_box

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
    """Step 5: Finalize and submit registration"""
    progress = db.query(RegistrationProgressDB).filter_by(company_id=company_id).first()
    if not progress:
        raise HTTPException(404, "Registration not found")

    # Verify all steps completed
    if not all([
        progress.step_company_info,
        progress.step_business_details,
        progress.step_documents,
        progress.step_plan_selection
    ]):
        raise HTTPException(400, "All previous steps must be completed")

    progress.step_review = True
    progress.completed = True
    db.commit()

    return {
        "message": "Registration submitted successfully! Your application is pending admin review.",
        "company_id": company_id,
        "status": "PENDING_REVIEW"
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

    company.status = CompanyStatus.ACTIVE

    # Activate subscription
    sub = db.query(CompanySubscriptionDB).filter_by(company_id=company_id).first()
    if sub:
        sub.status = SubscriptionStatus.ACTIVE

    db.commit()
    return {"message": f"Company '{company.legal_name}' approved and activated"}

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

@app.get("/companies/{company_id}", response_model=CompanyOut, tags=["Companies"])
def get_company(company_id: str, db: Session = Depends(get_db)):
    """Get company details"""
    company = db.get(CompanyDB, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    return CompanyOut(
        id=company.id,
        legal_name=company.legal_name,
        status=company.status,
        email=company.email,
        trn=company.trn
    )

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

# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Beam E-Invoicing API...")
    print("📚 API Docs: http://0.0.0.0:5000/docs")
    uvicorn.run(app, host="0.0.0.0", port=5000)

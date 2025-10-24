"""
UAE e‑Invoicing Platform – FastAPI (SQLAlchemy + OpenAPI + AS4 stub + Payments)
==============================================================================

This module loads and runs even if the host Python lacks OpenSSL (common in sandboxes):
- FastAPI/uvicorn are imported **only** when SSL is available.
- Core logic (DB models, VAT rules, XML/PDF generation, Schematron) always imports.
- SQLAlchemy Declarative conflict fixed by renaming the reserved attribute `metadata` → `payment_metadata`.

Scope: Implements only what is **required** by the documents you shared (PINT/PINT‑AE, Genericode lists, and UAE Schematron).
No optional behavior is included.
"""

from __future__ import annotations

import os, io, json, hashlib, sys
from uuid import uuid4
from typing import List, Optional, Any
from datetime import datetime, date, timedelta

# --------------------------- SSL availability probe ---------------------------
try:
    import ssl  # noqa: F401
    SSL_AVAILABLE = True
except ModuleNotFoundError:
    SSL_AVAILABLE = False

# We only import FastAPI stack when SSL is available to prevent import-time failure
if SSL_AVAILABLE:
    from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, BackgroundTasks
    from fastapi.responses import FileResponse
    from fastapi.middleware.cors import CORSMiddleware
else:
    FastAPI = object  # type: ignore
    UploadFile = object  # type: ignore
    FileResponse = object  # type: ignore
    CORSMiddleware = object  # type: ignore
    def Depends(x):  # type: ignore
        return x
    def File(*args, **kwargs):  # type: ignore
        return None
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: str):
            super().__init__(f"HTTP {status_code}: {detail}")

from pydantic import BaseModel, Field, ConfigDict

# --------------------------- Database (PostgreSQL + SQLAlchemy) ---------------------------
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Boolean, Date, DateTime, Enum, ForeignKey, JSON, Text, select, and_
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session
import enum

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")  # Use postgres in prod
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()

# --------------------------- Enums ---------------------------
class Role(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    FINANCE_USER = "FINANCE_USER"
    INTEGRATION_USER = "INTEGRATION_USER"
    READ_ONLY = "READ_ONLY"

class VATState(str, enum.Enum):
    NON_VAT = "NON_VAT"
    VAT_PENDING = "VAT_PENDING"
    VAT_ACTIVE = "VAT_ACTIVE"

class CompanyStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    REJECTED = "REJECTED"

class InvoiceType(str, enum.Enum):
    COMMERCIAL = "COMMERCIAL"
    VAT_TAX_INVOICE = "VAT_TAX_INVOICE"

class PaymentMethodKind(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"            # credit/debit via acquirers
    BANK_TRANSFER = "BANK_TRANSFER"
    POS = "POS"              # card via physical POS
    WALLET = "WALLET"        # wallets

class PaymentStatus(str, enum.Enum):
    REQUIRES_PAYMENT = "REQUIRES_PAYMENT"
    AUTHORIZED = "AUTHORIZED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"

AED_VAT_STANDARD = 0.05
MANDATORY_THRESHOLD_AED = 375_000
ARTIFACT_ROOT = os.environ.get("ARTIFACT_ROOT", "./artifacts")
os.makedirs(ARTIFACT_ROOT, exist_ok=True)

# --------------------------- SQLAlchemy Models ---------------------------
class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(Enum(Role), nullable=False)
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)

class CompanyDB(Base):
    __tablename__ = "companies"
    id = Column(String, primary_key=True)
    legal_name = Column(String, nullable=False)
    country = Column(String, default="AE")
    status = Column(Enum(CompanyStatus), default=CompanyStatus.PENDING_REVIEW)
    vat_state = Column(Enum(VATState), default=VATState.NON_VAT)
    trn = Column(String, nullable=True)
    vat_effective_date = Column(Date, nullable=True)
    default_currency = Column(String, default="AED")
    timezone = Column(String, default="Asia/Dubai")
    branding_profile_id = Column(String, ForeignKey("branding_profiles.id"), nullable=True)
    peppol_endpoint_id = Column(String, nullable=True)  # scheme:id

    branding = relationship("BrandingProfileDB", back_populates="company", uselist=False)

class BrandingProfileDB(Base):
    __tablename__ = "branding_profiles"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"))
    primary_color = Column(String, default="#111827")
    font_family = Column(String, default="Inter")
    layout_variant = Column(String, default="STANDARD")
    logo_asset_id = Column(String, ForeignKey("assets.id"), nullable=True)
    header_text = Column(Text, nullable=True)
    footer_text = Column(Text, nullable=True)

    company = relationship("CompanyDB", back_populates="branding")
    logo = relationship("AssetDB")

class AssetDB(Base):
    __tablename__ = "assets"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"))
    mime = Column(String)
    uri = Column(String)
    created_at = Column(DateTime)
    sha256 = Column(String)

class BillingEventDB(Base):
    __tablename__ = "billing_events"
    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"))
    customer_name = Column(String)
    occurred_at = Column(DateTime)
    description = Column(Text)
    quantity = Column(Float)
    unit_price = Column(Float)

class TurnoverBucketDB(Base):
    __tablename__ = "turnover_buckets"
    id = Column(String, primary_key=True)
    company_id = Column(String, index=True)
    month = Column(Date, index=True)  # first day of month
    amount = Column(Float, default=0.0)

class InvoiceDB(Base):
    __tablename__ = "invoices"
    id = Column(String, primary_key=True)
    company_id = Column(String, index=True)
    customer_name = Column(String)
    invoice_date = Column(Date)
    invoice_type = Column(Enum(InvoiceType))
    number = Column(String, index=True)
    currency = Column(String)
    net_total = Column(Float)
    vat_total = Column(Float)
    gross_total = Column(Float)
    xml_path = Column(String)
    pdf_path = Column(String)

class PaymentPolicyDB(Base):
    __tablename__ = "payment_policies"
    id = Column(String, primary_key=True)
    company_id = Column(String, index=True)
    allow_cash = Column(Boolean, default=True)
    allow_card = Column(Boolean, default=False)
    allow_pos = Column(Boolean, default=False)
    allow_bank_transfer = Column(Boolean, default=False)
    allow_wallet = Column(Boolean, default=False)
    card_surcharge_percent = Column(Float, default=0.0)

class POSDeviceDB(Base):
    __tablename__ = "pos_devices"
    id = Column(String, primary_key=True)
    company_id = Column(String, index=True)
    label = Column(String)
    provider = Column(String)
    terminal_id = Column(String)
    merchant_id = Column(String)
    active = Column(Boolean, default=True)

class PaymentIntentDB(Base):
    __tablename__ = "payment_intents"
    id = Column(String, primary_key=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), index=True)
    amount = Column(Float)
    currency = Column(String)
    method_kind = Column(Enum(PaymentMethodKind))
    status = Column(Enum(PaymentStatus), default=PaymentStatus.REQUIRES_PAYMENT)
    payment_metadata = Column(JSON)  # renamed from reserved name 'metadata'

class PaymentDB(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True)
    intent_id = Column(String, ForeignKey("payment_intents.id"), index=True)
    captured_at = Column(DateTime)
    amount = Column(Float)
    currency = Column(String)
    method_kind = Column(Enum(PaymentMethodKind))
    provider_ref = Column(String)

# --------------------------- DB init (dev convenience) ---------------------------
Base.metadata.create_all(engine)

# --------------------------- Dependency ---------------------------

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --------------------------- Security / Current User (stub) ---------------------------
class User(BaseModel):
    id: str
    email: str
    role: Role
    company_id: Optional[str] = None

SUPER = User(id="u_super", email="super@platform.tld", role=Role.SUPER_ADMIN)

def current_user() -> User:
    return SUPER

# --------------------------- Helpers & Services ---------------------------
PEPPOL_ENDPOINT_SCHEME = os.getenv("PEPPOL_ENDPOINT_SCHEME", "0088")
RETENTION_YEARS = int(os.getenv("RETENTION_YEARS", "7"))

def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def month_bucket(d: date) -> date:
    return d.replace(day=1)

# Turnover helpers

def add_turnover(db: Session, company_id: str, amount: float, happened_at: datetime):
    bucket = month_bucket(happened_at.date())
    q = select(TurnoverBucketDB).where(and_(TurnoverBucketDB.company_id==company_id, TurnoverBucketDB.month==bucket))
    row = db.scalars(q).first()
    if not row:
        row = TurnoverBucketDB(id=f"tb_{uuid4().hex[:8]}", company_id=company_id, month=bucket, amount=0.0)
        db.add(row)
    row.amount += amount
    db.commit()

def rolling_12m_total(db: Session, company_id: str, today: date) -> float:
    start = today - timedelta(days=365)
    q = select(TurnoverBucketDB).where(and_(TurnoverBucketDB.company_id==company_id, TurnoverBucketDB.month>start, TurnoverBucketDB.month<=today))
    return sum(b.amount for b in db.scalars(q).all())

def evaluate_vat_state(db: Session, company: CompanyDB, today: date) -> CompanyDB:
    if company.vat_state == VATState.NON_VAT:
        total = rolling_12m_total(db, company.id, today)
        if total >= MANDATORY_THRESHOLD_AED:
            company.vat_state = VATState.VAT_PENDING
    if company.vat_state == VATState.VAT_PENDING and company.trn and company.vat_effective_date:
        if today >= company.vat_effective_date:
            company.vat_state = VATState.VAT_ACTIVE
    db.commit()
    return company

# --------------------------- Genericode loader (required code lists) ---------------------------
import xml.etree.ElementTree as _ET
from functools import lru_cache as _lru_cache
_GC_NS = {'gc': 'http://docs.oasis-open.org/codelist/ns/genericode/1.0/'}
_GC_DIR = '/mnt/data'
GC_FILES = {
    'EAS': f"{_GC_DIR}/eas.gc",
    'ISO4217': f"{_GC_DIR}/ISO4217.gc",
    'ISO3166': f"{_GC_DIR}/ISO3166.gc",
    'UNCL1001': f"{_GC_DIR}/UNCL1001-cn.gc",
    'UNCL2005': f"{_GC_DIR}/UNCL2005.gc",
    'UNCL4461': f"{_GC_DIR}/UNCL4461.gc",
    'UNCL5189': f"{_GC_DIR}/UNCL5189.gc",
    'UNCL7161': f"{_GC_DIR}/UNCL7161.gc",
    'UNCL7143': f"{_GC_DIR}/UNCL7143.gc",
    'REC20': f"{_GC_DIR}/UNECERec20.gc",
    'MIME': f"{_GC_DIR}/MimeCode.gc",
    'TAX_CAT': f"{_GC_DIR}/Aligned-TaxCategoryCodes.gc",
    'TAX_EX': f"{_GC_DIR}/Aligned-TaxExemptionCodes.gc",
    'TXN_TYPE': f"{_GC_DIR}/transactiontype.gc",
    'FREQ': f"{_GC_DIR}/FreqBilling.gc",
    'ICD': f"{_GC_DIR}/ICD.gc",
}

@_lru_cache(maxsize=64)
def _gc_rows(path: str):
    try:
        root = _ET.parse(path).getroot()
    except Exception:
        return []
    rows = []
    for row in root.findall('.//gc:Row', _GC_NS):
        vals = {}
        for val in row.findall('gc:Value', _GC_NS):
            vals[val.attrib.get('ColumnRef')] = ''.join(val.itertext()).strip()
        if 'id' in vals and vals['id']:
            rows.append(vals)
    return rows

@_lru_cache(maxsize=128)
def code_ids(kind: str) -> set[str]:
    path = GC_FILES.get(kind)
    if not path:
        return set()
    return {r.get('id') for r in _gc_rows(path) if r.get('id')}

def _endpoint_scheme(endpoint_id: Optional[str]) -> Optional[str]:
    if not endpoint_id or ':' not in endpoint_id:
        return None
    return endpoint_id.split(':', 1)[0]

# --------------------------- Compliance: Schematron (enforced) ---------------------------
SCHEMATRON_GLOBAL_XSLT = "/mnt/data/PINT-UBL-validation-preprocessed.xslt"
SCHEMATRON_AE_XSLT = "/mnt/data/PINT-jurisdiction-aligned-rules.xslt"

try:
    import lxml.etree as _ETREE
    _HAVE_LXML = True
except Exception:
    _HAVE_LXML = False

def _write_artifact(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as _f:
        _f.write(data)

def _svrl_stub(label: str, err: str = "") -> bytes:
    esc = err.replace("<", "&lt;").replace(">", "&gt;")
    return ("<?xml version='1.0' encoding='UTF-8'?>\n"
            "<svrl:schematron-output xmlns:svrl='http://purl.oclc.org/dsdl/svrl'>\n"
            f"  <svrl:active-pattern documents='{label}'/>\n"
            f"  <svrl:failed-assert test='N/A'><svrl:text>{esc}</svrl:text></svrl:failed-assert>\n"
            "</svrl:schematron-output>\n").encode("utf-8")

def run_schematron_validations_enforced(xml_bytes: bytes, invoice_id: str) -> None:
    """Run global + UAE Schematron and **raise** if any failed-assert is present. Writes SVRL reports."""
    reports = []
    if not _HAVE_LXML:
        out = os.path.join(ARTIFACT_ROOT, f"{invoice_id}.svrl.xml")
        _write_artifact(out, _svrl_stub("all", "lxml not available"))
        raise RuntimeError("Schematron enforcement failed: XSLT engine unavailable")
    xml_doc = _ETREE.fromstring(xml_bytes)
    for label, xslt_path in (("global", SCHEMATRON_GLOBAL_XSLT), ("uae", SCHEMATRON_AE_XSLT)):
        try:
            xslt_doc = _ETREE.parse(xslt_path)
            transform = _ETREE.XSLT(xslt_doc)
            result = transform(xml_doc)
            svrl = _ETREE.tostring(result, encoding="utf-8")
        except Exception as e:
            svrl = _svrl_stub(label, str(e))
        out = os.path.join(ARTIFACT_ROOT, f"{invoice_id}.{label}.svrl.xml")
        _write_artifact(out, svrl)
        reports.append((label, svrl))
    if any(b"failed-assert" in svrl for _, svrl in reports):
        raise RuntimeError("Schematron enforcement failed; see SVRL reports")

# --------------------------- Schemas ---------------------------
class CompanyCreate(BaseModel):
    legal_name: str = Field(..., example="Falcon Trading LLC")
    country: str = Field("AE", example="AE")
    trn: Optional[str] = Field(None, example="1000 1234 5678 901")
    vat_effective_date: Optional[date] = Field(None, example="2025-12-01")
    peppol_endpoint_id: Optional[str] = Field(None, example="0088:1234567890123")  # scheme:id

    def model_post_init(self, __context: Any) -> None:
        if self.trn and not is_valid_trn(self.trn):
            raise ValueError("Invalid TRN format: expected 15 digits (spaces allowed)")
        if self.peppol_endpoint_id:
            scheme = _endpoint_scheme(self.peppol_endpoint_id)
            if not scheme or scheme not in code_ids('EAS'):
                raise ValueError("Unsupported Peppol endpoint scheme (EAS)")

class CompanyOut(BaseModel):
    id: str; legal_name: str; status: CompanyStatus; vat_state: VATState
    trn: Optional[str]; vat_effective_date: Optional[date]; branding_profile_id: Optional[str]

class CreateEventIn(BaseModel):
    company_id: str
    customer_name: str
    occurred_at: datetime
    description: str
    quantity: float = 1
    unit_price: float = 500.0

class UploadLogoOut(BaseModel):
    asset_id: str; logo_url: str

class PaymentPolicyIn(BaseModel):
    allow_cash: bool = True
    allow_card: bool = False
    allow_pos: bool = False
    allow_bank_transfer: bool = False
    allow_wallet: bool = False
    card_surcharge_percent: float = 0.0

class PaymentPolicyOut(PaymentPolicyIn):
    id: str

class POSDeviceIn(BaseModel):
    label: str; provider: str; terminal_id: str; merchant_id: str

class POSDeviceOut(POSDeviceIn):
    id: str; active: bool

class PaymentIntentMeta(BaseModel):
    model_config = ConfigDict(extra='forbid')
    cashier_id: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9_-]{1,64}$")
    shift_id: Optional[str] = None
    store_id: Optional[str] = None
    location_id: Optional[str] = None
    pos_terminal_id: Optional[str] = None
    device_serial: Optional[str] = None
    pos_provider: Optional[str] = None
    merchant_id: Optional[str] = None
    order_id: Optional[str] = None
    invoice_ref: Optional[str] = None
    external_session_id: Optional[str] = None
    provider_ref: Optional[str] = None
    rrn: Optional[str] = None
    auth_code: Optional[str] = None
    card_brand: Optional[str] = None
    card_last4: Optional[str] = Field(None, pattern=r"^[0-9]{4}$")
    card_entry_mode: Optional[str] = None
    surcharge_amount: Optional[float] = None
    tip_amount: Optional[float] = None
    change_given: Optional[float] = None
    vat_rate_applied: Optional[float] = None
    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    wallet_type: Optional[str] = None
    bank_account_ref: Optional[str] = None
    transfer_reference: Optional[str] = None
    reconciliation_batch_id: Optional[str] = None
    offline: Optional[bool] = None
    offline_at: Optional[datetime] = None
    receipt_url: Optional[str] = None
    note: Optional[str] = Field(None, max_length=256)

    def model_post_init(self, __context: Any) -> None:
        if self.offline is True and self.offline_at is None:
            raise ValueError("offline_at is required when offline=True")

class PaymentIntentIn(BaseModel):
    amount: float
    currency: str = "AED"
    method_kind: PaymentMethodKind
    metadata: Optional[PaymentIntentMeta] = None

    def model_post_init(self, __context: Any) -> None:
        if self.currency not in code_ids('ISO4217'):
            raise ValueError("Unsupported currency (ISO 4217)")

class PaymentIntentOut(BaseModel):
    id: str
    amount: float
    currency: str
    method_kind: PaymentMethodKind
    status: PaymentStatus
    metadata: Optional[PaymentIntentMeta] = None

class CapturePaymentIn(BaseModel):
    provider_ref: Optional[str] = None

class PaymentOut(BaseModel):
    id: str; captured_at: datetime; amount: float; currency: str
    method_kind: PaymentMethodKind; provider_ref: Optional[str]

# --------------------------- Invoice models & builders ---------------------------

def is_valid_trn(trn: str) -> bool:
    d = "".join([c for c in trn if c.isdigit()])
    return len(d) == 15

class InvoiceLine(BaseModel):
    description: str
    quantity: float
    unit_price: float
    vat_rate: float
    # Required per shared code lists
    uom_code: str = Field("C62", description="UNECE Rec 20 unit code")
    item_ident_type: Optional[str] = Field(None, description="UNCL7143 item identification type code")
    item_ident_value: Optional[str] = Field(None, description="Identifier value matching the selected type")
    tax_category_code: Optional[str] = Field(None, description="Aligned-TaxCategoryCodes: S,Z,E,AE,O,Ν")
    tax_exemption_code: Optional[str] = Field(None, description="Aligned-TaxExemptionCodes when category implies exemption/zero/out-of-scope")

    def model_post_init(self, __context: Any) -> None:
        if self.uom_code and self.uom_code not in code_ids('REC20'):
            raise ValueError("Invalid uom_code (UNECE Rec 20)")
        if self.item_ident_type:
            if self.item_ident_type not in code_ids('UNCL7143'):
                raise ValueError("Invalid item_ident_type (UNCL7143)")
            if not self.item_ident_value:
                raise ValueError("item_ident_value is required when item_ident_type is set")
        if self.tax_category_code:
            if self.tax_category_code not in code_ids('TAX_CAT'):
                raise ValueError("Invalid tax_category_code (Aligned-TaxCategoryCodes)")
            if self.tax_category_code in {"Z","E","O","AE"}:
                if not self.tax_exemption_code or self.tax_exemption_code not in code_ids('TAX_EX'):
                    raise ValueError("tax_exemption_code required and must be valid when category is Z/E/O/AE")
            if self.tax_category_code in {"S","Ν"} and (self.vat_rate or 0) <= 0:
                raise ValueError("vat_rate must be > 0 when tax_category_code is S/Ν")

class InvoiceOut(BaseModel):
    id: str; number: str; invoice_type: InvoiceType; customer_name: str; invoice_date: date
    net_total: float; vat_total: float; gross_total: float; xml_path: str; pdf_path: str

def build_invoice_xml(inv: InvoiceOut, lines: List[InvoiceLine], company: CompanyDB) -> bytes:
    """Build a minimal UBL/PINT‑AE‑aligned payload (JSON stub) including required invoice line fields.
    Only required elements per your shared documents are projected.
    """
    supplier_endpoint = company.peppol_endpoint_id or (
        f"{PEPPOL_ENDPOINT_SCHEME}:{''.join([c for c in (company.trn or 'NA') if c.isdigit()])}"
    )
    invoice_type_code = "380"  # UNCL1001 for standard commercial invoice
    inv_lines = []
    for idx, line in enumerate(lines, start=1):
        inv_line = {
            "cbc:ID": idx,
            "cbc:InvoicedQuantity": line.quantity,
            "@unitCode": line.uom_code,
            "cbc:LineExtensionAmount": round(line.quantity * line.unit_price, 2),
            "cac:ClassifiedTaxCategory": {
                "cbc:ID": line.tax_category_code,
                "cbc:Percent": (line.vat_rate if (line.tax_category_code in {"S","Ν"}) else None),
                "cbc:ExemptionReasonCode": line.tax_exemption_code,
            },
            "cac:Item": {
                "cbc:Name": line.description,
                "cac:StandardItemIdentification": (
                    {"cbc:ID": line.item_ident_value, "@schemeID": line.item_ident_type}
                    if line.item_ident_type and line.item_ident_value else None
                ),
            },
            "cac:Price": {"cbc:PriceAmount": line.unit_price},
        }
        inv_lines.append(inv_line)

    payload = {
        "SBDH": {"Sender": {"Identifier": supplier_endpoint}, "Receiver": {"Identifier": "TBD"}},
        "Invoice": {
            "cbc:CustomizationID": "urn:peppol:pint:billing-1@ae-1",
            "cbc:ProfileID": "urn:peppol:bis:billing",
            "cbc:ID": inv.number,
            "cbc:IssueDate": inv.invoice_date.isoformat(),
            "cbc:InvoiceTypeCode": invoice_type_code,
            "cbc:DocumentCurrencyCode": "AED",
            "cac:AccountingSupplierParty": {
                "cbc:CustomerAssignedAccountID": company.trn or "NA",
                "cac:Party": {"cbc:Name": company.legal_name},
                "cbc:EndpointID": supplier_endpoint,
            },
            "cac:AccountingCustomerParty": {"cac:Party": {"cbc:Name": inv.customer_name}},
            "cac:TaxTotal": {"cbc:TaxAmount": inv.vat_total},
            "cac:LegalMonetaryTotal": {
                "cbc:LineExtensionAmount": inv.net_total,
                "cbc:TaxExclusiveAmount": inv.net_total,
                "cbc:TaxInclusiveAmount": inv.gross_total,
                "cbc:PayableAmount": inv.gross_total,
            },
            "cac:InvoiceLine": inv_lines,
        }
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

def build_invoice_pdf(
    inv: InvoiceOut,
    lines: List[InvoiceLine],
    company: CompanyDB,
    brand: Optional[BrandingProfileDB],
    xml_hash: str,
    *,
    force_text_fallback: bool = False,
) -> bytes:
    """Generate PDF. If ReportLab isn't available or force_text_fallback=True,
    produce a plain-text PDF-like blob. The XML SHA-256 is embedded as metadata
    when ReportLab+PyPDF2 are available.
    """
    if force_text_fallback:
        content = f"""INVOICE {inv.number}
Company: {company.legal_name}
Customer: {inv.customer_name}
Net: {inv.net_total} AED
VAT: {inv.vat_total}
Gross: {inv.gross_total}
XML_SHA256: {xml_hash}
"""
        return content.encode("utf-8")

    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
    except Exception:
        content = f"""INVOICE {inv.number}
Company: {company.legal_name}
Customer: {inv.customer_name}
Net: {inv.net_total} AED
VAT: {inv.vat_total}
Gross: {inv.gross_total}
XML_SHA256: {xml_hash}
"""
        return content.encode("utf-8")

    buffer = io.BytesIO(); c = canvas.Canvas(buffer, pagesize=A4); width, height = A4
    y = height - 50
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Tax Invoice" if inv.invoice_type==InvoiceType.VAT_TAX_INVOICE else "Commercial Invoice")
    y -= 20; c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Invoice No: {inv.number}    Date: {inv.invoice_date.isoformat()}")
    y -= 15; c.drawString(40, y, f"Supplier: {company.legal_name} | TRN: {company.trn or 'N/A'}")
    y -= 15; c.drawString(40, y, f"Customer: {inv.customer_name}")
    y -= 25
    c.setFont("Helvetica", 7); c.drawString(40, 40, f"XML SHA256: {xml_hash}")
    c.showPage(); c.save(); pdf_bytes = buffer.getvalue()

    try:
        from PyPDF2 import PdfReader, PdfWriter
        reader = PdfReader(io.BytesIO(pdf_bytes)); writer = PdfWriter(); writer.append_pages_from_reader(reader)
        meta = reader.metadata or {}; meta_dict = {**{k:v for k,v in meta.items() if isinstance(v,str)}, "/XML_SHA256": xml_hash}
        writer.add_metadata(meta_dict); outbuf = io.BytesIO(); writer.write(outbuf); return outbuf.getvalue()
    except Exception:
        return pdf_bytes

# --------------------------- AS4 Sender Stub (pluggable) ---------------------------
class PeppolAS4Client:
    """Stub client that simulates sending a UBL/XML doc over AS4.
    Replace with a real library/adapter and SMP/SML discovery.
    """
    def __init__(self, endpoint: str = "https://as4.example/endpoint", cert_path: Optional[str]=None, key_path: Optional[str]=None):
        self.endpoint = endpoint; self.cert_path = cert_path; self.key_path = key_path

    def send_invoice(self, xml_bytes: bytes, doc_id: str, receiver_id: str) -> str:
        return f"as4msg_{uuid4().hex[:12]}"

as4_client = PeppolAS4Client()

# --------------------------- FastAPI app (only when SSL available) ---------------------------
if SSL_AVAILABLE:
    app = FastAPI(
        title="UAE e‑Invoicing API",
        description=(
            "Multi‑tenant e‑invoicing with VAT state machine, XML+PDF artifacts, "
            "company branding, payment policies & intents, and AS4 sending stub."
        ),
        version="0.4.0",
        contact={"name": "Your Team", "email": "support@example.tld"},
    )
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],)

# --------------------------- API Schemas helpers ---------------------------
def is_valid_trn(trn: str) -> bool:
    d = "".join([c for c in trn if c.isdigit()])
    return len(d) == 15

# --------------------------- Routes: Companies & Admin ---------------------------
if SSL_AVAILABLE:
    @app.post("/companies", response_model=CompanyOut, tags=["Companies"], summary="Create company")
    def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
        cid = f"c_{uuid4().hex[:8]}"
        comp = CompanyDB(id=cid, legal_name=payload.legal_name, country=payload.country, status=CompanyStatus.PENDING_REVIEW)
        if payload.trn:
            if not is_valid_trn(payload.trn):
                raise HTTPException(400, "Invalid TRN format: expected 15 digits")
            comp.trn = payload.trn
        if payload.vat_effective_date:
            comp.vat_effective_date = payload.vat_effective_date
        if payload.peppol_endpoint_id:
            comp.peppol_endpoint_id = payload.peppol_endpoint_id
        if comp.trn and comp.vat_effective_date:
            comp.vat_state = VATState.VAT_PENDING
            evaluate_vat_state(db, comp, date.today())
        db.add(comp); db.commit()
        return CompanyOut(id=comp.id, legal_name=comp.legal_name, status=comp.status, vat_state=comp.vat_state,
                          trn=comp.trn, vat_effective_date=comp.vat_effective_date, branding_profile_id=comp.branding_profile_id)

    @app.post("/admin/companies/approve/{company_id}", response_model=CompanyOut, tags=["Admin"], summary="Approve company")
    def approve_company(company_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
        if user.role != Role.SUPER_ADMIN:
            raise HTTPException(403, "Forbidden")
        comp = db.get(CompanyDB, company_id)
        if not comp:
            raise HTTPException(404, "Company not found")
        comp.status = CompanyStatus.ACTIVE; db.commit()
        return CompanyOut(id=comp.id, legal_name=comp.legal_name, status=comp.status, vat_state=comp.vat_state,
                          trn=comp.trn, vat_effective_date=comp.vat_effective_date, branding_profile_id=comp.branding_profile_id)

# --------------------------- Branding ---------------------------
if SSL_AVAILABLE:
    @app.post("/companies/{company_id}/branding/logo", response_model=UploadLogoOut, tags=["Branding"], summary="Upload company logo (PNG/SVG)")
    async def upload_logo(company_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
        comp = db.get(CompanyDB, company_id)
        if not comp:
            raise HTTPException(404, "Company not found")
        if file.content_type not in {"image/png","image/svg+xml"}:
            raise HTTPException(400, "Only PNG or SVG allowed")
        data = await file.read()
        if len(data) > 1_000_000:
            raise HTTPException(400, "Logo too large (max 1MB)")
        asset_id = f"a_{uuid4().hex[:8]}"; sha = sha256_bytes(data)
        ext = ".png" if file.content_type=="image/png" else ".svg"; path = os.path.join(ARTIFACT_ROOT, f"{asset_id}{ext}")
        with open(path, "wb") as f: f.write(data)
        asset = AssetDB(id=asset_id, company_id=company_id, mime=file.content_type, uri=path, created_at=datetime.utcnow(), sha256=sha)
        db.add(asset)
        comp = db.get(CompanyDB, company_id)
        if not comp.branding_profile_id:
            bpid = f"bp_{uuid4().hex[:6]}"; bp = BrandingProfileDB(id=bpid, company_id=company_id, logo_asset_id=asset_id)
            db.add(bp); comp.branding_profile_id = bpid
        else:
            bp = db.get(BrandingProfileDB, comp.branding_profile_id); bp.logo_asset_id = asset_id
        db.commit()
        return UploadLogoOut(asset_id=asset_id, logo_url=path)

# --------------------------- Payment Policies & POS ---------------------------
if SSL_AVAILABLE:
    @app.put("/companies/{company_id}/payment-policy", response_model=PaymentPolicyOut, tags=["Payments"], summary="Set company payment policy")
    def set_payment_policy(company_id: str, payload: PaymentPolicyIn, db: Session = Depends(get_db)):
        existing = db.query(PaymentPolicyDB).filter_by(company_id=company_id).first()
        if not existing:
            pp = PaymentPolicyDB(id=f"pp_{uuid4().hex[:8]}", company_id=company_id, **payload.dict())
            db.add(pp); db.commit(); return PaymentPolicyOut(id=pp.id, **payload.dict())
        for k,v in payload.dict().items(): setattr(existing, k, v)
        db.commit(); return PaymentPolicyOut(id=existing.id, **payload.dict())

    @app.post("/companies/{company_id}/pos-devices", response_model=POSDeviceOut, tags=["Payments"], summary="Register a POS device")
    def add_pos_device(company_id: str, payload: POSDeviceIn, db: Session = Depends(get_db)):
        pos = POSDeviceDB(id=f"pos_{uuid4().hex[:8]}", company_id=company_id, active=True, **payload.dict())
        db.add(pos); db.commit(); return POSDeviceOut(id=pos.id, active=pos.active, **payload.dict())

# --------------------------- Events → Auto Invoice ---------------------------
if SSL_AVAILABLE:
    @app.post("/events", response_model=BillingEventDB, tags=["Invoicing"], summary="Ingest billable event; auto‑generate invoice")
    def ingest_event(ev: CreateEventIn, BackgroundTasks=BackgroundTasks, db: Session = Depends(get_db)):
        be = BillingEventDB(id=f"e_{uuid4().hex[:8]}", **ev.dict())
        db.add(be); db.commit()
        add_turnover(db, ev.company_id, ev.quantity*ev.unit_price, ev.occurred_at)
        def _bg(task_id: str):
            generate_invoice_from_event(task_id)
        _bg(be.id)
        return be

_counter = {}

def next_number(db: Session, company_id: str) -> str:
    n = _counter.get(company_id, 0) + 1; _counter[company_id] = n
    return f"{date.today().strftime('%Y%m')}-{n:05d}"


def generate_invoice_from_event(event_id: str):
    db = SessionLocal()
    try:
        be: BillingEventDB = db.get(BillingEventDB, event_id)
        comp: CompanyDB = db.get(CompanyDB, be.company_id)
        comp = evaluate_vat_state(db, comp, date.today())
        brand = db.get(BrandingProfileDB, comp.branding_profile_id) if comp.branding_profile_id else None

        invoice_date = be.occurred_at.date()
        invoice_type = InvoiceType.COMMERCIAL
        vat_rate = 0.0
        if comp.vat_state == VATState.VAT_ACTIVE and comp.vat_effective_date and invoice_date >= comp.vat_effective_date:
            invoice_type = InvoiceType.VAT_TAX_INVOICE; vat_rate = AED_VAT_STANDARD

        lines = [InvoiceLine(description=be.description, quantity=be.quantity, unit_price=be.unit_price, vat_rate=vat_rate)]
        net_total = round(sum(l.quantity*l.unit_price for l in lines), 2)
        vat_total = round(sum(l.quantity*l.unit_price*l.vat_rate for l in lines), 2)
        gross_total = round(net_total + vat_total, 2)

        inv = InvoiceDB(
            id=f"inv_{uuid4().hex[:8]}", company_id=be.company_id, customer_name=be.customer_name, invoice_date=invoice_date,
            invoice_type=invoice_type, number=next_number(db, be.company_id), currency="AED", net_total=net_total,
            vat_total=vat_total, gross_total=gross_total, xml_path="", pdf_path="",
        )
        db.add(inv); db.commit()

        inv_out = InvoiceOut(id=inv.id, number=inv.number, invoice_type=inv.invoice_type, customer_name=inv.customer_name,
                             invoice_date=inv.invoice_date, net_total=inv.net_total, vat_total=inv.vat_total,
                             gross_total=inv.gross_total, xml_path="", pdf_path="")

        xml_bytes = build_invoice_xml(inv_out, lines, comp); xml_hash = sha256_bytes(xml_bytes)
        pdf_bytes = build_invoice_pdf(inv_out, lines, comp, brand, xml_hash)
        xml_path = os.path.join(ARTIFACT_ROOT, f"{inv.id}.xml"); pdf_path = os.path.join(ARTIFACT_ROOT, f"{inv.id}.pdf")
        with open(xml_path, "wb") as f: f.write(xml_bytes)
        with open(pdf_path, "wb") as f: f.write(pdf_bytes)
        inv.xml_path = xml_path; inv.pdf_path = pdf_path; db.commit()

        # Enforce Schematron (UAE + global)
        run_schematron_validations_enforced(xml_bytes, inv.id)
    finally:
        db.close()

# --------------------------- Retrieval ---------------------------
if SSL_AVAILABLE:
    @app.get("/companies/{company_id}/invoices", response_model=List[InvoiceOut], tags=["Invoicing"], summary="List invoices for a company")
    def list_invoices(company_id: str, db: Session = Depends(get_db)):
        rows = db.query(InvoiceDB).filter_by(company_id=company_id).all()
        return [InvoiceOut(id=r.id, number=r.number, invoice_type=r.invoice_type, customer_name=r.customer_name, invoice_date=r.invoice_date,
                           net_total=r.net_total, vat_total=r.vat_total, gross_total=r.gross_total, xml_path=r.xml_path, pdf_path=r.pdf_path) for r in rows]

    @app.get("/invoices/{invoice_id}/pdf", tags=["Invoicing"], summary="Download invoice PDF")
    def get_pdf(invoice_id: str, db: Session = Depends(get_db)):
        inv = db.get(InvoiceDB, invoice_id)
        if not inv: raise HTTPException(404, "Not found")
        return FileResponse(inv.pdf_path, media_type="application/pdf", filename=os.path.basename(inv.pdf_path))

    @app.get("/invoices/{invoice_id}/xml", tags=["Invoicing"], summary="Download invoice XML (UBL/PINT‑AE stub)")
    def get_xml(invoice_id: str, db: Session = Depends(get_db)):
        inv = db.get(InvoiceDB, invoice_id)
        if not inv: raise HTTPException(404, "Not found")
        return FileResponse(inv.xml_path, media_type="application/xml", filename=os.path.basename(inv.xml_path))

# --------------------------- Payments: intents & capture ---------------------------
if SSL_AVAILABLE:
    @app.post("/invoices/{invoice_id}/payment-intents", response_model=PaymentIntentOut, tags=["Payments"], summary="Create payment intent")
    def create_payment_intent(invoice_id: str, payload: PaymentIntentIn, db: Session = Depends(get_db)):
        inv = db.get(InvoiceDB, invoice_id)
        if not inv:
            raise HTTPException(404, "Invoice not found")
        intent_id = f"pi_{uuid4().hex[:8]}"
        intent = PaymentIntentDB(id=intent_id, invoice_id=invoice_id, amount=payload.amount, currency=payload.currency,
                                 method_kind=payload.method_kind, status=PaymentStatus.REQUIRES_PAYMENT,
                                 payment_metadata=(payload.metadata.dict() if payload.metadata else None))
        db.add(intent); db.commit()
        return PaymentIntentOut(id=intent.id, amount=intent.amount, currency=intent.currency, method_kind=intent.method_kind,
                                status=intent.status, metadata=payload.metadata)

    @app.post("/payment-intents/{intent_id}/capture", response_model=PaymentOut, tags=["Payments"], summary="Capture payment intent")
    def capture_payment(intent_id: str, payload: CapturePaymentIn, db: Session = Depends(get_db)):
        intent = db.get(PaymentIntentDB, intent_id)
        if not intent:
            raise HTTPException(404, "Payment intent not found")
        intent.status = PaymentStatus.CAPTURED
        p = PaymentDB(id=f"pay_{uuid4().hex[:8]}", intent_id=intent.id, captured_at=datetime.utcnow(), amount=intent.amount,
                      currency=intent.currency, method_kind=intent.method_kind, provider_ref=(payload.provider_ref or None))
        db.add(p); db.commit()
        return PaymentOut(id=p.id, captured_at=p.captured_at, amount=p.amount, currency=p.currency, method_kind=p.method_kind, provider_ref=p.provider_ref)

# --------------------------- Main (optional) ---------------------------
if __name__ == "__main__" and SSL_AVAILABLE:
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

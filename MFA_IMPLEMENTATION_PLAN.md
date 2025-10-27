# 🔐 Multifactor Authentication (MFA) Implementation Plan
**Date:** October 27, 2025  
**Legal Requirement:** Article 9.1 - Ministerial Decision No. 64/2025  
**Priority:** 🔴 **CRITICAL** (Mandatory for UAE FTA Compliance)

---

## 📜 **LEGAL REQUIREMENT**

**Article 9, Clause 1:**
> "Multifactor authentication mechanisms to secure user access is maintained."

**Current Status:** ❌ **Non-Compliant** (Email + password only)  
**Required Status:** ✅ **Compliant** (MFA mandatory for admin users)

---

## 🎯 **IMPLEMENTATION GOALS**

1. ✅ Add TOTP-based 2FA (Google Authenticator, Authy compatible)
2. ✅ Add SMS OTP option (via Twilio)
3. ✅ Enforce MFA for admin/finance users
4. ✅ Make MFA optional for regular users
5. ✅ Backup codes for account recovery
6. ✅ QR code generation for easy setup
7. ✅ MFA status tracking in database

---

## 🏗️ **ARCHITECTURE OVERVIEW**

### **Authentication Flow (Current):**
```
User → Email/Password → JWT Token → Access Granted
```

### **Authentication Flow (With MFA):**
```
User → Email/Password → MFA Challenge → TOTP/SMS Code → JWT Token → Access Granted
```

### **MFA Enrollment Flow:**
```
User → Settings → Enable MFA → Choose Method (TOTP/SMS) → 
  TOTP: Scan QR Code → Enter Code → Verify → Save Secret → Generate Backup Codes
  SMS: Enter Phone → Send Code → Verify → Save Phone → Generate Backup Codes
```

---

## 🗄️ **DATABASE SCHEMA CHANGES**

### **New Fields in `users` Table:**
```typescript
// MFA Configuration
mfa_enabled: boolean("mfa_enabled").default(false)
mfa_method: varchar("mfa_method", { length: 20 }) // 'totp', 'sms', null
mfa_secret: varchar("mfa_secret", { length: 255 }) // Base32 encoded TOTP secret
mfa_phone: varchar("mfa_phone", { length: 20 }) // E.164 format: +971501234567
mfa_backup_codes: text("mfa_backup_codes") // JSON array of hashed backup codes
mfa_enrolled_at: timestamp("mfa_enrolled_at")
mfa_last_verified_at: timestamp("mfa_last_verified_at")
```

### **New Table: `mfa_verification_attempts`**
```typescript
{
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id),
  method: varchar("method", { length: 20 }), // 'totp', 'sms', 'backup'
  success: boolean("success"),
  ip_address: varchar("ip_address", { length: 45 }),
  user_agent: text("user_agent"),
  created_at: timestamp("created_at").defaultNow()
}
```

**Purpose:** Track MFA verification attempts for security monitoring and rate limiting

---

## 🔧 **BACKEND IMPLEMENTATION**

### **Required Python Packages:**
```bash
pyotp==2.9.0          # TOTP generation and verification
qrcode==7.4.2         # QR code generation for TOTP
pillow==10.1.0        # Image processing for QR codes
twilio==8.11.0        # SMS delivery (Twilio API)
```

### **New Utility Module: `utils/mfa_utils.py`**

```python
import pyotp
import qrcode
from io import BytesIO
import base64
import secrets
import hashlib
from twilio.rest import Client
from typing import List, Optional

class MFAManager:
    """Manages MFA enrollment, verification, and backup codes"""
    
    @staticmethod
    def generate_totp_secret() -> str:
        """Generate a new TOTP secret (Base32 encoded)"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_qr_code(secret: str, user_email: str, issuer: str = "InvoLinks") -> str:
        """Generate QR code for TOTP setup (returns base64 encoded PNG)"""
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=user_email, issuer_name=issuer)
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return base64.b64encode(buffer.getvalue()).decode()
    
    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        """Verify TOTP code"""
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)  # Allow 30s window
    
    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        """Generate backup codes (8 digits each)"""
        return [f"{secrets.randbelow(100000000):08d}" for _ in range(count)]
    
    @staticmethod
    def hash_backup_code(code: str) -> str:
        """Hash backup code for storage"""
        return hashlib.sha256(code.encode()).hexdigest()
    
    @staticmethod
    def verify_backup_code(code: str, hashed_codes: List[str]) -> bool:
        """Verify backup code against stored hashes"""
        code_hash = MFAManager.hash_backup_code(code)
        return code_hash in hashed_codes
    
    @staticmethod
    def send_sms_code(phone: str, code: str) -> bool:
        """Send SMS verification code via Twilio"""
        try:
            client = Client(
                os.getenv("TWILIO_ACCOUNT_SID"),
                os.getenv("TWILIO_AUTH_TOKEN")
            )
            message = client.messages.create(
                body=f"Your InvoLinks verification code is: {code}",
                from_=os.getenv("TWILIO_PHONE_NUMBER"),
                to=phone
            )
            return message.sid is not None
        except Exception as e:
            logger.error(f"SMS send failed: {e}")
            return False
```

---

## 🔌 **REST API ENDPOINTS**

### **1. Enroll MFA (TOTP)**
```
POST /auth/mfa/enroll/totp
Authorization: Bearer {token}

Response:
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBOR...",
  "backup_codes": ["12345678", "87654321", ...]
}
```

### **2. Verify MFA Enrollment**
```
POST /auth/mfa/enroll/verify
Authorization: Bearer {token}
Body: {
  "method": "totp",
  "code": "123456"
}

Response: { "success": true, "message": "MFA enabled" }
```

### **3. Enroll MFA (SMS)**
```
POST /auth/mfa/enroll/sms
Authorization: Bearer {token}
Body: {
  "phone": "+971501234567"
}

Response: { "message": "Verification code sent to +971501234567" }
```

### **4. Login (Step 1: Password)**
```
POST /auth/login
Body: {
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response (if MFA enabled):
{
  "mfa_required": true,
  "mfa_method": "totp",
  "temp_token": "eyJhbGciOiJIUzI1NiIs..."  // Short-lived token
}

Response (if MFA not enabled):
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {...}
}
```

### **5. Login (Step 2: MFA Verification)**
```
POST /auth/mfa/verify
Body: {
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "code": "123456",
  "method": "totp"  // or "sms" or "backup"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {...}
}
```

### **6. Disable MFA**
```
POST /auth/mfa/disable
Authorization: Bearer {token}
Body: {
  "password": "SecurePass123",
  "code": "123456"  // Current MFA code
}

Response: { "success": true, "message": "MFA disabled" }
```

### **7. Regenerate Backup Codes**
```
POST /auth/mfa/backup-codes/regenerate
Authorization: Bearer {token}
Body: {
  "code": "123456"  // Current MFA code
}

Response: {
  "backup_codes": ["12345678", "87654321", ...]
}
```

### **8. Get MFA Status**
```
GET /auth/mfa/status
Authorization: Bearer {token}

Response:
{
  "enabled": true,
  "method": "totp",
  "enrolled_at": "2025-10-27T10:00:00Z",
  "last_verified_at": "2025-10-27T15:30:00Z"
}
```

---

## 🎨 **FRONTEND IMPLEMENTATION**

### **New Pages/Components:**

1. **MFA Settings Page** (`src/pages/MFASettings.jsx`)
   - Enable/Disable MFA toggle
   - Choose method (TOTP/SMS)
   - QR code display for TOTP
   - Phone number input for SMS
   - Backup codes display (one-time)
   - Regenerate backup codes button

2. **MFA Verification Modal** (`src/components/MFAVerificationModal.jsx`)
   - Shows during login if MFA enabled
   - Code input (6 digits)
   - "Use backup code" option
   - "Remember this device" checkbox (optional)
   - Resend SMS button (for SMS method)

3. **MFA Setup Wizard** (`src/components/MFASetupWizard.jsx`)
   - Step 1: Choose method
   - Step 2: Setup (QR code or phone verification)
   - Step 3: Verify code
   - Step 4: Save backup codes

### **User Flow:**

#### **Enrollment Flow:**
```
Settings → Security → Enable MFA → 
  Choose TOTP → Display QR Code → Scan with App → 
  Enter Verification Code → Success → Display Backup Codes → Done
```

#### **Login Flow (with MFA):**
```
Login Page → Enter Email/Password → Submit → 
  MFA Modal Appears → Enter 6-digit Code → Verify → 
  Success → Dashboard
```

---

## 🔒 **SECURITY CONSIDERATIONS**

### **Rate Limiting:**
- Limit MFA verification attempts to 5 per 15 minutes per user
- Block account after 10 failed attempts (require password reset)
- Log all verification attempts to `mfa_verification_attempts` table

### **Backup Codes:**
- Generate 10 backup codes per user
- Store as SHA-256 hashes (never plaintext)
- Each code can be used only once
- Show codes only once during enrollment
- Allow regeneration with current MFA code

### **TOTP Secret Storage:**
- Encrypt TOTP secrets at rest (optional enhancement)
- Never log or expose secrets in API responses
- Rotate secrets on suspicious activity

### **SMS Security:**
- Rate limit SMS sends to prevent abuse (max 3 per hour)
- Use E.164 phone format validation
- Support international numbers (+971, +1, etc.)
- Log SMS delivery status

### **Temporary Token:**
- Short-lived (5 minutes expiry)
- Single-use only (invalidate after MFA verification)
- Contains user_id and mfa_challenge flag
- Cannot access protected resources

---

## 🎯 **ENFORCEMENT POLICY**

### **Mandatory MFA (Admin Users):**
- All users with role = "OWNER" or "ADMIN" must enable MFA
- Block access to protected resources until MFA enrolled
- Grace period: 7 days after account creation

### **Optional MFA (Regular Users):**
- Finance users: Strongly encouraged (banner reminder)
- Regular users: Optional (promote in settings)

### **SuperAdmin:**
- Mandatory MFA for all SuperAdmin accounts
- No grace period

---

## 📊 **DATABASE MIGRATION**

### **Step 1: Add Columns to `users` Table**
```sql
ALTER TABLE users 
  ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN mfa_method VARCHAR(20),
  ADD COLUMN mfa_secret VARCHAR(255),
  ADD COLUMN mfa_phone VARCHAR(20),
  ADD COLUMN mfa_backup_codes TEXT,
  ADD COLUMN mfa_enrolled_at TIMESTAMP,
  ADD COLUMN mfa_last_verified_at TIMESTAMP;
```

### **Step 2: Create `mfa_verification_attempts` Table**
```sql
CREATE TABLE mfa_verification_attempts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mfa_attempts_user_id ON mfa_verification_attempts(user_id);
CREATE INDEX idx_mfa_attempts_created_at ON mfa_verification_attempts(created_at);
```

---

## ✅ **TESTING PLAN**

### **Unit Tests:**
1. ✅ TOTP secret generation
2. ✅ TOTP verification (valid code)
3. ✅ TOTP verification (invalid code)
4. ✅ TOTP verification (expired code)
5. ✅ Backup code generation
6. ✅ Backup code verification
7. ✅ Backup code single-use enforcement
8. ✅ QR code generation

### **Integration Tests:**
1. ✅ Enroll TOTP flow
2. ✅ Enroll SMS flow
3. ✅ Login with MFA (TOTP)
4. ✅ Login with MFA (SMS)
5. ✅ Login with backup code
6. ✅ Disable MFA
7. ✅ Rate limiting (5 attempts)
8. ✅ Account lockout (10 attempts)

### **Manual Tests:**
1. ✅ Google Authenticator compatibility
2. ✅ Authy compatibility
3. ✅ SMS delivery (UAE +971 numbers)
4. ✅ Backup code usage
5. ✅ Admin enforcement (cannot access without MFA)
6. ✅ Grace period (7 days for new admins)

---

## 📈 **ROLLOUT PLAN**

### **Phase 1: Development (1 week)**
- Day 1-2: Backend (database, utils, APIs)
- Day 3-4: Frontend (MFA settings, verification modal)
- Day 5: Testing (unit + integration)
- Day 6-7: Manual testing, bug fixes

### **Phase 2: Pilot (1 week)**
- Enable for internal team members only
- Collect feedback
- Fix issues

### **Phase 3: Gradual Rollout (2 weeks)**
- Week 1: Enable for all admin users (mandatory)
- Week 2: Promote to regular users (optional)

### **Phase 4: Full Enforcement (Ongoing)**
- Monitor adoption rates
- Send reminders to non-MFA users
- Require MFA for sensitive operations (payment approval, etc.)

---

## 💰 **COST ESTIMATE**

### **Twilio SMS Costs:**
- SMS to UAE: ~$0.05 per message
- Estimated usage: 100 verifications/day = $5/day = $150/month
- Annual: ~$1,800

### **Development Time:**
- Backend: 2 days
- Frontend: 2 days
- Testing: 1 day
- Total: 5 days (~$2,000 at $400/day)

### **Total First Year Cost:** ~$3,800

---

## 🎯 **SUCCESS METRICS**

1. ✅ 100% of admin users enrolled in MFA within 30 days
2. ✅ 50%+ of regular users enrolled in MFA within 90 days
3. ✅ Zero successful account takeovers
4. ✅ < 1% support tickets related to MFA issues
5. ✅ Pass security audit for Article 9.1 compliance

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Backend:**
- [ ] Install pyotp, qrcode, pillow, twilio packages
- [ ] Create `utils/mfa_utils.py` module
- [ ] Add MFA columns to `users` table schema
- [ ] Create `mfa_verification_attempts` table
- [ ] Run database migration
- [ ] Implement 8 MFA endpoints
- [ ] Add rate limiting middleware
- [ ] Update login endpoint for MFA flow
- [ ] Write unit tests
- [ ] Write integration tests

### **Frontend:**
- [ ] Create MFA Settings page
- [ ] Create MFA Verification modal
- [ ] Create MFA Setup wizard
- [ ] Add QR code display component
- [ ] Add phone input component
- [ ] Add backup codes display
- [ ] Update login flow for MFA
- [ ] Add "Enable MFA" banner for admins
- [ ] Test with Google Authenticator
- [ ] Test with Authy

### **Deployment:**
- [ ] Add Twilio environment variables (ask_secrets)
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test in production
- [ ] Monitor logs for errors

### **Documentation:**
- [ ] User guide: "How to enable MFA"
- [ ] Admin guide: "MFA enforcement policy"
- [ ] Developer docs: "MFA API reference"
- [ ] Security docs: "MFA security considerations"

---

## 🚀 **NEXT STEPS**

1. ✅ Get Twilio API credentials (via ask_secrets tool)
2. ✅ Install required Python packages
3. ✅ Implement `utils/mfa_utils.py`
4. ✅ Add database schema changes
5. ✅ Implement 8 MFA REST endpoints
6. ✅ Test backend with Postman
7. ✅ Build frontend components
8. ✅ End-to-end testing
9. ✅ Deploy to production

---

**Estimated Completion:** 5-7 days  
**Priority:** 🔴 **CRITICAL** (Legal requirement)  
**Compliance Impact:** Required for Article 9.1 - UAE FTA Compliance

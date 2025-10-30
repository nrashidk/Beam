# Production Signing Keys Setup Guide
**InvoLinks UAE FTA E-Invoicing Compliance**  
**Date:** October 30, 2025

---

## Overview

This guide explains how to generate and deploy production-grade RSA-2048 signing keys and X.509 certificates for InvoLinks digital signature functionality, as required by UAE Federal Tax Authority (FTA) e-invoicing regulations.

---

## Why Production Keys Are Required

**Current Status:**
```
⚠️ SIGNING_PRIVATE_KEY_PEM not set - using mock signing
⚠️ SIGNING_CERTIFICATE_PEM not set - using mock certificate
```

**FTA Requirements:**
- ✅ RSA-2048 minimum key size
- ✅ SHA-256 hashing algorithm
- ✅ X.509 certificate for signature validation
- ✅ Non-repudiation (invoices legally binding)
- ✅ Tamper-proof digital signatures

**Mock keys are suitable for:**
- ✅ Development and testing
- ✅ Demo environments
- ✅ Internal validation

**Production keys are required for:**
- ❌ Live customer invoices
- ❌ FTA audit compliance
- ❌ Legal enforceability
- ❌ PEPPOL transmission

---

## Step 1: Generate Signing Keys

### Option A: Interactive Generation (Recommended)

```bash
# Run the key generator script
python utils/generate_signing_keys.py
```

**Follow the prompts to customize certificate details:**
- Country Code: AE (United Arab Emirates)
- State/Emirate: Dubai (or your emirate)
- City: Dubai (or your city)
- Organization: Your company legal name
- Organizational Unit: E-Invoicing Platform / IT Department
- Common Name: involinks.ae (your domain)
- Email: security@involinks.ae (your security contact)
- Validity Period: 1825 days (5 years) - default

**Generated Files:**
```
📁 Current Directory
├─ private_key.pem        ← RSA-2048 private key (KEEP SECRET!)
├─ certificate.pem        ← X.509 self-signed certificate
├─ certificate.csr        ← Certificate Signing Request (for CA)
└─ certificate_info.txt   ← Deployment instructions
```

### Option B: Command-Line Generation (Non-Interactive)

```bash
# Using OpenSSL (if available)
openssl genrsa -out private_key.pem 2048
openssl req -new -x509 -key private_key.pem -out certificate.pem -days 1825 \
  -subj "/C=AE/ST=Dubai/L=Dubai/O=InvoLinks/OU=E-Invoicing/CN=involinks.ae/emailAddress=security@involinks.ae"
```

---

## Step 2: Secure Private Key

**⚠️ CRITICAL SECURITY STEPS:**

### 1. Add to .gitignore
```bash
# Verify private key is NOT in version control
cat .gitignore | grep private_key.pem

# If missing, add it:
echo "private_key.pem" >> .gitignore
echo "certificate.pem" >> .gitignore
echo "certificate.csr" >> .gitignore
echo "certificate_info.txt" >> .gitignore
```

### 2. Verify Not Committed
```bash
# Check git status - these files should NOT appear
git status

# If accidentally staged, remove from staging:
git reset HEAD private_key.pem
```

### 3. Backup Securely
- ✅ Store in password manager (1Password, LastPass, Bitwarden)
- ✅ Encrypted USB drive in secure location
- ✅ Cloud storage with encryption (encrypted zip file)
- ❌ NEVER email unencrypted
- ❌ NEVER commit to git
- ❌ NEVER share via messaging apps

---

## Step 3: Deploy to Replit

### Add Keys to Replit Secrets

1. **Open Replit Secrets Panel:**
   - Click "Tools" in left sidebar
   - Click "Secrets"
   - Click "Add new secret"

2. **Add Private Key:**
   ```
   Secret Name:  SIGNING_PRIVATE_KEY_PEM
   Secret Value: <paste entire contents of private_key.pem>
   ```
   
   **To copy file contents:**
   ```bash
   # Linux/Mac:
   cat private_key.pem | pbcopy    # macOS
   cat private_key.pem | xclip     # Linux
   
   # Or open in text editor and copy manually
   code private_key.pem
   ```

3. **Add Certificate:**
   ```
   Secret Name:  SIGNING_CERTIFICATE_PEM
   Secret Value: <paste entire contents of certificate.pem>
   ```

4. **Verify Secrets Added:**
   - You should see both secrets in the Secrets panel:
     - ✅ SIGNING_PRIVATE_KEY_PEM (masked)
     - ✅ SIGNING_CERTIFICATE_PEM (masked)

---

## Step 4: Restart Backend API

### Restart Workflow

```bash
# Via Replit UI:
# 1. Go to "Tools" → "Workflows"
# 2. Find "Backend API"
# 3. Click "Restart"

# Or click the restart button in this conversation
```

### Verify Startup Logs

**Look for these messages in Backend API logs:**

✅ **Success:**
```
✅ Crypto: Certificate loaded - CN=involinks.ae, expires 2029-10-30
✅ InvoLinks API started (🔧 DEVELOPMENT) - Plans seeded
```

❌ **Still Using Mock Keys:**
```
⚠️ Environment: SIGNING_PRIVATE_KEY_PEM not set - using mock signing
⚠️ Environment: SIGNING_CERTIFICATE_PEM not set - using mock certificate
```

**If mock keys warning appears:**
- Check secret names match exactly (case-sensitive)
- Verify secrets have values (not empty)
- Restart workflow again
- Check for syntax errors in PEM format

---

## Step 5: Test Invoice Signing

### Create Test Invoice

```bash
# Via InvoLinks UI:
# 1. Login as business admin
# 2. Go to Invoices → Create New Invoice
# 3. Fill in invoice details
# 4. Click "Issue Invoice"

# Via API:
curl -X POST https://your-replit-url.repl.co/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "customer_trn": "123456789012345",
    "invoice_type": "380",
    "line_items": [
      {
        "item_name": "Test Product",
        "quantity": 1,
        "unit_price": 100.00,
        "tax_category": "S"
      }
    ]
  }'
```

### Verify Signature

**Check Invoice Response:**
```json
{
  "id": "inv_12345678",
  "invoice_number": "INV-2024-001",
  "signature_b64": "BASE64_ENCODED_SIGNATURE_HERE",  // ← Should be present
  "xml_hash": "a1b2c3d4...",                           // ← Should be present
  "signing_cert_serial": "123456789",                  // ← Should match certificate
  "signing_timestamp": "2024-10-30T12:00:00Z"          // ← Should be recent
}
```

**Signature Validation:**
```python
# Run validation script:
python utils/test_invoice_signature.py inv_12345678
```

---

## Step 6: Certificate Authority (CA) Signing (Optional - Production Recommended)

### Why Use CA-Signed Certificate?

**Self-Signed Certificate:**
- ✅ Free
- ✅ Suitable for internal use
- ✅ Works for FTA validation
- ⚠️ Not trusted by external parties
- ⚠️ Browser warnings

**CA-Signed Certificate:**
- ✅ Trusted by all parties
- ✅ No browser warnings
- ✅ Professional appearance
- ✅ Better for customer confidence
- ❌ Costs money ($50-$500/year)

### Get CA-Signed Certificate

1. **Use the generated CSR:**
   ```bash
   # File created by generator script
   cat certificate.csr
   ```

2. **Choose Certificate Authority:**
   - **DigiCert** (Premium, $200-$500/year)
   - **GlobalSign** (Enterprise, $150-$400/year)
   - **Sectigo** (Affordable, $50-$150/year)
   - **Let's Encrypt** (FREE, auto-renewal required)

3. **Submit CSR to CA:**
   - Go to CA website
   - Select "Code Signing Certificate" or "Document Signing Certificate"
   - Paste contents of `certificate.csr`
   - Complete identity verification

4. **Receive Signed Certificate:**
   - Download certificate file (usually `.crt` or `.pem`)
   - Update Replit Secret: `SIGNING_CERTIFICATE_PEM`
   - Restart Backend API workflow

---

## Troubleshooting

### Problem: Mock Keys Warning Still Appears

**Solution:**
```bash
# 1. Check secret names (case-sensitive)
SIGNING_PRIVATE_KEY_PEM  # ✅ Correct
signing_private_key_pem  # ❌ Wrong (lowercase)

# 2. Verify secret has value (click eye icon in Secrets panel)

# 3. Check PEM format
# Private key should start with:
-----BEGIN PRIVATE KEY-----
# Certificate should start with:
-----BEGIN CERTIFICATE-----

# 4. Restart workflow AFTER adding secrets
```

### Problem: "Failed to load certificate" Error

**Solution:**
```python
# Check certificate validity
from cryptography import x509
from cryptography.hazmat.backends import default_backend

with open("certificate.pem", "rb") as f:
    cert = x509.load_pem_x509_certificate(f.read(), default_backend())
    print(f"Valid until: {cert.not_valid_after}")
```

### Problem: Signature Verification Fails

**Solution:**
```bash
# Ensure private key matches certificate
openssl x509 -noout -modulus -in certificate.pem | openssl md5
openssl rsa -noout -modulus -in private_key.pem | openssl md5
# Both hashes should match
```

### Problem: Certificate Expired

**Solution:**
```bash
# Generate new keys with longer validity
python utils/generate_signing_keys.py
# When prompted, enter: 3650 (10 years)

# Or extend existing certificate (requires CA re-signing)
```

---

## Security Best Practices

### ✅ DO:
- Store private key in Replit Secrets only
- Backup private key in encrypted format
- Use strong passwords for key backups
- Rotate keys every 2-5 years
- Monitor certificate expiration
- Test signatures regularly
- Use CA-signed certificates for production

### ❌ DON'T:
- Commit private key to version control
- Email private key unencrypted
- Share private key via messaging apps
- Use same keys for multiple environments
- Ignore certificate expiration warnings
- Store keys in public cloud storage (unless encrypted)

---

## Key Rotation Schedule

**Recommended Rotation:**
- **Development:** Every 1-2 years
- **Production:** Every 2-5 years (or when compromised)
- **CA-Signed Certs:** Before expiration (typically 1-3 years)

**Rotation Process:**
1. Generate new keys (keep old keys active)
2. Add new keys to Replit Secrets (e.g., `SIGNING_PRIVATE_KEY_PEM_NEW`)
3. Test new keys in staging environment
4. Update production secrets
5. Restart Backend API
6. Verify all new invoices use new signature
7. Archive old keys for historical invoice verification

---

## Certificate Information

**View Certificate Details:**
```bash
# Read certificate info
cat certificate_info.txt

# View certificate with OpenSSL
openssl x509 -in certificate.pem -text -noout

# Check expiration date
openssl x509 -in certificate.pem -noout -enddate
```

**Certificate Serial Number:**
- Used to identify which key signed an invoice
- Stored in `invoices.signing_cert_serial` column
- Critical for audit trail and verification

---

## Compliance Checklist

Before going live, verify:

- [ ] Production RSA-2048 keys generated
- [ ] Keys added to Replit Secrets
- [ ] Mock key warnings removed from startup logs
- [ ] Test invoice signed successfully
- [ ] Signature verification passes
- [ ] Certificate serial number recorded
- [ ] Private key backed up securely
- [ ] Certificate expiration monitored
- [ ] .gitignore updated
- [ ] CA-signed certificate obtained (optional but recommended)

---

## Support & Resources

**InvoLinks Documentation:**
- `UAE_TAX_COMPLIANCE_REPORT.md` - Full compliance analysis
- `utils/crypto_utils.py` - Signing implementation
- `utils/generate_signing_keys.py` - Key generator script

**External Resources:**
- UAE FTA E-Invoicing Portal: https://mof.gov.ae/einvoicing/
- OpenSSL Documentation: https://www.openssl.org/docs/
- Cryptography Library: https://cryptography.io/

**Certificate Authorities:**
- DigiCert: https://www.digicert.com/
- GlobalSign: https://www.globalsign.com/
- Sectigo: https://www.sectigo.com/
- Let's Encrypt: https://letsencrypt.org/

---

## FAQs

**Q: Can I use the same keys for development and production?**  
A: No, use separate keys for each environment. Production keys should be guarded more strictly.

**Q: What happens if private key is compromised?**  
A: Immediately revoke certificate, generate new keys, re-sign all active invoices, notify affected customers.

**Q: How long should I keep old signing keys?**  
A: Keep for 5+ years for historical invoice verification and FTA audits.

**Q: Can I change certificate details later?**  
A: Yes, generate new certificate. Old invoices remain valid with old certificate.

**Q: Is self-signed certificate FTA compliant?**  
A: Yes for internal validation. CA-signed is recommended for customer confidence.

**Q: How do I verify a signature without the platform?**  
A: Use OpenSSL or cryptography libraries with the public certificate.

---

**Last Updated:** October 30, 2025  
**Status:** Production Ready  
**Next Review:** Before Public Launch

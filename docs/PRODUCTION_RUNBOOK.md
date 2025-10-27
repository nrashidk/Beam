# InvoLinks Production Runbook
## Certificate and Cryptographic Key Management

This runbook provides step-by-step instructions for managing cryptographic certificates and keys in production environments.

---

## Table of Contents
1. [Overview](#overview)
2. [Environment Modes](#environment-modes)
3. [Obtaining Production Certificates](#obtaining-production-certificates)
4. [Certificate Installation](#certificate-installation)
5. [Certificate Rotation](#certificate-rotation)
6. [Monitoring and Alerts](#monitoring-and-alerts)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

---

## Overview

InvoLinks requires valid cryptographic certificates and private keys to:
- Sign UAE e-invoices for FTA compliance
- Generate tamper-proof hash chains
- Ensure invoice authenticity and integrity
- Enable PEPPOL network transmission

**Critical**: Production deployments MUST use real certificates from a trusted Certificate Authority (CA). Mock keys are only for development.

---

## Environment Modes

### Development Mode (Default)
```bash
# No environment variables needed
# System uses mock keys with warnings
npm run dev
```

**Characteristics:**
- ⚠️ Uses generated mock RSA-2048 keys
- ⚠️ Invoices signed with test certificates
- ⚠️ NOT FTA-compliant
- ✅ Suitable for local development and testing

### Production Mode
```bash
export PRODUCTION_MODE=true
export SIGNING_PRIVATE_KEY_PEM="<PEM content>"
export SIGNING_CERTIFICATE_PEM="<PEM content>"
```

**Characteristics:**
- 🔒 Requires real certificates and private keys
- 🔒 Fails immediately if keys missing or invalid
- 🔒 Validates certificate expiry at startup
- ✅ FTA-compliant invoice signing
- ✅ Production-ready

---

## Obtaining Production Certificates

### Option 1: UAE FTA Accredited Provider
1. **Register with FTA Accredited Service Provider (ASP)**
   - Examples: Tradeshift, Basware, Invozone, ClearTax
   - Choose provider based on PEPPOL network support

2. **Request Digital Certificate**
   - Provide company TRN and documentation
   - Specify RSA-2048 or higher key strength
   - Request X.509 certificate in PEM format

3. **Receive Certificate Package**
   - Private key (`.key` file)
   - Public certificate (`.crt` or `.pem` file)
   - CA certificate chain (optional)

### Option 2: Private Certificate Authority
For testing/staging environments, you may use your own CA:

```bash
# Generate private key
openssl genrsa -out involinks.key 2048

# Create certificate signing request
openssl req -new -key involinks.key -out involinks.csr \
  -subj "/C=AE/O=YourCompany/CN=involinks.yourcompany.ae"

# Self-sign certificate (valid for 1 year)
openssl x509 -req -in involinks.csr -signkey involinks.key \
  -out involinks.crt -days 365

# Convert to PEM format (if needed)
openssl x509 -in involinks.crt -out involinks.pem
```

**⚠️ Note**: Self-signed certificates should ONLY be used in staging/testing. Production must use FTA-accredited provider certificates.

---

## Certificate Installation

### Step 1: Convert to PEM Format (if needed)

If your certificate is in DER or other format:

```bash
# DER to PEM
openssl x509 -inform der -in certificate.der -out certificate.pem

# PKCS12 to PEM
openssl pkcs12 -in certificate.p12 -out certificate.pem -nodes
```

### Step 2: Prepare Environment Variables

```bash
# Read private key into variable
SIGNING_PRIVATE_KEY_PEM=$(cat /path/to/involinks.key)

# Read certificate into variable
SIGNING_CERTIFICATE_PEM=$(cat /path/to/involinks.pem)

# Export for application
export SIGNING_PRIVATE_KEY_PEM
export SIGNING_CERTIFICATE_PEM
export PRODUCTION_MODE=true
```

### Step 3: Set Environment Variables in Replit

**For Replit Deployments:**

1. Navigate to your Repl
2. Open **Secrets** (lock icon in left sidebar)
3. Add the following secrets:

| Secret Key | Value | Notes |
|------------|-------|-------|
| `PRODUCTION_MODE` | `true` | Enables strict validation |
| `SIGNING_PRIVATE_KEY_PEM` | `<full PEM content>` | Include BEGIN/END markers |
| `SIGNING_CERTIFICATE_PEM` | `<full PEM content>` | Include BEGIN/END markers |

**Example PEM format:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...
...
-----END PRIVATE KEY-----
```

### Step 4: Verify Installation

After setting environment variables, the system will validate on startup:

```bash
# Start the application
npm run dev  # or deploy to production

# Check startup logs for:
✅ Environment: SIGNING_PRIVATE_KEY_PEM validated
✅ Crypto: Certificate loaded - CN=involinks.ae, expires 2026-10-27T12:00:00
✅ Certificate: Valid until 2026-10-27T12:00:00
🔒 PRODUCTION MODE: All cryptographic validations passed
✅ InvoLinks API started (🔒 PRODUCTION) - Plans seeded
```

---

## Certificate Rotation

Certificates must be rotated before expiry to prevent service disruption.

### Rotation Timeline

```
Certificate Valid Period: 365 days
├─ Day 0-335 (0-92%): ✅ Normal operation
├─ Day 336-355 (92-97%): ⚠️  Warning logs (< 30 days to expiry)
├─ Day 356-365 (97-100%): 🚨 Urgent rotation required
└─ Day 366+: ❌ Certificate expired - service fails
```

### Rotation Procedure

**30 days before expiry:**

1. **Obtain new certificate** from CA/ASP
   ```bash
   # Request new certificate with same or updated details
   ```

2. **Test new certificate in staging**
   ```bash
   export SIGNING_PRIVATE_KEY_PEM="<new key>"
   export SIGNING_CERTIFICATE_PEM="<new cert>"
   
   # Run validation tests
   python -m pytest tests/test_crypto_validation.py
   ```

3. **Schedule maintenance window** (5-10 minutes)

4. **Deploy new certificate** to production
   - Update secrets in Replit
   - Restart application
   - Monitor startup logs for validation

5. **Verify invoice signing**
   - Create test invoice
   - Verify signature with new certificate serial
   - Check hash chain continuity

6. **Archive old certificate**
   - Store securely for audit purposes
   - Keep for at least 7 years (UAE tax retention requirements)

### Emergency Rotation (Certificate Compromised)

If private key is compromised:

1. **Immediately revoke certificate** with CA
2. **Generate new key pair** (never reuse compromised key)
3. **Deploy new certificate** ASAP
4. **Audit invoice signatures** from compromise period
5. **Notify FTA** if required by regulations

---

## Monitoring and Alerts

### Automated Monitoring

The system provides automatic warnings:

```bash
# Startup check
⚠️ Certificate: Expires in 25 days

# Recommended monitoring setup:
- Alert at 30 days before expiry
- Escalate at 14 days before expiry
- Critical alert at 7 days before expiry
```

### Manual Certificate Check

```bash
# Check certificate expiry
openssl x509 -in involinks.pem -noout -enddate

# Check certificate details
openssl x509 -in involinks.pem -noout -text

# Verify certificate with private key
openssl rsa -in involinks.key -modulus -noout | openssl md5
openssl x509 -in involinks.pem -modulus -noout | openssl md5
# Both hashes should match
```

### Health Check Endpoint

Monitor via API:

```bash
# Check cryptographic status (add this endpoint if needed)
curl https://your-app.replit.app/health/crypto

# Expected response:
{
  "status": "healthy",
  "certificate": {
    "serial_number": "ABC123...",
    "expires_in_days": 180,
    "subject_cn": "involinks.ae"
  }
}
```

---

## Troubleshooting

### Error: "SIGNING_PRIVATE_KEY_PEM is required for production deployment"

**Cause**: Production mode enabled without private key

**Solution**:
```bash
# Verify environment variable is set
echo $SIGNING_PRIVATE_KEY_PEM

# If empty, set it:
export SIGNING_PRIVATE_KEY_PEM="$(cat /path/to/key.pem)"

# Or disable production mode for testing:
export PRODUCTION_MODE=false
```

### Error: "Certificate has expired"

**Cause**: Certificate past its `not_valid_after` date

**Solution**:
1. Obtain new certificate immediately
2. Follow rotation procedure
3. Update `SIGNING_CERTIFICATE_PEM` environment variable

### Error: "Failed to load certificate: Unable to load PEM"

**Cause**: Invalid PEM format or corrupted file

**Solution**:
```bash
# Verify PEM format
cat involinks.pem

# Should start with: -----BEGIN CERTIFICATE-----
# Should end with: -----END CERTIFICATE-----

# Validate certificate
openssl x509 -in involinks.pem -noout -text

# If invalid, re-export from source
openssl x509 -in original.crt -out involinks.pem
```

### Error: "Private key and certificate do not match"

**Cause**: Certificate was generated for different private key

**Solution**:
```bash
# Verify key and cert match
openssl rsa -in involinks.key -modulus -noout | openssl md5
openssl x509 -in involinks.pem -modulus -noout | openssl md5

# If hashes differ, obtain matching certificate for your key
```

### Warning: "Certificate expires in X days" (X < 30)

**Cause**: Certificate approaching expiry

**Solution**:
1. Begin rotation procedure immediately
2. Order new certificate from CA
3. Schedule deployment within 1-2 weeks

---

## Security Best Practices

### Private Key Protection

**DO:**
- ✅ Store private keys in secure secrets management (Replit Secrets, AWS Secrets Manager, HashiCorp Vault)
- ✅ Use environment variables, never hardcode in source code
- ✅ Restrict access to private keys (need-to-know basis)
- ✅ Use strong passphrases for key files (if applicable)
- ✅ Enable audit logging for key access
- ✅ Rotate keys regularly (annually or per policy)

**DON'T:**
- ❌ Commit private keys to git repositories
- ❌ Store keys in plaintext files on disk
- ❌ Share keys via email or messaging apps
- ❌ Reuse keys across environments (dev/staging/prod)
- ❌ Use the same key for multiple purposes

### Certificate Best Practices

**DO:**
- ✅ Use certificates from FTA-accredited providers for production
- ✅ Set appropriate validity periods (1 year recommended)
- ✅ Monitor expiry dates and set up alerts
- ✅ Maintain certificate inventory with expiry tracking
- ✅ Archive old certificates for audit trail (7+ years)
- ✅ Use RSA-2048 or higher key strength

**DON'T:**
- ❌ Use self-signed certificates in production
- ❌ Extend certificate validity beyond recommended periods
- ❌ Ignore expiry warnings
- ❌ Share certificates across multiple companies/entities

### Environment Security

**Production Environment:**
```bash
# Minimal exposure
export PRODUCTION_MODE=true
export SIGNING_PRIVATE_KEY_PEM="<from secure secrets>"
export SIGNING_CERTIFICATE_PEM="<from secure secrets>"

# Optional: Restrict network access
# firewall rules, VPC, etc.
```

**Development Environment:**
```bash
# No production keys - use mocks
# PRODUCTION_MODE defaults to false
# Safe for local development
```

### Incident Response

If private key is compromised:

1. **Immediate**: Revoke certificate with CA
2. **Within 1 hour**: Generate new key pair
3. **Within 4 hours**: Deploy new certificate to production
4. **Within 24 hours**: Complete security audit
5. **Within 1 week**: Review access controls and policies

---

## Future Enhancements

### Planned: KMS/HSM Integration

For enhanced security, InvoLinks will support Hardware Security Modules:

- **AWS KMS**: CloudHSM, managed key rotation
- **Azure Key Vault**: Managed HSM tier
- **Google Cloud KMS**: HSM-backed keys

**Benefits:**
- Keys never leave secure hardware
- Automatic rotation and lifecycle management
- Compliance with security standards (FIPS 140-2)
- Audit trail for all cryptographic operations

See `docs/KMS_ARCHITECTURE.md` for implementation plan.

---

## Support and Contact

For production certificate issues:

- **Technical Support**: support@involinks.ae
- **Security Issues**: security@involinks.ae
- **Emergency Hotline**: +971-XXX-XXXX (24/7)

For FTA compliance questions:

- **UAE FTA Portal**: https://tax.gov.ae
- **e-Invoice Helpdesk**: +971-600-599-994

---

**Last Updated**: October 27, 2025  
**Document Version**: 1.0  
**Maintained By**: InvoLinks DevOps Team

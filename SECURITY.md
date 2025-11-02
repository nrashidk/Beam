# Security Configuration Guide

This document describes the security enhancements implemented in the InvoLinks platform and how to configure them properly.

## Environment Variables

### Required for Production

These environment variables **MUST** be set in production mode (`PRODUCTION_MODE=true`):

#### Authentication & Security
- `JWT_SECRET_KEY` - **REQUIRED** in production
  - Random secure string for JWT token signing
  - Generate using: `openssl rand -hex 32`
  - Example: `c4f3a8b2e1d9f7c6a5b4e3d2c1f0a9b8e7d6c5f4a3b2e1d0c9f8a7b6e5d4c3f2`

- `ALLOWED_ORIGINS` - **HIGHLY RECOMMENDED**
  - Comma-separated list of allowed frontend origins for CORS
  - Default (dev): `http://localhost:5000,http://localhost:3000,http://127.0.0.1:5000,http://127.0.0.1:3000`
  - Production example: `https://yourdomain.com,https://www.yourdomain.com`

#### Database
- `DATABASE_URL`
  - Database connection string
  - Default (dev): `sqlite:///./.dev.db`
  - Production example: `postgresql://user:password@localhost/involinks`

#### Email Service
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`
  - Required for sending emails (MFA, password reset, etc.)

#### Payment Processing
- `STRIPE_SECRET_KEY`
  - Required for Stripe payment processing
  - Get from: https://dashboard.stripe.com/apikeys

### Optional Configuration

- `ENV` - Environment mode (default: `development`)
  - Options: `development`, `staging`, `production`

- `PRODUCTION_MODE` - Strict security validation (default: `false`)
  - Set to `true` in production to enforce:
    - Required JWT_SECRET_KEY (no default allowed)
    - Strict cryptographic key validation
    - HSTS headers enabled
    - Enhanced security logging

- `SUPER_ADMIN_EMAIL` - Super admin email (default: `nrashidk@gmail.com`)
- `SUPER_ADMIN_PASSWORD` - Super admin password (default: `AbuDhabi@123`)

## Security Features

### 1. Rate Limiting

API endpoints are protected with rate limiting to prevent abuse:

| Endpoint | Limit | Purpose |
|----------|-------|---------|
| `/auth/login` | 5/minute | Prevent brute force attacks |
| `/auth/mfa/verify` | 5/minute | Prevent MFA code guessing |
| `/auth/forgot-password` | 3/hour | Prevent email flooding |
| `/auth/reset-password` | 5/hour | Prevent token guessing |

### 2. Security Headers

The following security headers are automatically added to all responses:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS filter for older browsers
- `Strict-Transport-Security` - HTTPS enforcement (production only)
- `Content-Security-Policy` - Controls resource loading
- `Referrer-Policy: strict-origin-when-cross-origin` - Privacy protection
- `Permissions-Policy` - Disables unnecessary features

### 3. CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured to allow only whitelisted origins:

- **Development**: `localhost:5000`, `localhost:3000`, and `127.0.0.1` variants
- **Production**: Set via `ALLOWED_ORIGINS` environment variable

Allowed methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`

### 4. Password Requirements

Passwords must meet the following criteria:

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*(),.?":{}|<>)

Both frontend and backend validate password strength.

### 5. Security Logging

All security-related events are logged to `security_audit.log`:

- Failed login attempts (with IP address)
- Successful logins (with user, role, and IP)
- Password resets (with company and IP)
- Unauthorized access attempts

**Note**: `security_audit.log` is excluded from version control.

### 6. Input Validation

#### Frontend Validation (`src/utils/validation.js`)
- Email format validation
- Password strength checking
- TRN (Tax Registration Number) validation
- Phone number validation
- File upload validation
- URL validation
- Input sanitization for XSS prevention

#### Backend Validation (`main.py`)
- Password complexity enforcement
- Email format validation
- Input sanitization
- File type and size restrictions

### 7. Authentication Security

- JWT tokens with configurable expiration (default: 24 hours)
- Multi-Factor Authentication (MFA) support
  - TOTP (Time-based One-Time Password)
  - Email OTP
  - Backup codes
- Secure password hashing with bcrypt
- Token-based password reset with 1-hour expiration
- Session management

## Production Deployment Checklist

### Before Deployment

- [ ] Set `PRODUCTION_MODE=true`
- [ ] Set strong `JWT_SECRET_KEY` (min 32 random characters)
- [ ] Configure `ALLOWED_ORIGINS` with your domain(s)
- [ ] Set up production database with `DATABASE_URL`
- [ ] Configure email service (SMTP credentials)
- [ ] Set up Stripe API keys
- [ ] Review and adjust rate limits if needed
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS certificate (HTTPS)
- [ ] Enable database encryption at rest
- [ ] Set up log rotation for `security_audit.log`

### After Deployment

- [ ] Test login functionality
- [ ] Verify MFA enrollment and verification
- [ ] Test password reset flow
- [ ] Verify rate limiting is working
- [ ] Check security headers in browser dev tools
- [ ] Monitor `security_audit.log` for suspicious activity
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting

## Security Best Practices

### For Developers

1. **Never commit secrets** to version control
   - Use `.env` files (excluded in `.gitignore`)
   - Use environment variables in CI/CD

2. **Always validate user input**
   - Use validation utilities for all forms
   - Sanitize input to prevent XSS
   - Never trust client-side validation alone

3. **Keep dependencies updated**
   ```bash
   npm audit
   pip-audit -r requirements.txt
   ```

4. **Review security logs regularly**
   ```bash
   tail -f security_audit.log
   ```

5. **Use HTTPS everywhere** in production
   - No HTTP endpoints
   - Set `PRODUCTION_MODE=true` to enforce HSTS

### For System Administrators

1. **Firewall Configuration**
   - Only expose ports 80 (HTTP redirect) and 443 (HTTPS)
   - Restrict database port access to application server only
   - Use VPC/private networks when possible

2. **Database Security**
   - Use strong database passwords
   - Enable SSL/TLS for database connections
   - Regular backups with encryption
   - Restrict database user permissions

3. **Log Management**
   - Rotate logs regularly (daily or weekly)
   - Archive old logs securely
   - Monitor for suspicious patterns
   - Set up alerts for critical events

4. **Updates and Patches**
   - Keep OS and packages updated
   - Monitor security advisories
   - Test updates in staging first
   - Have a rollback plan

## Monitoring and Incident Response

### Key Metrics to Monitor

- Failed login attempts per IP
- Rate limit violations
- Password reset requests
- MFA failures
- File upload attempts
- Database connection errors

### Alerts to Configure

- \> 10 failed logins from same IP in 1 hour
- \> 100 failed logins globally in 1 hour
- Successful login from new geographic location
- Multiple password reset requests for same account
- Unusual API usage patterns

### Incident Response

1. **Suspected Brute Force Attack**
   - Review `security_audit.log`
   - Identify attacking IP addresses
   - Add IPs to firewall block list
   - Notify affected users if accounts compromised

2. **Data Breach**
   - Immediately rotate all secrets (JWT, database passwords, API keys)
   - Force logout all users
   - Invalidate all active sessions
   - Notify affected users
   - Review and patch vulnerability
   - Document incident

3. **DDoS Attack**
   - Enable rate limiting globally
   - Use CDN/DDoS protection service
   - Scale infrastructure if needed
   - Monitor and block attacking IPs

## Support and Questions

For security issues or questions:
- Email: security@involinks.com (create this!)
- Report vulnerabilities privately
- Do not disclose vulnerabilities publicly before patching

## Version History

- **v2.0** (2025-11-02) - Added comprehensive security enhancements
  - Rate limiting
  - Security headers
  - Enhanced CORS
  - Password validation
  - Security logging
  - Frontend validation utilities

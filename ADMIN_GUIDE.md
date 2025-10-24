# Admin Dashboard Guide

## Accessing the Admin Dashboard

**URL:** `/admin`

Example: `https://your-repl-url.replit.dev/admin`

## Dashboard Features

### Overview Stats
- **Pending Review**: Total number of companies awaiting approval
- **Email Verified**: Number of companies that have verified their email

### Pending Registrations Table

The table displays all companies waiting for admin approval with the following information:

| Column | Description |
|--------|-------------|
| **Company Name** | Company legal name and business type |
| **Email** | Contact email and phone number |
| **Email Status** | ✓ Verified or ⏳ Pending |
| **Registration Date** | When they registered |
| **Actions** | Approve or Reject buttons |

### Approval Workflow

1. **User Registers**
   - User enters email + company name at `/`
   - System sends verification email (logged to console)

2. **User Verifies Email**
   - User clicks verification link
   - Email status changes to ✓ Verified
   - Company appears in admin dashboard

3. **Admin Reviews**
   - Visit `/admin` dashboard
   - Review company details
   - Check email verification status

4. **Admin Approves**
   - Click "✓ Approve" button (only enabled for verified emails)
   - Confirmation dialog appears
   - Upon approval:
     - Company status → ACTIVE
     - Free tier activated (100 invoices/month, $0/month)
     - Approval email sent (logged to console)
     - Company removed from pending list

5. **Admin Rejects** (if needed)
   - Click "✗ Reject" button
   - Enter rejection reason
   - Company status → REJECTED
   - Company removed from pending list

## API Endpoints for Admin

If you prefer to use API calls instead of the dashboard:

### List Pending Companies
```bash
GET /admin/companies/pending
```

Returns array of companies with `PENDING_REVIEW` status.

### Approve Company
```bash
POST /admin/companies/{company_id}/approve
```

Requirements:
- Company email must be verified
- Automatically assigns free tier subscription

Response:
```json
{
  "message": "Company 'Demo Trading LLC' approved and activated",
  "plan": "Free tier (100 invoices/month)",
  "status": "active",
  "note": "Approval email sent to admin@demotrading.ae"
}
```

### Reject Company
```bash
POST /admin/companies/{company_id}/reject
Form Data: reason=<rejection reason>
```

## Email Notifications

Currently, emails are **simulated and logged to the console**. You'll see formatted email content in the server logs for:

### 1. Verification Email
Sent when user registers:
```
╔══════════════════════════════════════════╗
║         EMAIL WOULD BE SENT              ║
╠══════════════════════════════════════════╣
║  To: user@company.com                    ║
║  Subject: Verify Your Email              ║
║  [Verification link]                     ║
╚══════════════════════════════════════════╝
```

### 2. Approval Email
Sent when admin approves:
```
╔══════════════════════════════════════════╗
║         EMAIL WOULD BE SENT              ║
╠══════════════════════════════════════════╣
║  To: user@company.com                    ║
║  Subject: Account Approved               ║
║  [Account activated message]             ║
╚══════════════════════════════════════════╝
```

### Integrating Real Email Service

The system is ready for Resend or SendGrid integration. When ready:

1. Use the `search_integrations` tool
2. Search for "Resend" or "SendGrid"
3. Set up the integration
4. Replace `print()` statements in main.py with actual email sending

## Dashboard Features

- **Auto-refresh**: Dashboard refreshes every 30 seconds
- **Manual refresh**: Click "🔄 Refresh" button anytime
- **Real-time updates**: Approved/rejected companies disappear immediately
- **Email validation**: Approve button disabled until email is verified

## Testing the System

### Complete Test Flow

1. **Register a company** (at `/`):
   ```
   Email: test@company.ae
   Company: Test Company LLC
   ```

2. **Check server logs** for verification email

3. **Extract verification token** from logs

4. **Verify email** via API or URL:
   ```bash
   POST /register/verify/{token}
   ```

5. **View in admin dashboard** (at `/admin`)

6. **Approve the company**

7. **Check logs** for approval email

8. **Verify subscription**:
   ```bash
   GET /companies/{company_id}/subscription
   ```
   Should show free tier activated.

## Security Notes

⚠️ **Important**: This admin dashboard currently has NO authentication. Before production:

1. Add authentication middleware
2. Implement role-based access control (RBAC)
3. Add audit logging for admin actions
4. Set up real email service
5. Add rate limiting

## Support

For questions or issues with the admin system, check:
- Server logs at `/tmp/logs/`
- API documentation at `/docs`
- Main README at `replit.md`

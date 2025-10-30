# AWS SES Setup Guide for InvoLinks

This guide will walk you through setting up Amazon Simple Email Service (SES) for InvoLinks email delivery.

## 📋 Overview

**What you'll set up:**
- AWS Account and IAM User
- AWS SES with verified sender email
- API credentials for email sending
- Environment variables in Replit

**Time required:** 15-20 minutes

---

## Step 1: Create AWS Account

1. Go to **https://aws.amazon.com/**
2. Click **"Create an AWS Account"**
3. Follow the registration process:
   - Enter email address and password
   - Provide contact information
   - Enter payment information (required, even for free tier)
   - Complete phone/SMS verification
4. Sign in to AWS Console

**Note:** You get **3,000 free emails/month** for the first 12 months!

---

## Step 2: Create IAM User for SES

**Why?** Don't use your root AWS account credentials. Create a dedicated user for security.

### 2.1 Navigate to IAM Console
- Go to: https://console.aws.amazon.com/iam/
- Click **"Users"** in the left sidebar
- Click **"Create user"**

### 2.2 Configure User
1. **Username:** `involinks-ses-user`
2. **Uncheck** "Provide user access to the AWS Management Console"
3. Click **Next**

### 2.3 Set Permissions
1. Select **"Attach policies directly"**
2. Search for: `AmazonSESFullAccess`
3. Check the box next to **AmazonSESFullAccess**
4. Click **Next** → **Create user**

---

## Step 3: Generate Access Keys

### 3.1 Create Access Key
1. Click on the user you just created (`involinks-ses-user`)
2. Go to **"Security credentials"** tab
3. Scroll to **"Access keys"** section
4. Click **"Create access key"**

### 3.2 Select Use Case
1. Choose **"Application running outside AWS"**
2. Click **Next**
3. (Optional) Add description: "InvoLinks email service"
4. Click **"Create access key"**

### 3.3 Save Your Credentials
⚠️ **CRITICAL:** Copy these values NOW - you can't retrieve the secret key later!

You'll see:
- **Access Key ID**: `AKIAIOSFODNN7EXAMPLE` (example)
- **Secret Access Key**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` (example)

**Download the CSV file** or copy both values to a secure location.

---

## Step 4: Verify Your Sender Email

Before you can send emails, you must verify your sender email address.

### 4.1 Go to SES Console
- Navigate to: https://console.aws.amazon.com/ses/
- Click **"Verified identities"** in the left sidebar

### 4.2 Create Identity
1. Click **"Create identity"**
2. Choose **"Email address"**
3. Enter: `noreply@involinks.ae`
4. Click **"Create identity"**

### 4.3 Verify Email
1. Check the inbox for `noreply@involinks.ae`
2. Open the email from AWS
3. Click the verification link
4. You should see "Congratulations! You've successfully verified..."

**Repeat this process for other sender emails:**
- `invoices@involinks.ae` (for invoice delivery)
- `security@involinks.ae` (for MFA emails)
- `support@involinks.ae` (for admin notifications)

---

## Step 5: Request Production Access (Remove Sandbox Mode)

New SES accounts start in "sandbox mode" with restrictions:
- ✓ Can only send to verified email addresses
- ✓ Limited to 200 emails/day
- ✗ Can't send to real customers

### 5.1 Request Production Access
1. In SES Console, go to **"Account dashboard"**
2. Look for the orange banner: "Your account is in the Amazon SES sandbox"
3. Click **"Request production access"**

### 5.2 Fill Out Request Form
- **Mail type:** Transactional
- **Website URL:** https://involinks.ae
- **Use case description:**
  ```
  InvoLinks is a UAE-based digital invoicing platform. We need SES to send:
  1. Invoice notifications to customers
  2. Multi-factor authentication codes
  3. Account verification emails
  4. Admin approval notifications
  
  All emails are transactional and sent only to users who registered on our platform.
  Expected volume: 500-1,000 emails/month initially, scaling to 5,000/month.
  ```
- **Acknowledge compliance**
- Click **"Submit request"**

**Timeline:** AWS typically approves within 24 hours (often much faster).

---

## Step 6: Configure Replit Secrets

Now add your AWS credentials to Replit as environment variables.

### 6.1 Open Replit Secrets
1. In your Replit workspace, click the **"Tools"** tab (left sidebar)
2. Click **"Secrets"**
3. Click **"+ New secret"**

### 6.2 Add These Secrets

Add each of these one by one:

| Secret Name | Value | Example |
|------------|-------|---------|
| `AWS_ACCESS_KEY_ID` | Your access key from Step 3 | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Your secret key from Step 3 | `wJalrXUtnFEMI/K7MDeng...` |
| `AWS_REGION` | Your AWS region | `us-east-1` |
| `SENDER_EMAIL` | Your verified sender email | `noreply@involinks.ae` |
| `PLATFORM_URL` | Your custom domain | `https://involinks.ae` |

**Important Notes:**
- **AWS_REGION:** Use the region where you verified your emails. Common options:
  - `us-east-1` (US East - N. Virginia) - **Recommended**
  - `eu-west-1` (Europe - Ireland)
  - `ap-south-1` (Asia Pacific - Mumbai)
- **SENDER_EMAIL:** Must match the email you verified in Step 4

---

## Step 7: Test Email Sending

### 7.1 Restart Your App
1. Click the **"Deploy"** tab (or restart workflows)
2. Wait for the backend to restart

### 7.2 Send a Test Email
Try one of these actions in your app:
- Create a company registration (sends verification email)
- Enable MFA and request email OTP
- Send an invoice to a customer

### 7.3 Check Console Output
If AWS SES is **not configured** or has errors, you'll see simulated emails in the console:
```
╔══════════════════════════════════════════════════════════════════╗
║                    EMAIL SIMULATION (AWS SES)                    ║
╠══════════════════════════════════════════════════════════════════╣
...
```

If AWS SES is **working**, you'll see:
```
✅ Email sent via AWS SES - Message ID: 0102...
```

---

## 🎯 Quick Reference

### Your AWS SES Configuration

```env
# Add these to Replit Secrets
AWS_ACCESS_KEY_ID=<your-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
AWS_REGION=us-east-1
SENDER_EMAIL=noreply@involinks.ae
PLATFORM_URL=https://involinks.ae
```

### Verified Sender Emails
- ✓ `noreply@involinks.ae` - General platform emails
- ✓ `invoices@involinks.ae` - Invoice delivery
- ✓ `security@involinks.ae` - MFA and security
- ✓ `support@involinks.ae` - Admin notifications

### Email Types InvoLinks Sends
1. **Company Verification** - Registration email confirmation
2. **MFA OTP** - Two-factor authentication codes
3. **Invoice Delivery** - Customer invoice notifications
4. **Approval Notifications** - Company approval/rejection
5. **Password Reset** - (Future feature)

---

## 💰 Pricing & Costs

### Free Tier (First 12 Months)
- **3,000 emails/month** - FREE
- After 3,000: $0.10 per 1,000 emails

### After Free Tier
- **$0.10 per 1,000 emails** ($1.00 per 10,000)
- Data transfer: ~$0.12/GB

### Example Costs
| Monthly Emails | Cost |
|----------------|------|
| 0 - 3,000 | **FREE** |
| 5,000 | **$0.20** |
| 10,000 | **$0.70** |
| 50,000 | **$4.70** |
| 100,000 | **$9.70** |

**Much cheaper than SendGrid ($19.95/month minimum)!**

---

## 🔧 Troubleshooting

### Problem: "Email was simulated - AWS SES not configured"
**Solution:** Check that all 5 secrets are added to Replit Secrets (Step 6)

### Problem: "Invalid credentials" error
**Solution:** 
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
- Check for extra spaces in the secret values
- Regenerate access keys if needed (IAM Console → User → Security credentials)

### Problem: "Email address is not verified"
**Solution:**
- Go to SES Console → Verified identities
- Make sure `noreply@involinks.ae` shows "Verified" status
- If pending, check the email inbox and click the verification link

### Problem: "Sandbox mode - can only send to verified addresses"
**Solution:**
- You need to request production access (Step 5)
- While in sandbox, you can only send to email addresses you've verified

### Problem: "MessageRejected: Email address is not verified"
**Solution:**
- Your `SENDER_EMAIL` doesn't match a verified identity
- Go verify the exact email you're using as SENDER_EMAIL

---

## 🚀 Next Steps

Once AWS SES is working:
1. ✅ Test all email types (verification, MFA, invoices, approvals)
2. ✅ Monitor email sending in AWS SES Console → "Sending statistics"
3. ✅ Set up domain verification (instead of email) for better deliverability
4. ✅ Configure DKIM and SPF records for `involinks.ae` domain
5. ✅ Enable bounce and complaint handling
6. ✅ Set up CloudWatch alarms for monitoring

---

## 📞 Support

If you encounter issues:
1. Check AWS SES Console → "Account dashboard" for account status
2. Review AWS SES documentation: https://docs.aws.amazon.com/ses/
3. Check Replit console logs for error messages
4. Contact AWS Support (included with AWS account)

---

**You're all set! 🎉** Your InvoLinks platform can now send real emails via AWS SES.

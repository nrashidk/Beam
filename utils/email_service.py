"""
AWS SES Email Service
Handles all email sending via Amazon Simple Email Service (SES)
"""

import os
import boto3
from botocore.exceptions import ClientError
from typing import Optional, List
from datetime import datetime

class EmailService:
    """
    AWS SES Email Service for InvoLinks
    
    Required Environment Variables:
    - AWS_ACCESS_KEY_ID: Your AWS access key
    - AWS_SECRET_ACCESS_KEY: Your AWS secret key
    - AWS_REGION: AWS region (e.g., 'us-east-1', 'eu-west-1')
    - SENDER_EMAIL: Verified sender email (e.g., 'noreply@involinks.ae')
    - PLATFORM_URL: Your platform URL (e.g., 'https://involinks.ae')
    """
    
    def __init__(self):
        self.aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        self.sender_email = os.getenv("SENDER_EMAIL", "noreply@involinks.ae")
        self.platform_url = os.getenv("PLATFORM_URL", "https://involinks.ae")
        
        # Check if credentials are configured
        self.is_configured = bool(self.aws_access_key and self.aws_secret_key)
        
        if self.is_configured:
            try:
                self.client = boto3.client(
                    'ses',
                    region_name=self.aws_region,
                    aws_access_key_id=self.aws_access_key,
                    aws_secret_access_key=self.aws_secret_key
                )
            except Exception as e:
                print(f"⚠️  AWS SES client initialization error: {e}")
                self.is_configured = False
                self.client = None
        else:
            self.client = None
            print("⚠️  AWS SES not configured - emails will be simulated (printed to console)")
    
    def _simulate_email(self, to_email: str, subject: str, body_text: str, body_html: Optional[str] = None, reply_to: Optional[str] = None):
        """Print email to console when AWS SES is not configured"""
        print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                    EMAIL SIMULATION (AWS SES)                    ║
╠══════════════════════════════════════════════════════════════════╣
║  From: {self.sender_email:<58} ║
║  To: {to_email:<60} ║
║  Reply-To: {(reply_to or 'N/A'):<54} ║
║  Subject: {subject:<55} ║
║                                                                  ║
║  {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'):<62} ║
╠══════════════════════════════════════════════════════════════════╣
{body_text[:500]}
╚══════════════════════════════════════════════════════════════════╝
        """)
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        reply_to: Optional[str] = None,
        from_name: Optional[str] = "InvoLinks"
    ) -> dict:
        """
        Send email via AWS SES
        
        Args:
            to_email: Recipient email address
            subject: Email subject line
            body_text: Plain text body
            body_html: HTML body (optional)
            reply_to: Reply-To address (optional)
            from_name: Display name for sender
        
        Returns:
            dict with 'success', 'message_id' (if successful), 'error' (if failed)
        """
        
        # If not configured, simulate email
        if not self.is_configured:
            self._simulate_email(to_email, subject, body_text, body_html, reply_to)
            return {
                "success": True,
                "message_id": "simulated",
                "note": "Email simulated - AWS SES not configured"
            }
        
        try:
            # Prepare source
            source = f"{from_name} <{self.sender_email}>" if from_name else self.sender_email
            
            # Prepare message
            message = {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {}
            }
            
            # Add plain text body
            message['Body']['Text'] = {'Data': body_text, 'Charset': 'UTF-8'}
            
            # Add HTML body if provided
            if body_html:
                message['Body']['Html'] = {'Data': body_html, 'Charset': 'UTF-8'}
            
            # Send email
            kwargs = {
                'Source': source,
                'Destination': {'ToAddresses': [to_email]},
                'Message': message
            }
            
            # Add Reply-To if provided
            if reply_to:
                kwargs['ReplyToAddresses'] = [reply_to]
            
            response = self.client.send_email(**kwargs)
            
            return {
                "success": True,
                "message_id": response['MessageId'],
                "note": "Email sent via AWS SES"
            }
            
        except ClientError as e:
            error_message = e.response['Error']['Message']
            print(f"❌ AWS SES Error: {error_message}")
            
            # Fallback to simulation on error
            self._simulate_email(to_email, subject, body_text, body_html, reply_to)
            
            return {
                "success": False,
                "error": error_message,
                "note": "Email simulated due to SES error"
            }
        except Exception as e:
            print(f"❌ Unexpected error sending email: {str(e)}")
            self._simulate_email(to_email, subject, body_text, body_html, reply_to)
            
            return {
                "success": False,
                "error": str(e),
                "note": "Email simulated due to unexpected error"
            }
    
    def send_verification_email(self, to_email: str, company_name: str, verification_url: str) -> dict:
        """Send company email verification email"""
        subject = "Verify Your Email - InvoLinks E-Invoicing"
        
        body_text = f"""
Hi {company_name},

Thank you for registering with InvoLinks!

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours.

If you didn't create an account with InvoLinks, please ignore this email.

Best regards,
InvoLinks E-Invoicing Team
        """
        
        body_html = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Verify Your Email</h2>
        
        <p>Hi <strong>{company_name}</strong>,</p>
        
        <p>Thank you for registering with InvoLinks!</p>
        
        <p>Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_url}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="{verification_url}" style="color: #2563eb;">{verification_url}</a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours.
        </p>
        
        <p style="color: #666; font-size: 14px;">
            If you didn't create an account with InvoLinks, please ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
            Best regards,<br>
            <strong>InvoLinks E-Invoicing Team</strong>
        </p>
    </div>
</body>
</html>
        """
        
        return self.send_email(to_email, subject, body_text, body_html, from_name="InvoLinks")
    
    def send_mfa_otp_email(self, to_email: str, user_name: str, otp_code: str) -> dict:
        """Send MFA OTP verification code"""
        subject = "Your InvoLinks Verification Code"
        
        body_text = f"""
Hi {user_name},

Your verification code is: {otp_code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
InvoLinks Security Team
        """
        
        body_html = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Your Verification Code</h2>
        
        <p>Hi <strong>{user_name}</strong>,</p>
        
        <p>Your verification code is:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; 
                        font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
                {otp_code}
            </div>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            This code will expire in <strong>10 minutes</strong>.
        </p>
        
        <p style="color: #666; font-size: 14px;">
            If you didn't request this code, please ignore this email and ensure your account is secure.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
            Best regards,<br>
            <strong>InvoLinks Security Team</strong>
        </p>
    </div>
</body>
</html>
        """
        
        return self.send_email(to_email, subject, body_text, body_html, from_name="InvoLinks Security")
    
    def send_invoice_email(
        self,
        to_email: str,
        customer_name: str,
        invoice_number: str,
        invoice_url: str,
        company_name: str,
        company_email: str,
        amount: float,
        currency: str = "AED"
    ) -> dict:
        """Send invoice to customer via email"""
        subject = f"Invoice {invoice_number} from {company_name}"
        
        body_text = f"""
Dear {customer_name},

Please find your invoice details below:

Invoice Number: {invoice_number}
Amount: {currency} {amount:.2f}

You can view and download your invoice here:
{invoice_url}

If you have any questions, please contact us at {company_email}

Best regards,
{company_name}
        """
        
        body_html = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Invoice from {company_name}</h2>
        
        <p>Dear <strong>{customer_name}</strong>,</p>
        
        <p>Please find your invoice details below:</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> {invoice_number}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> {currency} {amount:.2f}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{invoice_url}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
                View Invoice
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="{invoice_url}" style="color: #2563eb;">{invoice_url}</a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
            If you have any questions about this invoice, please contact us at 
            <a href="mailto:{company_email}" style="color: #2563eb;">{company_email}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
            Best regards,<br>
            <strong>{company_name}</strong>
        </p>
        
        <p style="color: #999; font-size: 11px;">
            This invoice was sent via InvoLinks E-Invoicing Platform
        </p>
    </div>
</body>
</html>
        """
        
        return self.send_email(
            to_email,
            subject,
            body_text,
            body_html,
            reply_to=company_email,
            from_name=f"{company_name} via InvoLinks"
        )
    
    def send_approval_notification(
        self,
        to_email: str,
        company_name: str,
        status: str,
        admin_message: Optional[str] = None
    ) -> dict:
        """Send company approval/rejection notification"""
        
        if status.upper() == "APPROVED":
            subject = "🎉 Your InvoLinks Account Has Been Approved!"
            
            body_text = f"""
Congratulations {company_name}!

Your InvoLinks account has been approved and is now active.

You can now:
✓ Create and send invoices
✓ Manage your customers
✓ Track payments
✓ Access all platform features

Login to your dashboard: {self.platform_url}

Welcome to InvoLinks!

Best regards,
InvoLinks Admin Team
            """
            
            body_html = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">🎉 Account Approved!</h2>
        
        <p>Congratulations <strong>{company_name}</strong>!</p>
        
        <p>Your InvoLinks account has been <strong style="color: #10b981;">approved</strong> and is now active.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #10b981;">You Can Now:</h3>
            <ul style="margin: 10px 0;">
                <li>✓ Create and send invoices</li>
                <li>✓ Manage your customers</li>
                <li>✓ Track payments</li>
                <li>✓ Access all platform features</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{self.platform_url}" 
               style="background-color: #10b981; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
                Access Your Dashboard
            </a>
        </div>
        
        <p>Welcome to InvoLinks! We're excited to help you streamline your invoicing.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
            Best regards,<br>
            <strong>InvoLinks Admin Team</strong>
        </p>
    </div>
</body>
</html>
            """
            
        else:  # REJECTED
            subject = "InvoLinks Application Update"
            
            body_text = f"""
Dear {company_name},

Thank you for your interest in InvoLinks.

Unfortunately, we are unable to approve your application at this time.

{f"Reason: {admin_message}" if admin_message else ""}

If you have any questions or would like to discuss this decision, please contact our support team.

Best regards,
InvoLinks Admin Team
            """
            
            body_html = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ef4444;">Application Update</h2>
        
        <p>Dear <strong>{company_name}</strong>,</p>
        
        <p>Thank you for your interest in InvoLinks.</p>
        
        <p>Unfortunately, we are unable to approve your application at this time.</p>
        
        {f'<div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;"><p style="margin: 0;"><strong>Reason:</strong> {admin_message}</p></div>' if admin_message else ''}
        
        <p>If you have any questions or would like to discuss this decision, please contact our support team.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
            Best regards,<br>
            <strong>InvoLinks Admin Team</strong>
        </p>
    </div>
</body>
</html>
            """
        
        return self.send_email(to_email, subject, body_text, body_html, from_name="InvoLinks Admin")


# Singleton instance
email_service = EmailService()

"""
MFA (Multi-Factor Authentication) Utilities
Supports TOTP, Email OTP, and Backup Codes (100% free, no external services)

Legal Requirement: Article 9.1 - Ministerial Decision No. 64/2025
"Multifactor authentication mechanisms to secure user access is maintained"
"""

import pyotp
import qrcode
from io import BytesIO
import base64
import secrets
import hashlib
import json
from typing import List, Tuple, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class MFAManager:
    """Manages MFA enrollment, verification, and backup codes"""
    
    # Constants
    TOTP_VALID_WINDOW = 1  # Allow 30s before/after for clock drift
    BACKUP_CODE_COUNT = 10
    EMAIL_OTP_LENGTH = 6
    EMAIL_OTP_VALID_MINUTES = 10
    
    @staticmethod
    def generate_totp_secret() -> str:
        """
        Generate a new TOTP secret (Base32 encoded)
        
        Returns:
            str: 32-character Base32 encoded secret (e.g., "JBSWY3DPEHPK3PXP")
        """
        return pyotp.random_base32()
    
    @staticmethod
    def generate_qr_code(secret: str, user_email: str, issuer: str = "InvoLinks") -> str:
        """
        Generate QR code for TOTP setup (returns base64 encoded PNG)
        
        Args:
            secret: TOTP secret (Base32 encoded)
            user_email: User's email address
            issuer: App name (default: "InvoLinks")
        
        Returns:
            str: Base64 encoded PNG image (data:image/png;base64,...)
        """
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=user_email, issuer_name=issuer)
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_base64}"
    
    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        """
        Verify TOTP code
        
        Args:
            secret: TOTP secret (Base32 encoded)
            code: 6-digit code from authenticator app
        
        Returns:
            bool: True if valid, False otherwise
        """
        if not secret or not code:
            return False
        
        try:
            totp = pyotp.TOTP(secret)
            # valid_window=1 allows codes from 30s before/after (clock drift tolerance)
            return totp.verify(code, valid_window=MFAManager.TOTP_VALID_WINDOW)
        except Exception as e:
            logger.error(f"TOTP verification failed: {e}")
            return False
    
    @staticmethod
    def generate_backup_codes(count: int = BACKUP_CODE_COUNT) -> List[str]:
        """
        Generate backup codes (8 digits each)
        
        Args:
            count: Number of codes to generate (default: 10)
        
        Returns:
            List[str]: List of 8-digit backup codes
        """
        codes = []
        for _ in range(count):
            # Generate cryptographically secure 8-digit code
            code = f"{secrets.randbelow(100000000):08d}"
            codes.append(code)
        return codes
    
    @staticmethod
    def hash_backup_code(code: str) -> str:
        """
        Hash backup code for secure storage (SHA-256)
        
        Args:
            code: Plain backup code
        
        Returns:
            str: SHA-256 hash (hex encoded)
        """
        return hashlib.sha256(code.encode()).hexdigest()
    
    @staticmethod
    def hash_backup_codes(codes: List[str]) -> List[str]:
        """
        Hash multiple backup codes
        
        Args:
            codes: List of plain backup codes
        
        Returns:
            List[str]: List of hashed codes
        """
        return [MFAManager.hash_backup_code(code) for code in codes]
    
    @staticmethod
    def verify_backup_code(code: str, hashed_codes_json: str) -> Tuple[bool, Optional[str]]:
        """
        Verify backup code against stored hashes
        
        Args:
            code: Plain backup code entered by user
            hashed_codes_json: JSON string of hashed backup codes
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, updated_json_without_used_code)
        """
        if not code or not hashed_codes_json:
            return False, None
        
        try:
            hashed_codes = json.loads(hashed_codes_json)
            code_hash = MFAManager.hash_backup_code(code)
            
            if code_hash in hashed_codes:
                # Remove used code (single-use only)
                hashed_codes.remove(code_hash)
                updated_json = json.dumps(hashed_codes)
                return True, updated_json
            
            return False, None
        except Exception as e:
            logger.error(f"Backup code verification failed: {e}")
            return False, None
    
    @staticmethod
    def generate_email_otp() -> str:
        """
        Generate 6-digit OTP for email verification
        
        Returns:
            str: 6-digit numeric code
        """
        return f"{secrets.randbelow(1000000):06d}"
    
    @staticmethod
    def create_otp_expiry() -> datetime:
        """
        Create expiry timestamp for email OTP (10 minutes from now)
        
        Returns:
            datetime: Expiry timestamp
        """
        return datetime.utcnow() + timedelta(minutes=MFAManager.EMAIL_OTP_VALID_MINUTES)
    
    @staticmethod
    def is_otp_expired(expiry: datetime) -> bool:
        """
        Check if OTP has expired
        
        Args:
            expiry: OTP expiry timestamp
        
        Returns:
            bool: True if expired, False otherwise
        """
        return datetime.utcnow() > expiry
    
    @staticmethod
    def format_backup_codes_for_display(codes: List[str]) -> str:
        """
        Format backup codes for user-friendly display
        
        Args:
            codes: List of backup codes
        
        Returns:
            str: Formatted string with codes separated by newlines
        """
        return "\n".join([f"{i+1}. {code}" for i, code in enumerate(codes)])
    
    @staticmethod
    def validate_totp_setup(secret: str, verification_code: str) -> bool:
        """
        Validate TOTP setup during enrollment
        
        Args:
            secret: Generated TOTP secret
            verification_code: Code entered by user from authenticator app
        
        Returns:
            bool: True if setup is valid, False otherwise
        """
        return MFAManager.verify_totp(secret, verification_code)


class EmailOTPManager:
    """
    Manages email-based OTP (stored in memory for development)
    
    Note: In production, store in Redis or database with TTL
    """
    
    _otp_store = {}  # {email: {'code': '123456', 'expiry': datetime, 'attempts': 0, 'created_at': datetime}}
    _send_history = {}  # {email: [datetime, datetime, ...]} - track sends in last hour
    
    MAX_ATTEMPTS = 5
    MAX_SENDS_PER_HOUR = 3
    
    @classmethod
    def generate_and_store(cls, email: str) -> str:
        """
        Generate OTP and store with expiry
        
        Args:
            email: User email address
        
        Returns:
            str: Generated 6-digit OTP
        """
        otp = MFAManager.generate_email_otp()
        expiry = MFAManager.create_otp_expiry()
        created_at = datetime.utcnow()
        
        cls._otp_store[email] = {
            'code': otp,
            'expiry': expiry,
            'attempts': 0,
            'created_at': created_at
        }
        
        # Track send in history for rate limiting
        if email not in cls._send_history:
            cls._send_history[email] = []
        cls._send_history[email].append(created_at)
        
        # Clean old entries (keep only last hour)
        one_hour_ago = created_at - timedelta(hours=1)
        cls._send_history[email] = [
            send_time for send_time in cls._send_history[email]
            if send_time > one_hour_ago
        ]
        
        logger.info(f"Generated email OTP for {email}, expires at {expiry}")
        return otp
    
    @classmethod
    def verify(cls, email: str, code: str) -> bool:
        """
        Verify email OTP
        
        Args:
            email: User email address
            code: 6-digit code entered by user
        
        Returns:
            bool: True if valid, False otherwise
        """
        if email not in cls._otp_store:
            logger.warning(f"No OTP found for {email}")
            return False
        
        otp_data = cls._otp_store[email]
        
        # Check expiry
        if MFAManager.is_otp_expired(otp_data['expiry']):
            logger.warning(f"OTP expired for {email}")
            cls.clear(email)
            return False
        
        # Check attempts
        if otp_data['attempts'] >= cls.MAX_ATTEMPTS:
            logger.warning(f"Max OTP attempts exceeded for {email}")
            cls.clear(email)
            return False
        
        # Verify code
        otp_data['attempts'] += 1
        
        if otp_data['code'] == code:
            logger.info(f"OTP verified successfully for {email}")
            cls.clear(email)
            return True
        
        logger.warning(f"Invalid OTP for {email} (attempt {otp_data['attempts']})")
        return False
    
    @classmethod
    def clear(cls, email: str):
        """Clear OTP for email"""
        if email in cls._otp_store:
            del cls._otp_store[email]
    
    @classmethod
    def can_send(cls, email: str) -> bool:
        """
        Check if user can request another OTP (rate limiting)
        
        Args:
            email: User email address
        
        Returns:
            bool: True if can send, False if rate limited
        """
        if email not in cls._send_history:
            return True
        
        # Count sends in last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_sends = [
            send_time for send_time in cls._send_history[email]
            if send_time > one_hour_ago
        ]
        
        # Allow up to MAX_SENDS_PER_HOUR (3) sends per hour
        if len(recent_sends) >= cls.MAX_SENDS_PER_HOUR:
            logger.warning(f"Rate limit exceeded for {email}: {len(recent_sends)} sends in last hour")
            return False
        
        return True


# Export main classes
__all__ = ['MFAManager', 'EmailOTPManager']

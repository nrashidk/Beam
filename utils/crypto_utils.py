"""
Cryptographic Utilities for UAE FTA Compliance
Handles digital signatures, hash chains, and invoice integrity verification

PRODUCTION NOTES:
- Current: Uses PEM keys from environment variables
- Production: Migrate to HSM/KMS (AWS KMS, Azure Key Vault, Google Cloud KMS)
- Key Rotation: Implement automated rotation and certificate lifecycle management
- Audit: All signing operations should be logged to audit trail
"""
import hashlib
import base64
import os
from datetime import datetime
from typing import Optional, Dict, Any
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from cryptography import x509
from cryptography.x509.oid import NameOID
from .exceptions import SigningError, CertificateError, CryptoError


class InvoiceCrypto:
    """Handles cryptographic operations for invoice signing and verification"""
    
    def __init__(
        self, 
        private_key_pem: Optional[str] = None, 
        cert_pem: Optional[str] = None,
        cert_serial: Optional[str] = None
    ):
        """
        Initialize crypto utilities
        
        Args:
            private_key_pem: PEM-encoded RSA private key for signing
            cert_pem: PEM-encoded X.509 certificate for validation
            cert_serial: Certificate serial number (optional if cert_pem provided)
            
        Raises:
            CertificateError: If key/certificate loading fails
            SigningError: If private key loading fails
        """
        self.private_key = None
        self.certificate = None
        self.cert_metadata = None
        self.signing_count = 0  # Track number of signatures for audit
        
        # Load and validate certificate if provided
        if cert_pem:
            try:
                self.certificate = load_certificate_from_pem(cert_pem)
                self.cert_metadata = validate_certificate(self.certificate)
                self.cert_serial = self.cert_metadata["serial_number"]
                
                print(f"✅ Crypto: Certificate loaded - CN={self.cert_metadata['subject']['common_name']}, "
                      f"expires {self.cert_metadata['valid_until']}")
            except CertificateError:
                raise
            except Exception as e:
                raise CertificateError(
                    f"Failed to load certificate: {str(e)}",
                    {"error_type": type(e).__name__}
                )
        else:
            # Use provided cert_serial or default to mock
            self.cert_serial = cert_serial or "MOCK-CERT-001"
            print(f"⚠️ Crypto: No certificate provided - using mock serial {self.cert_serial}")
        
        # Load private key
        if private_key_pem:
            try:
                self.private_key = serialization.load_pem_private_key(
                    private_key_pem.encode('utf-8'),
                    password=None,
                    backend=default_backend()
                )
                print(f"✅ Crypto: Private key loaded successfully (Serial: {self.cert_serial})")
            except Exception as e:
                raise SigningError(
                    f"Failed to load private key: {str(e)}",
                    {"cert_serial": self.cert_serial, "error_type": type(e).__name__}
                )
    
    @staticmethod
    def generate_key_pair() -> tuple[str, str]:
        """
        Generate a new RSA key pair for development/testing
        
        Returns:
            tuple: (private_key_pem, public_key_pem)
        """
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')
        
        public_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
        
        return private_pem, public_pem
    
    @staticmethod
    def compute_hash(data: str, algorithm: str = "sha256") -> str:
        """
        Compute cryptographic hash of data
        
        Args:
            data: String data to hash
            algorithm: Hash algorithm (sha256, sha512)
            
        Returns:
            Hex-encoded hash string
            
        Raises:
            CryptoError: If hashing fails
        """
        try:
            if algorithm == "sha256":
                hash_obj = hashlib.sha256()
            elif algorithm == "sha512":
                hash_obj = hashlib.sha512()
            else:
                raise CryptoError(
                    f"Unsupported hash algorithm: {algorithm}",
                    {"supported": ["sha256", "sha512"]}
                )
            
            hash_obj.update(data.encode('utf-8'))
            return hash_obj.hexdigest()
        except CryptoError:
            raise
        except Exception as e:
            raise CryptoError(
                f"Hash computation failed: {str(e)}",
                {"algorithm": algorithm, "error_type": type(e).__name__}
            )
    
    def compute_invoice_hash(self, invoice_data: Dict[str, Any]) -> str:
        """
        Compute hash of invoice for hash chain
        
        Args:
            invoice_data: Dictionary containing invoice fields
            
        Returns:
            SHA-256 hash of canonicalized invoice data
        """
        # Create canonical representation of invoice
        # Include critical fields only for hash chain
        canonical_fields = [
            str(invoice_data.get('invoice_number', '')),
            str(invoice_data.get('issue_date', '')),
            str(invoice_data.get('supplier_trn', '')),
            str(invoice_data.get('customer_trn', '')),
            str(invoice_data.get('total_amount', '0.0')),
            str(invoice_data.get('tax_amount', '0.0')),
            str(invoice_data.get('prev_invoice_hash', ''))  # Chain to previous
        ]
        
        canonical_string = '|'.join(canonical_fields)
        return self.compute_hash(canonical_string)
    
    def sign_data(self, data: str) -> str:
        """
        Create digital signature of data
        
        Args:
            data: String data to sign
            
        Returns:
            Base64-encoded signature
            
        Raises:
            SigningError: If signing fails or no private key available
        """
        if not self.private_key:
            raise SigningError(
                "No private key available for signing",
                {"cert_serial": self.cert_serial}
            )
        
        try:
            signature = self.private_key.sign(
                data.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            self.signing_count += 1
            
            # Log signing operation (production: send to audit log)
            if self.signing_count % 100 == 0:
                print(f"📊 Crypto: {self.signing_count} signatures generated (Serial: {self.cert_serial})")
            
            return base64.b64encode(signature).decode('utf-8')
        
        except Exception as e:
            raise SigningError(
                f"Digital signature generation failed: {str(e)}",
                {"cert_serial": self.cert_serial, "error_type": type(e).__name__}
            )
    
    def sign_invoice(self, invoice_hash: str, xml_content: str) -> str:
        """
        Create digital signature of invoice
        
        Args:
            invoice_hash: Pre-computed invoice hash
            xml_content: UBL XML content
            
        Returns:
            Base64-encoded signature
            
        Raises:
            SigningError: If signing fails
        """
        try:
            # Sign combination of hash + XML hash for extra integrity
            xml_hash = self.compute_hash(xml_content)
            sign_data = f"{invoice_hash}|{xml_hash}"
            
            return self.sign_data(sign_data)
        except Exception as e:
            if isinstance(e, SigningError):
                raise
            raise SigningError(
                f"Invoice signature generation failed: {str(e)}",
                {"invoice_hash_preview": invoice_hash[:32] if invoice_hash else None}
            )
    
    @staticmethod
    def verify_signature(data: str, signature_b64: str, public_key_pem: str) -> bool:
        """
        Verify digital signature
        
        Args:
            data: Original data that was signed
            signature_b64: Base64-encoded signature
            public_key_pem: PEM-encoded public key
            
        Returns:
            True if signature is valid, False otherwise
            
        Note:
            Does not raise exceptions - returns False on any verification failure
        """
        try:
            public_key = serialization.load_pem_public_key(
                public_key_pem.encode('utf-8'),
                backend=default_backend()
            )
            
            signature = base64.b64decode(signature_b64)
            
            public_key.verify(
                signature,
                data.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception as e:
            # Log verification failure (production: send to audit log)
            print(f"⚠️ Crypto: Signature verification failed: {type(e).__name__}")
            return False
    
    def verify_hash_chain(self, current_invoice: Dict[str, Any], previous_invoice: Dict[str, Any]) -> bool:
        """
        Verify hash chain integrity between two invoices
        
        Args:
            current_invoice: Current invoice data
            previous_invoice: Previous invoice data
            
        Returns:
            True if chain is valid
        """
        # Compute hash of previous invoice
        prev_computed_hash = self.compute_invoice_hash(previous_invoice)
        
        # Check if current invoice's prev_hash matches
        current_prev_hash = current_invoice.get('prev_invoice_hash', '')
        
        return prev_computed_hash == current_prev_hash


def load_certificate_from_pem(cert_pem: str) -> x509.Certificate:
    """
    Load and validate X.509 certificate from PEM
    
    Args:
        cert_pem: PEM-encoded certificate
        
    Returns:
        X.509 certificate object
        
    Raises:
        CertificateError: If certificate loading or validation fails
    """
    try:
        cert = x509.load_pem_x509_certificate(
            cert_pem.encode('utf-8'),
            backend=default_backend()
        )
        return cert
    except Exception as e:
        raise CertificateError(
            f"Failed to load certificate: {str(e)}",
            {"error_type": type(e).__name__}
        )


def validate_certificate(cert: x509.Certificate) -> Dict[str, Any]:
    """
    Validate certificate and extract metadata
    
    Args:
        cert: X.509 certificate object
        
    Returns:
        Dictionary with certificate metadata
        
    Raises:
        CertificateError: If certificate is expired or invalid
    """
    now = datetime.utcnow()
    
    # Check expiry
    if cert.not_valid_after < now:
        raise CertificateError(
            "Certificate has expired",
            {
                "expired_at": cert.not_valid_after.isoformat(),
                "current_time": now.isoformat()
            }
        )
    
    if cert.not_valid_before > now:
        raise CertificateError(
            "Certificate not yet valid",
            {
                "valid_from": cert.not_valid_before.isoformat(),
                "current_time": now.isoformat()
            }
        )
    
    # Extract metadata
    try:
        subject = cert.subject
        issuer = cert.issuer
        
        metadata = {
            "serial_number": str(cert.serial_number),
            "subject": {
                "common_name": subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value if subject.get_attributes_for_oid(NameOID.COMMON_NAME) else None,
                "organization": subject.get_attributes_for_oid(NameOID.ORGANIZATION_NAME)[0].value if subject.get_attributes_for_oid(NameOID.ORGANIZATION_NAME) else None,
                "country": subject.get_attributes_for_oid(NameOID.COUNTRY_NAME)[0].value if subject.get_attributes_for_oid(NameOID.COUNTRY_NAME) else None,
            },
            "issuer": {
                "common_name": issuer.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value if issuer.get_attributes_for_oid(NameOID.COMMON_NAME) else None,
                "organization": issuer.get_attributes_for_oid(NameOID.ORGANIZATION_NAME)[0].value if issuer.get_attributes_for_oid(NameOID.ORGANIZATION_NAME) else None,
            },
            "valid_from": cert.not_valid_before.isoformat(),
            "valid_until": cert.not_valid_after.isoformat(),
            "days_until_expiry": (cert.not_valid_after - now).days
        }
        
        return metadata
    
    except Exception as e:
        raise CertificateError(
            f"Failed to extract certificate metadata: {str(e)}",
            {"error_type": type(e).__name__}
        )


def validate_environment_keys(fail_on_missing: bool = False) -> Dict[str, Any]:
    """
    Validate cryptographic keys in environment variables
    
    Args:
        fail_on_missing: If True, raises ConfigurationError when keys are missing
                        (required for production deployment)
    
    Returns:
        Dictionary with validation results
        
    Raises:
        ConfigurationError: If required keys are missing/invalid AND fail_on_missing=True
    """
    from .exceptions import ConfigurationError
    
    results = {
        "private_key_present": False,
        "certificate_present": False,
        "warnings": [],
        "mode": "production" if fail_on_missing else "development"
    }
    
    # Check for private key
    private_key_pem = os.getenv('SIGNING_PRIVATE_KEY_PEM')
    if private_key_pem:
        try:
            serialization.load_pem_private_key(
                private_key_pem.encode('utf-8'),
                password=None,
                backend=default_backend()
            )
            results["private_key_present"] = True
            print("✅ Environment: SIGNING_PRIVATE_KEY_PEM validated")
        except Exception as e:
            raise ConfigurationError(
                f"Invalid SIGNING_PRIVATE_KEY_PEM: {str(e)}",
                {"env_var": "SIGNING_PRIVATE_KEY_PEM"}
            )
    else:
        warning = "SIGNING_PRIVATE_KEY_PEM not set - using mock keys"
        results["warnings"].append(warning)
        print("⚠️ Environment: SIGNING_PRIVATE_KEY_PEM not set - using mock signing")
        
        if fail_on_missing:
            raise ConfigurationError(
                "SIGNING_PRIVATE_KEY_PEM is required for production deployment",
                {"env_var": "SIGNING_PRIVATE_KEY_PEM", "mode": "production"}
            )
    
    # Check for certificate
    cert_pem = os.getenv('SIGNING_CERTIFICATE_PEM')
    if cert_pem:
        try:
            cert = load_certificate_from_pem(cert_pem)
            cert_metadata = validate_certificate(cert)
            results["certificate_present"] = True
            results["certificate"] = cert_metadata
            
            # Warn if expiring soon
            if cert_metadata["days_until_expiry"] < 30:
                results["warnings"].append(
                    f"Certificate expires in {cert_metadata['days_until_expiry']} days!"
                )
                print(f"⚠️ Certificate: Expires in {cert_metadata['days_until_expiry']} days")
            else:
                print(f"✅ Certificate: Valid until {cert_metadata['valid_until']}")
        
        except CertificateError as e:
            raise ConfigurationError(
                f"Invalid SIGNING_CERTIFICATE_PEM: {e.message}",
                {"env_var": "SIGNING_CERTIFICATE_PEM", "details": e.details}
            )
    else:
        warning = "SIGNING_CERTIFICATE_PEM not set - using mock certificate"
        results["warnings"].append(warning)
        print("⚠️ Environment: SIGNING_CERTIFICATE_PEM not set - using mock certificate")
        
        if fail_on_missing:
            raise ConfigurationError(
                "SIGNING_CERTIFICATE_PEM is required for production deployment",
                {"env_var": "SIGNING_CERTIFICATE_PEM", "mode": "production"}
            )
    
    return results


# Singleton instance for easy access
_crypto_instance: Optional[InvoiceCrypto] = None


def get_crypto_instance(
    private_key_pem: Optional[str] = None,
    cert_pem: Optional[str] = None, 
    cert_serial: Optional[str] = None
) -> InvoiceCrypto:
    """
    Get or create crypto instance
    
    Args:
        private_key_pem: Optional PEM-encoded private key
        cert_pem: Optional PEM-encoded certificate
        cert_serial: Optional certificate serial number
        
    Returns:
        InvoiceCrypto instance
    """
    global _crypto_instance
    if _crypto_instance is None:
        # Try to load from environment if not provided
        if not private_key_pem:
            private_key_pem = os.getenv('SIGNING_PRIVATE_KEY_PEM')
        if not cert_pem:
            cert_pem = os.getenv('SIGNING_CERTIFICATE_PEM')
        
        _crypto_instance = InvoiceCrypto(private_key_pem, cert_pem, cert_serial)
    return _crypto_instance

"""
Automated tests for cryptographic validation and production mode enforcement

These tests ensure:
1. Production mode fails hard without signing keys/certificates
2. Development mode continues with warnings
3. Certificate expiry validation works correctly
4. Invalid certificates are rejected
"""
import os
import pytest
from datetime import datetime, timedelta
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

# Import modules to test
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.crypto_utils import (
    InvoiceCrypto,
    validate_environment_keys,
    load_certificate_from_pem,
    validate_certificate
)
from utils.exceptions import (
    ConfigurationError,
    CertificateError,
    SigningError
)


class TestProductionModeValidation:
    """Test production mode enforcement for signing keys and certificates"""
    
    def setup_method(self):
        """Clear environment variables before each test"""
        if 'SIGNING_PRIVATE_KEY_PEM' in os.environ:
            del os.environ['SIGNING_PRIVATE_KEY_PEM']
        if 'SIGNING_CERTIFICATE_PEM' in os.environ:
            del os.environ['SIGNING_CERTIFICATE_PEM']
    
    def test_production_mode_fails_without_private_key(self):
        """Production mode should raise ConfigurationError when private key is missing"""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_environment_keys(fail_on_missing=True)
        
        assert "SIGNING_PRIVATE_KEY_PEM is required" in exc_info.value.message
        assert exc_info.value.details["mode"] == "production"
    
    def test_production_mode_fails_without_certificate(self):
        """Production mode should raise ConfigurationError when certificate is missing"""
        # Set private key but not certificate
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
        
        os.environ['SIGNING_PRIVATE_KEY_PEM'] = private_pem
        
        with pytest.raises(ConfigurationError) as exc_info:
            validate_environment_keys(fail_on_missing=True)
        
        assert "SIGNING_CERTIFICATE_PEM is required" in exc_info.value.message
    
    def test_development_mode_continues_without_keys(self):
        """Development mode should continue with warnings when keys are missing"""
        result = validate_environment_keys(fail_on_missing=False)
        
        assert result["mode"] == "development"
        assert result["private_key_present"] is False
        assert result["certificate_present"] is False
        assert len(result["warnings"]) >= 2
        assert any("SIGNING_PRIVATE_KEY_PEM" in w for w in result["warnings"])
        assert any("SIGNING_CERTIFICATE_PEM" in w for w in result["warnings"])
    
    def test_production_mode_accepts_valid_keys(self):
        """Production mode should pass with valid keys and certificate"""
        # Generate test key pair
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        # Generate self-signed certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "AE"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "InvoLinks Test"),
            x509.NameAttribute(NameOID.COMMON_NAME, "test.involinks.ae"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        # Export to PEM
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')
        
        cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')
        
        os.environ['SIGNING_PRIVATE_KEY_PEM'] = private_pem
        os.environ['SIGNING_CERTIFICATE_PEM'] = cert_pem
        
        # Should not raise
        result = validate_environment_keys(fail_on_missing=True)
        
        assert result["mode"] == "production"
        assert result["private_key_present"] is True
        assert result["certificate_present"] is True
        assert "certificate" in result


class TestCertificateValidation:
    """Test certificate loading, validation, and expiry checking"""
    
    def generate_certificate(self, valid_days: int):
        """Helper to generate test certificate with specified validity"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "AE"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "InvoLinks Test"),
            x509.NameAttribute(NameOID.COMMON_NAME, "test.involinks.ae"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=valid_days)
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        return cert
    
    def test_certificate_expiry_detection(self):
        """Validate certificate expiry checking"""
        # Generate expired certificate
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "AE"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "InvoLinks Test"),
        ])
        
        expired_cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow() - timedelta(days=365)
        ).not_valid_after(
            datetime.utcnow() - timedelta(days=1)  # Expired yesterday
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        with pytest.raises(CertificateError) as exc_info:
            validate_certificate(expired_cert)
        
        assert "expired" in exc_info.value.message.lower()
    
    def test_certificate_expiry_warning(self):
        """Certificate expiring soon should trigger warning"""
        # Generate certificate expiring in 15 days
        cert = self.generate_certificate(valid_days=15)
        
        metadata = validate_certificate(cert)
        
        assert metadata["days_until_expiry"] < 30
        assert "days_until_expiry" in metadata
        assert metadata["days_until_expiry"] > 0
    
    def test_certificate_metadata_extraction(self):
        """Validate certificate metadata extraction"""
        cert = self.generate_certificate(valid_days=365)
        
        metadata = validate_certificate(cert)
        
        assert "serial_number" in metadata
        assert "subject" in metadata
        assert "issuer" in metadata
        assert "valid_from" in metadata
        assert "valid_until" in metadata
        assert "days_until_expiry" in metadata
        assert metadata["subject"]["common_name"] == "test.involinks.ae"
        assert metadata["subject"]["organization"] == "InvoLinks Test"
        assert metadata["subject"]["country"] == "AE"
    
    def test_invalid_pem_certificate(self):
        """Invalid PEM should raise CertificateError"""
        invalid_pem = "-----BEGIN CERTIFICATE-----\nINVALID\n-----END CERTIFICATE-----"
        
        with pytest.raises(CertificateError) as exc_info:
            load_certificate_from_pem(invalid_pem)
        
        assert "Failed to load certificate" in exc_info.value.message


class TestInvoiceCryptoInitialization:
    """Test InvoiceCrypto initialization with certificates"""
    
    def test_crypto_with_certificate(self):
        """InvoiceCrypto should load and validate certificate"""
        # Generate test key and certificate
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "AE"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "InvoLinks"),
            x509.NameAttribute(NameOID.COMMON_NAME, "involinks.ae"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')
        
        cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')
        
        # Initialize crypto with certificate
        crypto = InvoiceCrypto(private_pem, cert_pem)
        
        assert crypto.certificate is not None
        assert crypto.cert_metadata is not None
        assert crypto.private_key is not None
        assert crypto.cert_metadata["subject"]["common_name"] == "involinks.ae"
    
    def test_crypto_without_certificate_uses_mock(self):
        """InvoiceCrypto without certificate should use mock serial"""
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
        
        crypto = InvoiceCrypto(private_pem, cert_pem=None)
        
        assert crypto.certificate is None
        assert crypto.cert_metadata is None
        assert "MOCK-CERT" in crypto.cert_serial or crypto.cert_serial == "MOCK-CERT-001"
    
    def test_crypto_with_expired_certificate_fails(self):
        """InvoiceCrypto should reject expired certificates"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "AE"),
        ])
        
        expired_cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow() - timedelta(days=365)
        ).not_valid_after(
            datetime.utcnow() - timedelta(days=1)
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')
        
        cert_pem = expired_cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')
        
        with pytest.raises(CertificateError):
            InvoiceCrypto(private_pem, cert_pem)


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])

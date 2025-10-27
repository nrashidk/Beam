"""
Cryptographic Utilities for UAE FTA Compliance
Handles digital signatures, hash chains, and invoice integrity verification
"""
import hashlib
import base64
from datetime import datetime
from typing import Optional, Dict, Any
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from cryptography import x509


class InvoiceCrypto:
    """Handles cryptographic operations for invoice signing and verification"""
    
    def __init__(self, private_key_pem: Optional[str] = None, cert_serial: Optional[str] = None):
        """
        Initialize crypto utilities
        
        Args:
            private_key_pem: PEM-encoded RSA private key for signing
            cert_serial: Certificate serial number for audit trail
        """
        self.cert_serial = cert_serial
        self.private_key = None
        
        if private_key_pem:
            self.private_key = serialization.load_pem_private_key(
                private_key_pem.encode('utf-8'),
                password=None,
                backend=default_backend()
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
        """
        if algorithm == "sha256":
            hash_obj = hashlib.sha256()
        elif algorithm == "sha512":
            hash_obj = hashlib.sha512()
        else:
            raise ValueError(f"Unsupported hash algorithm: {algorithm}")
        
        hash_obj.update(data.encode('utf-8'))
        return hash_obj.hexdigest()
    
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
    
    def sign_data(self, data: str) -> Optional[str]:
        """
        Create digital signature of data
        
        Args:
            data: String data to sign
            
        Returns:
            Base64-encoded signature, or None if no private key
        """
        if not self.private_key:
            return None
        
        signature = self.private_key.sign(
            data.encode('utf-8'),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        return base64.b64encode(signature).decode('utf-8')
    
    def sign_invoice(self, invoice_hash: str, xml_content: str) -> Optional[str]:
        """
        Create digital signature of invoice
        
        Args:
            invoice_hash: Pre-computed invoice hash
            xml_content: UBL XML content
            
        Returns:
            Base64-encoded signature
        """
        # Sign combination of hash + XML hash for extra integrity
        xml_hash = self.compute_hash(xml_content)
        sign_data = f"{invoice_hash}|{xml_hash}"
        
        return self.sign_data(sign_data)
    
    @staticmethod
    def verify_signature(data: str, signature_b64: str, public_key_pem: str) -> bool:
        """
        Verify digital signature
        
        Args:
            data: Original data that was signed
            signature_b64: Base64-encoded signature
            public_key_pem: PEM-encoded public key
            
        Returns:
            True if signature is valid
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
        except Exception:
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


# Singleton instance for easy access
_crypto_instance: Optional[InvoiceCrypto] = None


def get_crypto_instance(private_key_pem: Optional[str] = None, cert_serial: Optional[str] = None) -> InvoiceCrypto:
    """Get or create crypto instance"""
    global _crypto_instance
    if _crypto_instance is None:
        _crypto_instance = InvoiceCrypto(private_key_pem, cert_serial)
    return _crypto_instance

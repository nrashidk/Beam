"""
Custom exception classes for structured error handling
Converts domain errors to HTTP-friendly responses
"""
from typing import Optional, Dict, Any


class InvoLinksException(Exception):
    """Base exception for all InvoLinks errors"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to structured error dict for API responses"""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "details": self.details
        }


class ValidationError(InvoLinksException):
    """Validation errors (400 Bad Request)"""
    http_status = 400


class InvoiceValidationError(ValidationError):
    """Invoice-specific validation errors"""
    pass


class CryptoError(InvoLinksException):
    """Cryptographic operation errors (500 Internal Server Error)"""
    http_status = 500


class SigningError(CryptoError):
    """Digital signature generation/verification errors"""
    pass


class CertificateError(CryptoError):
    """Certificate validation/loading errors"""
    pass


class XMLGenerationError(InvoLinksException):
    """UBL XML generation errors (500)"""
    http_status = 500


class PeppolError(InvoLinksException):
    """PEPPOL provider errors (502 Bad Gateway)"""
    http_status = 502


class PeppolProviderError(PeppolError):
    """PEPPOL provider API errors"""
    pass


class PeppolTransmissionError(PeppolError):
    """PEPPOL transmission failures"""
    pass


class ConfigurationError(InvoLinksException):
    """Configuration/environment errors (500)"""
    http_status = 500


def exception_to_http_response(exc: InvoLinksException) -> Dict[str, Any]:
    """
    Convert domain exception to HTTP response dict
    
    Returns:
        {
            "status_code": int,
            "detail": {
                "error": str,
                "message": str,
                "details": dict
            }
        }
    """
    return {
        "status_code": getattr(exc, 'http_status', 500),
        "detail": exc.to_dict()
    }

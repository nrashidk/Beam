"""
PEPPOL Provider Adapter for E-Invoice Transmission
Supports multiple accredited providers (Tradeshift, Basware, etc.)
"""
import json
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum


class PeppolStatus(str, Enum):
    """PEPPOL transmission status codes"""
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class PeppolProvider:
    """Base class for PEPPOL provider integrations"""
    
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        """
        Initialize PEPPOL provider client
        
        Args:
            base_url: Provider API base URL
            api_key: Provider API authentication key
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.client = httpx.Client(timeout=timeout)
    
    def send_invoice(
        self,
        invoice_xml: str,
        invoice_number: str,
        sender_id: str,
        receiver_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send invoice via PEPPOL network
        
        Args:
            invoice_xml: UBL XML content
            invoice_number: Invoice number for reference
            sender_id: Sender's PEPPOL participant ID
            receiver_id: Receiver's PEPPOL participant ID
            metadata: Additional metadata
            
        Returns:
            Dictionary containing:
            - success: bool
            - message_id: str (provider's tracking ID)
            - status: str
            - response: dict (full provider response)
            - error: str (if failed)
        """
        raise NotImplementedError("Subclass must implement send_invoice")
    
    def get_status(self, message_id: str) -> Dict[str, Any]:
        """
        Get delivery status of a sent invoice
        
        Args:
            message_id: Provider's message tracking ID
            
        Returns:
            Dictionary with status information
        """
        raise NotImplementedError("Subclass must implement get_status")
    
    def validate_participant_id(self, participant_id: str) -> bool:
        """
        Validate if participant ID exists in PEPPOL network
        
        Args:
            participant_id: PEPPOL participant ID to validate
            
        Returns:
            True if participant exists
        """
        raise NotImplementedError("Subclass must implement validate_participant_id")


class TradeshiftProvider(PeppolProvider):
    """Tradeshift PEPPOL provider implementation"""
    
    def send_invoice(
        self,
        invoice_xml: str,
        invoice_number: str,
        sender_id: str,
        receiver_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send invoice via Tradeshift API"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/xml',
                'X-Tradeshift-SenderID': sender_id,
                'X-Tradeshift-ReceiverID': receiver_id,
                'X-Tradeshift-DocumentType': 'invoice',
                'X-Tradeshift-DocumentID': invoice_number
            }
            
            response = self.client.post(
                f'{self.base_url}/tradeshift/rest/external/documents',
                content=invoice_xml.encode('utf-8'),
                headers=headers
            )
            
            if response.status_code == 201:
                result = response.json()
                return {
                    'success': True,
                    'message_id': result.get('documentId'),
                    'status': PeppolStatus.SENT.value,
                    'response': result,
                    'provider': 'tradeshift',
                    'sent_at': datetime.utcnow().isoformat()
                }
            else:
                return {
                    'success': False,
                    'error': f'Tradeshift API error: {response.status_code} - {response.text}',
                    'status': PeppolStatus.FAILED.value,
                    'provider': 'tradeshift'
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Exception sending to Tradeshift: {str(e)}',
                'status': PeppolStatus.FAILED.value,
                'provider': 'tradeshift'
            }
    
    def get_status(self, message_id: str) -> Dict[str, Any]:
        """Get invoice status from Tradeshift"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }
            
            response = self.client.get(
                f'{self.base_url}/tradeshift/rest/external/documents/{message_id}/state',
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'status': result.get('state', PeppolStatus.PENDING.value),
                    'details': result
                }
            else:
                return {
                    'success': False,
                    'error': f'Status check failed: {response.status_code}'
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Exception checking status: {str(e)}'
            }
    
    def validate_participant_id(self, participant_id: str) -> bool:
        """Validate participant ID with Tradeshift"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }
            
            response = self.client.get(
                f'{self.base_url}/tradeshift/rest/external/network/directory/{participant_id}',
                headers=headers
            )
            
            return response.status_code == 200
        
        except Exception:
            return False


class BaswareProvider(PeppolProvider):
    """Basware PEPPOL provider implementation"""
    
    def send_invoice(
        self,
        invoice_xml: str,
        invoice_number: str,
        sender_id: str,
        receiver_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send invoice via Basware API"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/xml'
            }
            
            payload = {
                'senderIdentifier': sender_id,
                'receiverIdentifier': receiver_id,
                'documentType': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
                'documentContent': invoice_xml
            }
            
            response = self.client.post(
                f'{self.base_url}/basware/api/v1/documents',
                json=payload,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                return {
                    'success': True,
                    'message_id': result.get('documentId'),
                    'status': PeppolStatus.SENT.value,
                    'response': result,
                    'provider': 'basware',
                    'sent_at': datetime.utcnow().isoformat()
                }
            else:
                return {
                    'success': False,
                    'error': f'Basware API error: {response.status_code} - {response.text}',
                    'status': PeppolStatus.FAILED.value,
                    'provider': 'basware'
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Exception sending to Basware: {str(e)}',
                'status': PeppolStatus.FAILED.value,
                'provider': 'basware'
            }
    
    def get_status(self, message_id: str) -> Dict[str, Any]:
        """Get invoice status from Basware"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }
            
            response = self.client.get(
                f'{self.base_url}/basware/api/v1/documents/{message_id}/status',
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'status': result.get('status', PeppolStatus.PENDING.value),
                    'details': result
                }
            else:
                return {
                    'success': False,
                    'error': f'Status check failed: {response.status_code}'
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Exception checking status: {str(e)}'
            }
    
    def validate_participant_id(self, participant_id: str) -> bool:
        """Validate participant ID with Basware"""
        # Basware validation logic
        return True  # Simplified for now


class MockPeppolProvider(PeppolProvider):
    """Mock PEPPOL provider for testing without real API"""
    
    def __init__(self):
        """Initialize mock provider (no API credentials needed)"""
        super().__init__(base_url="http://mock", api_key="mock-key")
        self.sent_invoices: Dict[str, Dict[str, Any]] = {}
    
    def send_invoice(
        self,
        invoice_xml: str,
        invoice_number: str,
        sender_id: str,
        receiver_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Mock send - always succeeds"""
        message_id = f"MOCK-{invoice_number}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        self.sent_invoices[message_id] = {
            'invoice_number': invoice_number,
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'xml_length': len(invoice_xml),
            'sent_at': datetime.utcnow().isoformat(),
            'status': PeppolStatus.SENT.value
        }
        
        print(f"\n{'='*70}")
        print(f"📤 MOCK PEPPOL TRANSMISSION")
        print(f"{'='*70}")
        print(f"Message ID: {message_id}")
        print(f"Invoice: {invoice_number}")
        print(f"From: {sender_id}")
        print(f"To: {receiver_id}")
        print(f"XML Size: {len(invoice_xml)} bytes")
        print(f"Status: ✅ SENT (Mock)")
        print(f"{'='*70}\n")
        
        return {
            'success': True,
            'message_id': message_id,
            'status': PeppolStatus.SENT.value,
            'response': self.sent_invoices[message_id],
            'provider': 'mock',
            'sent_at': datetime.utcnow().isoformat()
        }
    
    def get_status(self, message_id: str) -> Dict[str, Any]:
        """Mock status check"""
        if message_id in self.sent_invoices:
            return {
                'success': True,
                'status': PeppolStatus.DELIVERED.value,
                'details': self.sent_invoices[message_id]
            }
        else:
            return {
                'success': False,
                'error': 'Message ID not found'
            }
    
    def validate_participant_id(self, participant_id: str) -> bool:
        """Mock validation - always returns True"""
        return True


class PeppolProviderFactory:
    """Factory to create appropriate PEPPOL provider instance"""
    
    @staticmethod
    def create_provider(
        provider_name: str,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = 30
    ) -> PeppolProvider:
        """
        Create PEPPOL provider instance
        
        Args:
            provider_name: "tradeshift", "basware", or "mock"
            base_url: Provider API base URL
            api_key: Provider API key
            timeout: Request timeout
            
        Returns:
            PeppolProvider instance
        """
        provider_name = provider_name.lower()
        
        if provider_name == "mock":
            return MockPeppolProvider()
        
        elif provider_name == "tradeshift":
            if not base_url or not api_key:
                raise ValueError("Tradeshift requires base_url and api_key")
            return TradeshiftProvider(base_url, api_key, timeout)
        
        elif provider_name == "basware":
            if not base_url or not api_key:
                raise ValueError("Basware requires base_url and api_key")
            return BaswareProvider(base_url, api_key, timeout)
        
        else:
            raise ValueError(f"Unknown provider: {provider_name}. Use 'tradeshift', 'basware', or 'mock'")


# Convenience functions
def send_invoice_via_peppol(
    invoice_xml: str,
    invoice_number: str,
    sender_id: str,
    receiver_id: str,
    provider_name: str = "mock",
    base_url: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send invoice via PEPPOL network
    
    Returns:
        Transmission result dictionary
    """
    provider = PeppolProviderFactory.create_provider(
        provider_name=provider_name,
        base_url=base_url,
        api_key=api_key
    )
    
    return provider.send_invoice(
        invoice_xml=invoice_xml,
        invoice_number=invoice_number,
        sender_id=sender_id,
        receiver_id=receiver_id
    )

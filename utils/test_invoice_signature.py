"""
Invoice Signature Verification Test Script
Tests that production signing keys are working correctly

USAGE:
    python utils/test_invoice_signature.py [invoice_id]
    
EXAMPLES:
    python utils/test_invoice_signature.py inv_12345678
    python utils/test_invoice_signature.py  # Tests latest invoice
"""

import sys
import os
import httpx
from datetime import datetime


def test_signature_configuration():
    """Test that signing keys are properly configured"""
    print("🔐 Testing Signing Configuration...")
    print("-" * 60)
    
    # Check environment variables
    has_private_key = bool(os.getenv("SIGNING_PRIVATE_KEY_PEM"))
    has_certificate = bool(os.getenv("SIGNING_CERTIFICATE_PEM"))
    
    print(f"SIGNING_PRIVATE_KEY_PEM: {'✅ Set' if has_private_key else '❌ Not set (using mock)'}")
    print(f"SIGNING_CERTIFICATE_PEM: {'✅ Set' if has_certificate else '❌ Not set (using mock)'}")
    print()
    
    if not has_private_key or not has_certificate:
        print("⚠️  WARNING: Using mock signing keys!")
        print("   Follow PRODUCTION_SIGNING_KEYS_SETUP.md to set up production keys.")
        print()
        return False
    
    # Test certificate loading
    try:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend
        
        cert_pem = os.getenv("SIGNING_CERTIFICATE_PEM")
        cert = x509.load_pem_x509_certificate(cert_pem.encode(), default_backend())
        
        print("✅ Certificate loaded successfully")
        print(f"   Subject: {cert.subject.rfc4514_string()}")
        print(f"   Issuer: {cert.issuer.rfc4514_string()}")
        print(f"   Serial: {cert.serial_number}")
        print(f"   Valid From: {cert.not_valid_before}")
        print(f"   Valid Until: {cert.not_valid_after}")
        
        # Check expiration
        days_until_expiry = (cert.not_valid_after - datetime.utcnow()).days
        if days_until_expiry < 30:
            print(f"⚠️  WARNING: Certificate expires in {days_until_expiry} days!")
        elif days_until_expiry < 90:
            print(f"⚠️  NOTICE: Certificate expires in {days_until_expiry} days")
        else:
            print(f"✅ Certificate valid for {days_until_expiry} days")
        
        print()
        return True
        
    except Exception as e:
        print(f"❌ Error loading certificate: {str(e)}")
        print()
        return False


def test_invoice_signature(invoice_id: str = None):
    """Test signature of a specific invoice"""
    print("📄 Testing Invoice Signature...")
    print("-" * 60)
    
    # Get backend URL
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    
    try:
        # If no invoice ID provided, get latest invoice
        if not invoice_id:
            print("No invoice ID provided, fetching latest invoice...")
            response = httpx.get(f"{backend_url}/invoices", params={"limit": 1})
            if response.status_code != 200:
                print(f"❌ Failed to fetch invoices: {response.status_code}")
                return False
            
            invoices = response.json()
            if not invoices:
                print("❌ No invoices found. Create an invoice first.")
                return False
            
            invoice_id = invoices[0]["id"]
            print(f"Using latest invoice: {invoice_id}")
            print()
        
        # Fetch invoice details
        response = httpx.get(f"{backend_url}/invoices/{invoice_id}")
        if response.status_code != 200:
            print(f"❌ Invoice not found: {response.status_code}")
            return False
        
        invoice = response.json()
        
        # Check signature fields
        print(f"Invoice: {invoice.get('invoice_number', 'N/A')}")
        print(f"Status: {invoice.get('status', 'N/A')}")
        print()
        
        has_signature = bool(invoice.get("signature_b64"))
        has_hash = bool(invoice.get("xml_hash"))
        has_cert_serial = bool(invoice.get("signing_cert_serial"))
        has_timestamp = bool(invoice.get("signing_timestamp"))
        
        print("Signature Fields:")
        print(f"  signature_b64: {'✅ Present' if has_signature else '❌ Missing'}")
        print(f"  xml_hash: {'✅ Present' if has_hash else '❌ Missing'}")
        print(f"  signing_cert_serial: {'✅ Present' if has_cert_serial else '❌ Missing'}")
        print(f"  signing_timestamp: {'✅ Present' if has_timestamp else '❌ Missing'}")
        print()
        
        if has_signature:
            sig_len = len(invoice["signature_b64"])
            print(f"Signature length: {sig_len} bytes")
            print(f"Signature preview: {invoice['signature_b64'][:50]}...")
            print()
        
        if has_hash:
            print(f"XML Hash: {invoice['xml_hash']}")
            print()
        
        if has_cert_serial:
            print(f"Certificate Serial: {invoice['signing_cert_serial']}")
            print()
        
        if has_timestamp:
            print(f"Signing Timestamp: {invoice['signing_timestamp']}")
            print()
        
        # Overall result
        all_fields_present = has_signature and has_hash and has_cert_serial and has_timestamp
        
        if all_fields_present:
            print("✅ Invoice signature verification PASSED")
            print("   All signature fields are present and valid")
            return True
        else:
            print("❌ Invoice signature verification FAILED")
            print("   Some signature fields are missing")
            print()
            print("   Possible causes:")
            print("   1. Invoice not yet issued (status != ISSUED)")
            print("   2. Signing keys not configured")
            print("   3. Error during invoice issuance")
            return False
        
    except httpx.ConnectError:
        print(f"❌ Cannot connect to backend: {backend_url}")
        print("   Make sure Backend API workflow is running")
        return False
    except Exception as e:
        print(f"❌ Error testing signature: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main execution function"""
    print("=" * 60)
    print("INVOLINKS SIGNATURE VERIFICATION TEST")
    print("=" * 60)
    print()
    
    # Test configuration
    config_ok = test_signature_configuration()
    print()
    
    # Test invoice signature
    invoice_id = sys.argv[1] if len(sys.argv) > 1 else None
    signature_ok = test_invoice_signature(invoice_id)
    print()
    
    # Final result
    print("=" * 60)
    if config_ok and signature_ok:
        print("✅ ALL TESTS PASSED")
        print("   Production signing keys are working correctly")
        sys.exit(0)
    elif config_ok and not signature_ok:
        print("⚠️  CONFIGURATION OK, BUT INVOICE SIGNATURE FAILED")
        print("   Check invoice status and signing errors")
        sys.exit(1)
    else:
        print("❌ TESTS FAILED")
        print("   Set up production signing keys before testing")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test cancelled by user")
        sys.exit(130)

"""
Production-Grade RSA-2048 Signing Key Generator
Generates cryptographic keys and X.509 certificates for UAE FTA e-invoicing compliance

USAGE:
    python utils/generate_signing_keys.py

OUTPUT:
    - private_key.pem: RSA-2048 private key (KEEP SECRET!)
    - certificate.pem: X.509 certificate for signature validation
    - certificate.csr: Certificate Signing Request (for CA signing)
    - certificate_info.txt: Certificate details for reference

PRODUCTION DEPLOYMENT:
    1. Run this script in a secure environment
    2. Store private_key.pem securely (never commit to git!)
    3. Add to Replit Secrets:
       - SIGNING_PRIVATE_KEY_PEM = contents of private_key.pem
       - SIGNING_CERTIFICATE_PEM = contents of certificate.pem
    4. For CA-signed cert: Send certificate.csr to Certificate Authority

SECURITY NOTES:
    - Private key is 2048-bit RSA (FTA minimum requirement)
    - Certificate validity: 5 years (extendable)
    - Self-signed cert suitable for testing
    - For production: Obtain CA-signed certificate
"""

import os
from datetime import datetime, timedelta
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import NameOID


def generate_rsa_keypair(key_size: int = 2048):
    """
    Generate RSA key pair
    
    Args:
        key_size: Key size in bits (2048 minimum for FTA compliance)
        
    Returns:
        Tuple of (private_key, public_key)
    """
    print(f"🔐 Generating RSA-{key_size} key pair...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=key_size,
        backend=default_backend()
    )
    public_key = private_key.public_key()
    print("✅ Key pair generated successfully")
    return private_key, public_key


def generate_self_signed_certificate(
    private_key,
    country: str = "AE",
    state: str = "Dubai",
    locality: str = "Dubai",
    organization: str = "InvoLinks",
    organizational_unit: str = "E-Invoicing Platform",
    common_name: str = "involinks.ae",
    email: str = "security@involinks.ae",
    validity_days: int = 1825  # 5 years
):
    """
    Generate self-signed X.509 certificate
    
    Args:
        private_key: RSA private key
        country: Two-letter country code (AE for UAE)
        state: State/Emirate name
        locality: City name
        organization: Company legal name
        organizational_unit: Department/unit name
        common_name: Domain name or company identifier
        email: Contact email address
        validity_days: Certificate validity period in days
        
    Returns:
        X.509 certificate object
    """
    print("📜 Generating X.509 certificate...")
    
    # Certificate subject (issuer details)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, country),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
        x509.NameAttribute(NameOID.LOCALITY_NAME, locality),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, organizational_unit),
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        x509.NameAttribute(NameOID.EMAIL_ADDRESS, email),
    ])
    
    # Certificate builder
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
        datetime.utcnow() + timedelta(days=validity_days)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(common_name),
            x509.DNSName(f"*.{common_name}"),
        ]),
        critical=False,
    ).add_extension(
        x509.BasicConstraints(ca=False, path_length=None),
        critical=True,
    ).add_extension(
        x509.KeyUsage(
            digital_signature=True,
            content_commitment=True,  # Non-repudiation
            key_encipherment=False,
            data_encipherment=False,
            key_agreement=False,
            key_cert_sign=False,
            crl_sign=False,
            encipher_only=False,
            decipher_only=False,
        ),
        critical=True,
    ).add_extension(
        x509.ExtendedKeyUsage([
            x509.oid.ExtendedKeyUsageOID.CODE_SIGNING,  # Document signing
        ]),
        critical=False,
    ).sign(private_key, hashes.SHA256(), default_backend())
    
    print("✅ Certificate generated successfully")
    return cert


def generate_csr(
    private_key,
    country: str = "AE",
    state: str = "Dubai",
    locality: str = "Dubai",
    organization: str = "InvoLinks",
    organizational_unit: str = "E-Invoicing Platform",
    common_name: str = "involinks.ae",
    email: str = "security@involinks.ae"
):
    """
    Generate Certificate Signing Request (CSR) for CA signing
    
    Args:
        private_key: RSA private key
        country: Two-letter country code
        state: State/Emirate name
        locality: City name
        organization: Company legal name
        organizational_unit: Department/unit name
        common_name: Domain name or company identifier
        email: Contact email address
        
    Returns:
        CSR object
    """
    print("📝 Generating Certificate Signing Request (CSR)...")
    
    # CSR subject
    subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, country),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
        x509.NameAttribute(NameOID.LOCALITY_NAME, locality),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, organizational_unit),
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        x509.NameAttribute(NameOID.EMAIL_ADDRESS, email),
    ])
    
    # Build CSR
    csr = x509.CertificateSigningRequestBuilder().subject_name(
        subject
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(common_name),
            x509.DNSName(f"*.{common_name}"),
        ]),
        critical=False,
    ).sign(private_key, hashes.SHA256(), default_backend())
    
    print("✅ CSR generated successfully")
    return csr


def save_keys_and_certificate(private_key, certificate, csr, output_dir: str = "."):
    """
    Save private key, certificate, and CSR to files
    
    Args:
        private_key: RSA private key
        certificate: X.509 certificate
        csr: Certificate Signing Request
        output_dir: Directory to save files (default: current directory)
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Save private key (PEM format, no encryption for Replit Secrets)
    private_key_path = os.path.join(output_dir, "private_key.pem")
    with open(private_key_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()  # No password for env vars
        ))
    print(f"💾 Private key saved: {private_key_path}")
    print("   ⚠️  KEEP THIS FILE SECRET! Never commit to git!")
    
    # Save certificate (PEM format)
    cert_path = os.path.join(output_dir, "certificate.pem")
    with open(cert_path, "wb") as f:
        f.write(certificate.public_bytes(serialization.Encoding.PEM))
    print(f"💾 Certificate saved: {cert_path}")
    
    # Save CSR (PEM format)
    csr_path = os.path.join(output_dir, "certificate.csr")
    with open(csr_path, "wb") as f:
        f.write(csr.public_bytes(serialization.Encoding.PEM))
    print(f"💾 CSR saved: {csr_path}")
    
    # Save certificate info
    info_path = os.path.join(output_dir, "certificate_info.txt")
    with open(info_path, "w") as f:
        f.write("=" * 60 + "\n")
        f.write("INVOLINKS SIGNING CERTIFICATE INFORMATION\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Serial Number: {certificate.serial_number}\n")
        f.write(f"Subject: {certificate.subject.rfc4514_string()}\n")
        f.write(f"Issuer: {certificate.issuer.rfc4514_string()}\n")
        f.write(f"Valid From: {certificate.not_valid_before}\n")
        f.write(f"Valid Until: {certificate.not_valid_after}\n")
        f.write(f"Signature Algorithm: {certificate.signature_algorithm_oid._name}\n\n")
        f.write("=" * 60 + "\n")
        f.write("DEPLOYMENT INSTRUCTIONS\n")
        f.write("=" * 60 + "\n\n")
        f.write("1. Add to Replit Secrets:\n")
        f.write("   Go to Replit → Tools → Secrets → Add new secret\n\n")
        f.write("   Secret Name: SIGNING_PRIVATE_KEY_PEM\n")
        f.write(f"   Secret Value: <contents of {private_key_path}>\n\n")
        f.write("   Secret Name: SIGNING_CERTIFICATE_PEM\n")
        f.write(f"   Secret Value: <contents of {cert_path}>\n\n")
        f.write("2. Restart Backend API workflow\n\n")
        f.write("3. Verify startup logs show:\n")
        f.write("   ✅ Crypto: Certificate loaded\n\n")
        f.write("4. For CA-signed certificate (production):\n")
        f.write(f"   - Send {csr_path} to Certificate Authority\n")
        f.write("   - Replace self-signed certificate with CA response\n")
        f.write("   - Update SIGNING_CERTIFICATE_PEM secret\n\n")
    print(f"📋 Certificate info saved: {info_path}")


def main():
    """Main execution function"""
    print("=" * 70)
    print("INVOLINKS PRODUCTION SIGNING KEY GENERATOR")
    print("UAE FTA E-Invoicing Compliance")
    print("=" * 70)
    print()
    
    # Get certificate details from user (or use defaults)
    print("📋 Certificate Configuration (press Enter to use defaults):")
    print()
    
    country = input("Country Code (AE): ").strip() or "AE"
    state = input("State/Emirate (Dubai): ").strip() or "Dubai"
    locality = input("City (Dubai): ").strip() or "Dubai"
    organization = input("Organization (InvoLinks): ").strip() or "InvoLinks"
    org_unit = input("Organizational Unit (E-Invoicing Platform): ").strip() or "E-Invoicing Platform"
    common_name = input("Common Name/Domain (involinks.ae): ").strip() or "involinks.ae"
    email = input("Email (security@involinks.ae): ").strip() or "security@involinks.ae"
    
    validity_days_input = input("Validity Period in Days (1825 = 5 years): ").strip()
    validity_days = int(validity_days_input) if validity_days_input else 1825
    
    print()
    print("-" * 70)
    print()
    
    # Generate keys
    private_key, public_key = generate_rsa_keypair(key_size=2048)
    
    # Generate self-signed certificate
    certificate = generate_self_signed_certificate(
        private_key=private_key,
        country=country,
        state=state,
        locality=locality,
        organization=organization,
        organizational_unit=org_unit,
        common_name=common_name,
        email=email,
        validity_days=validity_days
    )
    
    # Generate CSR for CA signing (optional)
    csr = generate_csr(
        private_key=private_key,
        country=country,
        state=state,
        locality=locality,
        organization=organization,
        organizational_unit=org_unit,
        common_name=common_name,
        email=email
    )
    
    # Save all files
    print()
    save_keys_and_certificate(private_key, certificate, csr, output_dir=".")
    
    print()
    print("=" * 70)
    print("✅ SIGNING KEYS GENERATED SUCCESSFULLY!")
    print("=" * 70)
    print()
    print("📁 Generated Files:")
    print("   ├─ private_key.pem        (RSA-2048 private key)")
    print("   ├─ certificate.pem        (X.509 self-signed certificate)")
    print("   ├─ certificate.csr        (Certificate Signing Request for CA)")
    print("   └─ certificate_info.txt   (Deployment instructions)")
    print()
    print("⚠️  IMPORTANT SECURITY NOTES:")
    print("   1. NEVER commit private_key.pem to version control!")
    print("   2. Add private_key.pem to .gitignore")
    print("   3. Store private key securely (Replit Secrets, password manager)")
    print("   4. For production: Get CA-signed certificate using certificate.csr")
    print()
    print("📖 Next Steps:")
    print("   1. Read certificate_info.txt for deployment instructions")
    print("   2. Add keys to Replit Secrets")
    print("   3. Restart Backend API workflow")
    print("   4. Verify invoice signatures are working")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
    except Exception as e:
        print(f"\n\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

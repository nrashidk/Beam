# KMS/HSM Integration Architecture
## Migrating from PEM Keys to Managed Key Services

**Status**: Planning / Future Enhancement  
**Priority**: High (Post-MVP)  
**Target Timeline**: Q2 2026

---

## Executive Summary

This document outlines the migration path from PEM-based cryptographic keys (stored in environment variables) to Hardware Security Module (HSM) and Key Management Service (KMS) solutions for production-grade security and compliance.

**Current State**: RSA-2048 private keys and X.509 certificates stored as PEM in Replit Secrets  
**Target State**: Keys managed by cloud HSM/KMS with automatic rotation and audit trails

---

## Table of Contents

1. [Objectives](#objectives)
2. [Comparison of KMS Providers](#comparison-of-kms-providers)
3. [Recommended Architecture](#recommended-architecture)
4. [Migration Strategy](#migration-strategy)
5. [Implementation Phases](#implementation-phases)
6. [Security Benefits](#security-benefits)
7. [Cost Analysis](#cost-analysis)
8. [Operational Impact](#operational-impact)

---

## Objectives

### Business Objectives
- **Compliance**: Meet UAE FTA requirements for secure key storage
- **Security**: Protect private keys from unauthorized access and exfiltration
- **Auditability**: Maintain comprehensive logs of all cryptographic operations
- **Scalability**: Support multi-tenant key management for enterprise customers

### Technical Objectives
- **Key Isolation**: Private keys never leave HSM boundary
- **Automatic Rotation**: Scheduled key and certificate rotation
- **Disaster Recovery**: Automated key backup and recovery procedures
- **Zero Downtime**: Seamless migration without service disruption

---

## Comparison of KMS Providers

### AWS KMS (CloudHSM)

**Strengths:**
- ✅ FIPS 140-2 Level 3 validated HSMs
- ✅ Seamless integration with AWS services
- ✅ Automatic key rotation (configurable)
- ✅ Extensive audit logging via CloudTrail
- ✅ Multi-region replication for DR
- ✅ Pay-per-operation pricing

**Considerations:**
- ⚠️ Vendor lock-in to AWS ecosystem
- ⚠️ Requires VPC configuration for CloudHSM
- ⚠️ Learning curve for IAM policies

**Use Case**: Best for AWS-native deployments

**Pricing**:
- CloudHSM: $1.60/hour per HSM (~$1,168/month)
- AWS KMS: $1/month per key + $0.03 per 10,000 operations
- Recommended: AWS KMS for most use cases

### Azure Key Vault

**Strengths:**
- ✅ FIPS 140-2 Level 2 (Standard) or Level 3 (Premium HSM)
- ✅ Native integration with Azure AD
- ✅ Managed HSM tier for dedicated HSMs
- ✅ Certificate lifecycle management
- ✅ Global presence in UAE (Azure UAE North region)

**Considerations:**
- ⚠️ Premium HSM tier more expensive
- ⚠️ Rate limiting on operations (Standard tier)
- ⚠️ Certificate management can be complex

**Use Case**: Best for Azure-native or UAE-local deployments

**Pricing**:
- Standard: ~$0.03 per 10,000 operations
- Premium (HSM): ~$1/month per key + operation costs
- Managed HSM: ~$2.50/hour (~$1,825/month)

### Google Cloud KMS

**Strengths:**
- ✅ FIPS 140-2 Level 3 (Cloud HSM)
- ✅ Automatic key rotation
- ✅ Global key availability
- ✅ Integrated with Google Cloud services
- ✅ Transparent pricing

**Considerations:**
- ⚠️ Limited UAE regional presence
- ⚠️ Smaller ecosystem compared to AWS/Azure
- ⚠️ Certificate management requires additional setup

**Use Case**: Best for GCP-native deployments

**Pricing**:
- Software keys: $0.06 per key version/month
- HSM keys: $1/month per active key version
- Operations: $0.03 per 10,000 operations

### HashiCorp Vault

**Strengths:**
- ✅ Cloud-agnostic (works with any provider)
- ✅ Open-source core with enterprise features
- ✅ Excellent secrets management beyond just keys
- ✅ Dynamic secrets generation
- ✅ Flexible deployment (self-hosted or cloud)

**Considerations:**
- ⚠️ Requires operational expertise to run
- ⚠️ Self-hosted adds infrastructure overhead
- ⚠️ HSM support only in Enterprise tier

**Use Case**: Best for multi-cloud or on-premises deployments

**Pricing**:
- Open Source: Free (self-hosted)
- Enterprise: Contact HashiCorp (typically $150k+/year)
- HCP Vault: $0.03 per secret per month

---

## Recommended Architecture

### Phase 1: AWS KMS Integration (Recommended)

**Rationale**: AWS offers the best balance of security, features, and cost for InvoLinks.

```
┌─────────────────────────────────────────────────────────────────┐
│                         InvoLinks Application                    │
│                         (Replit / EC2)                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ AWS SDK
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                           AWS KMS                                │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │  Customer Master  │  │  Certificate      │                  │
│  │  Key (CMK)        │  │  Storage (S3)     │                  │
│  │  RSA-2048         │  │  X.509 Certs      │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                  │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │  Key Rotation     │  │  Audit Logging    │                  │
│  │  Policy (Annual)  │  │  (CloudTrail)     │                  │
│  └───────────────────┘  └───────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **Customer Master Key (CMK)**
   - Asymmetric RSA-2048 key for invoice signing
   - Managed by AWS KMS
   - Never exported from HSM

2. **Certificate Storage**
   - X.509 certificates stored in S3 (encrypted at rest)
   - Certificate metadata in DynamoDB
   - Automatic expiry monitoring

3. **Key Rotation**
   - Automatic annual rotation (configurable)
   - Old keys retained for signature verification
   - Zero-downtime rotation process

4. **Audit Trail**
   - All signing operations logged to CloudTrail
   - Integration with AWS Security Hub
   - Real-time alerts for anomalous activity

### Implementation Architecture

```python
# Proposed crypto_utils.py refactor

from typing import Optional
import boto3
from botocore.exceptions import ClientError

class KMSInvoiceCrypto:
    """KMS-backed invoice cryptography"""
    
    def __init__(
        self, 
        kms_key_id: str,
        region_name: str = "me-south-1",  # Bahrain (closest to UAE)
        use_local_fallback: bool = False
    ):
        """
        Initialize KMS crypto utilities
        
        Args:
            kms_key_id: AWS KMS key ID or ARN
            region_name: AWS region for KMS
            use_local_fallback: Use local PEM keys if KMS unavailable (dev only)
        """
        self.kms_client = boto3.client('kms', region_name=region_name)
        self.kms_key_id = kms_key_id
        self.use_local_fallback = use_local_fallback
        
        # Verify KMS key exists and is enabled
        self._verify_kms_key()
    
    def sign_data(self, data: str) -> str:
        """
        Sign data using KMS
        
        Uses KMS Sign API - private key never leaves HSM
        """
        try:
            response = self.kms_client.sign(
                KeyId=self.kms_key_id,
                Message=data.encode('utf-8'),
                MessageType='RAW',
                SigningAlgorithm='RSASSA_PSS_SHA_256'
            )
            
            return base64.b64encode(response['Signature']).decode('utf-8')
        
        except ClientError as e:
            if self.use_local_fallback:
                # Fallback to local PEM signing (dev only)
                return self._sign_with_pem(data)
            raise SigningError(f"KMS signing failed: {str(e)}")
    
    def _verify_kms_key(self):
        """Verify KMS key is accessible and enabled"""
        try:
            response = self.kms_client.describe_key(KeyId=self.kms_key_id)
            if response['KeyMetadata']['KeyState'] != 'Enabled':
                raise ConfigurationError(
                    f"KMS key {self.kms_key_id} is not enabled",
                    {"key_state": response['KeyMetadata']['KeyState']}
                )
        except ClientError as e:
            raise ConfigurationError(
                f"Cannot access KMS key: {str(e)}",
                {"key_id": self.kms_key_id}
            )
```

---

## Migration Strategy

### Migration Principles

1. **Zero Downtime**: Rolling deployment with gradual cutover
2. **Dual Signing**: Parallel operation of PEM and KMS during transition
3. **Backward Compatibility**: Continue verifying old PEM signatures
4. **Rollback Ready**: Ability to revert to PEM if issues arise

### Migration Phases

#### Phase 0: Preparation (2 weeks)
- Set up AWS account and IAM roles
- Provision KMS keys in test environment
- Update crypto_utils.py with KMS support (feature flag)
- Create integration tests for KMS signing

#### Phase 1: Staging Deployment (2 weeks)
- Deploy KMS-enabled code to staging
- Run dual-signing (both PEM and KMS)
- Compare signatures for consistency
- Performance testing (latency, throughput)

#### Phase 2: Canary Production (1 week)
- Enable KMS for 10% of production traffic
- Monitor error rates and latency
- Collect operational metrics
- Validate audit logs

#### Phase 3: Full Production (1 week)
- Gradually increase KMS traffic to 100%
- Disable PEM signing (keep for verification)
- Archive PEM keys securely
- Update documentation and runbooks

#### Phase 4: Cleanup (1 week)
- Remove PEM fallback code
- Delete PEM keys from Secrets (after retention period)
- Enable automatic key rotation
- Finalize monitoring and alerting

**Total Timeline**: 6-8 weeks

---

## Security Benefits

### Current PEM Approach Risks
- ❌ Private keys exist in plaintext memory
- ❌ Keys can be exfiltrated via memory dumps
- ❌ No HSM-level protection
- ❌ Manual key rotation required
- ❌ Limited audit trail

### KMS Approach Benefits
- ✅ Private keys never leave HSM
- ✅ FIPS 140-2 Level 3 hardware protection
- ✅ Automatic key rotation
- ✅ Comprehensive audit logging (CloudTrail)
- ✅ Fine-grained access control (IAM policies)
- ✅ Compliance with security standards (PCI DSS, SOC 2)

### Compliance Impact

**UAE FTA Requirements:**
- ✅ Secure key storage: **Met** (HSM-backed)
- ✅ Audit trail: **Met** (CloudTrail logs)
- ✅ Key rotation: **Met** (Automatic)
- ✅ Multi-factor authorization: **Met** (IAM MFA)

**Additional Standards:**
- **PCI DSS**: KMS meets key management requirements
- **SOC 2**: Audit logs support compliance evidence
- **ISO 27001**: HSM aligns with information security controls

---

## Cost Analysis

### Current Costs (PEM Approach)
- Storage: $0 (environment variables)
- Operations: $0 (local signing)
- Management: ~4 hours/year (manual rotation)

**Total**: ~$200/year (labor cost)

### Projected Costs (KMS Approach)

**AWS KMS Option A: Software Keys**
- Key storage: $1/month × 1 key = $12/year
- Operations: 10,000 signatures/day × 365 days = 3.65M/year
  - Cost: (3.65M / 10,000) × $0.03 = $10.95/year
- Total: **~$23/year**

**AWS KMS Option B: HSM Keys (Recommended)**
- Key storage: $1/month × 1 key = $12/year  
- Operations: Same as above = $10.95/year
- Total: **~$23/year**

**AWS CloudHSM Option (Enterprise)**
- HSM instances: $1.60/hour × 24 × 365 = $14,016/year
- Operations: Included
- Total: **~$14,000/year**

### Recommendation
- **Start**: AWS KMS with HSM-backed keys (**~$23/year**)
- **Scale**: Upgrade to CloudHSM if >1M signatures/day or dedicated HSM required

**ROI**: Minimal cost increase ($23 vs $200) with massive security improvement

---

## Operational Impact

### Performance Considerations

**Latency:**
- Current PEM signing: ~5-10ms (local)
- KMS signing: ~50-100ms (network call)
- Mitigation: Batch signing, async workers

**Throughput:**
- KMS limits: 1,200 requests/second (software keys)
- CloudHSM: 10,000+ requests/second
- Current needs: ~10-50 requests/second

**Verdict**: KMS is sufficient for current and projected scale

### Availability & Disaster Recovery

**KMS SLA**: 99.99% (AWS)
- Downtime: ~52 minutes/year
- Multi-region replication available

**Disaster Recovery:**
- Automatic key backups by AWS
- Key material never at risk
- Instant failover to secondary region

### Monitoring & Alerting

**Key Metrics to Monitor:**
- KMS API latency (p50, p95, p99)
- Signing operation success rate
- Key rotation events
- Access denied attempts (security)
- Certificate expiry warnings

**Alerting:**
- PagerDuty integration for KMS failures
- CloudWatch alarms for latency spikes
- Security alerts for unauthorized access attempts

---

## Implementation Phases

### Phase 1: Infrastructure Setup

**Tasks:**
1. Create AWS account (or use existing)
2. Set up IAM roles and policies
3. Provision KMS key in `me-south-1` (Bahrain)
4. Configure CloudTrail logging
5. Set up S3 bucket for certificate storage

**IAM Policy Example:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:DescribeKey",
        "kms:GetPublicKey"
      ],
      "Resource": "arn:aws:kms:me-south-1:ACCOUNT_ID:key/KEY_ID"
    }
  ]
}
```

### Phase 2: Code Integration

**Tasks:**
1. Create `KMSInvoiceCrypto` class
2. Add feature flag: `USE_KMS_SIGNING`
3. Implement dual-signing mode
4. Add KMS-specific error handling
5. Update unit tests

**Configuration:**
```bash
# Environment variables
export USE_KMS_SIGNING=true
export AWS_KMS_KEY_ID=arn:aws:kms:me-south-1:...
export AWS_REGION=me-south-1
export KMS_FALLBACK_TO_PEM=false  # Disable in production
```

### Phase 3: Testing & Validation

**Test Matrix:**
- ✅ KMS signing produces valid RSA-PSS signatures
- ✅ Signatures verifiable with public key
- ✅ Performance within SLA (< 200ms p95)
- ✅ Error handling for KMS failures
- ✅ Fallback to PEM (dev only)
- ✅ Audit logs captured in CloudTrail

### Phase 4: Production Deployment

**Deployment Steps:**
1. Deploy code with `USE_KMS_SIGNING=false`
2. Enable feature flag for 10% of traffic
3. Monitor for 48 hours
4. Gradually increase to 100%
5. Disable PEM signing after 1 month validation period

### Phase 5: Operational Handoff

**Documentation:**
- Update `PRODUCTION_RUNBOOK.md` with KMS procedures
- Create runbooks for KMS key rotation
- Document incident response for KMS outages
- Train operations team on KMS management

**Monitoring:**
- Set up CloudWatch dashboards
- Configure PagerDuty alerts
- Establish on-call rotation for KMS incidents

---

## Alternative: Multi-Cloud Strategy

For high availability and vendor independence:

```
┌─────────────────────────────────────────────────────────────────┐
│                     InvoLinks Application                        │
└─────────────┬───────────────────────────┬───────────────────────┘
              │                           │
              ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │   AWS KMS       │         │  Azure Key      │
    │   (Primary)     │         │  Vault (Backup) │
    │   me-south-1    │         │  uaenorth       │
    └─────────────────┘         └─────────────────┘
```

**Benefits:**
- Resilience against single provider outage
- Compliance with data residency (UAE)
- Vendor negotiation leverage

**Challenges:**
- Increased complexity
- Higher operational overhead
- Double the cost

**Recommendation**: Single-cloud (AWS) for MVP, evaluate multi-cloud for enterprise tier

---

## Decision Matrix

| Criterion | PEM (Current) | AWS KMS | CloudHSM | Azure Key Vault | HashiCorp Vault |
|-----------|--------------|---------|----------|-----------------|-----------------|
| **Security** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Cost** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Compliance** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **UAE Presence** | N/A | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Scalability** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Final Recommendation**: **AWS KMS** for Phase 1, re-evaluate CloudHSM when reaching 100k+ signatures/day

---

## Next Steps

1. **Immediate (Q4 2025)**:
   - Continue using PEM with production hardening ✅
   - Complete Tier 2 improvements (C14N, XSD validation)

2. **Planning (Q1 2026)**:
   - Evaluate KMS providers
   - Get budget approval
   - Design detailed migration plan

3. **Implementation (Q2 2026)**:
   - Set up AWS KMS infrastructure
   - Develop KMS integration code
   - Test in staging environment

4. **Production (Q3 2026)**:
   - Gradual rollout to production
   - Monitor and optimize
   - Document lessons learned

---

## Appendices

### Appendix A: KMS Provider Comparison Table

| Feature | AWS KMS | Azure Key Vault | Google Cloud KMS | HashiCorp Vault |
|---------|---------|-----------------|------------------|-----------------|
| FIPS 140-2 Level | 3 (CloudHSM) | 2/3 (Premium) | 3 (Cloud HSM) | 3 (Enterprise + HSM) |
| UAE Region | ⚠️ Bahrain | ✅ UAE North | ❌ No | ✅ Self-hosted |
| Auto Rotation | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Pricing Model | Pay-per-use | Pay-per-use | Pay-per-use | License + hosting |
| Audit Logging | CloudTrail | Monitor | Cloud Audit Logs | Self-managed |

### Appendix B: Estimated Timeline

```
Month 1-2: Planning & Setup
├─ Week 1-2: Provider evaluation
├─ Week 3-4: AWS account setup
└─ Week 5-8: Infrastructure provisioning

Month 3-4: Development & Testing
├─ Week 9-12: Code implementation
├─ Week 13-14: Unit testing
└─ Week 15-16: Integration testing

Month 5-6: Deployment
├─ Week 17-18: Staging deployment
├─ Week 19-20: Canary production
├─ Week 21-22: Full production
└─ Week 23-24: Cleanup & documentation
```

### Appendix C: References

- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [Azure Key Vault Documentation](https://docs.microsoft.com/en-us/azure/key-vault/)
- [UAE FTA E-Invoice Guidelines](https://tax.gov.ae/en/eservices/services/einvoice.aspx)
- [FIPS 140-2 Security Requirements](https://csrc.nist.gov/publications/detail/fips/140/2/final)

---

**Document Owner**: InvoLinks Security Team  
**Review Cycle**: Quarterly  
**Next Review**: January 2026

# Contributing to InvoLinks

Thank you for your interest in contributing to InvoLinks! This document provides guidelines and standards for contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Testing Guidelines](#testing-guidelines)
6. [Commit Messages](#commit-messages)
7. [Pull Request Process](#pull-request-process)
8. [Documentation](#documentation)
9. [Bug Reports](#bug-reports)
10. [Feature Requests](#feature-requests)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, gender, gender identity and expression, sexual orientation, disability, personal appearance, race, ethnicity, age, religion, or nationality.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

- **Python 3.11+** installed
- **Node.js 20+** and npm installed
- **PostgreSQL 14+** (or use provided database)
- **Git** for version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
```bash
git clone https://github.com/YOUR_USERNAME/InvoLinks.git
cd InvoLinks
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/involinks/InvoLinks.git
```

### Installation

1. **Backend Setup:**
```bash
# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

2. **Frontend Setup:**
```bash
# Install Node dependencies
npm install
```

3. **Run the Application:**
```bash
# Terminal 1: Backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
npm run dev
```

4. **Verify Installation:**
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:5000

---

## Development Workflow

### Branch Strategy

We use a simplified Git Flow:

```
main (production)
  └── develop (integration branch)
       ├── feature/your-feature-name
       ├── bugfix/issue-123-description
       └── hotfix/critical-fix
```

### Creating a Feature Branch

```bash
# Update develop branch
git checkout develop
git pull upstream develop

# Create feature branch
git checkout -b feature/add-pdf-generation

# Make your changes...

# Push to your fork
git push origin feature/add-pdf-generation
```

### Branch Naming Conventions

- **Features:** `feature/short-description` (e.g., `feature/pdf-invoices`)
- **Bug Fixes:** `bugfix/issue-number-description` (e.g., `bugfix/123-trn-validation`)
- **Hotfixes:** `hotfix/critical-issue` (e.g., `hotfix/security-patch`)
- **Documentation:** `docs/update-readme` (e.g., `docs/api-examples`)

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream develop into your develop
git checkout develop
git merge upstream/develop

# Push to your fork
git push origin develop
```

---

## Code Standards

### Python (Backend)

#### Style Guide

Follow **PEP 8** with these specifics:

```python
# Imports (grouped and sorted)
import os
import sys
from datetime import datetime
from typing import List, Dict, Optional

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import Column, String, Integer
from pydantic import BaseModel

from utils.crypto_utils import InvoiceCrypto

# Constants (UPPER_CASE)
MAX_INVOICE_ITEMS = 100
DEFAULT_VAT_RATE = 5.0

# Functions (snake_case)
def generate_invoice_number(company_id: str, db: Session) -> str:
    """
    Generate sequential invoice number for company.
    
    Args:
        company_id: Unique company identifier
        db: Database session
        
    Returns:
        Invoice number in format INV-{prefix}-{sequence}
    """
    # Implementation...
    pass

# Classes (PascalCase)
class InvoiceCreate(BaseModel):
    """Request model for invoice creation"""
    customer_name: str
    customer_trn: Optional[str] = None
    issue_date: str
    line_items: List[InvoiceLineItem]
```

#### Type Hints

Always use type hints:

```python
# Good
def calculate_tax(amount: float, rate: float) -> float:
    return amount * (rate / 100)

# Bad
def calculate_tax(amount, rate):
    return amount * (rate / 100)
```

#### Docstrings

Use Google-style docstrings:

```python
def send_invoice_via_peppol(
    invoice_id: str,
    provider_name: str,
    db: Session
) -> Dict[str, Any]:
    """
    Send invoice via PEPPOL network.
    
    This function loads the invoice UBL XML, selects the appropriate
    PEPPOL provider, and transmits the invoice electronically.
    
    Args:
        invoice_id: Unique invoice identifier
        provider_name: PEPPOL provider ('tradeshift', 'basware', 'mock')
        db: Database session for loading invoice
        
    Returns:
        Dictionary containing:
            - message_id: PEPPOL transmission ID
            - status: Transmission status ('SENT', 'DELIVERED')
            - sent_at: Timestamp of transmission
            
    Raises:
        HTTPException: If invoice not found or provider unavailable
        
    Example:
        >>> result = send_invoice_via_peppol('inv_123', 'tradeshift', db)
        >>> print(result['message_id'])
        'TSHIFT-MSG-20251028-001'
    """
    # Implementation...
```

#### Error Handling

```python
# Use specific exceptions
from utils.exceptions import SigningError, CryptoError

try:
    signature = crypto.sign_invoice(invoice_hash, xml_content)
except SigningError as e:
    logger.error(f"Signing failed: {e}")
    raise HTTPException(500, f"Invoice signing failed: {str(e)}")
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(500, "Internal server error")
```

### JavaScript/React (Frontend)

#### Style Guide

Follow **Airbnb JavaScript Style Guide** with ESLint:

```javascript
// Components (PascalCase)
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function InvoiceList({ companyId }) {
  // State hooks
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Effects
  useEffect(() => {
    fetchInvoices();
  }, [companyId]);
  
  // Functions (camelCase)
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/invoices');
      setInvoices(response.data.invoices);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Render
  return (
    <div className="invoice-list">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {invoices.map(invoice => (
            <li key={invoice.id}>{invoice.invoice_number}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

#### Component Organization

```javascript
// 1. Imports
import React from 'react';
import PropTypes from 'prop-types';
import { useContent } from '../contexts/ContentContext';

// 2. Component
function FeatureBox({ title, description, icon }) {
  const content = useContent();
  
  return (
    <div className="feature-box">
      {icon && <span className="icon">{icon}</span>}
      <h3>{content(title)}</h3>
      <p>{content(description)}</p>
    </div>
  );
}

// 3. PropTypes
FeatureBox.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node,
};

// 4. Default props
FeatureBox.defaultProps = {
  icon: null,
};

// 5. Export
export default FeatureBox;
```

#### Hooks

```javascript
// Custom hooks (use prefix)
function useInvoices(companyId) {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const { data } = await axios.get(`/invoices?company_id=${companyId}`);
        setInvoices(data.invoices);
      } catch (err) {
        setError(err.message);
      }
    };
    
    loadInvoices();
  }, [companyId]);
  
  return { invoices, error };
}
```

---

## Testing Guidelines

### Backend Tests (Python)

We use **pytest** for backend testing:

```python
# tests/test_invoice_validation.py
import pytest
from utils.ubl_xml_generator import UBLXMLGenerator

def test_trn_validation():
    """Test TRN must be exactly 15 numeric digits"""
    # Valid TRN
    assert validate_trn("123456789012345") == True
    
    # Invalid TRNs
    assert validate_trn("12345678901234") == False  # Too short
    assert validate_trn("1234567890123456") == False  # Too long
    assert validate_trn("12345678901234A") == False  # Contains letter

def test_invoice_hash_chain():
    """Test hash chain links correctly"""
    crypto = InvoiceCrypto()
    
    # Create first invoice
    invoice1 = {"invoice_number": "INV-001", "total": 1000.00}
    hash1 = crypto.compute_invoice_hash(invoice1, prev_hash="GENESIS")
    
    # Create second invoice
    invoice2 = {"invoice_number": "INV-002", "total": 2000.00}
    hash2 = crypto.compute_invoice_hash(invoice2, prev_hash=hash1)
    
    # Verify chain
    assert crypto.verify_chain(invoice1, invoice2) == True
```

#### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=utils --cov=main

# Run specific test file
pytest tests/test_invoice_validation.py

# Run with verbose output
pytest -v
```

### Frontend Tests (Future)

```bash
# When implemented
npm test
```

---

## Commit Messages

### Format

Follow **Conventional Commits** specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation only changes
- **style:** Code style changes (formatting, no logic change)
- **refactor:** Code refactoring (no new features or bug fixes)
- **perf:** Performance improvement
- **test:** Adding or updating tests
- **chore:** Build process, dependency updates

### Examples

```bash
# Feature
git commit -m "feat(invoices): add PDF generation with QR code"

# Bug fix
git commit -m "fix(validation): correct TRN validation regex pattern"

# Documentation
git commit -m "docs(api): add curl examples for invoice endpoints"

# Refactor
git commit -m "refactor(crypto): extract certificate validation to separate function"

# Breaking change
git commit -m "feat(auth): migrate to OAuth2 with scopes

BREAKING CHANGE: JWT token structure has changed.
Clients must update authentication flow."
```

### Best Practices

- Use imperative mood ("add" not "added")
- Keep subject line under 50 characters
- Capitalize first letter of subject
- No period at end of subject
- Separate subject from body with blank line
- Wrap body at 72 characters
- Explain *what* and *why*, not *how*

---

## Pull Request Process

### Before Submitting

1. **Update from upstream:**
```bash
git fetch upstream
git rebase upstream/develop
```

2. **Run tests:**
```bash
pytest
npm test  # When available
```

3. **Check code style:**
```bash
# Python
black main.py utils/
flake8 main.py utils/

# JavaScript
npm run lint
```

4. **Update documentation** if needed

### PR Title Format

Use the same format as commit messages:

```
feat(invoices): Add PDF generation with QR code
fix(auth): Correct password reset token expiry
docs(readme): Update installation instructions
```

### PR Description Template

```markdown
## Description
Brief summary of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] My code follows the code style of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Screenshots (if applicable)
[Add screenshots here]

## Related Issues
Closes #123
Relates to #456
```

### Review Process

1. **Automated checks** must pass (linting, tests)
2. **Code review** by at least 1 maintainer
3. **Changes requested** → Make updates → Re-request review
4. **Approved** → Squash and merge to develop

---

## Documentation

### When to Update Documentation

Update documentation when you:
- Add new features
- Change API endpoints
- Modify database schema
- Update environment variables
- Change deployment process

### Documentation Files

- **README.md:** Overview, features, installation
- **docs/API.md:** Endpoint documentation with examples
- **docs/TECHNICAL_SPECIFICATIONS.md:** Database schema, validation rules
- **docs/ARCHITECTURE.md:** System design, data flows
- **CONTRIBUTING.md:** This file

### Inline Code Comments

```python
# Good: Explain WHY
# Use Base64 encoding for signature storage to ensure compatibility
# with JSON serialization and database text fields
signature_b64 = base64.b64encode(signature).decode('utf-8')

# Bad: Explain WHAT (obvious from code)
# Encode signature to base64
signature_b64 = base64.b64encode(signature).decode('utf-8')
```

---

## Bug Reports

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Try the latest version** from `develop` branch
3. **Verify it's not a configuration issue**

### Bug Report Template

```markdown
## Bug Description
A clear and concise description of what the bug is.

## To Reproduce
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Actual Behavior
What actually happened.

## Screenshots
If applicable, add screenshots to help explain your problem.

## Environment
- OS: [e.g., macOS, Windows, Linux]
- Browser: [e.g., Chrome 118, Safari 17]
- InvoLinks Version: [e.g., v1.0.0, commit hash]
- Python Version: [e.g., 3.11.5]
- Node.js Version: [e.g., 20.10.0]

## Additional Context
Add any other context about the problem here.

## Error Logs
```
Paste relevant error logs here
```
```

---

## Feature Requests

### Before Requesting

1. **Check existing feature requests** to avoid duplicates
2. **Verify it aligns with project goals** (UAE e-invoicing compliance)
3. **Consider submitting a PR** if you can implement it

### Feature Request Template

```markdown
## Feature Description
A clear and concise description of what you want to happen.

## Problem Statement
What problem does this feature solve?

## Proposed Solution
How would you like this feature to work?

## Alternatives Considered
What alternative solutions have you considered?

## Use Case
Describe a realistic use case for this feature.

## Additional Context
Add any other context, mockups, or examples.

## Implementation Notes (Optional)
If you have technical implementation ideas, share them here.
```

---

## Project-Specific Guidelines

### UAE Compliance

When working on compliance features:

1. **Consult FTA specifications** before implementing
2. **Test with sample data** from FTA documentation
3. **Document compliance rationale** in code comments
4. **Update TECHNICAL_SPECIFICATIONS.md** with compliance details

### Digital Signatures & Cryptography

- **Never commit private keys** to version control
- **Use environment variables** for sensitive configuration
- **Follow industry standards** (RSA-2048, SHA-256)
- **Document cryptographic decisions** in code

### PEPPOL Integration

- **Use the provider adapter pattern** for new providers
- **Mock provider** for testing (don't hit real APIs in tests)
- **Handle network failures gracefully**
- **Log transmission attempts** for audit trail

---

## Questions?

- **Technical Questions:** Open a GitHub Discussion
- **Bug Reports:** Open a GitHub Issue
- **Feature Requests:** Open a GitHub Issue with [FEATURE] tag
- **Security Issues:** Email security@involinks.ae (DO NOT open public issue)

---

## License

By contributing to InvoLinks, you agree that your contributions will be licensed under the MIT License.

---

## Acknowledgments

Thank you to all contributors who help make InvoLinks better! 🎉

---

**Last Updated:** October 28, 2025  
**Maintained By:** InvoLinks Development Team

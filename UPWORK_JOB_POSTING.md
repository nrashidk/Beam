# Upwork Job Posting: UAE Digital Invoicing Platform - Code Review, Bug Fixes & Completion

## Project Title
**Full-Stack Developer Needed: Code Review, Bug Fixes & Feature Completion for UAE E-Invoicing SaaS Platform**

---

## Project Overview
This is a comprehensive digital invoicing platform designed specifically for UAE businesses. The platform provides automated, VAT-compliant e-invoicing, subscription management, payment processing, and accounts payable management following the UAE 5-Corner model.

**Current Status:** 80% complete with core features implemented but requiring professional code review, bug fixes, testing, and completion of remaining functionality.

---

## Technical Stack

### Frontend
- React 19.2 with Vite 7.1
- React Router 7.9 for navigation
- Tailwind CSS 3.4 for styling
- Axios for API communication
- Recharts for analytics visualization
- Radix UI component library
- date-fns for date handling

### Backend
- FastAPI 2.0 (Python async)
- PostgreSQL database
- SQLAlchemy 2.0.36 ORM
- JWT authentication with bcrypt
- CORS enabled
- Email integration (AWS SES)
- SMS delivery (Twilio)

### Infrastructure
- Deployed on Replit (Reserved VM/Always-On)
- Environment variable configuration
- Multi-workflow setup (Backend API + Frontend)

---

## Scope of Work

### 1. **Code Review & Quality Assessment**
**Deliverables:**
- Comprehensive code review report identifying:
  - Security vulnerabilities
  - Performance bottlenecks
  - Code quality issues
  - Anti-patterns and technical debt
  - Missing error handling
  - Database query optimization opportunities
- Prioritized list of critical vs. nice-to-have fixes
- Estimated effort for each identified issue

### 2. **Bug Fixes & Error Resolution**

**Critical Bugs to Fix:**
- Authentication/authorization edge cases
- Payment processing errors
- Invoice generation failures
- File upload validation issues
- Email delivery failures
- Database connection handling
- Session management bugs
- CORS configuration issues
- Frontend routing problems
- API endpoint errors (404s, 500s)

**Requirements:**
- Fix all console errors (frontend and backend)
- Resolve all LSP/TypeScript/Python type errors
- Handle edge cases and null/undefined states
- Add proper error messages for user-facing errors
- Implement retry logic for external API calls

### 3. **Database Migration & Setup**

**Tasks:**
- Migrate from SQLite (development) to PostgreSQL (production)
- Create proper database migration system using Alembic or similar
- Set up database connection pooling
- Implement database backup strategy
- Add proper indexes for performance
- Create seed data scripts for testing
- Document database schema

**Deliverable:** Production-ready PostgreSQL setup with migrations

### 4. **Feature Completion**

**Incomplete Features Requiring Completion:**
- Multi-Factor Authentication (MFA) - Complete TOTP, Email OTP, Backup Codes implementation
- Payment Verification & Reconciliation system
- Bulk CSV/Excel import for invoices and vendors
- PDF Invoice generation with proper formatting
- UAE FTA Audit File generation (FAF format)
- PEPPOL integration (provider adapter implementation)
- Digital signature verification
- Hash chain validation
- Advanced analytics dashboard
- Company branding customization (logo upload, colors, fonts)
- Team member invitation system
- Email templates for all notification types

**Requirements:**
- Complete all half-implemented features
- Add proper validation and error handling
- Write unit tests for new functionality
- Update documentation

### 5. **Testing & Quality Assurance**

**Required Testing:**
- Unit tests for critical backend functions (pytest)
- Frontend component tests (React Testing Library)
- Integration tests for API endpoints
- End-to-end tests for critical user flows:
  - User registration and email verification
  - Company approval workflow
  - Invoice creation and delivery
  - Payment processing
  - Subscription upgrade/downgrade
  - Team member management
- Performance testing for database queries
- Load testing for concurrent users
- Security testing (SQL injection, XSS, CSRF)

**Deliverables:**
- Test coverage report (minimum 70% coverage)
- All tests passing
- Test documentation

### 6. **Security Hardening**

**Tasks:**
- Implement rate limiting on API endpoints
- Add input sanitization for all user inputs
- Secure file upload validation
- Implement CSRF protection
- Add SQL injection prevention verification
- Secure password reset flow
- Add audit logging for sensitive operations
- Implement API key rotation for external services
- Add security headers (HSTS, CSP, etc.)
- Review and secure all environment variables

**Deliverable:** Security audit report and fixes

### 7. **Performance Optimization**

**Tasks:**
- Optimize database queries (add indexes, reduce N+1 queries)
- Implement caching strategy (Redis if needed)
- Frontend bundle size optimization
- Lazy loading for routes and components
- Image optimization and CDN setup
- API response time optimization (target: <200ms)
- Implement pagination for large datasets
- Add database connection pooling

**Deliverable:** Performance report showing improvements

### 8. **Documentation**

**Required Documentation:**
- API documentation (OpenAPI/Swagger already configured)
- Database schema documentation
- Deployment guide
- Environment variables reference
- Feature documentation for each module
- User guide for Super Admin functions
- Developer onboarding guide
- Testing guide
- Security best practices document

### 9. **Deployment & DevOps**

**Tasks:**
- Set up proper production environment configuration
- Configure environment-specific settings (dev/staging/production)
- Implement proper logging system
- Set up error tracking (Sentry or similar)
- Configure automated backups
- Create deployment checklist
- Document rollback procedures
- Set up monitoring and alerting

### 10. **UAE Compliance Verification**

**Critical Requirements:**
- Verify UAE e-Invoicing compliance (UBL 2.1 / PINT-AE)
- Implement proper VAT calculations (5% standard rate)
- TRN (Tax Registration Number) validation
- Digital signature implementation
- Hash chain for invoice integrity
- QR code generation for invoices
- Invoice XML generation and validation
- FTA audit file format compliance

---

## Specific Technical Requirements

### Must Fix Issues:
1. **Frontend routing** - Ensure all routes work on direct navigation and refresh
2. **Authentication persistence** - Fix token refresh and session management
3. **File uploads** - Implement secure file upload with size limits and validation
4. **Email delivery** - Verify all email templates work correctly
5. **Payment integration** - Complete Stripe integration with proper error handling
6. **Invoice PDF generation** - Professional PDF with UAE branding requirements
7. **Multi-tenancy** - Ensure proper data isolation between companies
8. **Role-based access control** - Verify RBAC works correctly for all user types
9. **Subscription management** - Complete tier limits and upgrade/downgrade flows
10. **Error handling** - Global error handler with user-friendly messages

### Code Quality Requirements:
- Follow PEP 8 for Python code
- Follow React best practices and hooks patterns
- Proper TypeScript/JSDoc type annotations
- Consistent code formatting (Prettier for JS, Black for Python)
- No console.log statements in production code
- Proper error boundaries in React
- Async/await error handling
- Input validation on both frontend and backend

---

## Deliverables

### Week 1-2: Assessment & Planning
- Comprehensive code review report
- Bug list with priorities
- Completion estimate for all tasks
- Project plan with milestones

### Week 3-4: Critical Fixes
- All critical bugs fixed
- Security vulnerabilities resolved
- Database migrated to PostgreSQL
- Authentication/authorization working perfectly

### Week 5-6: Feature Completion
- All incomplete features completed
- Testing suite implemented
- Documentation updated

### Week 7-8: Polish & Deployment
- Performance optimization complete
- Production deployment ready
- All tests passing
- Final documentation delivered

---

## Success Criteria

### Technical Success:
✅ Zero console errors in browser and backend logs  
✅ All API endpoints return proper responses (no 500 errors)  
✅ 70%+ test coverage with all tests passing  
✅ Page load time < 2 seconds  
✅ API response time < 200ms average  
✅ Handles 100+ concurrent users  
✅ Database properly indexed and optimized  
✅ Security audit passes with no critical issues  

### Functional Success:
✅ Complete user registration and approval workflow  
✅ Invoice creation, PDF generation, and delivery working  
✅ Payment processing (Stripe) fully functional  
✅ Subscription management (free → paid upgrades) working  
✅ Multi-user team management operational  
✅ Email notifications sending correctly  
✅ File uploads (CSV, Excel, images) working  
✅ Analytics dashboard displaying accurate data  
✅ UAE compliance features (VAT, TRN, signatures) verified  

### Business Success:
✅ Platform is production-ready and deployable  
✅ No data loss or corruption  
✅ Proper backups configured  
✅ Monitoring and alerting set up  
✅ Documentation complete for handoff  

---

## Required Skills

### Must Have:
- **5+ years** full-stack development experience
- **Expert** in React.js and modern frontend development
- **Expert** in Python and FastAPI
- **Strong** PostgreSQL/SQL database skills
- **Experience** with payment processing (Stripe preferred)
- **Experience** with authentication/authorization (JWT, OAuth)
- **Experience** with SaaS multi-tenancy architecture
- **Strong** understanding of security best practices
- **Experience** with testing frameworks (pytest, Jest, React Testing Library)
- **Excellent** debugging and problem-solving skills

### Nice to Have:
- UAE business/invoicing domain knowledge
- Experience with e-invoicing standards (UBL, PINT)
- Experience with Replit platform
- AWS services experience (SES, S3)
- DevOps/deployment experience
- Previous SaaS platform development

---

## Project Details

**Duration:** 6-8 weeks (flexible based on availability)  
**Budget:** Fixed price or hourly (please provide estimate)  
**Commitment:** 30-40 hours per week preferred  
**Communication:** Daily updates via Slack/Discord  
**Time Zone:** Flexible, but overlap with UAE time (GMT+4) preferred  

---

## Application Requirements

Please include in your proposal:
1. **Relevant experience** - Links to similar projects you've completed
2. **Technical approach** - Brief outline of how you'd tackle this project
3. **Estimated timeline** - Realistic timeframe for completion
4. **Questions** - Any clarifications you need about the project
5. **Rate/Budget** - Your hourly rate or fixed-price proposal
6. **Availability** - Hours per week you can commit
7. **References** - Previous clients who can vouch for your work

---

## How to Apply

**First Steps:**
1. Review the codebase (GitHub link will be provided to shortlisted candidates)
2. Provide a brief assessment of the current state
3. Outline your proposed approach
4. Provide timeline and budget estimate

**Selection Process:**
1. Initial proposal review (shortlist top 5 candidates)
2. Technical screening call (30 minutes)
3. Code review assignment (2-3 hours, paid)
4. Final interview
5. Contract award

---

## Questions?

Feel free to ask any questions about the project scope, technical requirements, or expectations. Clear communication is essential for success.

**Note:** Access to the full codebase, environment variables, and API credentials will be provided upon contract award with appropriate NDA in place.

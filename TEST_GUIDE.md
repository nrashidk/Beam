# 🧪 InvoLinks End-to-End Visual Testing Guide

## SuperAdmin Login Credentials
- **Email:** nrashidk@gmail.com
- **Password:** Admin@123

---

## 📋 Test Checklist - Follow Along in Preview

### ✅ **Phase 1: SuperAdmin Dashboard Testing**

#### Step 1: Login as SuperAdmin
1. Go to `/login`
2. Enter email: `nrashidk@gmail.com`
3. Enter password: `Admin@123`
4. Click "Sign In" button
5. ✅ Should redirect to SuperAdmin Dashboard

#### Step 2: Test SuperAdmin Dashboard Features
**Navigation & Layout:**
- [ ] Check top navigation bar displays correctly
- [ ] Verify "InvoLinks" logo is visible
- [ ] Check user menu/dropdown works
- [ ] Test logout functionality

**Analytics Cards (Top Section):**
- [ ] View "Total Revenue" card
- [ ] View "Active Companies" card  
- [ ] View "Total Invoices" card
- [ ] View "MRR" (Monthly Recurring Revenue) card
- [ ] Verify all numbers display correctly

**Revenue Chart:**
- [ ] Check if revenue chart renders
- [ ] Hover over chart data points
- [ ] Verify chart shows revenue by subscription plan

**Company Explorer Section:**
- [ ] **Search Functionality:**
  - Type company name in search box
  - Verify search filters the results
  - Test with: "Test", "Retro", "Nas"
  - Clear search and verify all companies return

- [ ] **Status Filter Dropdown:**
  - Click "All Statuses" dropdown
  - Select "PENDING_REVIEW"
  - Verify only pending companies show
  - Select "ACTIVE"
  - Select "REJECTED"
  - Reset to "All Statuses"

- [ ] **Plan Filter Dropdown:**
  - Click "All Plans" dropdown
  - Filter by "Free"
  - Filter by "Basic"
  - Filter by "Professional"
  - Filter by "Enterprise"
  - Reset to "All Plans"

- [ ] **Export Button:**
  - Click "Export CSV" button
  - Verify CSV file downloads

**Company List Table:**
- [ ] Verify columns: Company Name, Email, Status, Plan, Invoices, Created
- [ ] Check pagination if more than 10 companies
- [ ] Click on a company row to view details
- [ ] Test sorting by clicking column headers

**Action Buttons Per Company:**
- [ ] Click "View Details" on pending company
- [ ] Click "Approve" button - verify modal/confirmation
- [ ] Click "Reject" button - verify modal/confirmation

#### Step 3: Test Approvals Page
1. Navigate to `/admin/approvals`
2. **Pending Registrations Tab:**
   - [ ] View list of pending companies
   - [ ] Click on company to see details:
     - Company name
     - Email
     - Business type
     - Phone
     - Registration date
   - [ ] Click "Approve" button
   - [ ] Enter approval notes/comments
   - [ ] Confirm approval
   - [ ] Verify success message

3. **Assign Subscription:**
   - [ ] Select subscription plan dropdown
   - [ ] Choose "Free" plan
   - [ ] Choose "Basic" plan
   - [ ] Set custom limits if Free plan

4. **Reject Company:**
   - [ ] Click "Reject" button
   - [ ] Enter rejection reason
   - [ ] Confirm rejection
   - [ ] Verify company status changes

---

### ✅ **Phase 2: Business User Testing**

#### Step 4: Approve & Login as Business User
1. Go to SuperAdmin → Approvals
2. Approve company: **E2E Test Company LLC** (testuser@involinks.ae)
3. Assign **Free** plan with 10 invoice limit
4. Logout from SuperAdmin
5. Login as business user:
   - **Email:** testuser@involinks.ae
   - **Password:** SecurePass123!@#

#### Step 5: Test Business Dashboard
**Dashboard Overview:**
- [ ] View revenue cards (Total Revenue, Paid, Pending, Overdue)
- [ ] Check recent invoices list
- [ ] View activity timeline
- [ ] Check subscription plan display
- [ ] View invoice count vs limit (for Free plan)

**Navigation Menu:**
- [ ] Click "Invoices" menu item
- [ ] Click "Create Invoice" button
- [ ] Click "Settings" → "Branding"
- [ ] Click "Settings" → "Team"
- [ ] Click "Dashboard" to return home

---

### ✅ **Phase 3: Invoice Management Testing**

#### Step 6: Create New Invoice
1. Navigate to `/invoices/create`
2. **Customer Information:**
   - [ ] Enter customer name: "Acme Corporation"
   - [ ] Enter customer email: "billing@acme.com"
   - [ ] Enter customer address
   - [ ] Enter customer TRN (optional): "100987654321001"

3. **Invoice Details:**
   - [ ] Select invoice type dropdown:
     - Tax Invoice
     - Credit Note  
     - Commercial
   - [ ] Set invoice date (date picker)
   - [ ] Set due date (date picker)
   - [ ] Enter invoice number or auto-generate
   - [ ] Add PO reference (optional)

4. **Line Items:**
   - [ ] Click "Add Line Item" button
   - [ ] Enter description: "Professional Services"
   - [ ] Enter quantity: 10
   - [ ] Enter unit price: 500
   - [ ] Select tax rate: 5% VAT
   - [ ] Verify subtotal calculates: 5,000 AED
   - [ ] Click "Add Another Line" button
   - [ ] Add second item:
     - Description: "Software License"
     - Quantity: 1
     - Unit Price: 2,000
     - Tax: 5% VAT
   - [ ] Click delete icon to remove a line item
   - [ ] Verify totals update correctly

5. **Tax & Totals Section:**
   - [ ] Verify Subtotal calculates correctly
   - [ ] Verify VAT @ 5% calculates correctly
   - [ ] Verify Total (Subtotal + VAT)
   - [ ] Check tax breakdown table

6. **Payment Terms:**
   - [ ] Select payment method dropdown:
     - Cash
     - Card
     - Bank Transfer
     - POS
     - Digital Wallet
   - [ ] Enter payment notes/terms

7. **Save Invoice:**
   - [ ] Click "Save as Draft" button
   - [ ] Verify success message
   - [ ] Verify redirect to invoice detail page

#### Step 7: Invoice Detail Page
1. View draft invoice created above
2. **Header Section:**
   - [ ] View invoice number
   - [ ] View status badge (DRAFT)
   - [ ] View customer name
   - [ ] View amounts

3. **Action Buttons:**
   - [ ] Click "Edit" button - verify can edit
   - [ ] Click "Issue Invoice" button
   - [ ] Verify confirmation modal
   - [ ] Confirm issuance
   - [ ] Check status changes to ISSUED

4. **Compliance Features (After Issuing):**
   - [ ] View "Digital Signature" section
   - [ ] Click "View XML" button
   - [ ] Verify UBL XML displays
   - [ ] Check signature details:
     - Signing certificate serial
     - Signing timestamp
     - XML hash
     - Previous invoice hash (hash chain)
   - [ ] Click "Download XML" button

5. **Send to PEPPOL:**
   - [ ] Click "Send via PEPPOL" button
   - [ ] Verify PEPPOL transmission status
   - [ ] Check transmission timestamp
   - [ ] View PEPPOL message ID

6. **Payment Section:**
   - [ ] Click "Record Payment" button
   - [ ] Enter payment amount
   - [ ] Select payment method
   - [ ] Enter payment reference
   - [ ] Set payment date
   - [ ] Click "Save Payment"
   - [ ] Verify status changes to PAID

7. **Other Actions:**
   - [ ] Click "Share" button
   - [ ] Copy public link
   - [ ] Open link in new tab (test customer portal view)
   - [ ] Click "Download PDF" button
   - [ ] Click "Print" button
   - [ ] Click "Cancel Invoice" (test cancellation flow)

#### Step 8: Invoice Dashboard
1. Navigate to `/invoices`
2. **Invoice List:**
   - [ ] View all invoices in table
   - [ ] Check columns: Number, Customer, Date, Amount, Status, Actions

3. **Search & Filter:**
   - [ ] Search by invoice number
   - [ ] Search by customer name
   - [ ] Clear search
   - [ ] Filter by status dropdown:
     - All Statuses
     - Draft
     - Issued
     - Sent
     - Paid
     - Overdue
     - Cancelled
   - [ ] Filter by date range (date picker)
   - [ ] Filter by payment method

4. **Sorting:**
   - [ ] Click "Date" column header - sort ascending/descending
   - [ ] Click "Amount" column header - sort high/low
   - [ ] Click "Status" column header - sort alphabetically

5. **Pagination:**
   - [ ] If >10 invoices, check pagination controls
   - [ ] Click "Next" page
   - [ ] Click "Previous" page
   - [ ] Change items per page (10, 25, 50)

6. **Bulk Actions:**
   - [ ] Select multiple invoices (checkboxes)
   - [ ] Click "Bulk Export" button
   - [ ] Click "Bulk Send" button (if available)

---

### ✅ **Phase 4: Company Settings Testing**

#### Step 9: Company Branding
1. Navigate to `/settings/branding`
2. **Logo Upload:**
   - [ ] Click "Upload Logo" button
   - [ ] Select image file (PNG/SVG)
   - [ ] Verify preview displays
   - [ ] Check file size validation
   - [ ] Click "Save" button

3. **Brand Colors:**
   - [ ] Click primary color picker
   - [ ] Select custom color
   - [ ] Click accent color picker
   - [ ] Verify preview updates

4. **Typography:**
   - [ ] Select font family dropdown
   - [ ] Choose different fonts
   - [ ] Verify preview updates

5. **Header/Footer:**
   - [ ] Enter custom header text
   - [ ] Enter custom footer text
   - [ ] Verify character limits
   - [ ] Save changes

6. **Preview:**
   - [ ] Click "Preview Invoice" button
   - [ ] Verify branding applies correctly
   - [ ] Check logo placement
   - [ ] Check colors apply

#### Step 10: Team Management
1. Navigate to `/settings/team`
2. **Team List:**
   - [ ] View all team members
   - [ ] Check columns: Name, Email, Role, Status, Invited By

3. **Invite Team Member:**
   - [ ] Click "Invite Member" button
   - [ ] Enter email address
   - [ ] Enter full name
   - [ ] Select role dropdown:
     - Company Admin
     - Finance User
     - Viewer
   - [ ] Click "Send Invitation"
   - [ ] Verify success message
   - [ ] Check temporary password shown

4. **Manage Members:**
   - [ ] Click "Edit" on team member
   - [ ] Change role
   - [ ] Click "Save"
   - [ ] Click "Remove" on team member
   - [ ] Confirm removal

---

### ✅ **Phase 5: System-Wide Testing**

#### Step 11: Error Handling
- [ ] Try invalid login credentials - verify error message
- [ ] Submit form with missing required fields
- [ ] Upload invalid file type
- [ ] Try creating invoice beyond Free plan limit
- [ ] Test network error scenarios

#### Step 12: Responsive Design
- [ ] Resize browser window to mobile size
- [ ] Test navigation menu on mobile
- [ ] Test tables on mobile (should scroll or stack)
- [ ] Test forms on mobile
- [ ] Test dashboard cards on tablet size

#### Step 13: Performance
- [ ] Test page load times
- [ ] Test navigation speed
- [ ] Test search response time
- [ ] Test large data tables (100+ invoices)

---

## 🐛 Bug Tracking

| Issue # | Page | Description | Severity | Status |
|---------|------|-------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## ✅ Test Summary

**Total Tests:** ~100+
**Passed:** ___
**Failed:** ___
**Blocked:** ___

**Overall Status:** 🟡 In Progress / 🟢 Passed / 🔴 Failed

---

## 📝 Notes & Observations

[Add your testing notes here]

---

**Tested By:** _____________
**Date:** October 27, 2025
**Version:** Tier 1 Production Hardening Build

# Expense Tracking & Inventory Management Guide

## ✅ What's Been Implemented

### 1. Custom Expense Categories
- **User-defined categories** - Businesses create their own expense categories
- **Auto-seeded defaults** - System provides 8 starter categories (Rent, Utilities, Salaries, etc.)
- **Full CRUD operations** - Create, list, and delete custom categories
- **Smart validation** - Cannot delete categories with associated expenses

**API Endpoints:**
- `POST /expense-categories` - Create custom category
- `GET /expense-categories` - List all categories (auto-seeds defaults)
- `DELETE /expense-categories/{id}` - Delete custom category

### 2. Simple Expense Tracking
- **Record monthly expenses** - Rent, utilities, salaries, materials, etc.
- **VAT support** - Track input VAT paid to suppliers
- **Automatic calculations**:
  - **Net Income** = Revenue - Expenses
  - **Net VAT Payable** = Output VAT (from sales) - Input VAT (from purchases)
- **Financial summary** - Revenue, expenses, profit margins, VAT details

**API Endpoints:**
- `POST /expenses` - Record expense
- `GET /expenses?month=YYYY-MM` - List expenses by month
- `GET /expenses/summary?month=YYYY-MM` - Financial summary
- `DELETE /expenses/{id}` - Delete expense

### 3. Simple Inventory Tracking
- **Track inventory items** - Products, materials, supplies
- **Stock management** - Current stock, min stock levels, low stock alerts
- **Transaction history** - Purchases, sales, adjustments, service usage
- **Automatic stock updates** - Tracks every movement with audit trail

**API Endpoints:**
- `POST /inventory` - Create inventory item
- `GET /inventory` - List all items (supports low_stock_only filter)
- `POST /inventory/{id}/adjust` - Adjust stock (purchase/sale/usage)
- `GET /inventory/{id}/history` - View transaction history

### 4. Frontend UI
- **ExpenseTracker.jsx** - Complete React component with:
  - Financial summary cards (Revenue, Expenses, Net Income, Net VAT)
  - Month selector for filtering
  - Expense list table
  - Modal forms for creating expenses and categories
  - Real-time calculations

## 🎯 Business Use Cases Covered

### Coffee Shop (B2C Products)
```
EXPENSES:
- Rent: AED 5,000/month
- Utilities: AED 800/month
- Salaries: AED 12,000/month
- Coffee Beans (Raw Materials): AED 3,000/month (VAT: 142.86)

INVENTORY:
- Coffee Beans: 50 kg
- Milk: 100 liters
- Cups: 500 units

CALCULATION:
Revenue: AED 35,000 (from invoices)
Expenses: AED 20,800
Net Income: AED 14,200
```

### Block Factory (B2B Products)
```
EXPENSES:
- Rent: AED 15,000/month
- Utilities: AED 5,000/month
- Salaries: AED 50,000/month
- Cement & Materials: AED 40,000/month (VAT: 1,904.76)

INVENTORY:
- Cement Bags: 1000 bags
- Finished Blocks: 5000 units

CALCULATION:
Revenue: AED 200,000 (from B2B invoices)
Expenses: AED 110,000
Net Income: AED 90,000
```

### Spa (Services + Products)
```
EXPENSES:
- Rent: AED 8,000/month
- Utilities: AED 1,500/month
- Salaries: AED 25,000/month
- Beauty Products: AED 6,000/month (VAT: 285.71)

INVENTORY:
- Shampoo Bottles: 200 units
- Mani Kits: 500 units
- Towels: 100 units

SERVICE USAGE:
- Used 200 mani kits for services
- Auto-deducted from inventory

CALCULATION:
Revenue: AED 45,000 (from service invoices)
Expenses: AED 40,500
Net Income: AED 4,500
```

## 📊 Database Schema

### expense_categories
```sql
id VARCHAR(255) PRIMARY KEY
company_id VARCHAR(255) FOREIGN KEY
name VARCHAR NOT NULL
description TEXT
is_default BOOLEAN (true for system categories)
created_at TIMESTAMP
```

### expenses
```sql
id VARCHAR(255) PRIMARY KEY
company_id VARCHAR(255) FOREIGN KEY
expense_date DATE NOT NULL
category VARCHAR NOT NULL (user-defined)
description TEXT
amount FLOAT NOT NULL
vat_amount FLOAT DEFAULT 0.0
total_amount FLOAT NOT NULL
currency_code VARCHAR DEFAULT 'AED'
reference_number VARCHAR
supplier_name VARCHAR
notes TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

### inventory_items
```sql
id VARCHAR(255) PRIMARY KEY
company_id VARCHAR(255) FOREIGN KEY
item_name VARCHAR NOT NULL
item_code VARCHAR (SKU)
description TEXT
unit VARCHAR DEFAULT 'unit'
current_stock FLOAT DEFAULT 0.0
min_stock_level FLOAT DEFAULT 0.0
unit_cost FLOAT
created_at TIMESTAMP
updated_at TIMESTAMP
```

### inventory_transactions
```sql
id VARCHAR(255) PRIMARY KEY
company_id VARCHAR(255) FOREIGN KEY
inventory_item_id VARCHAR(255) FOREIGN KEY
transaction_type VARCHAR NOT NULL (PURCHASE, SALE, ADJUSTMENT, SERVICE_USAGE)
quantity FLOAT NOT NULL (positive=add, negative=reduce)
transaction_date DATE NOT NULL
reference_type VARCHAR (INVOICE, EXPENSE, MANUAL)
reference_id VARCHAR
notes TEXT
stock_after FLOAT NOT NULL
created_at TIMESTAMP
```

## 🚀 Usage Examples

### 1. Create Custom Expense Category
```bash
curl -X POST "http://localhost:8000/expense-categories" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "name=Laundry Services&description=Monthly laundry expenses"
```

### 2. Record Expense
```bash
curl -X POST "http://localhost:8000/expenses" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "expense_date=2025-10-30&category=Rent&amount=5000&vat_amount=0&supplier_name=Landlord"
```

### 3. Add Inventory Item
```bash
curl -X POST "http://localhost:8000/inventory" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "item_name=Shampoo Bottles&current_stock=200&unit=bottle&min_stock_level=50&unit_cost=15"
```

### 4. Adjust Inventory (Purchase)
```bash
curl -X POST "http://localhost:8000/inventory/inv_abc123/adjust" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "quantity=50&transaction_type=PURCHASE&notes=Purchased from supplier"
```

### 5. Adjust Inventory (Service Usage)
```bash
curl -X POST "http://localhost:8000/inventory/inv_abc123/adjust" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "quantity=-200&transaction_type=SERVICE_USAGE&notes=Used for 200 manicure services"
```

### 6. Get Financial Summary
```bash
curl -X GET "http://localhost:8000/expenses/summary?month=2025-10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "period": "2025-10",
  "revenue": {
    "total": 35000.0,
    "invoice_count": 45,
    "output_vat": 1666.67
  },
  "expenses": {
    "total": 20800.0,
    "expense_count": 12,
    "input_vat": 142.86
  },
  "summary": {
    "net_income": 14200.0,
    "net_vat_payable": 1523.81,
    "gross_revenue": 36666.67,
    "total_costs": 20942.86,
    "profit_margin_percent": 40.57
  },
  "vat_details": {
    "output_vat": 1666.67,
    "input_vat": 142.86,
    "net_vat": 1523.81,
    "vat_status": "PAYABLE"
  }
}
```

## 🎨 Frontend Integration

Add the ExpenseTracker page to your router:

```jsx
import ExpenseTracker from './pages/ExpenseTracker';

// In your router
<Route path="/expense-tracker" element={<ExpenseTracker />} />
```

The component includes:
- ✅ Month selector for filtering
- ✅ Financial summary cards
- ✅ Expense list table
- ✅ Modal forms for creating expenses and categories
- ✅ Real-time API integration
- ✅ Responsive design

## 📝 Key Features

### Smart Defaults
- **Auto-seeded categories** - First access creates 8 default categories
- **Category protection** - Cannot delete system defaults
- **Validation** - Cannot delete categories with existing expenses

### Comprehensive Tracking
- **Monthly filtering** - View expenses and summary by month
- **VAT calculations** - Automatic Output VAT - Input VAT
- **Profit margins** - Net Income percentage calculations
- **Stock alerts** - Low stock warnings when below minimum

### Audit Trail
- **Transaction history** - Every inventory movement tracked
- **Reference linking** - Link transactions to invoices/expenses
- **Timestamp tracking** - Created/updated timestamps on all records

## 🔐 Security & Validation

- ✅ **Company isolation** - Users only see their company's data
- ✅ **JWT authentication** - All endpoints require valid token
- ✅ **Input validation** - Date formats, amounts, stock levels
- ✅ **Negative stock prevention** - Cannot reduce below zero
- ✅ **Duplicate prevention** - Category name uniqueness per company

## 🎯 Next Steps

1. **Add Inventory to Frontend** - Create InventoryManagement.jsx component
2. **Link Invoice to Inventory** - Auto-deduct stock when invoice is created
3. **Expense Reports** - Export to PDF/Excel for accountants
4. **Budget Planning** - Set monthly budgets per category
5. **Multi-currency Support** - Track expenses in different currencies

## ✅ System Status

**Backend:** ✅ Running on http://localhost:8000
**Frontend:** ✅ Running on http://localhost:5000
**Database:** ✅ PostgreSQL connected
**Authentication:** ✅ Super Admin credentials working
  - Email: nrashidk@gmail.com
  - Password: Admin@2025

---

**Last Updated:** October 30, 2025
**Features:** Custom Expense Categories, Simple Expense Tracking, Simple Inventory Management
**Coverage:** 100% of requested simple finance features for UAE businesses

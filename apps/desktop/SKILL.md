---
name: electronic-invoicing-desktop-app
description: >
  Complete rebuild skill for the Electron + React + SQLite electronic invoicing
  desktop application. Use this skill whenever rebuilding, extending, or modifying
  any screen, component, database table, or business logic in this app.
  This skill ensures pixel-accurate UI consistency and schema fidelity across all
  34 documented screens.
stack: Electron + React + SQLite (better-sqlite3)
---

# Electronic Invoicing Desktop App — Full Rebuild Skill

## 1. Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Shell        | Electron (desktop wrapper)          |
| Frontend     | React (functional components + hooks)|
| Styling      | Tailwind CSS or plain CSS modules    |
| Database     | SQLite via `better-sqlite3`         |
| Charts       | Recharts or Chart.js                |
| PDF Export   | jsPDF or Electron print-to-PDF      |
| Excel Export | SheetJS (xlsx)                      |
| Barcode      | `quagga2` or `@zxing/library`       |

---

## 2. Design System

### Layout
- **Sidebar width:** ~190px, dark background (`#1a1a1a` or `#111`)
- **Main content area:** white/light-grey background (`#f5f5f5`)
- **Top header bar:** white, with page title (bold, large), subtitle below it, search bar (right), bell icon (right)
- **Content padding:** 24px all sides

### Colors
| Token              | Value / Usage                                  |
|--------------------|------------------------------------------------|
| Sidebar bg         | `#111111` or `#1c1c1c`                         |
| Sidebar text       | `#ffffff`                                      |
| Sidebar active item| white text + left border highlight             |
| Primary button     | `#111111` (black), white text                  |
| Danger / negative  | `#ef4444` red                                  |
| Success / positive | `#22c55e` green                                |
| Warning / low      | `#f97316` orange                               |
| Stat card – blue   | `#dbeafe` background (Total Sale, Total Items) |
| Stat card – pink   | `#fce7f3` background (Profit, Low Stock)       |
| Stat card – yellow | `#fef9c3` background (Cash Balance)            |
| Stat card – green  | `#dcfce7` background (Bank Balance, Selling)   |
| Table header       | `#111111` bg, white text                       |
| Table rows         | alternating white / very light grey            |
| Modal overlay      | semi-transparent dark backdrop                 |
| Modal card         | white, border-radius 12px, shadow              |

### Typography
- Page title: `font-size: 24px; font-weight: 700`
- Page subtitle: `font-size: 13px; color: #6b7280`
- Stat card label: `font-size: 13px; color: #6b7280`
- Stat card value: `font-size: 28–32px; font-weight: 700`
- Trend indicator: small text, green `+x%` or red `-x%`
- Table header: `font-size: 13px; font-weight: 600; uppercase`
- Table cell: `font-size: 14px`

### Sidebar Navigation (always visible, always same order)
```
[LOGO placeholder]  (white box top-left)
─────────────────
Dashboard           (grid icon)
Billing & Invoice   (person/invoice icon)
Inventory & Services(cube/box icon)
Vendors & Purchases (truck icon)
Banking             (bank icon)
Expenses            (dollar icon)
Reports             (bar chart icon)
Settings            (gear icon)
```
Active item has a white-filled left indicator / highlight.

### Tab Pill Component
Tabs are rounded pill-buttons. Active tab = black bg + white text. Inactive = white bg + dark text + light border.
Used in: Billing & Invoice, Vendors & Purchases, Reports, Settings.

### Stat Card Component
4 stat cards in a row at the top of many screens. Each card has:
- Colored background
- Label (small top)
- Large bold value
- Trend percentage (+/- from last period)
- Icon (top right)

### Action Menu (⋮)
Each table row has a three-dot (⋮) kebab menu on the right for row-level actions (View, Edit, Delete, etc).

### Modal Pattern
- Background blurs/dims
- White card centered, max-width ~600–900px
- Title + optional subtitle at top
- Form fields in 2-column grid where applicable
- Cancel (outline) + Save (black filled) buttons bottom-right
- X close button top-right

---

## 3. SQLite Database Schema

### Table: `company_profile`
```sql
CREATE TABLE company_profile (
  id            INTEGER PRIMARY KEY,
  company_name  TEXT NOT NULL,
  mobile        TEXT,
  email         TEXT,
  address       TEXT,
  logo_path     TEXT  -- path to logo image file
);
```

### Table: `branches`
```sql
CREATE TABLE branches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  store_id    TEXT UNIQUE,  -- e.g. oHB-001
  address     TEXT,
  is_active   INTEGER DEFAULT 1
);
```

### Table: `users`
```sql
CREATE TABLE users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  mobile       TEXT,
  email        TEXT,
  password     TEXT NOT NULL,  -- hashed
  role         TEXT NOT NULL,  -- 'OWNER' | 'ACCOUNTANT' | 'BILLING OPERATOR'
  is_active    INTEGER DEFAULT 1,
  avatar_path  TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

### Table: `accounts`
```sql
CREATE TABLE accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name    TEXT NOT NULL,
  account_type    TEXT NOT NULL,  -- 'Cash' | 'Bank' | 'Capital' | 'Sales' | 'Purchase' | 'Expense'
  opening_balance REAL DEFAULT 0,
  as_of_date      TEXT,
  is_primary      INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);
```

### Table: `categories`
```sql
CREATE TABLE categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);
```

### Table: `products`
```sql
CREATE TABLE products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sku             TEXT UNIQUE,  -- e.g. ITM-001 (auto-generated)
  name            TEXT NOT NULL,
  category_id     INTEGER REFERENCES categories(id),
  unit            TEXT DEFAULT 'Piece',  -- Piece | Box | Kg | etc
  hsn_code        TEXT,
  purchase_price  REAL DEFAULT 0,
  selling_price   REAL DEFAULT 0,
  opening_stock   INTEGER DEFAULT 0,
  current_stock   INTEGER DEFAULT 0,
  reorder_level   INTEGER DEFAULT 10,  -- low stock threshold
  barcode         TEXT,
  status          TEXT DEFAULT 'Good',  -- 'Good' | 'Low' | 'Critical'
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);
-- Stock status rule: Good = stock > reorder_level; Low = stock <= reorder_level && stock > 5; Critical = stock <= 5
```

### Table: `customers`
```sql
CREATE TABLE customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Table: `invoices`
```sql
CREATE TABLE invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no      TEXT UNIQUE,  -- format: ETS-YYXXX e.g. ETS-26001
  invoice_date    TEXT NOT NULL,
  customer_name   TEXT,
  customer_phone  TEXT,
  seller_id       INTEGER REFERENCES users(id),
  branch_id       INTEGER REFERENCES branches(id),
  subtotal        REAL DEFAULT 0,
  tax_amount      REAL DEFAULT 0,
  grand_total     REAL DEFAULT 0,
  payment_mode    TEXT,  -- 'Cash' | 'Card' | 'EFT' | 'UPI' | 'Split'
  cash_amount     REAL DEFAULT 0,
  online_amount   REAL DEFAULT 0,
  internal_notes  TEXT,
  status          TEXT DEFAULT 'Draft',  -- 'Draft' | 'Paid' | 'Credit' | 'Exchanged'
  type            TEXT DEFAULT 'Sale',   -- 'Sale' | 'Return'
  is_credit_sale  INTEGER DEFAULT 0,
  paid_amount     REAL DEFAULT 0,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
-- Invoice number auto-generation: 'ETS-' + last 2 digits of year + zero-padded sequence
```

### Table: `invoice_items`
```sql
CREATE TABLE invoice_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id),
  product_code TEXT,
  product_name TEXT,
  qty         INTEGER NOT NULL,
  rate        REAL NOT NULL,
  amount      REAL NOT NULL  -- qty * rate
);
```

### Table: `return_exchange`
```sql
CREATE TABLE return_exchange (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  original_invoice_id INTEGER REFERENCES invoices(id),
  invoice_no          TEXT,
  customer_name       TEXT,
  type                TEXT NOT NULL,  -- 'Return' | 'Exchange'
  total_items_sold    INTEGER,
  items_returned      INTEGER DEFAULT 0,
  return_amount       REAL DEFAULT 0,
  exchange_amount     REAL DEFAULT 0,
  net_amount          REAL DEFAULT 0,
  status              TEXT DEFAULT 'complete',
  created_by          INTEGER REFERENCES users(id),
  date                TEXT DEFAULT (datetime('now'))
);
```

### Table: `return_exchange_items`
```sql
CREATE TABLE return_exchange_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id        INTEGER REFERENCES return_exchange(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id),
  product_name     TEXT,
  returned_qty     INTEGER DEFAULT 0,
  exchange_qty     INTEGER DEFAULT 0,
  rate             REAL
);
```

### Table: `vendors`
```sql
CREATE TABLE vendors (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_name         TEXT NOT NULL,
  company_name        TEXT,
  email               TEXT,
  phone               TEXT,
  street_address      TEXT,
  city                TEXT,
  province_state      TEXT,
  postal_code         TEXT,
  account_name        TEXT,
  account_number      TEXT,
  outstanding_balance REAL DEFAULT 0,
  status              TEXT DEFAULT 'Active',  -- 'Active' | 'Draft'
  created_at          TEXT DEFAULT (datetime('now'))
);
```

### Table: `purchase_invoices`
```sql
CREATE TABLE purchase_invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number       TEXT UNIQUE,  -- format: PO-YYYY-XXXXXX e.g. PO-2025-000024
  vendor_id       INTEGER REFERENCES vendors(id),
  vendor_name     TEXT,
  purchase_date   TEXT,
  subtotal        REAL DEFAULT 0,
  grand_total     REAL DEFAULT 0,
  purchase_note   TEXT,
  status          TEXT DEFAULT 'Pending',  -- 'Pending' | 'Received' | 'Partial'
  paid_amount     REAL DEFAULT 0,
  pending_amount  REAL DEFAULT 0,
  due_date        TEXT,
  last_payment_date TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);
```

### Table: `purchase_invoice_items`
```sql
CREATE TABLE purchase_invoice_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id          INTEGER REFERENCES products(id),
  product_name        TEXT,
  product_code        TEXT,
  qty                 INTEGER NOT NULL,
  price               REAL NOT NULL,
  total               REAL NOT NULL
);
```

### Table: `purchase_returns`
```sql
CREATE TABLE purchase_returns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number           TEXT,
  vendor_id           INTEGER REFERENCES vendors(id),
  vendor_name         TEXT,
  original_invoice_id INTEGER REFERENCES purchase_invoices(id),
  purchased_qty       INTEGER,
  return_qty          INTEGER,
  return_total        REAL DEFAULT 0,
  restocking_fee_pct  REAL DEFAULT 0,
  return_reason       TEXT,
  status              TEXT DEFAULT 'Pending',
  order_date          TEXT DEFAULT (datetime('now'))
);
```

### Table: `purchase_return_items`
```sql
CREATE TABLE purchase_return_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_return_id INTEGER REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id),
  item_name        TEXT,
  sku              TEXT,
  purchased_qty    INTEGER,
  return_qty       INTEGER DEFAULT 0,
  purchase_price   REAL,
  total            REAL DEFAULT 0
);
```

### Table: `pay_bills`
```sql
CREATE TABLE pay_bills (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id           INTEGER REFERENCES vendors(id),
  purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
  outstanding_amount  REAL,
  total_payable       REAL,
  last_payment_date   TEXT,
  payment_mode        TEXT,  -- 'Bank Transfer' | 'Cash' | 'Card'
  due_date            TEXT,
  paying_amount       REAL,
  payment_status      TEXT DEFAULT 'Unpaid',  -- 'Unpaid' | 'Paid' | 'Partial'
  created_at          TEXT DEFAULT (datetime('now'))
);
```

### Table: `banking_transactions`
```sql
CREATE TABLE banking_transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id       TEXT UNIQUE,  -- e.g. ETS-26001
  account_id   INTEGER REFERENCES accounts(id),
  account_name TEXT,
  date         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL,  -- 'Credit' | 'Debit'
  amount       REAL NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

### Table: `expenses`
```sql
CREATE TABLE expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id   TEXT UNIQUE,  -- e.g. ETS-26001
  title        TEXT NOT NULL,
  amount       REAL NOT NULL,
  expense_date TEXT NOT NULL,
  category     TEXT,  -- 'Payroll & Salary' | 'Rent & Office' | 'Marketing & Sales' | 'Utilities' | 'Other'
  account_id   INTEGER REFERENCES accounts(id),
  paid_from    TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

### Table: `backups`
```sql
CREATE TABLE backups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT,  -- 'Automated Daily Backup' | 'Manual Backup (Admin)'
  date_time  TEXT,
  size_mb    REAL,
  status     TEXT   -- 'Success' | 'Failed'
);
```

---

## 4. Screen-by-Screen Specification

---

### SCREEN 1 — Dashboard (Home)
**Route/Component:** `<Dashboard />`

#### Top stat row (6 cards, 2 rows):
| Card           | Color  | Fields                        |
|----------------|--------|-------------------------------|
| Total Sale     | Blue   | Sum of invoices grand_total   |
| Total Profit   | Pink   | Revenue - Cost                |
| Pending Payment| Green  | Sum of credit/unpaid invoices |
| Cash Balance   | Yellow | Sum of cash account balances  |
| Bank Balance   | Blue   | Sum of bank account balances  |
| Low Stock Items| Pink   | Count of products where status = Low or Critical |

Each card shows: label, large value, trend % vs last period (green = +, red = -), relevant icon.

#### Quick Actions (right panel, dark card):
- **New Sale** → "Create Invoice" → opens Billing & Invoice page
- **New Purchase** → "Add Bill" → opens Vendors & Purchases > Purchase Invoice
- **Add Item** → "Manage Stock" → opens Inventory & Services

#### Monthly Sales Trend chart:
- Bar chart, Jan–Dec x-axis, amount on y-axis
- Data from: `invoices` grouped by month

#### Recent Invoices table:
Columns: Invoice ID, Customer, Date, Amount, Status (Paid badge), Payment
Show last 5 invoices. "VIEW ALL" link goes to Billing & Invoice.

#### Top Selling Items (right panel):
Ranked list #1–#7 with item name, units sold, revenue.
Query: GROUP BY product on invoice_items, ORDER BY SUM(qty) DESC.

#### Branch Revenue (right panel):
Weekly/Monthly toggle. Shows each branch's total revenue.

---

### SCREEN 2 — Billing & Invoice > Invoices Tab
**Route/Component:** `<BillingInvoice />` with tab `Invoices`

#### Tab bar: [Invoices ●] [Return & Exchange] [Completed]

#### Filters row:
- Search input: "Search invoice, customers and amounts"
- Dropdown: All / Paid / Draft / Credit
- Calendar icon (date filter)
- Refresh icon
- `+ Create Invoice` button (black, right-aligned)

#### Table columns:
S.No | Invoice No. | Customer Name | Phone No. | Items | Total Amount | Created By | Created Date | Payment Type | Status | Action (⋮)

**Status badge colors:** Draft = grey, Paid = green, Credit = blue, Exchanged = purple

**Amount display:** Positive amounts in green (`+$500`), regular in black.

---

### SCREEN 3 — Billing & Invoice > Return & Exchange Tab
**Same layout as Invoices tab but columns:**
S.No | Invoice No. | Customer Name | Type (Return badge) | Total Items Sold | Items Returned | Return Amount (–) | Exchange Amount (+) | Net Amount | Created By | Date | Status | Action (⋮)

---

### SCREEN 4 — Billing & Invoice > Completed Tab
**Same as Invoices tab.** Shows invoices with status = Paid or Exchanged.
Payment Type column is now visible (Cash, UPI, Card, EFT).

---

### SCREEN 5 — Create Invoice Modal
**Triggered by:** `+ Create Invoice` button
**Modal options:**
- **Edit Draft** (left card, yellow icon): "Continue working on your last saved draft" → `Resume Draft` button
- **Create New** (right card, plus icon): "Start a fresh invoice from scratch" → `Start Fresh` button (black)

---

### SCREEN 6 — Create Invoice Form (Full Page)
**Component:** `<CreateInvoiceForm />`

#### Header section:
- Invoice Number (auto-generated, format `INV-2023-001`), pencil edit icon
- Date (auto-filled, editable)
- Status badge: `● Draft` (top right, orange pill)

#### Seller section:
- Seller Name dropdown (shows avatar, name, role "Sales Representative"), `Change` link
- Branch dropdown (shows branch name, Store ID), `Switch` link

#### Customer section (row):
- Customer Name text input
- Phone input
- Type dropdown: `Sale` | `Return`

#### Item search bar:
- Barcode icon + "Scan barcode or type item name to add..." → `Enter` button
- Adds items to table below

#### Items table:
`#` | CODE | ITEM DETAILS | QTY (editable input) | RATE (R) | AMOUNT | ACTION (delete 🗑)

#### Payment Details section (bottom left):
- Payment Mode toggle buttons: **Cash** | **Card** | **EFT** | **Split**
- Cash Amount (R) input
- Online/Other (R) input (shown when Split selected)
- Internal Notes textarea

#### Totals (bottom right):
- Subtotal
- **Grand Total** (large, bold)
- "Includes Tax where applicable" note

#### Bottom action bar:
- `⏱ Credit Sale` button (outline, left)
- `Save Draft` button (outline, right)
- `🖨 Save & Print` button (black, right)

---

### SCREEN 7 — Inventory & Services
**Route/Component:** `<InventoryServices />`

#### Top stat cards (4):
| Card                | Color  |
|---------------------|--------|
| Total Items         | Blue   |
| Low Stock Alert     | Pink   |
| Stock Value (Cost)  | Yellow |
| Stock Value (Selling)| Green |

#### Filters row:
- Search: "Search by name or Sku"
- All Categories dropdown
- All Status dropdown (Good / Low / Critical)
- `+ Add Item` button (black)

#### Table columns:
S.No | SKU | Product Name | Categories | HSN | Purchase Price | Selling Price | Stock | Status | Actions (⋮)

**Stock status color coding:**
- `Good` badge = green, stock in green
- `Low` badge = orange, stock in orange
- `Critical` badge = red, stock in red

---

### SCREEN 8 — Add New Product Modal
**Fields:**
- Item Name (full width)
- Category (dropdown) | Unit (dropdown: Piece, Box, Kg…)
- Product Code (8-digit code, auto or manual)
- Purchase Price (ZAR)
- Sales Price (ZAR) | Reorder Level (low stock limit)
- Opening Stock
- Upload Barcode (scan zone with barcode icon)
- `Cancel` | `Save Product` (black)

---

### SCREEN 9 — Vendors & Purchases > Vendors Tab
**Tab bar:** [Vendors ●] [Purchase Invoice] [Purchase Return] [Pay Bills]

#### Filters: Search by Vendor or Company name, All dropdown, Refresh icon
#### `+ Add Vendor` button (black, right)

#### Table columns:
S.No | Vendor Name | Company Name | Phone No. | E-mail | Outstanding Balance | Status | Action (⋮)

---

### SCREEN 10 — Add New Vendor Modal
**Sections:**

**① GENERAL INFORMATION**
- Vendor Name* | Company Name
- Email Address* | Phone Number

**② ADDRESS DETAILS**
- Street Address (full width)
- City | Province/State | Postal Code

**③ FINANCIAL INFORMATION**
- Account Name | Account Number

**Buttons:** Cancel | `💾 Save Vendor` (black)

---

### SCREEN 11 — Vendors & Purchases > Purchase Invoice Tab

#### Table columns:
S.No | PO Number | Vendor Name | Total Product | Total Quantity | Total | Order Date | Status | Action (⋮)

**PO Number format:** `PO-YYYY-XXXXXX`

`+ New Purchase Invoice` button (black, right)

---

### SCREEN 12 — Create Purchase Invoice Modal
**Subtitle:** "Record supplier purchase and update stock"

**Fields:**
- Vendor (dropdown)
- Purchase Date (date picker)
- Purchase Status (dropdown: Pending / Received / Partial)
- Search product by name + `+ Add Product Manually` button

**Items table:** S.NO | PRODUCT NAME (+ PC code below) | QTY (editable) | PRICE (CFA) | TOTAL

**Purchase Note** textarea (left)

**Summary (right):**
- Subtotal
- **Grand Total**

**Footer note:** "Stock levels will be auto-updated upon confirmation."
**Buttons:** Cancel | `Save & Confirm` (black)

> **Business rule:** When a purchase invoice is confirmed, `products.current_stock` is increased by the purchased qty for each item.

---

### SCREEN 13 — Vendors & Purchases > Purchase Return Tab

#### Table columns:
S.No | PO Number | Vendor Name | Purchased Quantity | Return Quantity | Return Total | Order Date | Status | Action (⋮)

`+ Purchase Return Invoice` button (black, right)

---

### SCREEN 14 — Create Purchase Return Modal
**Subtitle:** "Select vendor and invoice to begin"

**Fields:**
- Select Vendor (dropdown)
- Original Invoice (dropdown — shows pending invoices for selected vendor)
- Purchase Status (dropdown)

**Invoice Items section** (auto-loaded on invoice select):
ITEM NAME | PURCHASED QTY | RETURN QTY (editable input) | PURCHASE PRICE | TOTAL

**RETURN REASON / NOTES** textarea (left)

**RETURN SUMMARY (right):**
- Subtotal
- Restocking Fee (0%)
- **Total Refund**

**Buttons:** Cancel | `Finalize Return` (black)

> **Business rule:** On finalize, returned qty is deducted from `products.current_stock`.

---

### SCREEN 15 — Vendors & Purchases > Pay Bills Tab

#### Table columns:
S.No | PO Number | Vendor Name | Payment Status (Paid badge) | Paid Amount | Pending Amount | Total Amount | Due Date | Last Payment Date | Action (⋮)

---

### SCREEN 16 — Pay Bill Modal
**Badge:** `Unpaid` (yellow pill next to title)

**Fields:**
- Select Vendor (dropdown)
- Select Invoice (Pending) (dropdown — shows "INV-XXXX (Due: Month DD)")
- Outstanding Amount display | Total Payable (large, bold)
- Last Payment Date | Payment Mode (dropdown: Bank Transfer / Cash / Card)
- Due Date
- Paying Amount (editable for partial payments — shows "Editable for partial payments" hint)

**Buttons:** Cancel | `Save Payment` (black)

> **Business rule:** Paying amount updates `purchase_invoices.paid_amount`. If paid_amount >= grand_total → status = 'Paid'. Else status = 'Partial'.

---

### SCREEN 17 — Banking
**Route/Component:** `<Banking />`

#### Account balance cards (side by side):
Each account card shows: Account Name, Balance (large), `Received` button (outline), `Pay` button (black)
Accounts displayed: Cash Account, HDFC Bank – Current, ICICI Bank – Savings (from `accounts` table where type IN ('Cash','Bank'))

#### Recent Expenses / Transactions table:
Columns: Transaction ID | Date | Description | Account | Type (Credit green badge / Debit red) | Amount

`+ New Transaction` button (black)
Calendar filter icon.

---

### SCREEN 18 — New Transaction Modal
**Fields:**
- Transaction Type toggle: **Received** | **Paid**
- Date
- Select Account (dropdown)
- Amount
- Description textarea

**Button:** `✓ Add Transaction` (black)

> **Business rule:** Received = Credit entry → increases account balance. Paid = Debit → decreases account balance.

---

### SCREEN 19 — Expenses
**Route/Component:** `<Expenses />`

#### Top stat cards (4):
| Card                    | Color  |
|-------------------------|--------|
| Total Expenses (This Month) | Blue  |
| Rent                    | Pink   |
| Electricity             | Yellow |
| Salary                  | Green  |

Values computed by filtering `expenses` by category and current month.

#### Main content (split view):

**Left — Recent Expenses table:**
Expense ID | Date | Category | Description | Amount (red)
`+ Add Expense` button

**Right — Expense By Category:**
Progress bar list showing % breakdown:
- Payroll & Salary (60%)
- Rent & Office (25%)
- Marketing & Sales (10%)
- Utilities (5%)
- Other (0%)

**INSIGHT card:** AI-like text insight (e.g. "Payroll is down by 2.1% compared to Q3 projection.")

---

### SCREEN 20 — Add New Expense Modal
**Fields:**
- Expense Title/Description (full width)
- Amount | Expense Date
- Category (dropdown) | Paid From (dropdown → accounts)

**Buttons:** Cancel | `Save Expense` (black)

---

### SCREEN 21 — Reports (all 6 sub-reports)
**Route/Component:** `<Reports />`

**Tab bar:** [Sales Report] [Purchase Report] [Stock Report] [Customer Outstanding] [Vendor Outstanding] [Profit & Loss] [Balance Sheet]

All reports share:
- Date filter dropdown (Today / This Week / This Month / This Year / Custom)
- `Export Excel ↑` button
- `Export PDF 🖨` button

---

#### REPORT 1 — Sales Report
**Stat cards:** Total Sales | Total Invoices | Items Sold | Total Profit

**Table columns:**
Date | Bill No | Customer Name | Item Name | Qty | Rate | Amount | Payment Status | Payment Mode | Profit

---

#### REPORT 2 — Purchase Report
**Stat cards:** Total Purchases | Total Purchase Invoices | Items Purchased | Top Supplier (name)

**Table columns:**
Date | Bill No | Vendor Name | Item Name | Qty | Purchase Price | Total Amount | Payment Status

---

#### REPORT 3 — Stock Report
**Stat cards:** Total Products | Total Stock Quantity | Stock Value (Cost) | Stock Value (Selling)

**Table columns:**
Item Name | Category | Opening Stock | Purchase Qty | Sales Qty | Current Stock | Purchase Value | Sales Value | Profit Margin

---

#### REPORT 4 — Customer Outstanding
**Stat cards:** Total Credit Sales | Total Received | Total Outstanding | Overdue Amount

**Table columns:**
Customer Name | Invoice No | Invoice Date | Total Amount | Paid Amount | Balance

---

#### REPORT 5 — Vendor Outstanding
**Stat cards:** Total Purchases | Total Paid To Vendors | Total Outstanding | Overdue Payables

**Table columns:**
Vendor Name | Bill No | Bill Date | Total Amount | Paid Amount | Balance

---

#### REPORT 6 — Profit & Loss
**Stat cards:** Total Revenue | Total Cost | Gross Profit | Profit Margin (%)

**Table columns:**
`#` | Product | Units Sold | Cost Price | Sales Price | Total Profit | Margin %

> **Business rule:** Profit Margin % = ((Sales Price - Cost Price) / Sales Price) × 100

---

#### REPORT 7 — Balance Sheet
**Two-column layout:**

**Assets (left)** — CREDITS column:
- CURRENT ASSETS section:
  - Cash in Hand (from Cash accounts)
  - Bank accounts (HDFC Bank, etc with Primary badge)
  - Closing Stock (current inventory value at cost)
  - Customer Outstanding
- **TOTAL ASSETS** (green, bold)

**Liabilities & Equity (right)** — DEBITS column:
- CURRENT LIABILITIES section:
  - Vendor Outstanding
  - Total Liabilities
- EQUITY section:
  - Owner Capital Account
  - Retained Earnings (Profit)
  - Total Equity
- **TOTAL LIABILITIES + EQUITY** (blue, bold)

> **Accounting rule:** Total Assets must equal Total Liabilities + Equity.

---

### SCREEN 22 — Settings
**Route/Component:** `<Settings />`

Left sub-navigation panel (vertical list):
- Company Profile (active = highlighted)
- Accounts Management
- User Management
- Backup & Security

---

#### SETTINGS TAB 1 — Company Profile
- Logo upload area (dashed border, NO LOGO placeholder, 512×512px recommended, PNG/SVG/JPG)
- `Upload New Logo` button | `Remove` button
- **General Information section:**
  - Company Name
  - Mobile Number | Email Address
  - Address (multi-line textarea)
- **Buttons:** Cancel | `💾 Save` (black)

---

#### SETTINGS TAB 2 — Account Management (Accounts Chart)
**Stat cards (3):** Total Assets | Total Liabilities | Net Equity

**Table:**
Account Name (with colored letter avatar) | Account Type (colored badge) | Opening Balance | Created Date | Action (edit pencil icon)

Account types and badge colors:
- Cash → blue
- Bank → blue
- Capital → green
- Sales → teal
- Purchase → orange
- Expense → red

Filter + Export buttons above table.
`Add New Account` button (black).

**Important Note:** "Deleting an account is only possible if it has no transaction history."

---

#### SETTINGS TAB 2 — Add New Account Modal
**Fields:**
- Account Name
- Account Type (dropdown)
- Opening Balance | As of Date
- Info note: "This opening balance will be recorded as the initial entry for this ledger account."

**Buttons:** Cancel | `Save Account` (black)

---

#### SETTINGS TAB 3 — User Management
**Table columns:**
User Name (avatar + name + email) | Mobile Number | Role (badge) | Status (toggle) | Actions (edit + delete)

Role badge styles:
- OWNER → blue outlined
- ACCOUNTANT → grey outlined
- BILLING OPERATOR → grey outlined

Status toggle: active = dark, inactive = light.

`+ Add New User` button (black).

---

#### SETTINGS TAB 3 — Add New User Modal
**Fields:**
- User Name* (with person icon)
- Mobile Number (with phone icon)
- Password* (with eye toggle, min 8 chars)
- User Role* (dropdown: Owner / Accountant / Billing Operator)

**Buttons:** Cancel | `Save User` (black)

---

#### SETTINGS TAB 4 — Backup & Security
**Current Status card:**
- Shield icon, "SYSTEM HEALTHY" green badge
- "Last Successful Backup: [date]"
- "Next scheduled backup: Today, 00:00 UTC"
- `View Details` button

**Auto Backup toggle** (on/off): "Automatically back up your data daily at midnight (00:00 UTC)"

**Action buttons:** `☁ Backup Now` (black) | `↺ Restore Data` (outline)

**Recent Activity table:**
Activity | Date & Time | Size | Status (● Success green / ● Failed red)

---

## 5. Business Logic & Rules

### Invoice Number Generation
```
Format: ETS-YYXXX
- YY = last 2 digits of current year
- XXX = auto-incrementing 3-digit number (001, 002, ...)
Example: ETS-26001, ETS-26002
```

### PO Number Generation
```
Format: PO-YYYY-XXXXXX
- YYYY = full year
- XXXXXX = zero-padded 6-digit sequence
Example: PO-2025-000024
```

### Stock Status Logic
```javascript
function getStockStatus(currentStock, reorderLevel) {
  if (currentStock <= 5) return 'Critical';
  if (currentStock <= reorderLevel) return 'Low';
  return 'Good';
}
```

### Stock Auto-Update Rules
- **Create Invoice (Sale):** `product.current_stock -= qty` for each item sold
- **Return/Exchange:** `product.current_stock += qty` for each item returned
- **Confirm Purchase Invoice:** `product.current_stock += qty` for each item purchased
- **Finalize Purchase Return:** `product.current_stock -= qty` for each item returned to vendor

### Tax / Grand Total Calculation
```javascript
// Grand Total includes tax where applicable
grandTotal = subtotal + taxAmount;
// Tax is calculated per product if HSN-based tax rates are configured
// Default: taxAmount = 0 unless tax rate table is implemented
```

### Payment Mode: Split
When payment mode = Split, both `cash_amount` and `online_amount` fields are shown.
`cash_amount + online_amount` should equal `grand_total`.

### Credit Sale
Invoices marked as Credit Sale:
- `is_credit_sale = 1`
- `status = 'Credit'`
- Appear in Customer Outstanding report
- `paid_amount` starts at 0 (updated when customer pays)

### Balance Sheet Computation
```
Total Assets = Cash balances + Bank balances + Closing Stock value + Customer Outstanding
Total Liabilities = Vendor Outstanding
Equity = Owner Capital + Retained Earnings (cumulative profit)
Retained Earnings = Total Revenue - Total Cost - Total Expenses
Net Equity = Total Assets - Total Liabilities
```

### Profit Margin
```
Profit Margin % = ((selling_price - purchase_price) / selling_price) × 100
```

---

## 6. Component Reuse Rules

Always extract these as shared components to keep UI consistent:

| Component           | Used In                                              |
|---------------------|------------------------------------------------------|
| `<StatCard />`      | Dashboard, Inventory, Reports, Expenses, Banking     |
| `<TabPills />`      | Billing, Vendors, Reports, Settings                  |
| `<DataTable />`     | All list views                                       |
| `<KebabMenu />`     | All table row action menus                           |
| `<Modal />`         | All create/edit dialogs                              |
| `<SearchFilter />`  | All list screens                                     |
| `<Sidebar />`       | All screens (persistent)                             |
| `<TopBar />`        | All screens (persistent)                             |
| `<StatusBadge />`   | Invoice status, stock status, payment status         |

---

## 7. Electron IPC Pattern

Use `ipcMain` / `ipcRenderer` for all DB calls:

```javascript
// Renderer → Main
window.electron.invoke('invoices:create', invoiceData)
window.electron.invoke('invoices:getAll', { status, search })
window.electron.invoke('products:updateStock', { productId, delta })

// Main process (main.js)
ipcMain.handle('invoices:create', async (event, data) => {
  return db.prepare(`INSERT INTO invoices ...`).run(data);
});
```

Expose via `contextBridge` in preload.js:
```javascript
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data)
});
```

---

## 8. Export Functionality

### Export Excel
Use `SheetJS (xlsx)`:
```javascript
import * as XLSX from 'xlsx';
const ws = XLSX.utils.json_to_sheet(reportData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Report');
XLSX.writeFile(wb, `report_${Date.now()}.xlsx`);
```

### Export PDF
Use Electron's `webContents.printToPDF()` or `jsPDF`:
```javascript
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const doc = new jsPDF();
doc.autoTable({ head: [columns], body: rows });
doc.save('report.pdf');
```

---

## 9. File / Folder Structure

```
/src
  /main
    main.js           ← Electron entry, IPC handlers
    database.js       ← SQLite init, all DB queries
    preload.js        ← contextBridge exposure
  /renderer
    /components
      Sidebar.jsx
      TopBar.jsx
      StatCard.jsx
      DataTable.jsx
      Modal.jsx
      TabPills.jsx
      StatusBadge.jsx
    /pages
      Dashboard.jsx
      BillingInvoice.jsx
      CreateInvoiceForm.jsx
      InventoryServices.jsx
      VendorsPurchases.jsx
      Banking.jsx
      Expenses.jsx
      Reports.jsx
      Settings.jsx
    /utils
      invoiceNumber.js   ← auto-generate ETS-YYXXX
      stockUtils.js      ← stock status calculation
      exportUtils.js     ← xlsx + pdf export helpers
    App.jsx
    index.jsx
/public
  index.html
package.json
```

---

## 10. Critical Don'ts

- ❌ Do NOT change the sidebar order or icons
- ❌ Do NOT rename tabs — use exact names from screenshots
- ❌ Do NOT remove the "Includes Tax where applicable" note on invoice form
- ❌ Do NOT allow deleting an account that has transaction history
- ❌ Do NOT skip the "Edit Draft / Create New" modal before the invoice form
- ❌ Do NOT calculate stock manually in the renderer — always call IPC to update DB
- ❌ Do NOT change table column order from what is documented above
- ✅ DO keep all stat card trend % indicators (green + / red -)
- ✅ DO keep the Quick Actions panel on Dashboard dark-colored
- ✅ DO keep all modal Cancel / Save button positions (Cancel left/outline, Save right/black)

---

## 11. Login Screen & Authentication

### Screen: Login Page
This is the first screen shown when the app launches (before any other screen).
It is a **full-screen centered card** on a dark or light background.

**Layout:**
```
┌─────────────────────────────┐
│        [COMPANY LOGO]       │
│      Company Name           │
│                             │
│  Username / Mobile          │
│  [______________________]   │
│                             │
│  Password                   │
│  [____________________ 👁]  │
│                             │
│  [       Login →          ] │  ← black button, full width
│                             │
│  Forgot Password?           │
└─────────────────────────────┘
```

**Fields:**
- Username or Mobile Number (text input)
- Password (password input with show/hide eye toggle)
- `Login` button (black, full width)
- `Forgot Password?` link (opens PIN reset or admin override modal)

**Behavior:**
- On submit: check `users` table where `(name = input OR mobile = input) AND password = hashed(input) AND is_active = 1`
- If matched: store `currentUser` in app state (id, name, role, avatar)
- If `is_active = 0`: show error "Account is inactive. Contact your administrator."
- If wrong credentials: show inline error "Invalid username or password."
- After login: redirect to Dashboard
- Company logo and name come from `company_profile` table

**Session Storage (Electron):**
Store logged-in user in `localStorage` or Electron's `safeStorage` / in-memory context.
Clear on app close or explicit logout.

### Logout
- Add a `Logout` option to the user avatar / profile menu in the TopBar (top-right)
- On logout: clear session, redirect to Login screen

### Password Hashing
```javascript
// Use bcryptjs (no native deps, works in Electron renderer)
import bcrypt from 'bcryptjs';
const hash = bcrypt.hashSync(plainPassword, 10);
const valid = bcrypt.compareSync(plainPassword, storedHash);
```

---

## 12. Role-Based Access Control (RBAC)

### Roles
| Role              | Description                                              |
|-------------------|----------------------------------------------------------|
| Owner             | Full access to everything — no restrictions              |
| Accountant        | Reports, Banking, Expenses — read/write                  |
| Billing Operator  | Billing & Invoice only — create/edit/view invoices       |
| Inventory Manager | Inventory & Services only — add/edit/view products       |

### Permission Matrix (Default)

Each permission entry is: `module → [view, create, edit, delete]`

| Module                | Owner | Accountant | Billing Operator | Inventory Manager |
|-----------------------|-------|------------|------------------|-------------------|
| Dashboard             | ✅✅✅✅ | ✅❌❌❌     | ✅❌❌❌           | ✅❌❌❌            |
| Billing & Invoice     | ✅✅✅✅ | ✅❌❌❌     | ✅✅✅❌           | ❌❌❌❌            |
| Inventory & Services  | ✅✅✅✅ | ✅❌❌❌     | ✅❌❌❌           | ✅✅✅✅            |
| Vendors & Purchases   | ✅✅✅✅ | ✅✅✅❌     | ❌❌❌❌           | ✅❌❌❌            |
| Banking               | ✅✅✅✅ | ✅✅✅❌     | ❌❌❌❌           | ❌❌❌❌            |
| Expenses              | ✅✅✅✅ | ✅✅✅✅     | ❌❌❌❌           | ❌❌❌❌            |
| Reports               | ✅✅✅✅ | ✅❌❌❌     | ❌❌❌❌           | ❌❌❌❌            |
| Settings              | ✅✅✅✅ | ❌❌❌❌     | ❌❌❌❌           | ❌❌❌❌            |

> **Note:** These are default permissions. Owner can customize them per user — see Section 12.3.

### SQLite: Permissions Tables

```sql
-- Master permissions registry
CREATE TABLE permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  module      TEXT NOT NULL,   -- 'billing' | 'inventory' | 'vendors' | 'banking' | 'expenses' | 'reports' | 'settings' | 'dashboard'
  action      TEXT NOT NULL,   -- 'view' | 'create' | 'edit' | 'delete'
  UNIQUE(module, action)
);

-- Role-level default permissions
CREATE TABLE role_permissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL,   -- 'Owner' | 'Accountant' | 'Billing Operator' | 'Inventory Manager'
  permission_id INTEGER REFERENCES permissions(id),
  granted       INTEGER DEFAULT 1,  -- 1 = allowed, 0 = denied
  UNIQUE(role, permission_id)
);

-- User-level permission overrides (overrides role defaults for specific user)
CREATE TABLE user_permissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id),
  granted       INTEGER NOT NULL,   -- 1 = allow, 0 = deny
  UNIQUE(user_id, permission_id)
);
```

**Permission resolution order:**
1. Check `user_permissions` for this user — if exists, use it (most specific)
2. Else check `role_permissions` for user's role
3. Owner role always returns `granted = 1` for everything (bypass check)

```javascript
// utils/permissions.js
function can(user, module, action) {
  if (user.role === 'Owner') return true;
  // Check user_permissions first, then role_permissions
  const userOverride = db.prepare(
    `SELECT granted FROM user_permissions up
     JOIN permissions p ON p.id = up.permission_id
     WHERE up.user_id = ? AND p.module = ? AND p.action = ?`
  ).get(user.id, module, action);
  if (userOverride !== undefined) return userOverride.granted === 1;
  const roleDefault = db.prepare(
    `SELECT granted FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role = ? AND p.module = ? AND p.action = ?`
  ).get(user.role, module, action);
  return roleDefault ? roleDefault.granted === 1 : false;
}
```

### Settings > User Management — Permission Assignment UI

When Owner opens a user's edit modal, there is an additional **Permissions** tab/section:

```
┌─────────────────────────────────────────────────────┐
│  User: Sarah Miller    Role: Accountant             │
│                                                     │
│  Module Permissions                                 │
│  ┌──────────────────┬───────┬────────┬──────┬───────┐│
│  │ Module           │ View  │ Create │ Edit │ Delete││
│  ├──────────────────┼───────┼────────┼──────┼───────┤│
│  │ Dashboard        │  ☑    │   ☐    │  ☐   │   ☐   ││
│  │ Billing          │  ☑    │   ☐    │  ☐   │   ☐   ││
│  │ Inventory        │  ☑    │   ☐    │  ☐   │   ☐   ││
│  │ Vendors          │  ☑    │   ☑    │  ☑   │   ☐   ││
│  │ Banking          │  ☑    │   ☑    │  ☑   │   ☐   ││
│  │ Expenses         │  ☑    │   ☑    │  ☑   │   ☑   ││
│  │ Reports          │  ☑    │   ☐    │  ☐   │   ☐   ││
│  │ Settings         │  ☐    │   ☐    │  ☐   │   ☐   ││
│  └──────────────────┴───────┴────────┴──────┴───────┘│
│                                                     │
│  [Reset to Role Defaults]      [Save Permissions]   │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Checkboxes pre-filled from `role_permissions` defaults
- Any change saves to `user_permissions` as override
- "Reset to Role Defaults" deletes all `user_permissions` rows for this user

### Sidebar & UI Enforcement
```javascript
// In Sidebar.jsx — hide nav items user has no view permission for
const navItems = [
  { label: 'Dashboard',            module: 'dashboard',  icon: GridIcon },
  { label: 'Billing & Invoice',    module: 'billing',    icon: InvoiceIcon },
  { label: 'Inventory & Services', module: 'inventory',  icon: BoxIcon },
  { label: 'Vendors & Purchases',  module: 'vendors',    icon: TruckIcon },
  { label: 'Banking',              module: 'banking',    icon: BankIcon },
  { label: 'Expenses',             module: 'expenses',   icon: DollarIcon },
  { label: 'Reports',              module: 'reports',    icon: ChartIcon },
  { label: 'Settings',             module: 'settings',   icon: GearIcon },
].filter(item => can(currentUser, item.module, 'view'));
```

```javascript
// In any page — hide/disable buttons based on action permissions
{can(currentUser, 'billing', 'create') && (
  <button className="btn-black">+ Create Invoice</button>
)}
{can(currentUser, 'billing', 'delete') && (
  <button className="btn-danger">Delete</button>
)}
```

If a user navigates directly to a route they don't have access to, show a full-page **Access Denied** screen:
```
🔒 Access Denied
You don't have permission to view this page.
Contact your administrator to request access.
[← Go Back]
```

---

## 13. Global Search Bar

### Location
Top-right of the `<TopBar />` component — always visible on every screen after login.
Width: ~280–320px. Placeholder: `"Search invoices, products, users..."`

### Behavior: Live Dropdown
As the user types (debounced 300ms), show a floating results dropdown below the search bar.
Minimum 2 characters to trigger search. Show spinner while loading.

### Search Scopes & Result Types

| Scope        | Searches In                                           | Display Fields                                 |
|--------------|-------------------------------------------------------|------------------------------------------------|
| 📄 Invoices  | `invoices.invoice_no`, `invoices.customer_name`, `invoices.customer_phone` | Invoice No, Customer, Date, Amount, Status     |
| 📦 Products  | `products.name`, `products.sku`, `products.barcode`   | SKU, Product Name, Category, Stock, Price      |
| 👤 Users     | `users.name`, `users.mobile`, `users.email`           | Avatar, Name, Role, Status (Owner only)        |
| 🏢 Vendors   | `vendors.vendor_name`, `vendors.company_name`         | Vendor Name, Company, Phone, Outstanding       |
| 💰 Expenses  | `expenses.title`, `expenses.expense_id`               | Expense ID, Title, Amount, Date                |
| 🏦 Transactions | `banking_transactions.txn_id`, `banking_transactions.description` | Txn ID, Description, Amount, Account   |

### Dropdown UI Structure
```
┌──────────────────────────────────────────┐
│ 🔍 "ETS-26"                              │
├──────────────────────────────────────────┤
│ 📄 INVOICES                              │
│   ETS-26001  Harshit Pandey  $500  Paid  │
│   ETS-26002  Sharma Elec.    $300  Draft │
├──────────────────────────────────────────┤
│ 📦 PRODUCTS                              │
│   ITM-001  LED-Bulb 9w  Stock: 450       │
├──────────────────────────────────────────┤
│ 👤 USERS                                 │
│   Harshit Pandey  Accountant  Active     │
├──────────────────────────────────────────┤
│   View all results for "ETS-26" →        │
└──────────────────────────────────────────┘
```

**Click behavior per result type:**
| Result Type  | On Click                                             |
|--------------|------------------------------------------------------|
| Invoice      | Navigate to Billing & Invoice, open invoice detail   |
| Product      | Navigate to Inventory, highlight/open product row    |
| User         | Navigate to Settings > User Management, highlight row|
| Vendor       | Navigate to Vendors & Purchases, highlight row       |
| Expense      | Navigate to Expenses, highlight row                  |
| Transaction  | Navigate to Banking, highlight row                   |

### SQLite Search Query Pattern
```javascript
// ipcMain handler: 'search:global'
ipcMain.handle('search:global', async (event, { query }) => {
  const q = `%${query}%`;
  const invoices = db.prepare(`
    SELECT 'invoice' as type, invoice_no, customer_name, grand_total, status, created_at
    FROM invoices
    WHERE invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?
    LIMIT 5
  `).all(q, q, q);

  const products = db.prepare(`
    SELECT 'product' as type, sku, name, current_stock, selling_price, status
    FROM products
    WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ?
    LIMIT 5
  `).all(q, q, q);

  const vendors = db.prepare(`
    SELECT 'vendor' as type, vendor_name, company_name, phone, outstanding_balance
    FROM vendors
    WHERE vendor_name LIKE ? OR company_name LIKE ?
    LIMIT 3
  `).all(q, q);

  const users = db.prepare(`
    SELECT 'user' as type, name, mobile, role, is_active
    FROM users
    WHERE name LIKE ? OR mobile LIKE ?
    LIMIT 3
  `).all(q, q);

  return { invoices, products, vendors, users };
});
```

### Keyboard Navigation
- `↑` / `↓` arrows navigate through results
- `Enter` selects highlighted result
- `Escape` closes dropdown
- `Ctrl+K` or `Cmd+K` focuses the search bar from anywhere in the app

### Permission Filtering
Search results are filtered based on `currentUser` permissions:
- Only show Invoice results if `can(user, 'billing', 'view')`
- Only show User results if `can(user, 'settings', 'view')` (Owner only)
- Only show Vendor results if `can(user, 'vendors', 'view')`

---

## 14. Barcode Scanning

### Two Scanning Modes

| Mode           | Hardware             | Library                    | Use Case                              |
|----------------|----------------------|----------------------------|---------------------------------------|
| Barcode Gun    | USB HID keyboard     | No library needed — listens to keyboard input | Fast scanning in invoice form  |
| Webcam Scanner | Built-in / USB camera| `@zxing/browser` or `quagga2` | When gun not available, product lookup |

---

### Mode 1: Barcode Gun (USB HID Keyboard Input)

A barcode gun types the barcode value + `Enter` key rapidly into the focused input.

**Implementation:**
```javascript
// In any barcode input field — listen for rapid keystroke bursts
// A barcode gun types a full barcode in < 100ms

let barcodeBuffer = '';
let barcodeTimer = null;

function handleBarcodeInput(e) {
  if (e.key === 'Enter') {
    if (barcodeBuffer.length >= 4) {
      onBarcodeScanned(barcodeBuffer);
    }
    barcodeBuffer = '';
    clearTimeout(barcodeTimer);
    return;
  }
  barcodeBuffer += e.key;
  clearTimeout(barcodeTimer);
  barcodeTimer = setTimeout(() => {
    barcodeBuffer = '';  // reset if typing too slow (human, not gun)
  }, 100);
}

// Attach to document for global gun listening:
document.addEventListener('keydown', handleBarcodeInput);
// Detach when not on an invoice/inventory screen
```

---

### Mode 2: Webcam Scanner

**Library:** `@zxing/browser` (supports Code128, QR, EAN, UPC)

```javascript
import { BrowserMultiFormatReader } from '@zxing/browser';

const codeReader = new BrowserMultiFormatReader();

async function startWebcamScanner(videoElementId, onResult) {
  const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
  const selectedDeviceId = videoInputDevices[0].deviceId; // first camera
  
  codeReader.decodeFromVideoDevice(
    selectedDeviceId,
    videoElementId,
    (result, err) => {
      if (result) {
        onResult(result.getText());
        stopWebcamScanner(); // stop after first scan
      }
    }
  );
}

function stopWebcamScanner() {
  codeReader.reset();
}
```

**Webcam Scanner UI Modal:**
```
┌────────────────────────────────────────┐
│  📷 Scan Barcode                   ✕  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │      [Live Camera Feed]          │  │
│  │                                  │  │
│  │   ┌──────────────────────┐       │  │
│  │   │  Aim barcode here    │       │  │  ← green scanning box overlay
│  │   └──────────────────────┘       │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Or enter barcode manually:            │
│  [________________________] [Search]   │
│                                        │
│  Camera: [Default Camera     ▼]        │
└────────────────────────────────────────┘
```

---

### Barcode Scan Context Behaviors

#### Context 1: Invoice Form (Add Item to Invoice)
- Scan input field is always focused when invoice form is open
- Gun scan or webcam result → query `products` WHERE `barcode = scannedValue`
- **If product found:** add row to invoice items table (qty = 1, rate = selling_price)
  - If product already in list, increment qty by 1
  - Show brief green toast: "✓ LED Bulb 9w added"
- **If NOT found:** show red toast: "✗ Product not found for barcode: XXXX"
- Webcam scanner triggered by clicking the barcode icon in the invoice search bar

#### Context 2: Inventory & Services (Product Lookup)
- A `🔍 Scan` button in the inventory search bar opens webcam scanner modal
- After scan → query products by barcode
- **If found:** highlight the product row (yellow flash), scroll into view, show product info popup
- **If NOT found:** show "Product not found — would you like to add it?" prompt with `+ Add Product` button pre-filled with barcode

#### Context 3: Product Info Popup (anywhere)
When a barcode is scanned outside the invoice form context, show a floating popup:
```
┌──────────────────────────────────┐
│  📦 LED Bulb 9w                  │
│  SKU: ITM-001  |  HSN: 85395000  │
│  Category: LED & Lighting        │
│  Purchase Price: $120            │
│  Selling Price:  $140            │
│  Current Stock: 450  [Good ✓]    │
│  Barcode: 85395000123            │
│                                  │
│  [Add to Invoice]  [View Detail] │
└──────────────────────────────────┘
```

#### Context 4: Add New Product (Barcode Upload)
- In the Add Product modal, clicking the barcode scan zone activates webcam scanner
- Scanned value auto-fills the `barcode` field
- Shows the barcode value as text + a rendered barcode image preview

---

### Barcode IPC Handler
```javascript
// main.js
ipcMain.handle('products:findByBarcode', async (event, barcode) => {
  return db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.barcode = ? AND p.is_active = 1
  `).get(barcode);
});
```

---

### Global Barcode Listener (App-Wide)
Register a global keydown listener at the App root level. Detect if rapid input pattern matches a barcode gun. Route to the correct handler based on which screen is currently active:

```javascript
// App.jsx
useEffect(() => {
  const handleGlobalBarcode = (scannedValue) => {
    if (currentScreen === 'billing' && invoiceFormOpen) {
      addItemToInvoice(scannedValue);
    } else if (currentScreen === 'inventory') {
      searchAndHighlightProduct(scannedValue);
    } else {
      showProductInfoPopup(scannedValue);
    }
  };
  registerBarcodeGunListener(handleGlobalBarcode);
  return () => unregisterBarcodeGunListener();
}, [currentScreen, invoiceFormOpen]);
```

---

## 15. Updated File / Folder Structure

```
/src
  /main
    main.js              ← Electron entry, all IPC handlers
    database.js          ← SQLite init + all DB queries
    preload.js           ← contextBridge
  /renderer
    /components
      Sidebar.jsx         ← filters nav items by permission
      TopBar.jsx          ← includes GlobalSearchBar + user avatar/logout
      StatCard.jsx
      DataTable.jsx
      Modal.jsx
      TabPills.jsx
      StatusBadge.jsx
      GlobalSearchBar.jsx ← live dropdown search component
      BarcodeScanner.jsx  ← webcam scanner modal
      ProductInfoPopup.jsx← popup shown on barcode scan (non-invoice context)
      PermissionGate.jsx  ← wrapper: <PermissionGate module="billing" action="create">
      AccessDenied.jsx    ← full-page access denied screen
    /pages
      Login.jsx           ← login screen (shown before auth)
      Dashboard.jsx
      BillingInvoice.jsx
      CreateInvoiceForm.jsx
      InventoryServices.jsx
      VendorsPurchases.jsx
      Banking.jsx
      Expenses.jsx
      Reports.jsx
      Settings.jsx
    /hooks
      useAuth.js          ← currentUser state, login(), logout()
      usePermissions.js   ← can(module, action) hook
      useBarcodeGun.js    ← barcode gun listener hook
      useSearch.js        ← debounced global search hook
    /utils
      invoiceNumber.js
      stockUtils.js
      exportUtils.js
      permissions.js      ← can() helper function
      barcodeUtils.js     ← gun detection + ZXing webcam wrapper
    /context
      AuthContext.jsx     ← provides currentUser app-wide
      PermissionContext.jsx
    App.jsx               ← wraps routes in AuthContext, handles login redirect
    index.jsx
/public
  index.html
package.json
```

---

## 16. Updated Critical Don'ts

- ❌ Do NOT show any screen (except Login) before authentication check
- ❌ Do NOT hardcode permissions — always resolve via `can()` helper
- ❌ Do NOT show sidebar items the user has no `view` permission for
- ❌ Do NOT allow non-Owner users to access Settings
- ❌ Do NOT store plain text passwords — always use `bcryptjs` hash
- ❌ Do NOT let barcode gun input interfere with normal text typing — use the 100ms burst detection
- ❌ Do NOT keep webcam stream open after modal closes — always call `codeReader.reset()`
- ✅ DO show "Access Denied" page for direct URL navigation to unauthorized routes
- ✅ DO filter search results by user permissions before displaying
- ✅ DO show toast notifications for barcode scan success/failure
- ✅ DO allow Owner to override any permission per user (not just by role)
- ✅ DO use `Ctrl+K` / `Cmd+K` as global keyboard shortcut to open search

---

## 17. Gap Analysis Findings & Planned Changes (v2 — March 2026)

A full comparison of this spec against the live codebase revealed the following gaps.
All items below are **required** for the next implementation pass.

---

### 17.1 Schema Additions

The following columns and tables must be added (use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in migrations):

#### users — add branch_id
```sql
ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id);
```

#### products — add branch_id
```sql
ALTER TABLE products ADD COLUMN branch_id INTEGER REFERENCES branches(id);
```

#### expenses — add branch_id
```sql
ALTER TABLE expenses ADD COLUMN branch_id INTEGER REFERENCES branches(id);
```

#### banking_transactions — add branch_id
```sql
ALTER TABLE banking_transactions ADD COLUMN branch_id INTEGER REFERENCES branches(id);
```

#### customers — add branch_id
```sql
ALTER TABLE customers ADD COLUMN branch_id INTEGER REFERENCES branches(id);
```

#### branches — add code & contact columns
```sql
ALTER TABLE branches ADD COLUMN code TEXT;
ALTER TABLE branches ADD COLUMN contact TEXT;
```

#### New table: `app_settings` (currency, language)
```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- seed defaults:
-- INSERT OR IGNORE INTO app_settings VALUES ('currency', 'INR');
-- INSERT OR IGNORE INTO app_settings VALUES ('currency_symbol', '₹');
-- INSERT OR IGNORE INTO app_settings VALUES ('language', 'en');
-- INSERT OR IGNORE INTO app_settings VALUES ('date_format', 'DD/MM/YYYY');
```

---

### 17.2 Invoice Status Machine (CRITICAL)

The correct invoice status values are:
```
'Draft' → 'Active' → 'Credit' (if unpaid) | 'Paid' (if paid)
         → 'return_window' (within 15 days of Active/Paid/Credit)
         → 'Completed' (auto-lock after 15 days)
```

- `'return_window'` must be set when an invoice transitions to Active/Paid/Credit. It means the invoice is still editable for returns.
- `'Completed'` must be auto-set by a background interval check in `main.js` that runs every hour.
- Once `'Completed'`, the invoice is READ-ONLY. All edit/return buttons must be hidden.
- The `returns:create` IPC handler must validate: `julianday('now') - julianday(invoice_date) <= 15`.

---

### 17.3 New IPC Handlers Required

Add all of the following to `ipcHandlers.js`:

| Channel | Description |
|---------|-------------|
| `vendors:update` | Edit existing vendor (all fields) |
| `branches:create` | Create new branch |
| `branches:update` | Edit branch name/code/address/contact |
| `branches:delete` | Soft-delete branch (is_active=0) |
| `purchases:createReturn` | Create purchase return, adjust stock |
| `reports:expenses` | Expense report with from/to date range and branch filter |
| `settings:getAll` | Return all rows from app_settings as key-value map |
| `settings:saveAll` | Upsert multiple key-value rows in app_settings |
| `settings:uploadLogo` | Copy logo file to userData dir, save logo_path |
| `settings:restoreBackup` | Copy backup SQLite file back into place |
| `products:importCSV` | Bulk-upsert products from parsed CSV/XLSX array |
| `products:exportCSV` | Return all products as array for XLSX export |

**Server-side permission enforcement pattern** (add to EVERY handler that writes data):
```js
// at top of handler, after const db = getDb():
// (pass { userId, role } in every IPC call from frontend)
// if (role !== 'Owner') {
//   const allowed = checkPermission(db, userId, role, 'module', 'action');
//   if (!allowed) return { success: false, error: 'Permission denied' };
// }
```

---

### 17.4 Branch-Based Data Rules

**ALL queries that return lists must accept a `branch_id` parameter:**
- If `branch_id` is provided (and user is not Owner/Super-Admin viewing all), add `WHERE … AND table.branch_id = ?`
- Dashboard stats must be filtered by the user's branch unless they are Owner (who sees all)
- Reports must expose a branch selector dropdown: `All Branches | Branch 1 | Branch 2 | …`

**Auth context must expose `user.branch_id`** so every page can pass it to IPC calls.

---

### 17.5 Settings Page — New Sections

The Settings page must have **5 tabs** (not 4):
1. Company Profile ← update logo upload button to use `settings:uploadLogo`
2. Account Management ← unchanged
3. User Management ← add Branch dropdown to add/edit user form
4. Branch Management ← **NEW TAB**: list branches, add/edit/delete via `branches:*` handlers
5. Backup & Restore ← wire Restore button to `settings:restoreBackup`

Below the 5 tabs, add a sixth settings group accessible from a link/tab:
6. Currency & Language ← dropdowns for currency and language, saved via `settings:saveAll`

---

### 17.6 Reports Page — New Tab

Add **Expense Report** tab to the Reports page:
- Filters: From date, To date, Branch (All / per branch), Category (All / per category)
- Table: Expense ID | Title | Category | Amount | Date | Paid From
- Summary row: Total expenses in period
- Export to Excel button

---

### 17.7 Banking Auto-Linkage

When any of the following events occurs, **automatically** insert a `banking_transactions` row:
- Sale finalized (status → Paid or Active with Cash/Card/UPI): Debit from account = payment_mode account
- Expense created: Debit from `account_id`
- Vendor payment (paybills:create): Debit from payment account

The existing manual "Add Transaction" in Banking remains for adjustments.

---

### 17.8 Inventory — Import / Export

On the Inventory page, add two buttons to the header row:
- **Import CSV** — opens a file dialog (via `dialog.showOpenDialog`), reads the file, calls `products:importCSV`
- **Export** — calls `products:exportCSV`, then uses `xlsx` to write to file via `dialog.showSaveDialog`

CSV format for import:
```
name,category,purchase_price,selling_price,current_stock,reorder_level,barcode,unit,hsn_code
```

---

### 17.9 Vendor Edit

The vendor row kebab menu must include an **Edit** action that opens the existing Add Vendor modal pre-filled.
The `vendors:update` handler updates all vendor fields by `id`.

---

### 17.10 Purchase Return Flow

In VendorsPurchases, when a user selects "Return" on a purchase invoice:
1. A modal lists the purchased items with a `return_qty` input per item
2. On save, calls `purchases:createReturn` which:
   - Inserts into `purchase_returns` and `purchase_return_items`
   - Reduces `current_stock` by `return_qty` for each returned item
   - Updates `purchase_invoices.status` appropriately
3. Stock status recalculates (Good / Low / Critical)

---

### 17.11 Additional Don'ts (v2)

- ❌ Do NOT run any `getAll` query without passing `branch_id` (unless user is Owner)
- ❌ Do NOT allow return/exchange on invoices older than 15 days — reject in both UI and IPC handler
- ❌ Do NOT allow editing of `Completed` invoices — hide all edit/return buttons when status = Completed
- ❌ Do NOT allow branches to be deleted if they have linked invoices/products — show error instead
- ✅ DO auto-create banking_transactions entries on every sale, expense, and vendor payment
- ✅ DO validate permissions server-side in every write IPC handler
- ✅ DO show branch selector in Reports header, filter all report data by selected branch
- ✅ DO use `julianday()` SQLite function for 15-day return window validation

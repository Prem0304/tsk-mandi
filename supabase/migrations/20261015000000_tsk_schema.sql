-- ============================================================================
-- TSK TOMATO AND VEGETABLE MANDI - COMPLETE SUPABASE POSTGRESQL SCHEMA
-- PRODUCTION READY WITH RLS, VIEWS, FUNCTIONS & AUDIT LOGGING
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    shop_name TEXT NOT NULL DEFAULT 'TSK Tomato and Vegetable Mandi',
    shop_name_ta TEXT NOT NULL DEFAULT 'TSK தக்காளி மற்றும் காய்கறி மண்டி',
    logo_url TEXT,
    address TEXT NOT NULL DEFAULT 'Wholesale Market Yard, Dindigul Road',
    phone TEXT NOT NULL DEFAULT '9876543210',
    upi_id TEXT NOT NULL DEFAULT 'tsk@upi',
    gst_number TEXT,
    bill_footer TEXT DEFAULT 'Thank you for your business! Please return empty crates promptly.',
    bill_footer_ta TEXT DEFAULT 'உங்கள் வணிகத்திற்கு நன்றி! காலி பெட்டிகளை உடனடியாக திருப்பித் தரவும்.',
    payment_allocation_rule TEXT NOT NULL DEFAULT 'supplier_first' CHECK (payment_allocation_rule IN ('supplier_first', 'proportional')),
    bill_allocation_rule TEXT NOT NULL DEFAULT 'fifo' CHECK (bill_allocation_rule IN ('fifo', 'manual')),
    lot_allocation_rule TEXT NOT NULL DEFAULT 'fifo' CHECK (lot_allocation_rule IN ('fifo', 'manual')),
    auto_mark_supplier_paid BOOLEAN NOT NULL DEFAULT FALSE,
    default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en', 'ta')),
    crate_aging_days INTEGER NOT NULL DEFAULT 15,
    low_stock_threshold INTEGER NOT NULL DEFAULT 20,
    auto_lock_minutes INTEGER NOT NULL DEFAULT 10,
    bill_prefix TEXT NOT NULL DEFAULT 'TSK-',
    bill_print_size TEXT NOT NULL DEFAULT 'thermal_80' CHECK (bill_print_size IN ('a4', 'a5', 'thermal_58', 'thermal_80')),
    app_pin TEXT DEFAULT '1234',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USERS & ROLES
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'entry_staff', 'view_only')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CRATE CATEGORIES
CREATE TABLE IF NOT EXISTS crate_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ta TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial categories
INSERT INTO crate_categories (id, name, name_ta, display_order)
VALUES 
    ('big', 'Big Crate', 'பெரிய பெட்டி', 1),
    ('small', 'Small Crate', 'சிறிய பெட்டி', 2)
ON CONFLICT (id) DO NOTHING;

-- 4. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alt_phone TEXT,
    place TEXT,
    gst_number TEXT,
    notes TEXT,
    opening_money_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_crates JSONB NOT NULL DEFAULT '{"big": 0, "small": 0}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 5. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    shop_name TEXT,
    phone TEXT NOT NULL,
    alt_phone TEXT,
    place TEXT,
    notes TEXT,
    opening_money_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_crates JSONB NOT NULL DEFAULT '{"big": 0, "small": 0}'::jsonb,
    credit_limit NUMERIC(12, 2),
    crate_limits JSONB DEFAULT '{"big": null, "small": null}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. DAILY RATE BOARD
CREATE TABLE IF NOT EXISTS daily_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    rates JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"big": {"buying": 300, "selling": 350}, "small": {"buying": 200, "selling": 240}}
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PURCHASES
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    bill_no TEXT NOT NULL,
    vehicle_no TEXT,
    transport_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    transport_paid_by TEXT NOT NULL DEFAULT 'supplier_bill' CHECK (transport_paid_by IN ('supplier_bill', 'self_expense', 'none')),
    labour_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    loading_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_crates INTEGER NOT NULL DEFAULT 0,
    subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid_now NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'bank', 'cheque')),
    payment_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 8. PURCHASE LINES & LOTS (Each purchase line forms a distinct stock lot)
CREATE TABLE IF NOT EXISTS purchase_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    lot_no TEXT NOT NULL UNIQUE,
    category_id TEXT NOT NULL REFERENCES crate_categories(id),
    crates_purchased INTEGER NOT NULL CHECK (crates_purchased > 0),
    crates_remaining INTEGER NOT NULL CHECK (crates_remaining >= 0),
    crates_wasted INTEGER NOT NULL DEFAULT 0 CHECK (crates_wasted >= 0),
    price_per_crate NUMERIC(10, 2) NOT NULL CHECK (price_per_crate >= 0),
    transport_share NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    effective_cost_per_crate NUMERIC(10, 2) NOT NULL CHECK (effective_cost_per_crate >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    is_fully_sold BOOLEAN NOT NULL DEFAULT FALSE,
    is_fully_collected BOOLEAN NOT NULL DEFAULT FALSE,
    is_settled_with_supplier BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. SALES
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    bill_no TEXT NOT NULL UNIQUE,
    transport_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    bill_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_received_now NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'bank', 'cheque')),
    payment_ref TEXT,
    total_crates INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 10. SALE LINES
CREATE TABLE IF NOT EXISTS sale_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES crate_categories(id),
    crates INTEGER NOT NULL CHECK (crates > 0),
    price_per_crate NUMERIC(10, 2) NOT NULL CHECK (price_per_crate >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. SALE LOT ALLOCATIONS (Detailed FIFO or manual breakdown per sale line)
CREATE TABLE IF NOT EXISTS sale_lot_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    sale_line_id UUID NOT NULL REFERENCES sale_lines(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES purchase_lines(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    crates INTEGER NOT NULL CHECK (crates > 0),
    cost_per_crate NUMERIC(10, 2) NOT NULL,
    sale_price_per_crate NUMERIC(10, 2) NOT NULL,
    cost_amount NUMERIC(12, 2) NOT NULL, -- Supplier's share of this allocation
    sale_amount NUMERIC(12, 2) NOT NULL,
    booked_profit NUMERIC(12, 2) NOT NULL, -- sale_amount - cost_amount
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PAYMENTS RECEIVED (From Customers)
CREATE TABLE IF NOT EXISTS payments_received (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL, -- optional direct bill link
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode IN ('cash', 'upi', 'bank', 'cheque')),
    reference_no TEXT,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 13. PAYMENT ALLOCATIONS (Core Section 9A: Split into Supplier Share + Profit)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments_received(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    lot_id UUID REFERENCES purchase_lines(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    is_opening_balance BOOLEAN NOT NULL DEFAULT FALSE,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
    supplier_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Clears supplier cost
    transport_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Transport recovery
    profit_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Realised profit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. PAYMENTS MADE (To Suppliers)
CREATE TABLE IF NOT EXISTS payments_made (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode IN ('cash', 'upi', 'bank', 'cheque')),
    reference_no TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 15. STOCK ADJUSTMENTS & WASTAGE
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category_id TEXT NOT NULL REFERENCES crate_categories(id),
    lot_id UUID REFERENCES purchase_lines(id) ON DELETE RESTRICT,
    crates INTEGER NOT NULL CHECK (crates > 0),
    cost_per_crate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Supplier still owed this; owner loss
    reason TEXT NOT NULL CHECK (reason IN ('spoiled', 'damaged', 'sample', 'count_correction', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 16. CRATE MOVEMENTS (Physical Crate Accounts: Full Tracking, Count Only)
CREATE TABLE IF NOT EXISTS crate_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category_id TEXT NOT NULL REFERENCES crate_categories(id),
    party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier', 'shop', 'internal')),
    party_id UUID, -- References customers(id) or suppliers(id) or NULL
    qty_in INTEGER NOT NULL DEFAULT 0 CHECK (qty_in >= 0),
    qty_out INTEGER NOT NULL DEFAULT 0 CHECK (qty_out >= 0),
    ownership TEXT NOT NULL DEFAULT 'shop' CHECK (ownership IN ('shop', 'supplier')),
    ref_type TEXT NOT NULL CHECK (ref_type IN ('purchase', 'sale', 'customer_return', 'supplier_return', 'damaged', 'lost', 'physical_count', 'new_purchase', 'opening')),
    ref_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 17. CRATE INVENTORY EVENTS (Shop Owned Crate Tracking)
CREATE TABLE IF NOT EXISTS crate_inventory_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category_id TEXT NOT NULL REFERENCES crate_categories(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('new_purchase', 'damaged', 'lost', 'physical_count')),
    qty INTEGER NOT NULL CHECK (qty >= 0),
    unit_cost NUMERIC(10, 2) DEFAULT 0.00,
    total_cost NUMERIC(12, 2) DEFAULT 0.00,
    party_type TEXT CHECK (party_type IN ('customer', 'supplier', 'shop')),
    party_id UUID,
    system_count INTEGER,
    physical_count INTEGER,
    difference INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 18. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL, -- 'Transport', 'Labour/Hamali', 'Loading', 'Rent', 'Electricity', 'Tea/Snacks', 'Crate Purchase', 'Other'
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode IN ('cash', 'upi', 'bank', 'cheque')),
    ref_type TEXT,
    ref_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 19. CASH BOOK CLOSINGS
CREATE TABLE IF NOT EXISTS cash_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    closing_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    expected_closing NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    actual_closing NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upi_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upi_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    is_closed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID,
    user_name TEXT NOT NULL DEFAULT 'Owner',
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'soft_delete', 'restore')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    description TEXT
);

-- 21. DISCOUNTS & BAD DEBTS WRITE-OFFS
CREATE TABLE IF NOT EXISTS discounts_writeoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('discount', 'bad_debt')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- SQL VIEWS FOR ANALYTICS, DASHBOARD AND BALANCES
-- ============================================================================

-- Stock by Category
CREATE OR REPLACE VIEW view_stock_by_category AS
SELECT 
    cc.id AS category_id,
    cc.name AS category_name,
    cc.name_ta AS category_name_ta,
    COALESCE(SUM(pl.crates_remaining), 0)::INTEGER AS available_stock,
    COALESCE(SUM(pl.crates_purchased), 0)::INTEGER AS total_purchased,
    COALESCE(SUM(pl.crates_wasted), 0)::INTEGER AS total_wasted
FROM crate_categories cc
LEFT JOIN purchase_lines pl ON pl.category_id = cc.id AND pl.crates_remaining > 0
GROUP BY cc.id, cc.name, cc.name_ta;

-- Customer Money Balance
CREATE OR REPLACE VIEW view_customer_balance AS
WITH cust_sales AS (
    SELECT customer_id, COALESCE(SUM(bill_total), 0) AS total_billed
    FROM sales WHERE deleted_at IS NULL GROUP BY customer_id
),
cust_payments AS (
    SELECT customer_id, COALESCE(SUM(amount + discount), 0) AS total_paid
    FROM payments_received WHERE deleted_at IS NULL GROUP BY customer_id
),
cust_writeoffs AS (
    SELECT customer_id, COALESCE(SUM(amount), 0) AS total_written_off
    FROM discounts_writeoffs WHERE deleted_at IS NULL GROUP BY customer_id
)
SELECT 
    c.id AS customer_id,
    c.name AS customer_name,
    c.phone,
    c.credit_limit,
    c.opening_money_balance,
    COALESCE(cs.total_billed, 0) AS total_billed,
    COALESCE(cp.total_paid, 0) AS total_paid,
    COALESCE(cw.total_written_off, 0) AS total_written_off,
    (c.opening_money_balance + COALESCE(cs.total_billed, 0) - COALESCE(cp.total_paid, 0) - COALESCE(cw.total_written_off, 0)) AS current_balance
FROM customers c
LEFT JOIN cust_sales cs ON cs.customer_id = c.id
LEFT JOIN cust_payments cp ON cp.customer_id = c.id
LEFT JOIN cust_writeoffs cw ON cw.customer_id = c.id
WHERE c.deleted_at IS NULL;

-- Supplier Money Balance & Clearance
CREATE OR REPLACE VIEW view_supplier_collection_summary AS
WITH supp_purchases AS (
    SELECT 
        supplier_id, 
        COALESCE(SUM(net_amount), 0) AS total_purchased_due
    FROM purchases WHERE deleted_at IS NULL GROUP BY supplier_id
),
supp_collected AS (
    SELECT 
        supplier_id, 
        COALESCE(SUM(supplier_share), 0) AS collected_from_customers
    FROM payment_allocations 
    WHERE supplier_id IS NOT NULL 
    GROUP BY supplier_id
),
supp_paid AS (
    SELECT 
        supplier_id, 
        COALESCE(SUM(amount), 0) AS paid_out_to_supplier
    FROM payments_made WHERE deleted_at IS NULL GROUP BY supplier_id
)
SELECT 
    s.id AS supplier_id,
    s.name AS supplier_name,
    s.phone,
    s.opening_money_balance,
    (s.opening_money_balance + COALESCE(sp.total_purchased_due, 0)) AS total_due,
    COALESCE(sc.collected_from_customers, 0) AS collected_from_customers,
    COALESCE(spd.paid_out_to_supplier, 0) AS paid_out_to_supplier,
    -- Money in Hand for Supplier = Collected - Paid Out
    (COALESCE(sc.collected_from_customers, 0) - COALESCE(spd.paid_out_to_supplier, 0)) AS money_in_hand,
    -- Still to Collect = Total Due - Collected
    ((s.opening_money_balance + COALESCE(sp.total_purchased_due, 0)) - COALESCE(sc.collected_from_customers, 0)) AS still_to_collect,
    -- Total Balance Payable = Total Due - Paid Out
    ((s.opening_money_balance + COALESCE(sp.total_purchased_due, 0)) - COALESCE(spd.paid_out_to_supplier, 0)) AS balance_payable
FROM suppliers s
LEFT JOIN supp_purchases sp ON sp.supplier_id = s.id
LEFT JOIN supp_collected sc ON sc.supplier_id = s.id
LEFT JOIN supp_paid spd ON spd.supplier_id = s.id
WHERE s.deleted_at IS NULL;

-- Customer Crate Balance
CREATE OR REPLACE VIEW view_customer_crate_balance AS
SELECT 
    c.id AS customer_id,
    c.name AS customer_name,
    cm.category_id,
    COALESCE(SUM(cm.qty_out), 0) - COALESCE(SUM(cm.qty_in), 0) AS crates_held
FROM customers c
LEFT JOIN crate_movements cm ON cm.party_id = c.id AND cm.party_type = 'customer' AND cm.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, cm.category_id;

-- Supplier Crate Balance (Owed to Supplier)
CREATE OR REPLACE VIEW view_supplier_crate_balance AS
SELECT 
    s.id AS supplier_id,
    s.name AS supplier_name,
    cm.category_id,
    COALESCE(SUM(cm.qty_in), 0) - COALESCE(SUM(cm.qty_out), 0) AS crates_owed_to_supplier
FROM suppliers s
LEFT JOIN crate_movements cm ON cm.party_id = s.id AND cm.party_type = 'supplier' AND cm.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, cm.category_id;

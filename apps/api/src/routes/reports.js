const router = require('express').Router();
const db = require('../db/pg');

// Sales report
router.get('/sales', async (req, res) => {
  try {
    const { from, to, branch_id } = req.query;
    let query = db('invoices').whereNotIn('status', ['Draft', 'Deleted']);
    if (from) query = query.where('invoice_date', '>=', from);
    if (to) query = query.where('invoice_date', '<=', to);
    if (branch_id) query = query.where('branch_id', branch_id);
    const invoices = await query.orderBy('invoice_date', 'desc');
    const totalSales = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
    const totalPending = invoices.reduce((s, i) => s + ((i.grand_total || 0) - (i.paid_amount || 0)), 0);
    res.json({ invoices, totalSales, totalPaid, totalPending });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Purchase report
router.get('/purchases', async (req, res) => {
  try {
    const { from, to, vendor_id } = req.query;
    let query = db('purchase_invoices as pi')
      .leftJoin('vendors as v', 'v.id', 'pi.vendor_id')
      .select('pi.*', 'v.vendor_name');
    if (from) query = query.where('pi.purchase_date', '>=', from);
    if (to) query = query.where('pi.purchase_date', '<=', to);
    if (vendor_id) query = query.where('pi.vendor_id', vendor_id);
    const purchases = await query.orderBy('pi.purchase_date', 'desc');
    const totalPurchases = purchases.reduce((s, p) => s + (p.grand_total || 0), 0);
    res.json({ purchases, totalPurchases });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expense report
router.get('/expenses', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    let query = db('expenses as e')
      .leftJoin('expense_categories as ec', 'ec.id', 'e.category_id')
      .select('e.*', 'ec.name as category_name');
    if (from) query = query.where('e.expense_date', '>=', from);
    if (to) query = query.where('e.expense_date', '<=', to);
    if (category) query = query.where('e.category_id', category);
    const expenses = await query.orderBy('e.expense_date', 'desc');
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ expenses, totalExpenses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #8a: was referencing non-existent table `product_categories` — correct table is `categories`
// Inventory / stock value report
router.get('/inventory', async (req, res) => {
  try {
    const { category_id, status } = req.query;
    let query = db('products as p')
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .select('p.*', 'c.name as category_name')
      .where('p.is_active', true);
    if (category_id) query = query.where('p.category_id', category_id);
    if (status) query = query.where('p.status', status);
    const products = await query.orderBy('p.name');
    const totalValue = products.reduce((s, p) => s + ((p.current_stock || 0) * (p.purchase_price || 0)), 0);
    res.json({ products, totalValue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Profit & loss
router.get('/profit-loss', async (req, res) => {
  try {
    const { from, to } = req.query;
    let iq = db('invoices').whereNotIn('status', ['Draft', 'Deleted']);
    let eq = db('expenses');
    if (from) { iq = iq.where('invoice_date', '>=', from); eq = eq.where('expense_date', '>=', from); }
    if (to) { iq = iq.where('invoice_date', '<=', to); eq = eq.where('expense_date', '<=', to); }
    const salesTotal = Number((await iq.clone().sum('grand_total as t').first())?.t || 0);
    const costTotal = Number((await iq.clone().sum('subtotal as t').first())?.t || 0);
    const expenseTotal = Number((await eq.clone().sum('amount as t').first())?.t || 0);
    const grossProfit = salesTotal - costTotal;
    const netProfit = grossProfit - expenseTotal;
    res.json({ salesTotal, costTotal, grossProfit, expenseTotal, netProfit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer outstanding
router.get('/customer-outstanding', async (req, res) => {
  try {
    const rows = await db('invoices')
      .select('customer_name', 'invoice_no', 'invoice_date', db.raw('grand_total as total_amount'), 'paid_amount', db.raw('(grand_total-paid_amount) as balance'))
      .where('is_credit_sale', true)
      .whereNotIn('status', ['Draft', 'Deleted'])
      .orderBy('invoice_date', 'desc');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vendor outstanding
router.get('/vendor-outstanding', async (req, res) => {
  try {
    const rows = await db('purchase_invoices as pi')
      .join('vendors as v', 'v.id', 'pi.vendor_id')
      .select('v.vendor_name', 'pi.po_number as bill_no', 'pi.purchase_date as bill_date', db.raw('pi.grand_total as total_amount'), db.raw('COALESCE(pi.paid_amount,0) as paid_amount'), db.raw('(pi.grand_total - COALESCE(pi.paid_amount,0)) as balance'))
      .whereNot('pi.status', 'Received')
      .orderBy('pi.purchase_date', 'desc');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Balance sheet
router.get('/balance-sheet', async (req, res) => {
  try {
    const cashAccounts = await db('accounts').select('account_name', 'current_balance', 'is_primary').whereIn('account_type', ['Cash', 'Bank']).andWhere('is_active', true);
    const closingStock = Number((await db('products').where('is_active', true).sum(db.raw('current_stock*purchase_price as val')).first())?.val || 0);
    const customerOutstanding = Number((await db('invoices').where('is_credit_sale', true).sum(db.raw('grand_total-paid_amount as val')).first())?.val || 0);
    const vendorOutstanding = Number((await db('purchase_invoices').whereNot('status', 'Received').sum(db.raw('grand_total-COALESCE(paid_amount,0) as val')).first())?.val || 0);
    const ownerCapital = Number((await db('accounts').where('account_type', 'Capital').sum('opening_balance as val').first())?.val || 0);
    const totalRevenue = Number((await db('invoices').whereNotIn('status', ['Draft', 'Deleted']).sum('grand_total as val').first())?.val || 0);
    const totalCost = Number((await db('purchase_invoices').whereNot('status', 'Pending').sum('grand_total as val').first())?.val || 0);
    const totalExpenses = Number((await db('expenses').sum('amount as val').first())?.val || 0);
    const retainedEarnings = totalRevenue - totalCost - totalExpenses;
    res.json({ cashAccounts, closingStock, customerOutstanding, vendorOutstanding, ownerCapital, retainedEarnings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #8b: was referencing non-existent `product_categories` — correct table is `categories`
// Stock movement report
router.get('/stock', async (req, res) => {
  try {
    const rows = await db('products as p')
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .leftJoin('purchase_invoice_items as pii', 'pii.product_id', 'p.id')
      .leftJoin('invoice_items as ii', 'ii.product_id', 'p.id')
      .where('p.is_active', true)
      .groupBy('p.id', 'c.name')
      .select(
        'p.name as item_name',
        'c.name as category',
        'p.opening_stock',
        'p.current_stock',
        'p.purchase_price',
        'p.selling_price',
        db.raw('COALESCE(SUM(DISTINCT pii.qty),0) as purchase_qty'),
        db.raw('COALESCE(SUM(DISTINCT ii.qty),0) as sales_qty'),
        db.raw('ROUND(((p.selling_price-p.purchase_price)/NULLIF(p.selling_price,0))*100,2) as profit_margin'),
      );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer ledger — looks up by customer name since invoices store customer_name not customer_id
router.get('/customer-ledger', async (req, res) => {
  try {
    const { customer_name } = req.query;
    if (!customer_name) return res.status(400).json({ error: 'customer_name required' });
    const invoices = await db('invoices')
      .where('customer_name', 'like', `%${customer_name}%`)
      .orderBy('invoice_date', 'desc');
    const totalBilled = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
    res.json({ customer_name, invoices, totalBilled, totalPaid, outstanding: totalBilled - totalPaid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

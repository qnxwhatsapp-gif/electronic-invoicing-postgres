const router = require('express').Router();
const db = require('../db/pg');

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ invoices: [], products: [], vendors: [], users: [], expenses: [] });
    const s = `%${q}%`;
    const invoices = await db('invoices')
      .select(db.raw("'invoice' as type"), 'id', 'invoice_no', 'customer_name', 'grand_total', 'status', 'invoice_date as date')
      .where((qb) => qb.where('invoice_no', 'like', s).orWhere('customer_name', 'like', s).orWhere('customer_phone', 'like', s))
      .limit(5);
    const products = await db('products')
      .select(db.raw("'product' as type"), 'id', 'sku', 'name', 'current_stock', 'selling_price', 'status')
      .where((qb) => qb.where('name', 'like', s).orWhere('sku', 'like', s).orWhere('barcode', 'like', s))
      .andWhere('is_active', true)
      .limit(5);
    const vendors = await db('vendors')
      .select(db.raw("'vendor' as type"), 'id', 'vendor_name as name', 'company_name', 'phone')
      .where((qb) => qb.where('vendor_name', 'like', s).orWhere('company_name', 'like', s))
      .limit(3);
    const users = await db('users')
      .select(db.raw("'user' as type"), 'id', 'name', 'mobile', 'role', 'is_active')
      .where((qb) => qb.where('name', 'like', s).orWhere('mobile', 'like', s))
      .limit(3);
    const expenses = await db('expenses')
      .select(db.raw("'expense' as type"), 'id', 'description as name', 'amount', 'expense_date as date')
      .where('description', 'like', s)
      .limit(3);
    res.json({ invoices, products, vendors, users, expenses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const { branch_id } = req.query;

    // BUG FIX #10: was using string interpolation `AND branch_id = ${parseInt(branch_id)}`
    // which is an SQL injection risk. All filters must use parameterized queries.
    const branchParams = branch_id ? [parseInt(branch_id, 10)] : [];
    const branchSuffix = branch_id ? ` AND branch_id = ?` : '';

    const totalSale = db.prepare(
      `SELECT COALESCE(SUM(grand_total),0) as t FROM invoices WHERE status NOT IN ('Draft','Deleted')${branchSuffix}`
    ).get(...branchParams).t;

    const totalProfit = db.prepare(
      `SELECT COALESCE(SUM(grand_total - subtotal),0) as t FROM invoices WHERE status NOT IN ('Draft','Deleted')${branchSuffix}`
    ).get(...branchParams).t;

    const pendingPayment = db.prepare(
      `SELECT COALESCE(SUM(grand_total - paid_amount),0) as t FROM invoices WHERE is_credit_sale=1 AND status IN ('Credit','Overdue')${branchSuffix}`
    ).get(...branchParams).t;

    const cashBalance = db.prepare(
      `SELECT COALESCE(SUM(current_balance),0) as t FROM accounts WHERE account_type='Cash' AND is_active=1`
    ).get().t;

    const bankBalance = db.prepare(
      `SELECT COALESCE(SUM(current_balance),0) as t FROM accounts WHERE account_type != 'Cash' AND is_active=1`
    ).get().t;

    const lowStock = db.prepare(
      `SELECT COUNT(*) as c FROM products WHERE status IN ('Low','Critical') AND is_active=1`
    ).get().c;

    const monthlySales = db.prepare(
      `SELECT strftime('%m', invoice_date) as month, SUM(grand_total) as total FROM invoices WHERE status NOT IN ('Draft','Deleted')${branchSuffix} GROUP BY month ORDER BY month`
    ).all(...branchParams);

    const topProducts = db.prepare(
      `SELECT ii.product_name, SUM(ii.qty) as units_sold, SUM(ii.amount) as revenue FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id WHERE i.status NOT IN ('Draft','Deleted')${branch_id ? ' AND i.branch_id = ?' : ''} GROUP BY ii.product_name ORDER BY units_sold DESC LIMIT 5`
    ).all(...branchParams);

    const recentInvoices = db.prepare(
      `SELECT * FROM invoices WHERE status NOT IN ('Draft')${branchSuffix} ORDER BY created_at DESC LIMIT 5`
    ).all(...branchParams);

    res.json({ totalSale, totalProfit, pendingPayment, cashBalance, bankBalance, lowStock, monthlySales, topProducts, recentInvoices });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

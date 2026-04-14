const router = require('express').Router();
const db = require('../db/pg');

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const { branch_id } = req.query;
    const bId = branch_id ? Number(branch_id) : null;
    const invoiceBase = db('invoices').whereNotIn('status', ['Draft', 'Deleted']).modify((q) => {
      if (bId) q.andWhere('branch_id', bId);
    });

    const totalSaleRow = await invoiceBase.clone().sum('grand_total as t').first();
    const totalProfitRow = await invoiceBase.clone().select(db.raw('COALESCE(SUM(grand_total - subtotal),0) as t')).first();
    const pendingPaymentRow = await db('invoices')
      .where('is_credit_sale', true)
      .whereIn('status', ['Credit', 'Overdue'])
      .modify((q) => { if (bId) q.andWhere('branch_id', bId); })
      .select(db.raw('COALESCE(SUM(grand_total - paid_amount),0) as t'))
      .first();
    const cashBalanceRow = await db('accounts').where({ account_type: 'Cash', is_active: true }).sum('current_balance as t').first();
    const bankBalanceRow = await db('accounts').whereNot('account_type', 'Cash').andWhere('is_active', true).sum('current_balance as t').first();
    const lowStockRow = await db('products').whereIn('status', ['Low', 'Critical']).andWhere('is_active', true).count('* as c').first();
    const monthlySales = await db('invoices')
      .whereNotIn('status', ['Draft', 'Deleted'])
      .modify((q) => { if (bId) q.andWhere('branch_id', bId); })
      .select(db.raw("to_char(invoice_date::date, 'MM') as month"))
      .sum('grand_total as total')
      .groupByRaw("to_char(invoice_date::date, 'MM')")
      .orderBy('month');
    const topProducts = await db('invoice_items as ii')
      .join('invoices as i', 'i.id', 'ii.invoice_id')
      .whereNotIn('i.status', ['Draft', 'Deleted'])
      .modify((q) => { if (bId) q.andWhere('i.branch_id', bId); })
      .select('ii.product_name')
      .sum('ii.qty as units_sold')
      .sum('ii.amount as revenue')
      .groupBy('ii.product_name')
      .orderBy('units_sold', 'desc')
      .limit(5);
    const recentInvoices = await db('invoices')
      .whereNot('status', 'Draft')
      .modify((q) => { if (bId) q.andWhere('branch_id', bId); })
      .orderBy('created_at', 'desc')
      .limit(5);

    const totalSale = Number(totalSaleRow?.t || 0);
    const totalProfit = Number(totalProfitRow?.t || 0);
    const pendingPayment = Number(pendingPaymentRow?.t || 0);
    const cashBalance = Number(cashBalanceRow?.t || 0);
    const bankBalance = Number(bankBalanceRow?.t || 0);
    const lowStock = Number(lowStockRow?.c || 0);

    res.json({ totalSale, totalProfit, pendingPayment, cashBalance, bankBalance, lowStock, monthlySales, topProducts, recentInvoices });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

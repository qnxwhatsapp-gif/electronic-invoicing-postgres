const router = require('express').Router();
const db = require('../db/pg');

// Accounts
router.get('/accounts', async (req, res) => {
  try { res.json(await db('accounts').where('is_active', true).orderBy('account_name')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/accounts', async (req, res) => {
  try {
    const d = req.body;
    const rows = await db('accounts')
      .insert({
        account_name: d.account_name,
        account_type: d.account_type || 'Cash',
        bank_name: d.bank_name || '',
        account_number: d.account_number || '',
        ifsc_code: d.ifsc_code || '',
        opening_balance: d.opening_balance || 0,
        current_balance: d.opening_balance || 0,
        is_primary: !!d.is_primary,
      })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.put('/accounts/:id', async (req, res) => {
  try {
    const d = req.body;
    await db('accounts').where({ id: req.params.id }).update({
      account_name: d.account_name,
      account_type: d.account_type,
      bank_name: d.bank_name || '',
      account_number: d.account_number || '',
      ifsc_code: d.ifsc_code || '',
      is_primary: !!d.is_primary,
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete('/accounts/:id', async (req, res) => {
  try {
    await db('accounts').where({ id: req.params.id }).update({ is_active: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Transactions
router.get('/transactions', async (req, res) => {
  try {
    const { account_id } = req.query;
    let query = db('banking_transactions as bt')
      .leftJoin('accounts as a', 'a.id', 'bt.account_id')
      .select('bt.*', 'a.account_name as acct_name');
    if (account_id) query = query.where('bt.account_id', account_id);
    res.json(await query.orderBy([{ column: 'bt.date', order: 'desc' }, { column: 'bt.id', order: 'desc' }]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/transactions', async (req, res) => {
  try {
    const d = req.body;
    const year = new Date().getFullYear().toString().slice(-2);
    const last = await db('banking_transactions').select('txn_id').orderBy('id', 'desc').first();
    let seq = 1;
    if (last?.txn_id) { const n = parseInt(last.txn_id.replace(`TXN-${year}`, ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const txn_id = `TXN-${year}${String(seq).padStart(3,'0')}`;
    const acct = await db('accounts').where({ id: d.account_id }).first();
    if (!acct) return res.json({ success: false, error: 'Account not found' });
    await db('banking_transactions').insert({
      txn_id, account_id: d.account_id, account_name: acct.account_name,
      date: d.date, description: d.description || '', type: d.type, amount: d.amount,
    });
    const delta = d.type === 'Credit' ? d.amount : -d.amount;
    await db('accounts').where({ id: d.account_id }).increment('current_balance', delta);
    res.json({ success: true, txn_id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete('/transactions/:id', async (req, res) => {
  try {
    const txn = await db('banking_transactions').where({ id: req.params.id }).first();
    if (txn) {
      const delta = txn.type === 'Credit' ? -txn.amount : txn.amount;
      await db('accounts').where({ id: txn.account_id }).increment('current_balance', delta);
      await db('banking_transactions').where({ id: req.params.id }).del();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.post('/transfer', async (req, res) => {
  try {
    const { from_account_id, to_account_id, amount, date, description } = req.body;
    const fromAcct = await db('accounts').where({ id: from_account_id }).first();
    const toAcct = await db('accounts').where({ id: to_account_id }).first();
    if (!fromAcct || !toAcct) return res.json({ success: false, error: 'Account not found' });
    await db('accounts').where({ id: from_account_id }).decrement('current_balance', amount);
    await db('accounts').where({ id: to_account_id }).increment('current_balance', amount);
    const year = new Date().getFullYear().toString().slice(-2);
    const last = await db('banking_transactions').select('txn_id').orderBy('id', 'desc').first();
    let seq = last?.txn_id ? parseInt(last.txn_id.replace(`TXN-${year}`, ''), 10) + 1 : 1;
    if (Number.isNaN(seq)) seq = 1;
    await db('banking_transactions').insert({
      txn_id: `TXN-${year}${String(seq).padStart(3, '0')}`,
      account_id: from_account_id, account_name: fromAcct.account_name, date,
      description: description || 'Transfer out', type: 'Debit', amount,
    });
    await db('banking_transactions').insert({
      txn_id: `TXN-${year}${String(seq + 1).padStart(3, '0')}`,
      account_id: to_account_id, account_name: toAcct.account_name, date,
      description: description || 'Transfer in', type: 'Credit', amount,
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

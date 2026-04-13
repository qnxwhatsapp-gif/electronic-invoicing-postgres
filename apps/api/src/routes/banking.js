const router = require('express').Router();
const { getDb } = require('../db/database');

// Accounts
router.get('/accounts', (req, res) => {
  try { res.json(getDb().prepare(`SELECT * FROM accounts WHERE is_active=1 ORDER BY account_name`).all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/accounts', (req, res) => {
  try {
    const d = req.body;
    const r = getDb().prepare(`INSERT INTO accounts (account_name,account_type,bank_name,account_number,ifsc_code,opening_balance,current_balance,is_primary) VALUES (?,?,?,?,?,?,?,?)`
    ).run(d.account_name, d.account_type||'Cash', d.bank_name||'', d.account_number||'', d.ifsc_code||'', d.opening_balance||0, d.opening_balance||0, d.is_primary||0);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.put('/accounts/:id', (req, res) => {
  try {
    const d = req.body;
    getDb().prepare(`UPDATE accounts SET account_name=?,account_type=?,bank_name=?,account_number=?,ifsc_code=?,is_primary=? WHERE id=?`
    ).run(d.account_name, d.account_type, d.bank_name||'', d.account_number||'', d.ifsc_code||'', d.is_primary||0, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete('/accounts/:id', (req, res) => {
  try {
    getDb().prepare(`UPDATE accounts SET is_active=0 WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Transactions
router.get('/transactions', (req, res) => {
  try {
    const { account_id } = req.query;
    let q = `SELECT bt.*, a.account_name as acct_name FROM banking_transactions bt LEFT JOIN accounts a ON a.id=bt.account_id WHERE 1=1`;
    const params = [];
    if (account_id) { q += ` AND bt.account_id=?`; params.push(account_id); }
    q += ` ORDER BY bt.date DESC, bt.id DESC`;
    res.json(getDb().prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/transactions', (req, res) => {
  try {
    const db = getDb();
    const d = req.body;
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT txn_id FROM banking_transactions ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.txn_id.replace(`TXN-${year}`,''),10); seq = isNaN(n)?1:n+1; }
    const txn_id = `TXN-${year}${String(seq).padStart(3,'0')}`;
    const acct = db.prepare(`SELECT * FROM accounts WHERE id=?`).get(d.account_id);
    if (!acct) return res.json({ success: false, error: 'Account not found' });
    db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`
    ).run(txn_id, d.account_id, acct.account_name, d.date, d.description||'', d.type, d.amount);
    const delta = d.type === 'Credit' ? d.amount : -d.amount;
    db.prepare(`UPDATE accounts SET current_balance=current_balance+? WHERE id=?`).run(delta, d.account_id);
    res.json({ success: true, txn_id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.delete('/transactions/:id', (req, res) => {
  try {
    const db = getDb();
    const txn = db.prepare(`SELECT * FROM banking_transactions WHERE id=?`).get(req.params.id);
    if (txn) {
      const delta = txn.type === 'Credit' ? -txn.amount : txn.amount;
      db.prepare(`UPDATE accounts SET current_balance=current_balance+? WHERE id=?`).run(delta, txn.account_id);
      db.prepare(`DELETE FROM banking_transactions WHERE id=?`).run(req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.post('/transfer', (req, res) => {
  try {
    const db = getDb();
    const { from_account_id, to_account_id, amount, date, description } = req.body;
    const fromAcct = db.prepare(`SELECT * FROM accounts WHERE id=?`).get(from_account_id);
    const toAcct = db.prepare(`SELECT * FROM accounts WHERE id=?`).get(to_account_id);
    if (!fromAcct || !toAcct) return res.json({ success: false, error: 'Account not found' });
    db.prepare(`UPDATE accounts SET current_balance=current_balance-? WHERE id=?`).run(amount, from_account_id);
    db.prepare(`UPDATE accounts SET current_balance=current_balance+? WHERE id=?`).run(amount, to_account_id);
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT txn_id FROM banking_transactions ORDER BY id DESC LIMIT 1`).get();
    let seq = last ? parseInt(last.txn_id.replace(`TXN-${year}`,''),10)+1 : 1;
    db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`
    ).run(`TXN-${year}${String(seq).padStart(3,'0')}`, from_account_id, fromAcct.account_name, date, description||'Transfer out', 'Debit', amount);
    db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`
    ).run(`TXN-${year}${String(seq+1).padStart(3,'0')}`, to_account_id, toAcct.account_name, date, description||'Transfer in', 'Credit', amount);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

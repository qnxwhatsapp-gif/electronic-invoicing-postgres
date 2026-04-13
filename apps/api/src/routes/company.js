const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/company
router.get('/', (req, res) => {
  try {
    const row = getDb().prepare(`SELECT * FROM company_profile LIMIT 1`).get();
    res.json(row || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/company
// BUG FIX #9a: aligned UPDATE/INSERT columns with the expanded company_profile schema.
// Old schema only had: company_name, mobile, email, address, logo_path
// Expanded schema now includes all fields that this route was already trying to write.
router.put('/', (req, res) => {
  try {
    const db = getDb();
    const d = req.body;
    const existing = db.prepare(`SELECT id FROM company_profile LIMIT 1`).get();
    if (existing) {
      db.prepare(
        `UPDATE company_profile SET
          company_name=?, tagline=?, mobile=?, email=?, address=?, city=?, state=?,
          pincode=?, website=?, gstin=?, pan=?, bank_name=?, account_number=?,
          ifsc_code=?, upi_id=?, invoice_prefix=?, invoice_footer=?,
          currency_symbol=?, tax_label=?, tax_percent=?
         WHERE id=?`
      ).run(
        d.company_name || '', d.tagline || '', d.phone || d.mobile || '',
        d.email || '', d.address || '', d.city || '', d.state || '',
        d.pincode || '', d.website || '', d.gstin || '', d.pan || '',
        d.bank_name || '', d.account_number || '', d.ifsc_code || '',
        d.upi_id || '', d.invoice_prefix || 'INV', d.invoice_footer || '',
        d.currency_symbol || 'Rs.', d.tax_label || 'GST', d.tax_percent || 18,
        existing.id
      );
    } else {
      db.prepare(
        `INSERT INTO company_profile
          (company_name,tagline,mobile,email,address,city,state,pincode,website,
           gstin,pan,bank_name,account_number,ifsc_code,upi_id,invoice_prefix,
           invoice_footer,currency_symbol,tax_label,tax_percent)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        d.company_name || '', d.tagline || '', d.phone || d.mobile || '',
        d.email || '', d.address || '', d.city || '', d.state || '',
        d.pincode || '', d.website || '', d.gstin || '', d.pan || '',
        d.bank_name || '', d.account_number || '', d.ifsc_code || '',
        d.upi_id || '', d.invoice_prefix || 'INV', d.invoice_footer || '',
        d.currency_symbol || 'Rs.', d.tax_label || 'GST', d.tax_percent || 18
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

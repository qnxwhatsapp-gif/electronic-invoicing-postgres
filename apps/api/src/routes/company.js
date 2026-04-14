const router = require('express').Router();
const db = require('../db/pg');

// GET /api/company
router.get('/', async (req, res) => {
  try {
    const row = await db('company_profile').first();
    res.json(row || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/company
// BUG FIX #9a: aligned UPDATE/INSERT columns with the expanded company_profile schema.
// Old schema only had: company_name, mobile, email, address, logo_path
// Expanded schema now includes all fields that this route was already trying to write.
router.put('/', async (req, res) => {
  try {
    const d = req.body;
    const existing = await db('company_profile').select('id').first();
    const payload = {
      company_name: d.company_name || '',
      tagline: d.tagline || '',
      mobile: d.phone || d.mobile || '',
      email: d.email || '',
      address: d.address || '',
      city: d.city || '',
      state: d.state || '',
      pincode: d.pincode || '',
      website: d.website || '',
      gstin: d.gstin || '',
      pan: d.pan || '',
      bank_name: d.bank_name || '',
      account_number: d.account_number || '',
      ifsc_code: d.ifsc_code || '',
      upi_id: d.upi_id || '',
      invoice_prefix: d.invoice_prefix || 'INV',
      invoice_footer: d.invoice_footer || '',
      currency_symbol: d.currency_symbol || 'Rs.',
      tax_label: d.tax_label || 'GST',
      tax_percent: d.tax_percent || 18,
    };
    if (existing) {
      await db('company_profile').where({ id: existing.id }).update(payload);
    } else {
      await db('company_profile').insert(payload);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

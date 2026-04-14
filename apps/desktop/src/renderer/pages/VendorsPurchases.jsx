/**
 * VENDORS & PURCHASES PAGE
 * Tabs: Vendors | Purchase Invoice | Purchase Return | Pay Bills
 */
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// -- KebabMenu --------------------------------------------------------------
function KebabMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Actions"
      >
        <svg width="14" height="14" viewBox="0 0 4 16" fill="currentColor">
          <circle cx="2" cy="2" r="1.5"/>
          <circle cx="2" cy="8" r="1.5"/>
          <circle cx="2" cy="14" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 180 }}>
          {items.map((item, i) => (
            <div key={i} onClick={() => { item.action(); setOpen(false); }}
              style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: item.danger ? '#ef4444' : '#1e293b', borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.icon && <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', minWidth: 18 }}>{item.icon}</span>}
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- ViewPurchaseModal -- shows full purchase invoice with items -------------
function ViewPurchaseModal({ purchase, onClose, onPayBill, onMarkReceived }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    window.electron.invoke('purchases:getItems', { id: purchase.id })
      .then(d => setItems(Array.isArray(d) ? d : []));
  }, [purchase.id]);

  const statusColor = { Received: '#16a34a', Partial: '#f97316', Pending: '#2563eb', Draft: '#64748b' }[purchase.status] || '#64748b';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{purchase.po_number}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {purchase.vendor_name} &middot; {purchase.purchase_date} &middot; <span style={{ color: statusColor, fontWeight: 600 }}>{purchase.status}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {purchase.status !== 'Received' && (
              <button className="btn btn-outline btn-sm" style={{ color: '#16a34a', borderColor: '#16a34a' }}
                onClick={() => { onClose(); onMarkReceived(purchase); }}>
                Mark Received
              </button>
            )}
            {purchase.status !== 'Received' && (
              <button className="btn btn-outline btn-sm" style={{ color: '#2563eb', borderColor: '#2563eb' }}
                onClick={() => { onClose(); onPayBill(purchase); }}>
                Pay Bill
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
          {[
            { label: 'Grand Total', val: `Rs.${Number(purchase.grand_total||0).toLocaleString('en-IN', {minimumFractionDigits:2})}` },
            { label: 'Paid', val: `Rs.${Number(purchase.paid_amount||0).toLocaleString('en-IN', {minimumFractionDigits:2})}`, color: '#16a34a' },
            { label: 'Pending', val: `Rs.${Number(purchase.pending_amount||0).toLocaleString('en-IN', {minimumFractionDigits:2})}`, color: '#ef4444' },
          ].map(r => (
            <div key={r.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: r.color || '#111' }}>{r.val}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 24px' }}>
          <table className="data-table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>#</th><th>Product</th><th>SKU</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit Price</th><th style={{ textAlign: 'right' }}>Total</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Loading items...</td></tr>}
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.product_name}</td>
                  <td style={{ color: '#64748b' }}>{it.product_code || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{it.qty}</td>
                  <td style={{ textAlign: 'right' }}>Rs.{Number(it.price || 0).toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs.{Number(it.total || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {purchase.purchase_note && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
            <strong>Notes:</strong> {purchase.purchase_note}
          </div>
        )}
      </div>
    </div>
  );
}

// -- VendorDetailModal -- shows vendor profile + purchase history -----------
function VendorDetailModal({ vendor, onClose, onEdit, onPayBill }) {
  const [purchases, setPurchases] = useState([]);
  useEffect(() => {
    window.electron.invoke('purchases:getAll', {})
      .then(d => setPurchases((Array.isArray(d) ? d : []).filter(p => String(p.vendor_id) === String(vendor.id))));
  }, [vendor.id]);

  const totalSpend = purchases.reduce((s, p) => s + (p.grand_total || 0), 0);
  const pending = purchases.filter(p => p.status !== 'Received').reduce((s, p) => s + (p.pending_amount || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 620, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{vendor.vendor_name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{vendor.company_name || ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => { onClose(); onEdit(vendor); }}>Edit</button>
            <button className="btn btn-outline btn-sm" style={{ color: '#2563eb', borderColor: '#2563eb' }} onClick={() => { onClose(); onPayBill(vendor); }}>Pay Bill</button>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
          {[
            { label: 'Total Orders', val: purchases.length },
            { label: 'Total Spend', val: `Rs.${totalSpend.toLocaleString('en-IN', {minimumFractionDigits:2})}` },
            { label: 'Outstanding', val: `Rs.${pending.toLocaleString('en-IN', {minimumFractionDigits:2})}`, color: pending > 0 ? '#ef4444' : '#16a34a' },
          ].map(r => (
            <div key={r.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: r.color || '#111' }}>{r.val}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Contact</div>
            {vendor.phone && <div style={{ fontSize: 13, marginBottom: 4 }}>Ph: {vendor.phone}</div>}
            {vendor.email && <div style={{ fontSize: 13, marginBottom: 4 }}>{vendor.email}</div>}
            {vendor.street_address && <div style={{ fontSize: 13, color: '#64748b' }}>{[vendor.street_address, vendor.city, vendor.province_state, vendor.postal_code].filter(Boolean).join(', ')}</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Banking</div>
            {vendor.account_name && <div style={{ fontSize: 13, marginBottom: 4 }}>{vendor.account_name}</div>}
            {vendor.account_number && <div style={{ fontSize: 13, color: '#64748b' }}>Acc: {vendor.account_number}</div>}
          </div>
        </div>

        <div style={{ padding: '12px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Purchase History</div>
          {purchases.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, padding: '10px 0' }}>No purchases yet</div>}
          {purchases.slice(0, 10).map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{p.po_number}</span>
                <span style={{ color: '#64748b', marginLeft: 8 }}>{p.purchase_date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600 }}>Rs.{Number(p.grand_total||0).toLocaleString()}</span>
                <span className={`badge ${p.status === 'Received' ? 'badge-green' : p.status === 'Partial' ? 'badge-orange' : 'badge-blue'}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- PurchaseInvoiceForm ----------------------------------------------------
function PurchaseInvoiceForm({ vendors, onClose, onSaved }) {
  const [allProducts, setAllProducts] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [notes, setNotes] = useState('');
  const [taxPct, setTaxPct] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electron.invoke('products:getAll', {}).then(data => setAllProducts(Array.isArray(data) ? data : []));
  }, []);

  function onSearch(val) {
    setSearch(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    setSuggestions(allProducts.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8));
  }

  function addItem(product) {
    setItems(prev => {
      const existing = prev.findIndex(i => i.product_id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1, amount: (updated[existing].qty + 1) * updated[existing].rate };
        return updated;
      }
      return [...prev, { product_id: product.id, name: product.name, sku: product.sku, qty: 1, rate: product.purchase_price || 0, amount: product.purchase_price || 0 }];
    });
    setSearch('');
    setSuggestions([]);
  }

  function updateItem(idx, field, val) {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: parseFloat(val) || 0 };
      updated[idx].amount = updated[idx].qty * updated[idx].rate;
      return updated;
    });
  }

  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmt = subtotal * (taxPct / 100);
  const grandTotal = subtotal + taxAmt - (parseFloat(discount) || 0);

  async function handleSave(status) {
    if (!vendorId) { toast.error('Select a vendor'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const result = await window.electron.invoke('purchases:create', {
        vendor_id: vendorId,
        purchase_date: purchaseDate,
        due_date: dueDate,
        items,
        tax_pct: taxPct,
        discount: parseFloat(discount) || 0,
        subtotal,
        tax_amount: taxAmt,
        grand_total: grandTotal,
        notes,
        status,
      });
      if (result.success) {
        toast.success('Purchase invoice created');
        onSaved();
        onClose();
      } else {
        toast.error(result.error || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 0' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 740, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>New Purchase Invoice</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>x</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label className="form-label">Vendor *</label>
            <select className="form-select" value={vendorId} onChange={e => setVendorId(e.target.value)}>
              <option value="">Select Vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Purchase Date *</label>
            <input type="date" className="form-input" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Due Date</label>
            <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Add Products</label>
          <div style={{ position: 'relative' }}>
            <input className="form-input" placeholder="Search product by name or SKU..." value={search} onChange={e => onSearch(e.target.value)} />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 220, overflowY: 'auto' }}>
                {suggestions.map(p => (
                  <div key={p.id} onClick={() => addItem(p)}
                    style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <span>{p.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{p.sku}</span></span>
                    <span style={{ fontWeight: 600 }}>Rs.{p.purchase_price?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <table className="data-table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>#</th><th>Product</th><th>SKU</th><th style={{ width: 80 }}>Qty</th><th style={{ width: 110 }}>Rate (Rs.)</th><th style={{ width: 110 }}>Amount (Rs.)</th><th></th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No items added yet</td></tr>
              )}
              {items.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{item.name}</td>
                  <td style={{ color: '#64748b' }}>{item.sku}</td>
                  <td><input type="number" min={1} className="form-input" style={{ width: 70, padding: '4px 8px' }} value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                  <td><input type="number" min={0} className="form-input" style={{ width: 90, padding: '4px 8px' }} value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                  <td style={{ fontWeight: 600 }}>Rs.{item.amount.toLocaleString()}</td>
                  <td><button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, fontWeight: 700 }}>x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes..." style={{ resize: 'vertical' }} />
          </div>
          <div style={{ width: 240 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Tax (%)</label>
                <input type="number" min={0} className="form-input" value={taxPct} onChange={e => setTaxPct(parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Discount (Rs.)</label>
                <input type="number" min={0} className="form-input" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#64748b' }}>Subtotal</span><span>Rs.{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#64748b' }}>Tax</span><span>Rs.{taxAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#64748b' }}>Discount</span><span style={{ color: '#ef4444' }}>-Rs.{(parseFloat(discount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}><span>Grand Total</span><span>Rs.{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-outline" onClick={() => handleSave('Draft')} disabled={saving}>Save as Draft</button>
          <button className="btn btn-black" onClick={() => handleSave('Pending')} disabled={saving}>
            {saving ? 'Saving...' : 'Create Purchase Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- PurchaseReturnModal ----------------------------------------------------
function PurchaseReturnModal({ purchase, onClose, onDone }) {
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (purchase._items && purchase._items.length > 0) {
      setItems(purchase._items.map(i => ({ ...i, return_qty: 0 })));
    } else {
      window.electron.invoke('purchases:getItems', { id: purchase.id }).then(loadedItems => {
        if (Array.isArray(loadedItems) && loadedItems.length > 0) {
          setItems(loadedItems.map(i => ({ ...i, return_qty: 0 })));
        }
      }).catch(() => {});
    }
  }, [purchase]);

  const returnTotal = items.reduce((s, i) => s + (i.return_qty * (i.price || 0)), 0);

  async function submit() {
    const returnItems = items.filter(i => i.return_qty > 0);
    if (returnItems.length === 0) { toast.error('Enter return quantity for at least one item'); return; }
    setSaving(true);
    const payload = {
      po_number: purchase.po_number,
      vendor_id: purchase.vendor_id,
      vendor_name: purchase.vendor_name,
      original_invoice_id: purchase.id,
      purchased_qty: items.reduce((s, i) => s + i.qty, 0),
      return_qty: returnItems.reduce((s, i) => s + i.return_qty, 0),
      return_total: returnTotal,
      return_reason: reason,
      items: returnItems.map(i => ({
        product_id: i.product_id,
        item_name: i.product_name,
        sku: i.product_code || '',
        purchased_qty: i.qty,
        return_qty: i.return_qty,
        purchase_price: i.price,
      })),
    };
    const r = await window.electron.invoke('purchases:createReturn', payload);
    setSaving(false);
    if (r.success) { toast.success('Purchase return submitted'); onDone(); onClose(); }
    else toast.error(r.error || 'Failed to submit return');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 700, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Purchase Return</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>PO: {purchase.po_number} &middot; {purchase.vendor_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>x</button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
            <div style={{ fontSize: 14 }}>No items found for this purchase</div>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <thead>
                <tr style={{ background: '#f8fafc', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Purchased Qty</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: 120 }}>Return Qty</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Return Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px' }}>{item.product_name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>Rs.{item.price?.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input type="number" min={0} max={item.qty} value={item.return_qty}
                        onChange={e => {
                          const v = Math.min(parseInt(e.target.value) || 0, item.qty);
                          setItems(prev => prev.map((i, ii) => ii === idx ? { ...i, return_qty: v } : i));
                        }}
                        style={{ width: 70, textAlign: 'center', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px' }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ef4444' }}>
                      Rs.{(item.return_qty * (item.price || 0)).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Return Reason</label>
              <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged goods, wrong items..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Return Total: <span style={{ color: '#ef4444' }}>Rs.{returnTotal.toLocaleString('en-IN')}</span></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button className="btn btn-black" onClick={submit} disabled={saving}>{saving ? 'Submitting...' : 'Submit Return'}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -- PayBillModal -----------------------------------------------------------
function PayBillModal({ vendors, purchases, onClose, onSaved, defaultVendorId, defaultPurchaseId }) {
  const [vendorId, setVendorId] = useState(defaultVendorId || '');
  const [purchaseId, setPurchaseId] = useState(defaultPurchaseId || '');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const vendorPurchases = purchases.filter(p => String(p.vendor_id) === String(vendorId) && p.status !== 'Received');

  // Auto-fill amount from selected purchase
  useEffect(() => {
    if (purchaseId) {
      const p = purchases.find(p => String(p.id) === String(purchaseId));
      if (p) setAmount(String(p.pending_amount || p.grand_total || ''));
    }
  }, [purchaseId]);

  async function handleSave() {
    if (!vendorId) { toast.error('Select a vendor'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const result = await window.electron.invoke('paybills:create', {
        vendor_id: vendorId,
        purchase_invoice_id: purchaseId || null,
        paying_amount: parseFloat(amount),
        payment_mode: paymentMode,
        payment_date: paymentDate,
        notes,
      });
      if (result.success) {
        toast.success('Payment recorded');
        onSaved();
        onClose();
      } else {
        toast.error(result.error || 'Failed');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Pay Bill</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>x</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Vendor *</label>
            <select className="form-select" value={vendorId} onChange={e => { setVendorId(e.target.value); setPurchaseId(''); setAmount(''); }}>
              <option value="">Select Vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
          </div>
          {vendorId && (
            <div>
              <label className="form-label">Purchase Invoice (optional)</label>
              <select className="form-select" value={purchaseId} onChange={e => setPurchaseId(e.target.value)}>
                <option value="">All outstanding</option>
                {vendorPurchases.map(p => (
                  <option key={p.id} value={p.id}>{p.po_number} &mdash; Rs.{p.grand_total?.toLocaleString()} (pending: Rs.{(p.pending_amount||0).toLocaleString()})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Payment Amount (Rs.) *</label>
            <input type="number" min={0} className="form-input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Payment Mode</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Cash', 'Card', 'UPI', 'EFT', 'Cheque'].map(mode => (
                <button key={mode} onClick={() => setPaymentMode(mode)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    background: paymentMode === mode ? '#1e293b' : '#fff',
                    color: paymentMode === mode ? '#fff' : '#64748b',
                    borderColor: paymentMode === mode ? '#1e293b' : '#e2e8f0' }}>
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Payment Date</label>
            <input type="date" className="form-input" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <input className="form-input" placeholder="Reference or notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-black" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- VendorsPurchases (main) ------------------------------------------------
export default function VendorsPurchases() {
  const [activeTab, setActiveTab] = useState('Vendors');
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [payBills, setPayBills] = useState([]);
  const [search, setSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [billSearch, setBillSearch] = useState('');
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [showPayBill, setShowPayBill] = useState(false);
  const [payBillDefaults, setPayBillDefaults] = useState({});
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [viewVendor, setViewVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState({ vendor_name: '', company_name: '', email: '', phone: '', street_address: '', city: '', province_state: '', postal_code: '', account_name: '', account_number: '' });
  const [editingVendor, setEditingVendor] = useState(null);
  const { can } = useAuth();

  useEffect(() => { loadAll(); }, [search, activeTab]);

  function loadAll() {
    window.electron.invoke('vendors:getAll', { search }).then(data => setVendors(Array.isArray(data) ? data : []));
    window.electron.invoke('purchases:getAll', {}).then(data => setPurchases(Array.isArray(data) ? data : []));
    window.electron.invoke('purchases:getReturns').then(data => setPurchaseReturns(Array.isArray(data) ? data : []));
    window.electron.invoke('paybills:getAll', {}).then(data => setPayBills(Array.isArray(data) ? data : []));
  }

  async function saveVendor() {
    if (!vendorForm.vendor_name.trim()) { toast.error('Vendor name is required'); return; }
    let result;
    if (editingVendor) {
      result = await window.electron.invoke('vendors:update', { id: editingVendor.id, ...vendorForm });
    } else {
      result = await window.electron.invoke('vendors:create', vendorForm);
    }
    if (result.success) {
      toast.success(editingVendor ? 'Vendor updated!' : 'Vendor saved!');
      setShowAddVendor(false);
      setEditingVendor(null);
      setVendorForm({ vendor_name: '', company_name: '', email: '', phone: '', street_address: '', city: '', province_state: '', postal_code: '', account_name: '', account_number: '' });
      loadAll();
    } else {
      toast.error(result.error || 'Failed to save vendor');
    }
  }

  function openEditVendor(vendor) {
    setEditingVendor(vendor);
    setVendorForm({
      vendor_name: vendor.vendor_name,
      company_name: vendor.company_name || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      street_address: vendor.street_address || '',
      city: vendor.city || '',
      province_state: vendor.province_state || '',
      postal_code: vendor.postal_code || '',
      account_name: vendor.account_name || '',
      account_number: vendor.account_number || '',
    });
    setShowAddVendor(true);
  }

  async function deleteVendor(id) {
    if (!window.confirm('Delete this vendor?')) return;
    const result = await window.electron.invoke('vendors:delete', { id });
    if (result.success) { toast.success('Vendor deleted'); loadAll(); }
    else toast.error(result.error || 'Failed');
  }

  async function deletePurchase(id) {
    if (!window.confirm('Delete this purchase invoice?')) return;
    const result = await window.electron.invoke('purchases:delete', { id });
    if (result.success) { toast.success('Deleted'); loadAll(); }
    else toast.error(result.error || 'Failed');
  }

  async function markReceived(purchase) {
    if (!window.confirm(`Mark ${purchase.po_number} as Received? Stock will be updated.`)) return;
    const r = await window.electron.invoke('purchases:updateStatus', { id: purchase.id, status: 'Received' });
    if (r.success) { toast.success('Marked as Received - stock updated'); loadAll(); }
    else toast.error(r.error || 'Failed');
  }

  async function openReturnModal(purchase) {
    const items = await window.electron.invoke('purchases:getItems', { id: purchase.id }).catch(() => []);
    setReturnPurchase({ ...purchase, _items: items });
    setShowReturnModal(true);
  }

  function openPayBill(opts = {}) {
    setPayBillDefaults(opts);
    setShowPayBill(true);
  }

  const setVF = (field, val) => setVendorForm(prev => ({ ...prev, [field]: val }));

  // Filtered lists
  const filteredPurchases = purchases.filter(p =>
    !purchaseSearch || (p.po_number||'').toLowerCase().includes(purchaseSearch.toLowerCase()) || (p.vendor_name||'').toLowerCase().includes(purchaseSearch.toLowerCase())
  );
  const filteredReturns = purchaseReturns.filter(r =>
    !returnSearch || (r.po_number||'').toLowerCase().includes(returnSearch.toLowerCase()) || (r.vendor_name||r.vname||'').toLowerCase().includes(returnSearch.toLowerCase())
  );
  const filteredBills = payBills.filter(b =>
    !billSearch || (b.po_number||'').toLowerCase().includes(billSearch.toLowerCase()) || (b.vendor_name||'').toLowerCase().includes(billSearch.toLowerCase())
  );

  const TABS = ['Vendors', 'Purchase Invoice', 'Purchase Return', 'Pay Bills'];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Vendors &amp; Purchases</div>
        <div className="page-subtitle">Manage Vendor Relationships And Purchase Orders</div>
      </div>

      <div className="tab-pills">
        {TABS.map(t => <div key={t} className={`tab-pill ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t}</div>)}
      </div>

      {/* Modals */}
      {viewPurchase && (
        <ViewPurchaseModal
          purchase={viewPurchase}
          onClose={() => setViewPurchase(null)}
          onPayBill={p => openPayBill({ defaultVendorId: p.vendor_id, defaultPurchaseId: p.id })}
          onMarkReceived={p => markReceived(p)}
        />
      )}
      {viewVendor && (
        <VendorDetailModal
          vendor={viewVendor}
          onClose={() => setViewVendor(null)}
          onEdit={v => { setViewVendor(null); openEditVendor(v); }}
          onPayBill={v => { setViewVendor(null); openPayBill({ defaultVendorId: v.id }); }}
        />
      )}
      {showReturnModal && returnPurchase && (
        <PurchaseReturnModal
          purchase={returnPurchase}
          onClose={() => { setShowReturnModal(false); setReturnPurchase(null); }}
          onDone={loadAll}
        />
      )}
      {showPayBill && (
        <PayBillModal
          vendors={vendors}
          purchases={purchases}
          onClose={() => { setShowPayBill(false); setPayBillDefaults({}); }}
          onSaved={loadAll}
          defaultVendorId={payBillDefaults.defaultVendorId}
          defaultPurchaseId={payBillDefaults.defaultPurchaseId}
        />
      )}

      {/* ── VENDORS TAB ── */}
      {activeTab === 'Vendors' && (
        <>
          <div className="filters-bar">
            <input className="form-input" style={{ width: 280 }} placeholder="Search by Vendor or Company name" value={search} onChange={e => setSearch(e.target.value)} />
            {can('vendors', 'create') && (
              <button className="btn btn-black filters-bar-right" onClick={() => { setEditingVendor(null); setVendorForm({ vendor_name: '', company_name: '', email: '', phone: '', street_address: '', city: '', province_state: '', postal_code: '', account_name: '', account_number: '' }); setShowAddVendor(true); }}>
                + Add Vendor
              </button>
            )}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>S.No</th><th>Vendor Name</th><th>Company Name</th><th>Phone No.</th><th>E-mail</th><th>Outstanding Balance</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {vendors.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No vendors found</td></tr>}
                {vendors.map((v, i) => (
                  <tr key={v.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600, cursor: 'pointer', color: '#2563eb' }} onClick={() => setViewVendor(v)}>{v.vendor_name}</td>
                    <td>{v.company_name}</td>
                    <td>{v.phone}</td>
                    <td>{v.email}</td>
                    <td style={{ fontWeight: 600, color: (v.outstanding_balance||0) > 0 ? '#ef4444' : '#16a34a' }}>
                      Rs.{Number(v.outstanding_balance||0).toLocaleString()}
                    </td>
                    <td><span className={`badge ${v.status === 'Active' ? 'badge-green' : 'badge-grey'}`}>{v.status || 'Active'}</span></td>
                    <td>
                      <KebabMenu items={[
                        { label: 'View Details', icon: '[+]', action: () => setViewVendor(v) },
                        { label: 'Edit', icon: '[E]', action: () => openEditVendor(v) },
                        { label: 'Pay Bill', icon: '[$]', action: () => openPayBill({ defaultVendorId: v.id }) },
                        { label: 'Delete', icon: '[X]', danger: true, action: () => deleteVendor(v.id) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddVendor && (
            <div className="modal-overlay" onClick={() => setShowAddVendor(false)}>
              <div className="modal-card modal-md" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setShowAddVendor(false)}>x</button>
                <div className="modal-title">{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</div>
                <div className="modal-subtitle">{editingVendor ? 'Update vendor details below' : 'Fill in vendor details below'}</div>

                <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 12, color: '#374151' }}>GENERAL INFORMATION</div>
                <div className="form-grid-2">
                  <div className="form-group"><label className="form-label">Vendor Name *</label><input className="form-input" placeholder="Enter vendor name" value={vendorForm.vendor_name} onChange={e => setVF('vendor_name', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" placeholder="Full Name" value={vendorForm.company_name} onChange={e => setVF('company_name', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" placeholder="contact@vendor.com" value={vendorForm.email} onChange={e => setVF('email', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" placeholder="+1 (555) 000-0000" value={vendorForm.phone} onChange={e => setVF('phone', e.target.value)} /></div>
                </div>

                <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 12, color: '#374151' }}>ADDRESS DETAILS</div>
                <div className="form-group"><label className="form-label">Street Address</label><input className="form-input" placeholder="123 Business Way, Suite 100" value={vendorForm.street_address} onChange={e => setVF('street_address', e.target.value)} /></div>
                <div className="form-grid-3">
                  <div className="form-group"><label className="form-label">City</label><input className="form-input" placeholder="New York" value={vendorForm.city} onChange={e => setVF('city', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Province / State</label><input className="form-input" placeholder="NY" value={vendorForm.province_state} onChange={e => setVF('province_state', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Postal Code</label><input className="form-input" placeholder="10001" value={vendorForm.postal_code} onChange={e => setVF('postal_code', e.target.value)} /></div>
                </div>

                <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 12, color: '#374151' }}>FINANCIAL INFORMATION</div>
                <div className="form-grid-2">
                  <div className="form-group"><label className="form-label">Account Name</label><input className="form-input" placeholder="Account Holder Name" value={vendorForm.account_name} onChange={e => setVF('account_name', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Account Number</label><input className="form-input" placeholder="0000 0000 0000" value={vendorForm.account_number} onChange={e => setVF('account_number', e.target.value)} /></div>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => { setShowAddVendor(false); setEditingVendor(null); }}>Cancel</button>
                  <button className="btn btn-black" onClick={saveVendor}>{editingVendor ? 'Update Vendor' : 'Save Vendor'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PURCHASE INVOICE TAB ── */}
      {activeTab === 'Purchase Invoice' && (
        <>
          <div className="filters-bar">
            <input className="form-input" style={{ width: 280 }} placeholder="Search by vendor or PO number" value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)} />
            {can('vendors', 'create') && (
              <button className="btn btn-black filters-bar-right" onClick={() => setShowAddPurchase(true)}>+ New Purchase Invoice</button>
            )}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>S.No</th><th>PO Number</th><th>Vendor Name</th><th>Products</th><th>Total Qty</th><th>Grand Total</th><th>Paid</th><th>Pending</th><th>Order Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No purchase invoices found</td></tr>}
                {filteredPurchases.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600, cursor: 'pointer', color: '#2563eb' }} onClick={() => setViewPurchase(p)}>{p.po_number}</td>
                    <td>{p.vendor_name}</td>
                    <td style={{ textAlign: 'center' }}>{p.product_count || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{p.total_qty || '-'}</td>
                    <td style={{ fontWeight: 600 }}>Rs.{Number(p.grand_total||0).toLocaleString()}</td>
                    <td style={{ color: '#16a34a' }}>Rs.{Number(p.paid_amount||0).toLocaleString()}</td>
                    <td style={{ color: (p.pending_amount||0) > 0 ? '#ef4444' : '#16a34a', fontWeight: 600 }}>Rs.{Number(p.pending_amount||0).toLocaleString()}</td>
                    <td>{p.purchase_date}</td>
                    <td><span className={`badge ${p.status === 'Received' ? 'badge-green' : p.status === 'Partial' ? 'badge-orange' : p.status === 'Draft' ? 'badge-grey' : 'badge-blue'}`}>{p.status}</span></td>
                    <td>
                      <KebabMenu items={[
                        { label: 'View Details', icon: '[+]', action: () => setViewPurchase(p) },
                        ...(p.status !== 'Received' ? [{ label: 'Mark as Received', icon: '[R]', action: () => markReceived(p) }] : []),
                        ...(p.status !== 'Received' ? [{ label: 'Pay Bill', icon: '[$]', action: () => openPayBill({ defaultVendorId: p.vendor_id, defaultPurchaseId: p.id }) }] : []),
                        { label: 'Return Items', icon: '[~]', action: () => openReturnModal(p) },
                        { label: 'Delete', icon: '[X]', danger: true, action: () => deletePurchase(p.id) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showAddPurchase && (
            <PurchaseInvoiceForm vendors={vendors} onClose={() => setShowAddPurchase(false)} onSaved={loadAll} />
          )}
        </>
      )}

      {/* ── PURCHASE RETURN TAB ── */}
      {activeTab === 'Purchase Return' && (
        <>
          <div className="filters-bar">
            <input className="form-input" style={{ width: 280 }} placeholder="Search by vendor or PO number" value={returnSearch} onChange={e => setReturnSearch(e.target.value)} />
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>S.No</th><th>Original PO</th><th>Vendor</th><th>Return Reason</th><th>Return Qty</th><th>Refund Amount</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredReturns.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No purchase returns found</td></tr>
                )}
                {filteredReturns.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.po_number || '-'}</td>
                    <td>{r.vendor_name || r.vname || '-'}</td>
                    <td style={{ color: '#64748b' }}>{r.return_reason || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{r.return_qty || 0}</td>
                    <td style={{ fontWeight: 600, color: '#ef4444' }}>Rs.{Number(r.return_total||0).toLocaleString()}</td>
                    <td>{(r.order_date || '').split('T')[0]}</td>
                    <td><span className={`badge ${r.status === 'Completed' ? 'badge-green' : 'badge-grey'}`}>{r.status || 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PAY BILLS TAB ── */}
      {activeTab === 'Pay Bills' && (
        <>
          <div className="filters-bar">
            <input className="form-input" style={{ width: 280 }} placeholder="Search by vendor or invoice number" value={billSearch} onChange={e => setBillSearch(e.target.value)} />
            {can('vendors', 'create') && (
              <button className="btn btn-black filters-bar-right" onClick={() => openPayBill({})}>+ Pay Bill</button>
            )}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>S.No</th><th>PO Number</th><th>Vendor Name</th><th>Payment Status</th><th>Paid Amount</th><th>Pending Amount</th><th>Total Amount</th><th>Due Date</th><th>Payment Date</th><th>Mode</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filteredBills.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No payment records found</td></tr>}
                {filteredBills.map((b, i) => (
                  <tr key={b.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{b.po_number || '-'}</td>
                    <td>{b.vendor_name}</td>
                    <td><span className={`badge ${b.payment_status === 'Paid' ? 'badge-green' : b.payment_status === 'Partial' ? 'badge-orange' : 'badge-red'}`}>{b.payment_status || 'Paid'}</span></td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>Rs.{Number(b.paying_amount||0).toLocaleString()}</td>
                    <td style={{ color: ((b.total_payable||0) - (b.paying_amount||0)) > 0 ? '#ef4444' : '#16a34a' }}>
                      Rs.{Math.max(0, (b.total_payable||0) - (b.paying_amount||0)).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>Rs.{Number(b.total_payable||0).toLocaleString()}</td>
                    <td>{b.due_date || '-'}</td>
                    <td>{b.payment_date || b.last_payment_date || '-'}</td>
                    <td>{b.payment_mode || '-'}</td>
                    <td>
                      <KebabMenu items={[
                        { label: 'Pay More', icon: '[$]', action: () => openPayBill({ defaultVendorId: b.vendor_id }) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

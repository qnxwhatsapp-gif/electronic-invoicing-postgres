import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useBarcodeGun } from '../hooks/useBarcodeGun';
import BarcodeScanner from '../components/BarcodeScanner';

// -- Print Preview Modal ----------------------------------------------------
function PrintPreviewModal({ invoice, onClose }) {
  if (!invoice) return null;
  const items = invoice.items || [];
  const fmt = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const statusColors = { Paid:'#065f46', Credit:'#1e40af', Draft:'#475569', Completed:'#065f46', Overdue:'#991b1b' };
  const statusBg    = { Paid:'#d1fae5', Credit:'#dbeafe', Draft:'#f1f5f9', Completed:'#d1fae5', Overdue:'#fee2e2' };

  function doPrint() {
    const fmt = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const sColor = { Paid:'#065f46', Credit:'#1e40af', Draft:'#475569', Completed:'#065f46', Overdue:'#991b1b' };
    const sBg    = { Paid:'#d1fae5', Credit:'#dbeafe', Draft:'#f1f5f9', Completed:'#d1fae5', Overdue:'#fee2e2' };
    const rows = items.map((it, i) => `
      <tr style="background:${i%2===1?'#f8fafc':'#fff'}">
        <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9">${i+1}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9">${it.product_name||it.name||''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b">${it.product_code||it.sku||''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${it.qty}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right">Rs.${fmt(it.rate)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">Rs.${fmt(it.amount)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_no}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px}
      table{width:100%;border-collapse:collapse}
      th{background:#111;color:#fff;padding:10px 12px;text-align:left;font-size:12px}
      .grand{font-weight:700;font-size:16px;border-top:2px solid #111;padding-top:8px;margin-top:4px}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111">
      <div>
        <div style="font-size:22px;font-weight:700">Acme Electricals</div>
        <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.7">123 Market Street, Mumbai, India<br>+91-9876543210 | info@acme.com</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:28px;font-weight:700">INVOICE</div>
        <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.8">
          <strong>${invoice.invoice_no}</strong><br>Date: ${invoice.invoice_date}<br>
          ${invoice.due_date?`Due: ${invoice.due_date}<br>`:''}
          <span style="display:inline-block;margin-top:4px;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:${sBg[invoice.status]||'#f1f5f9'};color:${sColor[invoice.status]||'#111'}">${invoice.status}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px 18px">
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Bill To</div>
        <div style="font-weight:600;font-size:14px">${invoice.customer_name||'Walk-in Customer'}</div>
        ${invoice.customer_phone?`<div style="font-size:12px;color:#555;margin-top:3px">Ph: ${invoice.customer_phone}</div>`:''}
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px 18px">
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Payment</div>
        <div style="font-size:12px;background:#f1f5f9;padding:4px 10px;border-radius:6px;display:inline-block">${invoice.payment_mode||'Cash'}</div>
        ${invoice.is_credit_sale?'<div style="color:#b45309;margin-top:6px;font-size:12px">Credit Sale</div>':''}
      </div>
    </div>
    <table style="margin:4px 0 20px">
      <thead><tr><th>#</th><th>Product</th><th>SKU</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-left:auto;width:280px">
      ${invoice.subtotal>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span>Subtotal</span><span>Rs.${fmt(invoice.subtotal)}</span></div>`:''}
      ${invoice.tax_amount>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span>Tax</span><span>Rs.${fmt(invoice.tax_amount)}</span></div>`:''}
      <div class="grand" style="display:flex;justify-content:space-between;padding:8px 0 5px"><span>Grand Total</span><span>Rs.${fmt(invoice.grand_total)}</span></div>
    </div>
    ${invoice.internal_notes?`<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b"><strong>Notes:</strong> ${invoice.internal_notes}</div>`:''}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">Thank you for your business!</div>
    </body></html>`;

    // Hidden iframe — prints without touching the React app
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;border:0;opacity:0';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 400);
  }

  // Keyboard shortcuts: Ctrl+P → print, Escape → close
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        doPrint();
      }
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', overflowY:'auto', padding:'24px 16px' }}>
      {/* Toolbar */}
      <div style={{ width:720, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <span style={{ color:'#fff', fontWeight:600, fontSize:15 }}>Print Preview &mdash; {invoice.invoice_no}</span>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={doPrint} title="Print (Ctrl+P)" style={{ background:'#111', color:'#fff', border:'none', borderRadius:8, padding:'8px 22px', fontWeight:700, cursor:'pointer', fontSize:14 }}>
            Print &nbsp;<span style={{ fontSize:11, fontWeight:400, opacity:0.7, background:'rgba(255,255,255,0.15)', borderRadius:4, padding:'2px 6px' }}>Ctrl+P</span>
          </button>
          <button onClick={onClose} title="Close (Esc)" style={{ background:'#fff', color:'#111', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 18px', fontWeight:600, cursor:'pointer', fontSize:14 }}>
            Close &nbsp;<span style={{ fontSize:11, fontWeight:400, opacity:0.5, background:'#f1f5f9', borderRadius:4, padding:'2px 6px' }}>Esc</span>
          </button>
        </div>
      </div>

      {/* Invoice Paper */}
      <div id="invoice-print-area" style={{ width:720, background:'#fff', borderRadius:10, boxShadow:'0 8px 40px rgba(0,0,0,0.25)', padding:'40px 48px', fontFamily:'Arial, sans-serif', fontSize:13, color:'#111' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, paddingBottom:16, borderBottom:'2px solid #111' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700 }}>Acme Electricals</div>
            <div style={{ fontSize:12, color:'#555', marginTop:4, lineHeight:1.7 }}>
              123 Market Street, Mumbai, India<br />
              +91-9876543210 &nbsp;|&nbsp; info@acme.com
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:28, fontWeight:700 }}>INVOICE</div>
            <div style={{ fontSize:12, color:'#555', marginTop:4, lineHeight:1.8 }}>
              <strong>{invoice.invoice_no}</strong><br />
              Date: {invoice.invoice_date}<br />
              {invoice.due_date && <>Due: {invoice.due_date}<br /></>}
              <span style={{ display:'inline-block', marginTop:4, padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:700, background: statusBg[invoice.status]||'#f1f5f9', color: statusColors[invoice.status]||'#111' }}>
                {invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To & Payment */}
        <div style={{ display:'flex', gap:16, marginBottom:20 }}>
          <div style={{ flex:1, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'14px 18px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Bill To</div>
            <div style={{ fontWeight:600, fontSize:14 }}>{invoice.customer_name || 'Walk-in Customer'}</div>
            {invoice.customer_phone && <div style={{ fontSize:12, color:'#555', marginTop:3 }}>Ph: {invoice.customer_phone}</div>}
            {invoice.customer_address && <div style={{ fontSize:12, color:'#555', marginTop:3 }}>{invoice.customer_address}</div>}
          </div>
          <div style={{ flex:1, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'14px 18px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Payment Details</div>
            <div style={{ fontSize:12, background:'#f1f5f9', padding:'4px 10px', borderRadius:6, display:'inline-block' }}>{invoice.payment_mode || 'Cash'}</div>
            {!!invoice.is_credit_sale && <div style={{ color:'#b45309', marginTop:6, fontSize:12 }}>Credit Sale &mdash; Payment Pending</div>}
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width:'100%', borderCollapse:'collapse', margin:'4px 0 20px' }}>
          <thead>
            <tr>
              {['#','Product','SKU','Qty','Rate','Amount'].map((h, i) => (
                <th key={i} style={{ background:'#111', color:'#fff', padding:'10px 12px', textAlign: i>=3?'center':'left', fontSize:12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ background: i%2===1?'#f8fafc':'#fff' }}>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f1f5f9' }}>{i+1}</td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f1f5f9' }}>{it.product_name || it.name || ''}</td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f1f5f9', fontSize:12, color:'#64748b' }}>{it.product_code || it.sku || ''}</td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f1f5f9', textAlign:'center' }}>{it.qty}</td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f1f5f9', textAlign:'right' }}>Rs.{fmt(it.rate)}</td>
                <td style={{ padding:'9px 12px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:600 }}>Rs.{fmt(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ marginLeft:'auto', width:280 }}>
          {invoice.subtotal > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:13 }}>
              <span>Subtotal</span><span>Rs.{fmt(invoice.subtotal)}</span>
            </div>
          )}
          {invoice.tax_amount > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:13 }}>
              <span>Tax</span><span>Rs.{fmt(invoice.tax_amount)}</span>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0 5px', fontSize:16, fontWeight:700, borderTop:'2px solid #111', marginTop:4 }}>
            <span>Grand Total</span><span>Rs.{fmt(invoice.grand_total)}</span>
          </div>
          {invoice.paid_amount > 0 && invoice.is_credit_sale && (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:13, color:'#16a34a' }}>
              <span>Paid</span><span>Rs.{fmt(invoice.paid_amount)}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {invoice.internal_notes && (
          <div style={{ marginTop:32, paddingTop:16, borderTop:'1px solid #e2e8f0', fontSize:12, color:'#64748b' }}>
            <strong>Notes:</strong> {invoice.internal_notes}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:32, paddingTop:16, borderTop:'1px solid #e2e8f0', fontSize:11, color:'#94a3b8', textAlign:'center' }}>
          Thank you for your business!
        </div>
      </div>
    </div>
  );
}

// -- KebabMenu --------------------------------------------------------------
function KebabMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef();
  const menuRef = useRef();

  useEffect(() => {
    function handler(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Position dropdown below the button, aligned to its right edge
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 180 });
    }
    setOpen(v => !v);
  }

  return (
    <div style={{ display:'inline-block' }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{ background:'none', border:'1px solid #e2e8f0', cursor:'pointer', padding:'4px 10px', borderRadius:6, color:'#374151', fontSize:16, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}
        title="Actions"
      >
        <svg width="14" height="14" viewBox="0 0 4 16" fill="currentColor">
          <circle cx="2" cy="2" r="1.5"/>
          <circle cx="2" cy="8" r="1.5"/>
          <circle cx="2" cy="14" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position:'fixed', top: menuPos.top, left: menuPos.left, background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.15)', zIndex:9999, minWidth:180 }}
        >
          {items.map((item, i) => (
            <div key={i} onClick={() => { item.action(); setOpen(false); }}
              style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, color:item.danger?'#ef4444':'#1e293b', borderBottom:i<items.length-1?'1px solid #f1f5f9':'none', display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              {item.icon && <span style={{ fontSize:13, fontWeight:600, color:'#64748b', minWidth:20 }}>{item.icon}</span>}
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- ViewInvoiceModal -------------------------------------------------------
function ViewInvoiceModal({ invoiceId, onClose, onReturn, onPrint }) {
  const [inv, setInv] = useState(null);
  useEffect(() => {
    window.electron.invoke('invoices:getById', { id: invoiceId }).then(setInv);
  }, [invoiceId]);

  if (!inv) return (
    <div className="modal-overlay"><div className="modal-card" style={{textAlign:'center',padding:40}}>Loading...</div></div>
  );

  const statusColor = { Paid:'#16a34a', Credit:'#2563eb', Draft:'#64748b', Completed:'#64748b' }[inv.status] || '#64748b';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width:680, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:18 }}>{inv.invoice_no}</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{inv.invoice_date} &middot; <span style={{ color:statusColor, fontWeight:600 }}>{inv.status}</span></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => onPrint && onPrint(inv)}>Print</button>
            {(inv.status === 'Paid' || inv.status === 'Credit') && (
              <button className="btn btn-outline btn-sm" style={{ color:'#f97316', borderColor:'#f97316' }} onClick={() => { onClose(); onReturn(inv); }}>Return / Exchange</button>
            )}
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Customer & Invoice Info */}
        <div style={{ padding:'16px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:8 }}>Bill To</div>
            <div style={{ fontWeight:700, fontSize:15 }}>{inv.customer_name || 'Walk-in Customer'}</div>
            {inv.customer_phone && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>Ph: {inv.customer_phone}</div>}
            {inv.customer_address && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{inv.customer_address}</div>}
          </div>
          <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:8 }}>Payment</div>
            <div style={{ fontWeight:600 }}>{inv.payment_mode}</div>
            {inv.is_credit_sale
              ? <div style={{ fontSize:12, color:'#f97316', marginTop:4 }}>Credit Sale &ndash; Payment Pending</div>
              : <div style={{ fontSize:12, color:'#16a34a', marginTop:4 }}>Paid</div>}
            {inv.due_date && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Due: {inv.due_date}</div>}
          </div>
        </div>

        {/* Items */}
        <div style={{ padding:'0 24px' }}>
          <table className="data-table" style={{ fontSize:13 }}>
            <thead><tr><th>#</th><th>Product</th><th>SKU</th><th style={{textAlign:'center'}}>Qty</th><th style={{textAlign:'right'}}>Rate</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
            <tbody>
              {(inv.items||[]).map((it, i) => (
                <tr key={it.id}>
                  <td>{i+1}</td>
                  <td>{it.product_name||it.name}</td>
                  <td style={{color:'#64748b'}}>{it.product_code||it.sku||'-'}</td>
                  <td style={{textAlign:'center'}}>{it.qty}</td>
                  <td style={{textAlign:'right'}}>Rs.{Number(it.rate).toLocaleString()}</td>
                  <td style={{textAlign:'right',fontWeight:600}}>Rs.{Number(it.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid #f1f5f9' }}>
          <div style={{ marginLeft:'auto', width:260 }}>
            {[
              { label:'Subtotal', val: inv.subtotal },
              { label:'Tax', val: inv.tax_amount },
            ].filter(r => r.val > 0).map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', color:'#64748b' }}>
                <span>{r.label}</span><span>Rs.{Number(r.val).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:17, borderTop:'2px solid #111', paddingTop:8, marginTop:4 }}>
              <span>Grand Total</span><span>Rs.{Number(inv.grand_total).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
            </div>
          </div>
        </div>

        {inv.internal_notes && (
          <div style={{ padding:'12px 24px', borderTop:'1px solid #f1f5f9', fontSize:12, color:'#64748b' }}>
            <strong>Notes:</strong> {inv.internal_notes}
          </div>
        )}
      </div>
    </div>
  );
}

// -- UpdatePaymentModal -----------------------------------------------------
function UpdatePaymentModal({ invoice, onClose, onUpdated }) {
  const [mode, setMode] = useState('Cash');
  const [amount, setAmount] = useState(invoice.grand_total - (invoice.paid_amount||0));
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    const r = await window.electron.invoke('invoices:updateStatus', { id: invoice.id, status: 'Paid', paid_amount: invoice.grand_total });
    setSaving(false);
    if (r.success) { toast.success('Payment recorded - Invoice marked Paid'); onUpdated(); onClose(); }
    else toast.error(r.error || 'Failed');
  }

  const outstanding = Number(invoice.grand_total||0) - Number(invoice.paid_amount||0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:14, width:440, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:700, fontSize:17, marginBottom:4 }}>Record Payment</div>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:20 }}>Invoice {invoice.invoice_no} &middot; {invoice.customer_name}</div>
        <div style={{ background:'#fef9c3', border:'1px solid #fde68a', borderRadius:8, padding:12, marginBottom:20, fontSize:13 }}>
          Outstanding: <strong>Rs.{outstanding.toLocaleString('en-IN', {minimumFractionDigits:2})}</strong>
        </div>
        <div className="form-group">
          <label className="form-label">Payment Mode</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['Cash','Card'].map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{ padding:'6px 16px', borderRadius:20, border:'1px solid', fontSize:12, cursor:'pointer', fontWeight:500,
                  background: mode===m?'#111':'#fff', color: mode===m?'#fff':'#64748b', borderColor: mode===m?'#111':'#e2e8f0' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Amount Received (Rs.)</label>
          <input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-black" onClick={confirm} disabled={saving}>{saving?'Saving...':'Confirm Payment'}</button>
        </div>
      </div>
    </div>
  );
}

// -- ReturnExchangeModal ----------------------------------------------------
function ReturnExchangeModal({ invoice, onClose, onSaved }) {
  const [type, setType] = useState('Return');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electron.invoke('invoices:getById', { id: invoice.id }).then(inv => {
      if (inv && inv.items) {
        setItems(inv.items.map(it => ({ ...it, returned_qty: 0, max_qty: it.qty })));
      }
    });
  }, [invoice.id]);

  function setQty(idx, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, returned_qty: Math.min(Math.max(0, parseInt(val)||0), it.max_qty) } : it));
  }

  const returnItems = items.filter(it => it.returned_qty > 0);
  const refundTotal = returnItems.reduce((s, it) => s + (it.returned_qty * it.rate), 0);

  const daysSince = Math.floor((Date.now() - new Date(invoice.invoice_date).getTime()) / 86400000);
  const overdue = daysSince > 15;

  async function submit() {
    if (returnItems.length === 0) { toast.error('Select at least one item to return'); return; }
    setSaving(true);
    const r = await window.electron.invoke('returns:create', {
      original_invoice_id: invoice.id,
      invoice_no: invoice.invoice_no,
      customer_name: invoice.customer_name,
      type,
      total_items_sold: items.reduce((s, it) => s + it.qty, 0),
      items_returned: returnItems.reduce((s, it) => s + it.returned_qty, 0),
      return_amount: refundTotal,
      exchange_amount: 0,
      net_amount: refundTotal,
      status: 'Completed',
      created_by: null,
      items: returnItems.map(it => ({ product_id: it.product_id, product_name: it.product_name||it.name, returned_qty: it.returned_qty, exchange_qty: 0, rate: it.rate })),
    });
    setSaving(false);
    if (r.success) { toast.success(`${type} recorded successfully`); onSaved(); onClose(); }
    else toast.error(r.error || 'Failed to record return');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width:600, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ fontWeight:700, fontSize:17 }}>Return / Exchange</div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Invoice {invoice.invoice_no} &middot; {invoice.customer_name || 'Walk-in'} &middot; {daysSince} day(s) ago</div>
        </div>

        <div style={{ padding:'20px 24px' }}>
          {overdue && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:12, marginBottom:16, fontSize:13, color:'#dc2626' }}>
              Warning: This invoice is {daysSince} days old. The standard 15-day return window has expired.
            </div>
          )}

          <div style={{ marginBottom:20 }}>
            <label className="form-label">Type</label>
            <div style={{ display:'flex', gap:10 }}>
              {['Return','Exchange'].map(t => (
                <div key={t} onClick={() => setType(t)} style={{ flex:1, padding:'12px 16px', borderRadius:10, cursor:'pointer', border: type===t?'2px solid #111':'1.5px solid #e2e8f0', background: type===t?'#f8fafc':'#fff', textAlign:'center', fontWeight: type===t?700:400, fontSize:14 }}>
                  {t === 'Return' ? 'Return' : 'Exchange'}
                  <div style={{ fontSize:11, color:'#64748b', fontWeight:400, marginTop:3 }}>
                    {t==='Return'?'Customer gets refund':'Customer swaps item'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label className="form-label">Select Items to {type}</label>
            <table className="data-table" style={{ fontSize:13 }}>
              <thead><tr><th>Product</th><th style={{textAlign:'center'}}>Sold Qty</th><th style={{textAlign:'center'}}>Return Qty</th><th style={{textAlign:'right'}}>Rate</th><th style={{textAlign:'right'}}>Refund</th></tr></thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={5} style={{textAlign:'center',color:'#94a3b8',padding:20}}>Loading items...</td></tr>}
                {items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.product_name || it.name}</td>
                    <td style={{textAlign:'center'}}>{it.max_qty}</td>
                    <td style={{textAlign:'center'}}>
                      <input type="number" min={0} max={it.max_qty} value={it.returned_qty}
                        onChange={e => setQty(i, e.target.value)}
                        style={{ width:60, padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, textAlign:'center', fontSize:13 }} />
                    </td>
                    <td style={{textAlign:'right'}}>Rs.{Number(it.rate).toLocaleString()}</td>
                    <td style={{textAlign:'right', fontWeight:600, color: it.returned_qty>0?'#ef4444':'#94a3b8'}}>
                      {it.returned_qty > 0 ? `-Rs.${(it.returned_qty*it.rate).toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {refundTotal > 0 && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 16px', display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ fontWeight:600 }}>Total {type === 'Return' ? 'Refund' : 'Credit'}</span>
              <span style={{ fontWeight:700, fontSize:17, color:'#ef4444' }}>Rs.{refundTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
            </div>
          )}
        </div>

        <div style={{ padding:'16px 24px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-black" onClick={submit} disabled={saving || returnItems.length === 0}>
            {saving ? 'Processing...' : `Confirm ${type}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- InvoiceStartModal ------------------------------------------------------
function InvoiceStartModal({ onClose, onNew, onResume }) {
  const [drafts, setDrafts] = useState([]);
  useEffect(() => {
    window.electron.invoke('invoices:getAll', { status: 'Draft' }).then(d => setDrafts(Array.isArray(d) ? d : []));
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:32, width:520, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:4 }}>Create Invoice</div>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:24 }}>Start a new invoice or continue a saved draft</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          <div onClick={onNew} style={{ border:'2px solid #111', borderRadius:10, padding:20, cursor:'pointer', textAlign:'center' }}
               onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
               onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            <div style={{ fontSize:28, marginBottom:8 }}>+</div>
            <div style={{ fontWeight:700, fontSize:15 }}>Create New</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>Start a fresh invoice</div>
          </div>
          <div style={{ border:'2px solid #f97316', borderRadius:10, padding:20, textAlign:'center', opacity: drafts.length ? 1 : 0.4, cursor: drafts.length ? 'pointer' : 'default' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>~</div>
            <div style={{ fontWeight:700, fontSize:15 }}>Continue Draft</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{drafts.length} draft(s) saved</div>
          </div>
        </div>
        {drafts.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'#374151' }}>Saved Drafts:</div>
            {drafts.map(d => (
              <div key={d.id} onClick={() => onResume(d)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:8, marginBottom:6, cursor:'pointer' }}
                   onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                   onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{d.invoice_no || 'Unsaved Draft'}</div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>{d.customer_name || 'No customer'} &middot; {d.invoice_date}</div>
                </div>
                <div style={{ fontWeight:700, color:'#111' }}>Rs.{d.grand_total?.toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// -- CreateInvoiceForm ------------------------------------------------------
function CreateInvoiceForm({ onClose, onSaved, initialDraft }) {
  const { currentUser } = useAuth();

  const defaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  };

  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [branchId, setBranchId] = useState('');
  const [sellerId, setSellerId] = useState(currentUser ? String(currentUser.id) : '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [taxPct, setTaxPct] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState(null);

  useEffect(() => {
    window.electron.invoke('products:getAll', {}).then(d => setProducts(Array.isArray(d) ? d : []));
    window.electron.invoke('branches:getAll', {}).then(d => {
      const list = Array.isArray(d) ? d : [];
      setBranches(list);
      // Auto-set branch only when NOT loading a draft
      if (!initialDraft || !initialDraft.id) {
        if (currentUser && currentUser.branch_id) {
          // Branch-specific user: lock to their branch
          setBranchId(String(currentUser.branch_id));
        } else if (list.length > 0) {
          // Admin / Owner: default to main branch (first = lowest id)
          setBranchId(String(list[0].id));
        }
      }
    });
    window.electron.invoke('users:getAll', {}).then(d => setSellers(Array.isArray(d) ? d : []));
    window.electron.invoke('customers:getAll', {}).then(d => setCustomers(Array.isArray(d) ? d : []));
    if (initialDraft && initialDraft.id) {
      setDraftId(initialDraft.id);
      setInvoiceDate(initialDraft.invoice_date || new Date().toISOString().slice(0, 10));
      setDueDate(initialDraft.due_date || defaultDueDate());
      setBranchId(initialDraft.branch_id ? String(initialDraft.branch_id) : (currentUser && currentUser.branch_id ? String(currentUser.branch_id) : ''));
      setSellerId(initialDraft.seller_id ? String(initialDraft.seller_id) : (currentUser ? String(currentUser.id) : ''));
      setCustomerName(initialDraft.customer_name || '');
      setCustomerPhone(initialDraft.customer_phone || '');
      setCustomerAddress(initialDraft.customer_address || '');
      setPaymentMode(initialDraft.payment_mode || 'Cash');
      setIsCreditSale(!!initialDraft.is_credit_sale);
      setTaxPct(initialDraft.tax_pct || 0);
      setDiscount(initialDraft.discount || 0);
      setNotes(initialDraft.notes || '');
      if (Array.isArray(initialDraft.items)) setItems(initialDraft.items);
    }
  }, []);

  const handleGunScan = useCallback(async (barcode) => {
    const p = await window.electron.invoke('products:findByBarcode', { barcode });
    if (p) { addItem(p); toast.success(`Added: ${p.name}`); }
    else toast.error('Barcode not found: ' + barcode);
  }, []);

  useBarcodeGun(handleGunScan, !showScanner);

  async function handleScanDetected(barcode) {
    setShowScanner(false);
    const p = await window.electron.invoke('products:findByBarcode', { barcode });
    if (p) { addItem(p); toast.success(`Added: ${p.name}`); }
    else toast.error('Product not found: ' + barcode);
  }

  function onSearch(val) {
    setSearch(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    setSuggestions(products.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8));
  }

  function addItem(product) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], qty: u[idx].qty + 1, amount: (u[idx].qty + 1) * u[idx].rate };
        return u;
      }
      return [...prev, { product_id: product.id, name: product.name, sku: product.sku, qty: 1, rate: product.selling_price || 0, amount: product.selling_price || 0 }];
    });
    setSearch(''); setSuggestions([]);
  }

  function updateItem(idx, field, val) {
    setItems(prev => {
      const u = [...prev];
      u[idx] = { ...u[idx], [field]: parseFloat(val) || 0 };
      u[idx].amount = u[idx].qty * u[idx].rate;
      return u;
    });
  }

  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmt = subtotal * (taxPct / 100);
  const grandTotal = subtotal + taxAmt - (parseFloat(discount) || 0);

  async function save(status) {
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const payload = {
        invoice_date: invoiceDate, due_date: dueDate, branch_id: branchId || null, seller_id: sellerId || null,
        customer_name: customerName, customer_phone: customerPhone, customer_address: customerAddress, items,
        payment_mode: paymentMode, split_cash: splitCash ? parseFloat(splitCash) : null, split_card: splitCard ? parseFloat(splitCard) : null,
        is_credit_sale: isCreditSale ? 1 : 0, tax_pct: taxPct, discount: parseFloat(discount) || 0,
        subtotal, tax_amount: taxAmt, grand_total: grandTotal, notes, status,
      };
      const result = await window.electron.invoke(draftId ? 'invoices:update' : 'invoices:create', draftId ? { id: draftId, data: payload } : payload);
      if (result.success) {
        toast.success(status === 'Draft' ? 'Saved as draft' : 'Invoice created!');
        onSaved(); onClose();
      } else { toast.error(result.error || 'Failed to save invoice'); }
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#fff', zIndex:200, overflowY:'auto', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:16, background:'#fff', position:'sticky', top:0, zIndex:10 }}>
        <button className="btn btn-outline" onClick={onClose}>&larr; Back</button>
        <div>
          <div style={{ fontWeight:700, fontSize:18 }}>Create Invoice</div>
          <div style={{ fontSize:12, color:'#64748b' }}>Fill in the details to generate a sales invoice</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn btn-outline" onClick={() => save('Draft')} disabled={saving}>Save Draft</button>
          <button className="btn btn-black" onClick={() => save(isCreditSale ? 'Credit' : 'Paid')} disabled={saving}>
            {isCreditSale ? 'Save Credit Sale' : 'Finalize & Save'}
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, gap:0 }}>
        <div style={{ flex:1, padding:24, overflowY:'auto', borderRight:'1px solid #f1f5f9' }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontWeight:600, marginBottom:12, fontSize:14 }}>Invoice Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="form-label">Invoice Date *</label><input type="date" className="form-input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
              <div><label className="form-label">Due Date</label><input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              <div><label className="form-label">Branch</label>
                <select
                  className="form-select"
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  disabled={!!(currentUser && currentUser.branch_id)}
                  style={currentUser && currentUser.branch_id ? { background:'#f1f5f9', cursor:'not-allowed' } : {}}
                >
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label className="form-label">Seller</label>
                <select className="form-select" value={sellerId} onChange={e => setSellerId(e.target.value)}>
                  <option value="">Select Seller</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginBottom:24 }}>
            <div style={{ fontWeight:600, marginBottom:12, fontSize:14 }}>Customer Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="form-label">Customer Name</label>
                <input className="form-input" placeholder="Walk-in Customer" value={customerName} onChange={e => setCustomerName(e.target.value)} list="customer-list" />
                <datalist id="customer-list">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
              </div>
              <div><label className="form-label">Phone Number</label><input className="form-input" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></div>
              <div style={{ gridColumn:'span 2' }}><label className="form-label">Address</label><input className="form-input" placeholder="Customer address (optional)" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} /></div>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, marginBottom:8, fontSize:14 }}>Add Products</div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ position:'relative', flex:1 }}>
                <input className="form-input" placeholder="Search product by name, SKU or barcode..." value={search} onChange={e => onSearch(e.target.value)} />
                {suggestions.length > 0 && (
                  <div style={{ position:'absolute', left:0, right:0, top:'100%', background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, zIndex:50, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', maxHeight:260, overflowY:'auto' }}>
                    {suggestions.map(p => (
                      <div key={p.id} onClick={() => addItem(p)} style={{ padding:'10px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9', fontSize:13 }}
                        onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                        <span>{p.name} <span style={{ color:'#94a3b8', fontSize:11 }}>{p.sku}</span></span>
                        <span style={{ fontWeight:600 }}>Rs.{p.selling_price?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setShowScanner(true)} title="Scan barcode"
                style={{ padding:'0 14px', background:'#1e293b', border:'none', borderRadius:8, cursor:'pointer', color:'#fff', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                [Scan]
              </button>
            </div>
            <div style={{ marginTop:5, fontSize:11, color:'#94a3b8' }}>Tip: USB barcode gun works anytime - just scan and product is added instantly</div>
          </div>

          {showScanner && <BarcodeScanner title="Scan Product Barcode" onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />}

          <div style={{ marginBottom:24 }}>
            <table className="data-table" style={{ fontSize:13 }}>
              <thead><tr><th>#</th><th>Product</th><th>SKU</th><th style={{width:80}}>Qty</th><th style={{width:100}}>Rate (Rs.)</th><th style={{width:100}}>Amount (Rs.)</th><th></th></tr></thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', color:'#94a3b8', padding:24 }}>No items added yet</td></tr>}
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>{i+1}</td><td>{item.name}</td><td style={{ color:'#64748b' }}>{item.sku}</td>
                    <td><input type="number" min={1} className="form-input" style={{ width:70, padding:'4px 8px' }} value={item.qty} onChange={e => updateItem(i,'qty',e.target.value)} /></td>
                    <td><input type="number" min={0} className="form-input" style={{ width:90, padding:'4px 8px' }} value={item.rate} onChange={e => updateItem(i,'rate',e.target.value)} /></td>
                    <td style={{ fontWeight:600 }}>Rs.{item.amount.toLocaleString()}</td>
                    <td><button onClick={() => removeItem(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16, fontWeight:700 }}>x</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div><label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} placeholder="Internal notes or instructions..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize:'vertical' }} />
          </div>
        </div>

        <div style={{ width:320, padding:24, display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <div style={{ fontWeight:600, marginBottom:10, fontSize:14 }}>Payment Mode</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {['Cash','Card'].map(m => (
                <button key={m} type="button" onClick={() => setPaymentMode(m)}
                  style={{ padding:'6px 14px', borderRadius:20, border:'1px solid', fontSize:12, cursor:'pointer', fontWeight:500,
                    background: paymentMode===m?'#1e293b':'#fff', color: paymentMode===m?'#fff':'#64748b', borderColor: paymentMode===m?'#1e293b':'#e2e8f0' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
            <div><div style={{ fontWeight:600, fontSize:13 }}>Credit Sale</div><div style={{ fontSize:11, color:'#64748b' }}>Customer pays later</div></div>
            <div onClick={() => setIsCreditSale(v => !v)} style={{ width:44, height:24, borderRadius:12, background:isCreditSale?'#22c55e':'#cbd5e1', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
              <div style={{ position:'absolute', top:2, left:isCreditSale?22:2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
            </div>
          </div>

          <div>
            <div style={{ fontWeight:600, marginBottom:10, fontSize:14 }}>Adjustments</div>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}><label className="form-label" style={{ fontSize:11 }}>Tax (%)</label><input type="number" min={0} max={100} className="form-input" value={taxPct} onChange={e => setTaxPct(parseFloat(e.target.value)||0)} /></div>
              <div style={{ flex:1 }}><label className="form-label" style={{ fontSize:11 }}>Discount (Rs.)</label><input type="number" min={0} className="form-input" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
            </div>
          </div>

          <div style={{ background:'#f8fafc', borderRadius:10, padding:16, border:'1px solid #e2e8f0' }}>
            <div style={{ fontWeight:600, marginBottom:12, fontSize:14 }}>Summary</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#64748b' }}>Subtotal</span><span>Rs.{subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#64748b' }}>Tax ({taxPct}%)</span><span>Rs.{taxAmt.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#64748b' }}>Discount</span><span style={{ color:'#ef4444' }}>-Rs.{(parseFloat(discount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              <div style={{ height:1, background:'#e2e8f0', margin:'4px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:16 }}><span>Grand Total</span><span>Rs.{grandTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              {isCreditSale && <div style={{ marginTop:4, padding:'6px 10px', background:'#fef3c7', borderRadius:6, fontSize:11, color:'#92400e', textAlign:'center' }}>Credit Sale - payment due later</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- ReturnExchangeTab ------------------------------------------------------
function ReturnExchangeTab({ onCreateReturn }) {
  const [returns, setReturns] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => { loadReturns(); }, [search]);

  async function loadReturns() {
    try {
      const data = await window.electron.invoke('returns:getAll', {});
      setReturns(Array.isArray(data) ? data : []);
    } catch { setReturns([]); }
  }

  const filtered = returns.filter(r =>
    !search || (r.invoice_no||'').toLowerCase().includes(search.toLowerCase()) || (r.customer_name||'').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="filters-bar">
        <div style={{ position:'relative' }}>
          <input className="form-input" style={{ paddingLeft:12, width:280 }} placeholder="Search by invoice or customer" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-black filters-bar-right" onClick={onCreateReturn}>+ Create Return / Exchange</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>S.No</th><th>Original Invoice</th><th>Customer</th><th>Type</th><th>Items Returned</th><th>Refund Amount</th><th>Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>No returns or exchanges found</td></tr>}
            {filtered.map((r, i) => (
              <tr key={r.id}>
                <td>{i+1}</td>
                <td style={{ fontWeight:600 }}>{r.invoice_no || '-'}</td>
                <td>{r.customer_name || '-'}</td>
                <td><span className={`badge ${r.type === 'Return' ? 'badge-orange' : 'badge-blue'}`}>{r.type}</span></td>
                <td style={{ textAlign:'center' }}>{r.items_returned || 0}</td>
                <td style={{ fontWeight:600, color:'#ef4444' }}>Rs.{Number(r.return_amount||0).toLocaleString()}</td>
                <td>{(r.date||r.created_at||'').split('T')[0]}</td>
                <td><span className={`badge ${r.status === 'Completed' ? 'badge-green' : 'badge-grey'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- ReturnPickerModal - pick a paid invoice to return ----------------------
function ReturnPickerModal({ onClose, onPick }) {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    window.electron.invoke('invoices:getAll', { status: 'Paid' })
      .then(d => setInvoices(Array.isArray(d) ? d : []));
  }, []);

  const filtered = invoices.filter(inv =>
    !search || (inv.invoice_no||'').toLowerCase().includes(search.toLowerCase()) || (inv.customer_name||'').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width:560, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ fontWeight:700, fontSize:17 }}>Select Invoice to Return</div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>Choose the original paid invoice</div>
        </div>
        <div style={{ padding:'12px 24px', borderBottom:'1px solid #f1f5f9' }}>
          <input className="form-input" placeholder="Search invoice or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {filtered.length === 0 && <div style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>No paid invoices found</div>}
          {filtered.map(inv => (
            <div key={inv.id} onClick={() => onPick(inv)}
              style={{ padding:'12px 24px', borderBottom:'1px solid #f8fafc', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background='#fff'}>
              <div>
                <div style={{ fontWeight:600 }}>{inv.invoice_no}</div>
                <div style={{ fontSize:12, color:'#64748b' }}>{inv.customer_name||'Walk-in'} &middot; {inv.invoice_date}</div>
              </div>
              <div style={{ fontWeight:700 }}>Rs.{Number(inv.grand_total||0).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid #f1f5f9' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// -- BillingInvoice (main) --------------------------------------------------
export default function BillingInvoice() {
  const [activeTab, setActiveTab] = useState('Invoices');
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [payInvoice, setPayInvoice] = useState(null);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [printPreview, setPrintPreview] = useState(null);
  const { can } = useAuth();

  useEffect(() => { loadInvoices(); }, [search, statusFilter]);

  async function loadInvoices() {
    try {
      await window.electron.invoke('invoices:autoComplete', {}).catch(() => {});
      const data = await window.electron.invoke('invoices:getAll', { status: statusFilter === 'All' ? null : statusFilter, search });
      setInvoices(Array.isArray(data) ? data : []);
    } catch { setInvoices([]); }
  }

  async function deleteInvoice(id) {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    const r = await window.electron.invoke('invoices:delete', { id });
    if (r.success) { toast.success('Invoice deleted'); loadInvoices(); }
    else toast.error(r.error || 'Failed');
  }

  function handleCreateClick() { setShowStartModal(true); }
  function handleNewInvoice() { setShowStartModal(false); setShowCreate(true); }
  function handleResumeDraft(draft) { setShowStartModal(false); setShowCreate(draft); }

  function openReturnPicker() { setShowReturnPicker(true); }

  const displayList = activeTab === 'Completed'
    ? invoices.filter(inv => ['Completed','Paid'].includes(inv.status))
    : activeTab === 'Invoices'
    ? invoices.filter(inv => !['Completed'].includes(inv.status))
    : invoices;

  if (showCreate && showCreate !== true) {
    return <CreateInvoiceForm initialDraft={showCreate} onClose={() => setShowCreate(false)} onSaved={loadInvoices} />;
  }
  if (showCreate === true) {
    return <CreateInvoiceForm onClose={() => setShowCreate(false)} onSaved={loadInvoices} />;
  }

  return (
    <div>
      {printPreview && <PrintPreviewModal invoice={printPreview} onClose={() => setPrintPreview(null)} />}

      {showStartModal && <InvoiceStartModal onClose={() => setShowStartModal(false)} onNew={handleNewInvoice} onResume={handleResumeDraft} />}

      {viewInvoice && (
        <ViewInvoiceModal
          invoiceId={viewInvoice}
          onClose={() => setViewInvoice(null)}
          onReturn={inv => { setViewInvoice(null); setReturnInvoice(inv); }}
          onPrint={inv => { setViewInvoice(null); setPrintPreview(inv); }}
        />
      )}

      {payInvoice && (
        <UpdatePaymentModal
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onUpdated={loadInvoices}
        />
      )}

      {returnInvoice && (
        <ReturnExchangeModal
          invoice={returnInvoice}
          onClose={() => setReturnInvoice(null)}
          onSaved={loadInvoices}
        />
      )}

      {showReturnPicker && (
        <ReturnPickerModal
          onClose={() => setShowReturnPicker(false)}
          onPick={inv => { setShowReturnPicker(false); setReturnInvoice(inv); }}
        />
      )}

      <div className="page-header">
        <div className="page-title">Billing &amp; Invoice</div>
        <div className="page-subtitle">Manage Bills And Create Sales Invoices</div>
      </div>

      <div className="tab-pills">
        {['Invoices','Return & Exchange','Completed'].map(tab => (
          <div key={tab} className={`tab-pill ${activeTab===tab?'active':''}`} onClick={() => setActiveTab(tab)}>{tab}</div>
        ))}
      </div>

      {activeTab === 'Return & Exchange' && <ReturnExchangeTab onCreateReturn={openReturnPicker} />}

      {(activeTab === 'Invoices' || activeTab === 'Completed') && (
        <>
          <div className="filters-bar">
            <div style={{ position:'relative' }}>
              <input className="form-input" style={{ paddingLeft:12, width:280 }} placeholder="Search invoice, customer or amount" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width:130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option>All</option><option>Paid</option><option>Draft</option><option>Credit</option><option>Completed</option>
            </select>
            {activeTab === 'Invoices' && can('billing','create') && (
              <button className="btn btn-black filters-bar-right" onClick={handleCreateClick}>+ Create Invoice</button>
            )}
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th><th>Invoice No.</th><th>Customer</th><th>Phone</th>
                  <th>Items</th><th>Total</th><th>Payment</th><th>Date</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayList.length === 0 && <tr><td colSpan={10} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>No invoices found</td></tr>}
                {displayList.map((inv, i) => (
                  <tr key={inv.id}>
                    <td>{i+1}</td>
                    <td style={{ fontWeight:600, cursor:'pointer', color:'#2563eb' }} onClick={() => setViewInvoice(inv.id)}>{inv.invoice_no}</td>
                    <td>{inv.customer_name || 'Walk-in'}</td>
                    <td>{inv.customer_phone || '-'}</td>
                    <td style={{ textAlign:'center' }}>{inv.item_count || '-'}</td>
                    <td style={{ fontWeight:600 }}>Rs.{Number(inv.grand_total||0).toLocaleString()}</td>
                    <td>{inv.payment_mode}</td>
                    <td>{inv.invoice_date}</td>
                    <td>
                      <span className={`badge ${inv.status==='Paid'?'badge-green':inv.status==='Draft'?'badge-grey':inv.status==='Credit'?'badge-blue':'badge-grey'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <KebabMenu items={[
                        { label:'View Details', icon:'[+]', action:() => setViewInvoice(inv.id) },
                        { label:'Print', icon:'[P]', action:async () => {
                          const full = await window.electron.invoke('invoices:getById', { id: inv.id });
                          setPrintPreview(full);
                        }},
                        ...(inv.status === 'Credit' ? [{ label:'Mark as Paid', icon:'[$]', action:() => setPayInvoice(inv) }] : []),
                        ...((inv.status === 'Paid' || inv.status === 'Credit') ? [{ label:'Return / Exchange', icon:'[R]', action:() => setReturnInvoice(inv) }] : []),
                        { label:'Delete', icon:'[X]', action:() => deleteInvoice(inv.id), danger:true },
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

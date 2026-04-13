/**
 * INVENTORY & SERVICES PAGE
 * Stats: Total Items, Low Stock Alert, Stock Value (Cost), Stock Value (Selling)
 * Table: SKU | Product Name | Category | HSN | Purchase Price | Selling Price | Stock | Status | Actions
 */
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import BarcodeScanner from '../components/BarcodeScanner';

// ── KebabMenu ──────────────────────────────────────────────────────────────
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
      <button className="btn-icon" onClick={() => setOpen(v => !v)}>⋮</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150 }}>
          {items.map((item, i) => (
            <div key={i} onClick={() => { item.action(); setOpen(false); }}
              style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: item.danger ? '#ef4444' : '#1e293b', borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ItemModal (Add / Edit) ─────────────────────────────────────────────────
function ItemModal({ product, categories, branches, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category_id: product?.category_id || '',
    hsn_code: product?.hsn_code || '',
    unit: product?.unit || 'pcs',
    purchase_price: product?.purchase_price || '',
    selling_price: product?.selling_price || '',
    current_stock: product?.current_stock || '',
    low_stock_threshold: product?.low_stock_threshold || 10,
    description: product?.description || '',
    branch_id: product?.branch_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })); }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!form.selling_price) { toast.error('Selling price is required'); return; }
    setSaving(true);
    try {
      const channel = isEdit ? 'products:update' : 'products:create';
      const payload = isEdit ? { id: product.id, ...form } : form;
      const result = await window.electron.invoke(channel, payload);
      if (result.success) {
        toast.success(isEdit ? 'Product updated' : 'Product added');
        onSaved();
        onClose();
      } else {
        toast.error(result.error || 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{isEdit ? 'Edit Product' : 'Add New Item'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Product Name *</label>
            <input className="form-input" placeholder="Enter product name" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="form-label">SKU</label>
            <input className="form-input" placeholder="Auto-generated if blank" value={form.sku} onChange={e => set('sku', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Barcode</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="form-input"
                placeholder="Scan or enter barcode"
                value={form.barcode}
                onChange={e => set('barcode', e.target.value)}
                style={{ flex: 1, fontFamily: 'monospace', letterSpacing: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                title="Scan barcode with webcam or gun"
                style={{ padding: '0 12px', background: '#1e293b', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}
              >
                📷
              </button>
            </div>
            {showScanner && (
              <BarcodeScanner
                title="Scan Product Barcode"
                onDetected={code => { set('barcode', code); setShowScanner(false); toast.success('Barcode captured: ' + code); }}
                onClose={() => setShowScanner(false)}
              />
            )}
          </div>
          <div>
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Branch</label>
            <select className="form-select" value={form.branch_id} onChange={e => set('branch_id', e.target.value || '')}>
              <option value="">All Branches (Global)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">HSN Code</label>
            <input className="form-input" placeholder="HSN code" value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Unit</label>
            <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
              {['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'dozen', 'meter'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Purchase Price (₹)</label>
            <input type="number" min={0} className="form-input" placeholder="0.00" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Selling Price (₹) *</label>
            <input type="number" min={0} className="form-input" placeholder="0.00" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Current Stock</label>
            <input type="number" min={0} className="form-input" placeholder="0" value={form.current_stock} onChange={e => set('current_stock', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Low Stock Threshold</label>
            <input type="number" min={0} className="form-input" placeholder="10" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} placeholder="Product description (optional)" value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-black" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── InventoryServices (main) ───────────────────────────────────────────────
export default function InventoryServices() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const { can } = useAuth();

  useEffect(() => { loadAll(); }, [search, catFilter, statusFilter, selectedBranch]);

  useEffect(() => {
    window.electron.invoke('branches:getAll').then(setBranches).catch(() => setBranches([]));
  }, []);

  function loadAll() {
    window.electron.invoke('products:getAll', { search, category: catFilter === 'All Categories' ? null : catFilter, status: statusFilter === 'All Status' ? null : statusFilter, branch_id: selectedBranch || undefined })
      .then(data => setProducts(Array.isArray(data) ? data : []));
    window.electron.invoke('products:getInventoryStats', {})
      .then(data => setStats(data || {}));
    window.electron.invoke('categories:getAll', {})
      .then(data => setCategories(Array.isArray(data) ? data : []));
  }

  function handleImportCSV() { setShowImportModal(true); }

  async function doImport() {
    try {
      const filePath = await window.electron.invoke('products:chooseImportFile');
      if (!filePath) return;

      let rows = [];
      if (filePath.endsWith('.csv')) {
        const fs = window.require ? window.require('fs') : null;
        if (fs) {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(l => l.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          rows = lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const obj = {};
            headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
            return obj;
          });
        }
      } else {
        const XLSX = window.require ? window.require('xlsx') : null;
        if (XLSX) {
          const wb = XLSX.readFile(filePath);
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws);
        }
      }

      if (rows.length === 0) { toast.error('No data found in file'); return; }
      const result = await window.electron.invoke('products:importCSV', { rows });
      if (result.success) {
        toast.success(`Import complete: ${result.inserted} added, ${result.updated} updated`);
        setShowImportModal(false);
        loadAll();
      } else {
        toast.error('Import failed');
      }
    } catch(e) {
      toast.error('Import error: ' + e.message);
    }
  }

  async function handleExportExcel() {
    try {
      const rows = await window.electron.invoke('products:exportCSV');
      if (!rows || rows.length === 0) { toast.error('No products to export'); return; }
      const savePath = await window.electron.invoke('products:chooseSaveFile');
      if (!savePath) return;
      const XLSX = window.require ? window.require('xlsx') : null;
      if (!XLSX) { toast.error('Excel export not available'); return; }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, savePath);
      toast.success('Products exported successfully!');
    } catch(e) {
      toast.error('Export error: ' + e.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    const result = await window.electron.invoke('products:delete', { id });
    if (result.success) { toast.success('Product deleted'); loadAll(); }
    else toast.error(result.error || 'Failed to delete');
  }

  function openAdd() { setEditProduct(null); setShowModal(true); }
  function openEdit(product) { setEditProduct(product); setShowModal(true); }

  const statusBadge = s => s === 'Good' ? 'badge-green' : s === 'Low' ? 'badge-orange' : 'badge-red';
  const stockColor = s => s === 'Good' ? '#16a34a' : s === 'Low' ? '#d97706' : '#dc2626';

  function downloadTemplate() {
    const header = 'name,category,purchase_price,selling_price,current_stock,reorder_level,unit,hsn_code,barcode';
    const sample = [
      'Wireless Mouse,Electronics,450,799,50,10,pcs,84716060,8901234567890',
      'Office Chair,Furniture,3500,5999,20,5,pcs,,',
      'A4 Paper Ream,Stationery,180,250,100,20,ream,48023900,',
    ].join('\n');
    const csv = header + '\n' + sample;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products_import_template.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width:640, boxShadow:'0 24px 80px rgba(0,0,0,0.18)', overflow:'hidden' }}>
            {/* Header */}
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:17 }}>Import Products via CSV</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Upload a CSV file to bulk add or update products</div>
              </div>
              <button onClick={() => setShowImportModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>&#10005;</button>
            </div>

            <div style={{ padding:'20px 24px' }}>
              {/* Format table */}
              <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Required CSV Format</div>
              <div style={{ overflowX:'auto', marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#111', color:'#fff' }}>
                      {['Column','Example','Required?','Notes'].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['name',           'Wireless Mouse',    'Yes', 'Unique product name'],
                      ['category',       'Electronics',       'No',  'Must match existing category'],
                      ['purchase_price', '450',               'No',  'Cost price (number)'],
                      ['selling_price',  '799',               'No',  'Selling price (number)'],
                      ['current_stock',  '50',                'No',  'Opening stock quantity'],
                      ['reorder_level',  '10',                'No',  'Low stock threshold'],
                      ['unit',           'pcs',               'No',  'pcs / kg / ltr / box etc.'],
                      ['hsn_code',       '84716060',          'No',  'HSN/SAC code'],
                      ['barcode',        '8901234567890',     'No',  'Barcode / EAN'],
                    ].map(([col, ex, req, note], i) => (
                      <tr key={col} style={{ background: i%2===0?'#f8fafc':'#fff' }}>
                        <td style={{ padding:'7px 12px', fontWeight:600, color:'#111', fontFamily:'monospace' }}>{col}</td>
                        <td style={{ padding:'7px 12px', color:'#64748b' }}>{ex}</td>
                        <td style={{ padding:'7px 12px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700, background: req==='Yes'?'#fee2e2':'#f1f5f9', color: req==='Yes'?'#991b1b':'#64748b' }}>{req}</span>
                        </td>
                        <td style={{ padding:'7px 12px', color:'#64748b', fontSize:11 }}>{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tips */}
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400e', marginBottom:20 }}>
                <strong>Tips:</strong> First row must be the header. Existing products (matched by name) will be updated, new names will be inserted. Leave optional columns blank — do not remove them.
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-outline" onClick={downloadTemplate}>
                  &#8595; Download Template
                </button>
                <button className="btn btn-black" onClick={doImport}>
                  &#8593; Choose File &amp; Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div className="page-title">Inventory &amp; Services</div>
        <div className="page-subtitle">Manage Stock And Products</div>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card blue" style={{ minHeight: 100, padding: '16px 18px' }}>
          <div className="stat-card-label">Total Items</div>
          <div className="stat-card-value" style={{ fontSize: 26, margin: '6px 0 0' }}>{stats.total || 0}</div>
          <div className="stat-card-icon" style={{ fontSize: 18, top: 14, right: 14 }}>&#128230;</div>
        </div>
        <div className="stat-card pink" style={{ minHeight: 100, padding: '16px 18px' }}>
          <div className="stat-card-label">Low Stock Alert</div>
          <div className="stat-card-value" style={{ fontSize: 26, margin: '6px 0 0' }}>{stats.lowAlert || 0}</div>
          <div className="stat-card-icon" style={{ fontSize: 18, top: 14, right: 14 }}>&#9888;</div>
        </div>
        <div className="stat-card yellow" style={{ minHeight: 100, padding: '16px 18px' }}>
          <div className="stat-card-label">Stock Value (Cost)</div>
          <div className="stat-card-value" style={{ fontSize: 20, margin: '6px 0 0' }}>Rs.{(stats.costVal || 0).toLocaleString()}</div>
          <div className="stat-card-icon" style={{ fontSize: 18, top: 14, right: 14 }}>&#128181;</div>
        </div>
        <div className="stat-card green" style={{ minHeight: 100, padding: '16px 18px' }}>
          <div className="stat-card-label">Stock Value (Selling)</div>
          <div className="stat-card-value" style={{ fontSize: 20, margin: '6px 0 0' }}>Rs.{(stats.sellVal || 0).toLocaleString()}</div>
          <div className="stat-card-icon" style={{ fontSize: 18, top: 14, right: 14 }}>&#128200;</div>
        </div>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          <input className="form-input" style={{ paddingLeft: 32, width: 260 }} placeholder="Search by name or SKU" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option>All Categories</option>
          {categories.map(c => <option key={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All Status</option><option>Good</option><option>Low</option><option>Critical</option>
        </select>
        <select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); }} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13 }}>
          <option value=''>All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {can('inventory', 'create') && (
          <>
            <button className="btn btn-outline filters-bar-right" onClick={handleImportCSV} style={{ marginRight: 8 }}>⬆ Import CSV</button>
            <button className="btn btn-outline filters-bar-right" onClick={handleExportExcel} style={{ marginRight: 8 }}>⬇ Export</button>
            <button className="btn btn-black filters-bar-right" onClick={openAdd}>+ Add Item</button>
          </>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>S.No</th><th>SKU</th><th>Product Name</th><th>Categories</th>
              <th>HSN</th><th>Purchase Price</th><th>Selling Price</th>
              <th>Stock</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No products found</td></tr>
            )}
            {products.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.category_name || '-'}</td>
                <td>{p.hsn_code || '-'}</td>
                <td>₹{p.purchase_price?.toLocaleString()}</td>
                <td>₹{p.selling_price?.toLocaleString()}</td>
                <td style={{ color: stockColor(p.status), fontWeight: 600 }}>{p.current_stock}</td>
                <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                <td>
                  <KebabMenu items={[
                    { label: 'Edit Product', action: () => openEdit(p) },
                    { label: 'Delete Product', danger: true, action: () => handleDelete(p.id) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ItemModal
          product={editProduct}
          categories={categories}
          branches={branches}
          onClose={() => setShowModal(false)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}

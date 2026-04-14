/**
 * EXPENSES PAGE
 * Claude Code: Build per SKILL.md Sections 19-20 (Screens 19-20)
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = ['Payroll & Salary','Rent & Office','Marketing & Sales','Utilities','Other'];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({ total:0, byCategory:[] });
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title:'', amount:'', expense_date: new Date().toISOString().split('T')[0], category:'', account_id:'' });
  const { can } = useAuth();

  useEffect(() => { load(); }, []);

  async function load() {
    setExpenses(await window.electron.invoke('expenses:getAll'));
    setStats(await window.electron.invoke('expenses:getStats'));
    setAccounts(await window.electron.invoke('banking:getAccounts'));
  }

  async function saveExpense() {
    if (!form.title || !form.amount) { toast.error('Title and amount required'); return; }
    await window.electron.invoke('expenses:create', { ...form, amount: parseFloat(form.amount), account_id: parseInt(form.account_id) || null });
    toast.success('Expense saved!');
    setShowModal(false);
    load();
  }

  const catColors = { 'Payroll & Salary':'#111', 'Rent & Office':'#374151', 'Marketing & Sales':'#6b7280', 'Utilities':'#9ca3af', 'Other':'#d1d5db' };
  const totalCat = stats.byCategory?.reduce((s,c) => s + c.total, 0) || 1;

  // Stat card values from byCategory
  const getVal = (cat) => stats.byCategory?.find(c => c.category === cat)?.total || 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Expenses</div>
        <div className="page-subtitle">Track And Manage Business Expenses</div>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns:'repeat(4, 1fr)' }}>
        <div className="stat-card blue" style={{ minHeight:100, padding:'16px 18px' }}>
          <div className="stat-card-label">Total Expenses (This Month)</div>
          <div className="stat-card-value" style={{ fontSize:20, margin:'6px 0 0' }}>${(stats.total||0).toLocaleString()}</div>
          <div className="stat-card-icon" style={{ fontSize:18, top:14, right:14 }}>&#128179;</div>
        </div>
        <div className="stat-card pink" style={{ minHeight:100, padding:'16px 18px' }}>
          <div className="stat-card-label">Rent</div>
          <div className="stat-card-value" style={{ fontSize:20, margin:'6px 0 0' }}>${getVal('Rent & Office').toLocaleString()}</div>
          <div className="stat-card-icon" style={{ fontSize:18, top:14, right:14 }}>&#127970;</div>
        </div>
        <div className="stat-card yellow" style={{ minHeight:100, padding:'16px 18px' }}>
          <div className="stat-card-label">Electricity</div>
          <div className="stat-card-value" style={{ fontSize:20, margin:'6px 0 0' }}>${getVal('Utilities').toLocaleString()}</div>
          <div className="stat-card-icon" style={{ fontSize:18, top:14, right:14 }}>&#9889;</div>
        </div>
        <div className="stat-card green" style={{ minHeight:100, padding:'16px 18px' }}>
          <div className="stat-card-label">Salary</div>
          <div className="stat-card-value" style={{ fontSize:20, margin:'6px 0 0' }}>${getVal('Payroll & Salary').toLocaleString()}</div>
          <div className="stat-card-icon" style={{ fontSize:18, top:14, right:14 }}>&#128188;</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
        {/* Recent Expenses Table */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Recent Expenses</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>Latest Expense Entries</div>
            </div>
            {can('expenses','create') && (
              <button className="btn btn-black" onClick={() => setShowModal(true)}>+ Add Expense</button>
            )}
          </div>
          <table className="data-table">
            <thead><tr><th>Expense ID</th><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight:600 }}>{e.expense_id}</td>
                  <td>{e.expense_date}</td>
                  <td>{e.category}</td>
                  <td>{e.title}</td>
                  <td className="amount-negative">${e.amount?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expense by Category */}
        <div className="card">
          <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Expense By Category</div>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>Latest Expense Entries</div>
          {EXPENSE_CATEGORIES.map(cat => {
            const val = getVal(cat);
            const pct = totalCat > 0 ? Math.round((val / totalCat) * 100) : 0;
            return (
              <div key={cat} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                  <span>{cat}</span><span style={{ fontWeight:600 }}>{pct}%</span>
                </div>
                <div style={{ height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background: catColors[cat] || '#111', borderRadius:3 }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop:20, background:'#f9fafb', borderRadius:10, padding:14, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:20 }}>💡</span>
            <div>
              <div style={{ fontWeight:600, fontSize:12 }}>INSIGHT</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                {stats.byCategory?.length ? `${stats.byCategory[0]?.category} is your top expense this month.` : 'No expenses recorded this month.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="modal-title">Add New Expense</div>
            <div className="form-group">
              <label className="form-label">Expense Title / Description</label>
              <input className="form-input" placeholder="e.g. Office Supplies" value={form.title} onChange={e => setForm({...form,title:e.target.value})} />
            </div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Amount</label><input className="form-input" type="number" placeholder="0" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Expense Date</label><input type="date" className="form-input" value={form.expense_date} onChange={e => setForm({...form,expense_date:e.target.value})} /></div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
                  <option value="">Select Category</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Paid From</label>
                <select className="form-select" value={form.account_id} onChange={e => setForm({...form,account_id:e.target.value})}>
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={saveExpense}>Save Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

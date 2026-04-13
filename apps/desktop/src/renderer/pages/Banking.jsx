/**
 * BANKING PAGE
 * Claude Code: Build per SKILL.md Section 17-18 (Screens 17-18)
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Banking() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type:'Received', date: new Date().toISOString().split('T')[0], account_id:'', account_name:'', amount:'', description:'' });
  const { can } = useAuth();

  useEffect(() => { load(); }, []);

  async function load() {
    setAccounts(await window.electron.invoke('banking:getAccounts'));
    setTransactions(await window.electron.invoke('banking:getTransactions'));
  }

  async function addTransaction() {
    const payload = { ...form, type: form.type === 'Received' ? 'Credit' : 'Debit', amount: parseFloat(form.amount) };
    const selAcc = accounts.find(a => a.id === parseInt(form.account_id));
    if (selAcc) payload.account_name = selAcc.account_name;
    await window.electron.invoke('banking:addTransaction', payload);
    toast.success('Transaction added!');
    setShowModal(false);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Banking</div>
        <div className="page-subtitle">Manage Cash And Bank Transactions</div>
      </div>

      {/* Account Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {accounts.map(acc => (
          <div key={acc.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>{acc.account_name}</div>
                <div style={{ fontSize:26, fontWeight:700 }}>${acc.current_balance?.toLocaleString()}</div>
              </div>
              <span style={{ fontSize:22 }}>{acc.account_type === 'Cash' ? '🏧' : '🏦'}</span>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="btn btn-outline" style={{ flex:1 }} onClick={() => { setForm({...form, type:'Received', account_id: String(acc.id)}); setShowModal(true); }}>Received</button>
              <button className="btn btn-black" style={{ flex:1 }} onClick={() => { setForm({...form, type:'Paid', account_id: String(acc.id)}); setShowModal(true); }}>Pay</button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>Recent Expenses</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>Latest Expense Entries</div>
          </div>
          {can('banking','create') && (
            <button className="btn btn-black" onClick={() => setShowModal(true)}>+ New Transaction</button>
          )}
        </div>
        <table className="data-table">
          <thead><tr><th>Transaction ID</th><th>Date</th><th>Description</th><th>Account</th><th>Type</th><th>Amount</th></tr></thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight:600 }}>{t.txn_id}</td>
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td>{t.account_name}</td>
                <td><span className={`badge ${t.type==='Credit'?'badge-green':'badge-red'}`}>{t.type}</span></td>
                <td className={t.type==='Credit'?'amount-positive':'amount-negative'}>${t.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="modal-title">New Transaction</div>
            <div className="modal-subtitle">Record a new payment or receipt</div>

            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid #e5e7eb' }}>
                {['Received','Paid'].map(t => (
                  <button key={t} onClick={() => setForm({...form,type:t})} style={{ flex:1, padding:'9px', border:'none', background: form.type===t ? '#111' : '#fff', color: form.type===t ? '#fff' : '#374151', cursor:'pointer', fontWeight:500, fontSize:13 }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Select Account</label>
                <select className="form-select" value={form.account_id} onChange={e => setForm({...form,account_id:e.target.value})}>
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input className="form-input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={3} placeholder="e.g. Payment from Sharma Electricals" value={form.description} onChange={e => setForm({...form,description:e.target.value})} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={addTransaction}>✓ Add Transaction</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

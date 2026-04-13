import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const navigate = useNavigate();

  // Load branches on mount
  useEffect(() => {
    window.electron.invoke('branches:getAll').then(data => {
      setBranches(data || []);
    }).catch(err => console.error('Error loading branches:', err));
  }, []);

  // Load stats whenever selectedBranch changes
  useEffect(() => {
    window.electron.invoke('dashboard:getStats', { branch_id: selectedBranch || undefined }).then(setStats);
  }, [selectedBranch]);

  if (!stats) return <div style={{ padding: 40, color: '#6b7280' }}>Loading...</div>;

  const chartData = MONTHS.map((m, i) => {
    const row = stats.monthlySales.find(r => parseInt(r.month) === i + 1);
    return { month: m, total: row ? row.total : 0 };
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome Back, {JSON.parse(localStorage.getItem('currentUser') || '{}').name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Branch:</span>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
            <option value=''>All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Left column */}
        <div>
          {/* Stat cards row 1 */}
          <div className="stat-cards">
            <div className="stat-card blue">
              <div className="stat-card-label">Total Sale</div>
              <div className="stat-card-value">${stats.totalSale.toLocaleString()}</div>
              <div className="stat-card-trend up">+21%</div>
              <div className="stat-card-icon">💵</div>
            </div>
            <div className="stat-card pink">
              <div className="stat-card-label">Total Profit</div>
              <div className="stat-card-value">${Math.round(stats.totalProfit).toLocaleString()}</div>
              <div className="stat-card-trend up">+17%</div>
              <div className="stat-card-icon">📈</div>
            </div>
            <div className="stat-card green">
              <div className="stat-card-label">Pending Payment</div>
              <div className="stat-card-value">${Math.round(stats.pendingPayment).toLocaleString()}</div>
              <div className="stat-card-trend up">+17%</div>
              <div className="stat-card-icon">⏳</div>
            </div>
          </div>

          {/* Stat cards row 2 */}
          <div className="stat-cards" style={{ marginBottom: 20 }}>
            <div className="stat-card yellow">
              <div className="stat-card-label">Cash Balance</div>
              <div className="stat-card-value">${stats.cashBalance.toLocaleString()}</div>
              <div className="stat-card-trend up">+21%</div>
              <div className="stat-card-icon">🏧</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-card-label">Bank Balance</div>
              <div className="stat-card-value">${stats.bankBalance.toLocaleString()}</div>
              <div className="stat-card-trend up">+21%</div>
              <div className="stat-card-icon">🏦</div>
            </div>
            <div className="stat-card pink">
              <div className="stat-card-label">Low Stock Items</div>
              <div className="stat-card-value">{stats.lowStock}</div>
              <div className="stat-card-trend up">+21%</div>
              <div className="stat-card-icon">⚠️</div>
            </div>
          </div>

          {/* Monthly Sales Trend */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Monthly Sales Trend</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Sales And Profit Overview</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/reports')}>VIEW ALL</button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => `$${v.toLocaleString()}`} />
                <Bar dataKey="total" fill="#111" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Invoices */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Recent Invoices</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Latest Sales Transactions</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/billing')}>VIEW ALL</button>
            </div>
            <table className="data-table">
              <thead><tr>
                <th>INVOICE ID</th><th>CUSTOMER</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th>PAYMENT</th>
              </tr></thead>
              <tbody>
                {stats.recentInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.invoice_no}</td>
                    <td>{inv.customer_name}</td>
                    <td>{inv.invoice_date}</td>
                    <td className="amount-positive">+${inv.grand_total?.toLocaleString()}</td>
                    <td><span className={`badge ${inv.status === 'Paid' ? 'badge-green' : inv.status === 'Draft' ? 'badge-grey' : 'badge-orange'}`}>{inv.status}</span></td>
                    <td>{inv.payment_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Actions */}
          <div style={{ background: '#111', borderRadius: 12, padding: 20, color: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Quick Actions</div>
            {[
              { icon: '🧾', title: 'New Sale', sub: 'Create Invoice', path: '/billing' },
              { icon: '🛒', title: 'New Purchase', sub: 'Add Bill', path: '/vendors' },
              { icon: '📦', title: 'Add Item', sub: 'Manage Stock', path: '/inventory' },
            ].map(a => (
              <div key={a.path} onClick={() => navigate(a.path)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#222', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.sub}</div>
                  </div>
                </div>
                <span style={{ color: '#9ca3af' }}>→</span>
              </div>
            ))}
          </div>

          {/* Top Selling Items */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Top Selling Items</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Best Performing Items</div>
            {stats.topItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ background: '#111', color: '#fff', borderRadius: 4, padding: '2px 5px', fontWeight: 700 }}>#{i + 1}</span>
                  <span>{item.product_name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>${item.revenue?.toLocaleString()}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{item.units_sold} Units Sold</div>
                </div>
              </div>
            ))}
          </div>

          {/* Branch Revenue */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #f1f5f9', marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Branch Revenue</div>
            {(stats.branchRevenue || []).length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>No branch data</div>
            )}
            {(stats.branchRevenue || []).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>₹{(b.revenue || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

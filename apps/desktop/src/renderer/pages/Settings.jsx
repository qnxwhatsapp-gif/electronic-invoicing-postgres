/**
 * SETTINGS PAGE
 * Claude Code: Build per SKILL.md Section 22 (Screens 29-34)
 * Sub-tabs: Company Profile | Account Management | User Management | Branch Management | Backup & Security
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MODULES = ['dashboard','billing','inventory','vendors','banking','expenses','reports','settings'];
const ACTIONS = ['view','create','edit','delete'];
const ROLES = ['Owner','Accountant','Billing Operator','Inventory Manager'];

const MODULE_META = {
  dashboard:  { label: 'Dashboard',            icon: '⊞', desc: 'Overview, stats & charts' },
  billing:    { label: 'Billing & Invoice',     icon: '🧾', desc: 'Create & manage invoices' },
  inventory:  { label: 'Inventory & Services',  icon: '📦', desc: 'Products, stock & categories' },
  vendors:    { label: 'Vendors & Purchases',   icon: '🚚', desc: 'Vendors, POs & bills' },
  banking:    { label: 'Banking',               icon: '🏦', desc: 'Accounts & transactions' },
  expenses:   { label: 'Expenses',              icon: '💵', desc: 'Expense tracking' },
  reports:    { label: 'Reports',               icon: '📊', desc: 'Analytics & exports' },
  settings:   { label: 'Settings',              icon: '⚙️', desc: 'Company & user settings' },
};
const ACCOUNT_TYPES = ['Cash','Bank','Capital','Sales','Purchase','Expense'];
const TABS = ['Company Profile','Account Management','User Management','Branch Management','Backup & Security','Invoice Designer'];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Company Profile');
  const { currentUser } = useAuth();

  const getTabIcon = (tab) => {
    switch(tab) {
      case 'Company Profile': return '🏢';
      case 'Account Management': return '📒';
      case 'User Management': return '👥';
      case 'Branch Management': return '🏪';
      case 'Backup & Security': return '🔒';
      case 'Invoice Designer': return '🎨';
      default: return '⚙️';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Manage Your Business Settings And Preferences</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:20 }}>
        {/* Left sub-nav */}
        <div className="card" style={{ padding:0, overflow:'hidden', alignSelf:'start' }}>
          {TABS.map(tab => (
            <div key={tab} onClick={() => setActiveTab(tab)} style={{ padding:'14px 18px', cursor:'pointer', fontSize:13, fontWeight: activeTab===tab ? 600 : 400, background: activeTab===tab ? '#f9fafb' : '#fff', borderLeft: activeTab===tab ? '3px solid #111' : '3px solid transparent', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:10 }}>
              <span>{getTabIcon(tab)}</span>
              {tab}
            </div>
          ))}
        </div>

        {/* Right content */}
        <div>
          {activeTab === 'Company Profile' && <CompanyProfile />}
          {activeTab === 'Account Management' && <AccountManagement />}
          {activeTab === 'User Management' && <UserManagement />}
          {activeTab === 'Branch Management' && <BranchManagement />}
          {activeTab === 'Backup & Security' && <BackupSecurity />}
          {activeTab === 'Invoice Designer' && <InvoiceDesigner />}
        </div>
      </div>
    </div>
  );
}

// ── COMPANY PROFILE ──────────────────────────────────────────────────────────
function CompanyProfile() {
  const [form, setForm] = useState({ company_name:'', mobile:'', email:'', address:'', logo_path:'' });
  useEffect(() => { window.electron.invoke('settings:getCompany').then(d => d && setForm(d)); }, []);

  async function save() {
    await window.electron.invoke('settings:saveCompany', form);
    toast.success('Company profile saved!');
  }

  async function uploadLogo() {
    const filePath = await window.electron.invoke('settings:chooseLogoFile');
    if (!filePath) return;
    const r = await window.electron.invoke('settings:uploadLogo', { filePath });
    if (r.success) {
      toast.success('Logo uploaded!');
      setForm(p => ({...p, logo_path: r.logo_path}));
    } else {
      toast.error(r.error || 'Failed to upload logo');
    }
  }

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Company Profile</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:24 }}>Manage your company information</div>

      {/* Logo */}
      <div style={{ display:'flex', gap:20, alignItems:'center', padding:20, border:'1px solid #e5e7eb', borderRadius:10, marginBottom:24 }}>
        <div style={{ width:80, height:80, border:'2px dashed #d1d5db', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#9ca3af' }}>
          {form.logo_path ? '📎' : 'NO LOGO'}
        </div>
        <div>
          <div style={{ fontWeight:600, marginBottom:4 }}>Company Logo</div>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:10 }}>Recommended size: 512×512px (PNG, SVG, or JPG)</div>
          {form.logo_path && <div style={{ fontSize:11, color:'#4b5563', marginBottom:8 }}>{form.logo_path}</div>}
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-black btn-sm" onClick={uploadLogo}>↑ Upload New Logo</button>
            {form.logo_path && <button className="btn btn-outline btn-sm" onClick={() => setForm(p => ({...p, logo_path:''}))}>Remove</button>}
          </div>
        </div>
      </div>

      <div style={{ fontWeight:600, fontSize:15, marginBottom:16 }}>General Information</div>
      <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} /></div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Mobile Number</label><input className="form-input" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
      </div>
      <div className="form-group"><label className="form-label">Address</label><textarea className="form-input" rows={3} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} /></div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
        <button className="btn btn-outline">Cancel</button>
        <button className="btn btn-black" onClick={save}>💾 Save</button>
      </div>

      <CurrencyLanguage />
    </div>
  );
}

// ── ACCOUNT MANAGEMENT ───────────────────────────────────────────────────────
function AccountManagement() {
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ account_name:'', account_type:'', opening_balance:'', as_of_date: new Date().toISOString().split('T')[0] });

  useEffect(() => { window.electron.invoke('accounts:getAll').then(setAccounts); }, []);

  const totalAssets = accounts.filter(a=>['Cash','Bank'].includes(a.account_type)).reduce((s,a)=>s+a.current_balance,0);
  const totalLiab = accounts.filter(a=>a.account_type==='Expense').reduce((s,a)=>s+a.opening_balance,0);

  const typeBadge = t => ({ Cash:'badge-blue', Bank:'badge-blue', Capital:'badge-green', Sales:'badge-green', Purchase:'badge-orange', Expense:'badge-red' }[t] || 'badge-grey');
  const typeAvatar = t => ({ Cash:'#3b82f6', Bank:'#3b82f6', Capital:'#22c55e', Sales:'#14b8a6', Purchase:'#f97316', Expense:'#ef4444' }[t] || '#9ca3af');

  async function saveAccount() {
    await window.electron.invoke('accounts:create', { ...form, opening_balance: parseFloat(form.opening_balance) || 0 });
    toast.success('Account created!');
    setShowModal(false);
    window.electron.invoke('accounts:getAll').then(setAccounts);
  }

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Account Management</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Manage your chart of accounts</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        <div style={{ padding:16, background:'#f0fdf4', borderRadius:10 }}>
          <div style={{ fontSize:12, color:'#6b7280' }}>Total Assets</div>
          <div style={{ fontSize:22, fontWeight:700 }}>${totalAssets.toLocaleString()}</div>
        </div>
        <div style={{ padding:16, background:'#fef2f2', borderRadius:10 }}>
          <div style={{ fontSize:12, color:'#6b7280' }}>Total Liabilities</div>
          <div style={{ fontSize:22, fontWeight:700 }}>${totalLiab.toLocaleString()}</div>
        </div>
        <div style={{ padding:16, background:'#eff6ff', borderRadius:10 }}>
          <div style={{ fontSize:12, color:'#6b7280' }}>Net Equity</div>
          <div style={{ fontSize:22, fontWeight:700 }}>${(totalAssets - totalLiab).toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <button className="btn btn-black" onClick={() => setShowModal(true)}>+ Add New Account</button>
      </div>

      <table className="data-table">
        <thead><tr><th>Account Name</th><th>Account Type</th><th>Opening Balance</th><th>Created Date</th><th>Action</th></tr></thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <td style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background: typeAvatar(a.account_type), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12 }}>{a.account_name[0]}</div>
                {a.account_name}
              </td>
              <td><span className={`badge ${typeBadge(a.account_type)}`}>{a.account_type}</span></td>
              <td>${a.opening_balance?.toLocaleString()}</td>
              <td>{a.created_at?.split('T')[0]}</td>
              <td>✏️</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ background:'#eff6ff', borderRadius:8, padding:12, marginTop:16, fontSize:12, color:'#374151', display:'flex', gap:8 }}>
        <span>ℹ️</span> Deleting an account is only possible if it has no transaction history.
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="modal-title">Add New Account</div>
            <div className="form-group"><label className="form-label">Account Name</label><input className="form-input" placeholder="e.g. HDFC Current Account" value={form.account_name} onChange={e=>setForm({...form,account_name:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Account Type</label><select className="form-select" value={form.account_type} onChange={e=>setForm({...form,account_type:e.target.value})}><option value="">Select an account type</option>{ACCOUNT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Opening Balance</label><input className="form-input" type="number" placeholder="0.00" value={form.opening_balance} onChange={e=>setForm({...form,opening_balance:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">As of Date</label><input type="date" className="form-input" value={form.as_of_date} onChange={e=>setForm({...form,as_of_date:e.target.value})} /></div>
            </div>
            <div style={{ background:'#eff6ff', borderRadius:8, padding:10, fontSize:12, color:'#374151', marginBottom:16 }}>ℹ️ This opening balance will be recorded as the initial entry for this ledger account.</div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={saveAccount}>Save Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── USER MANAGEMENT ──────────────────────────────────────────────────────────
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPerms, setShowPerms] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'', mobile:'', email:'', password:'', role:'', branch_id:'' });
  const [permsMap, setPermsMap] = useState({});
  const { currentUser } = useAuth();

  function loadAll() {
    window.electron.invoke('users:getAll').then(setUsers).catch(() => {});
    window.electron.invoke('branches:getAll').then(setBranches).catch(() => {});
    window.electron.invoke('roles:getAll').then(r => setAllRoles(r.map(x => x.name))).catch(() => {});
  }

  useEffect(() => { loadAll(); }, []);

  async function saveUser() {
    if (!form.name || !form.role) { toast.error('Name and role are required'); return; }
    if (!editing && !form.password) { toast.error('Password is required for new users'); return; }
    if (editing) {
      await window.electron.invoke('users:update', { id: editing.id, ...form });
      toast.success('User updated!');
    } else {
      await window.electron.invoke('users:create', form);
      toast.success('User created!');
    }
    setShowModal(false);
    window.electron.invoke('users:getAll').then(setUsers);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name:'', mobile:'', email:'', password:'', role:'', branch_id:'' });
    setShowModal(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({ name: user.name, mobile: user.mobile, email: user.email, password:'', role: user.role, branch_id: user.branch_id || '' });
    setShowModal(true);
  }

  async function toggleActive(user) {
    await window.electron.invoke('users:toggleActive', { id: user.id, is_active: user.is_active ? 0 : 1 });
    window.electron.invoke('users:getAll').then(setUsers);
  }

  async function openPerms(user) {
    const perms = await window.electron.invoke('permissions:getForUser', { userId: user.id, role: user.role });
    setPermsMap(perms || {});
    setShowPerms(user);
  }

  async function savePerms(branchId) {
    await window.electron.invoke('permissions:saveForUser', { userId: showPerms.id, permissions: permsMap });
    if (branchId !== undefined) {
      await window.electron.invoke('users:update', { id: showPerms.id, name: showPerms.name, mobile: showPerms.mobile || '', email: showPerms.email || '', role: showPerms.role, branch_id: branchId || null });
    }
    toast.success('Permissions saved!');
    setShowPerms(null);
    loadAll();
  }

  function togglePerm(mod, act) {
    setPermsMap(prev => ({ ...prev, [mod]: { ...(prev[mod]||{}), [act]: !(prev[mod]?.[act]) } }));
  }

  const roleBadge = r => r==='Owner'?'badge-blue':r==='Accountant'?'badge-grey':'badge-grey';

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>User Management</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Manage your workspace members</div>

      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <input className="form-input" style={{ width:280 }} placeholder="Search users by name, email, or role..." />
        {currentUser?.role === 'Owner' && <button className="btn btn-black" onClick={openAdd}>+ Add New User</button>}
      </div>

      <table className="data-table">
        <thead><tr><th>User Name</th><th>Mobile Number</th><th>Role</th><th>Branch</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'#111', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{u.name[0]}</div>
                  <div><div style={{ fontWeight:600 }}>{u.name}</div><div style={{ fontSize:11, color:'#9ca3af' }}>{u.email}</div></div>
                </div>
              </td>
              <td>{u.mobile}</td>
              <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
              <td>{branches.find(b => b.id === u.branch_id)?.name || '—'}</td>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div onClick={() => toggleActive(u)} style={{ width:36, height:20, borderRadius:10, background: u.is_active?'#111':'#d1d5db', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
                    <div style={{ width:16, height:16, background:'#fff', borderRadius:'50%', position:'absolute', top:2, left: u.is_active?18:2, transition:'left 0.2s' }} />
                  </div>
                  <span style={{ fontSize:12, color:'#6b7280' }}>{u.is_active?'Active':'Inactive'}</span>
                </div>
              </td>
              <td style={{ display:'flex', gap:8 }}>
                {currentUser?.role === 'Owner' && <button className="btn btn-outline btn-sm" onClick={() => openPerms(u)} title="Edit Permissions">🔑</button>}
                <button className="btn btn-outline btn-sm" title="Edit" onClick={() => openEdit(u)}>✏️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="modal-title">{editing ? 'Edit User' : 'Add New User'}</div>
            <div className="modal-subtitle">{editing ? 'Update user information' : 'Invite a new member to your workspace.'}</div>
            <div className="form-group"><label className="form-label">User Name *</label><input className="form-input" placeholder="e.g. John Doe" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Mobile Number</label><input className="form-input" placeholder="(555) 000-0000" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="user@email.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            {!editing && <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-input" placeholder="Min 8 characters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>}
            <div className="form-group"><label className="form-label">User Role *</label><select className="form-select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="">Select user role</option>{allRoles.map(r=><option key={r}>{r}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Branch</label><select className="form-select" value={form.branch_id} onChange={e=>setForm({...form,branch_id:e.target.value})}><option value="">No Branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={saveUser}>{editing ? 'Update' : 'Save'} User</button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPerms && <PermissionsModal user={showPerms} permsMap={permsMap} onToggle={togglePerm} onSave={(branchId) => savePerms(branchId)} onReset={async () => { await window.electron.invoke('permissions:saveForUser',{userId:showPerms.id,permissions:{}}); setShowPerms(null); toast.success('Reset to role defaults'); }} onClose={() => setShowPerms(null)} />}

      {/* User Types Manager */}
      <UserTypesManager onRolesChanged={loadAll} />
    </div>
  );
}

// ── USER TYPES MANAGER ───────────────────────────────────────────────────────
function UserTypesManager({ onRolesChanged }) {
  const [roles, setRoles] = useState([]);
  const [newRole, setNewRole] = useState('');
  const [adding, setAdding] = useState(false);
  const { currentUser } = useAuth();

  function load() {
    window.electron.invoke('roles:getAll').then(setRoles).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function addRole() {
    if (!newRole.trim()) return;
    const r = await window.electron.invoke('roles:create', { name: newRole.trim() });
    if (r.success) {
      toast.success(`User type "${newRole.trim()}" added`);
      setNewRole('');
      setAdding(false);
      load();
      onRolesChanged();
    } else {
      toast.error(r.error || 'Failed to add user type');
    }
  }

  async function deleteRole(role) {
    if (!window.confirm(`Delete user type "${role.name}"?`)) return;
    const r = await window.electron.invoke('roles:delete', { id: role.id });
    if (r.success) {
      toast.success('User type deleted');
      load();
      onRolesChanged();
    } else {
      toast.error(r.error || 'Cannot delete');
    }
  }

  if (currentUser?.role !== 'Owner') return null;

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>User Types</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Manage roles available when creating users</div>
        </div>
        {!adding && (
          <button className="btn btn-black btn-sm" onClick={() => setAdding(true)}>+ Add User Type</button>
        )}
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 8, margin: '14px 0', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ flex: 1, maxWidth: 280 }}
            placeholder="e.g. Sales Manager"
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addRole(); if (e.key === 'Escape') { setAdding(false); setNewRole(''); } }}
            autoFocus
          />
          <button className="btn btn-black btn-sm" onClick={addRole}>Save</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setAdding(false); setNewRole(''); }}>Cancel</button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {roles.map(role => (
          <div
            key={role.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 20,
              background: role.is_system ? '#f1f5f9' : '#eff6ff',
              border: role.is_system ? '1px solid #e2e8f0' : '1px solid #bfdbfe',
              fontSize: 13, fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 14 }}>
              {role.name === 'Owner' ? '👑' : role.name === 'Accountant' ? '📒' : role.name === 'Billing Operator' ? '🧾' : role.name === 'Inventory Manager' ? '📦' : '👤'}
            </span>
            <span>{role.name}</span>
            {role.is_system ? (
              <span style={{ fontSize: 10, color: '#94a3b8', background: '#e2e8f0', borderRadius: 4, padding: '1px 5px' }}>SYSTEM</span>
            ) : (
              <button
                onClick={() => deleteRole(role)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}
                title="Delete"
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PERMISSIONS MODAL ────────────────────────────────────────────────────────
function PermissionsModal({ user, permsMap, onToggle, onSave, onReset, onClose }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.branch_id || '');

  useEffect(() => {
    window.electron.invoke('branches:getAll').then(setBranches).catch(() => {});
  }, []);

  // Tab is visible if `view` permission is true
  const canView = (mod) => !!permsMap?.[mod]?.view;

  // Toggle the `view` permission (controls tab visibility in sidebar)
  function toggleTabAccess(mod) {
    onToggle(mod, 'view');
    // If disabling view, also remove create/edit/delete
    if (canView(mod)) {
      ['create','edit','delete'].forEach(act => {
        if (permsMap?.[mod]?.[act]) onToggle(mod, act);
      });
    }
  }

  const visibleCount = MODULES.filter(m => canView(m)).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'#fff', borderRadius:16, width:620, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div style={{ padding:'24px 28px 20px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'#111', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16 }}>{user.name[0]}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>{user.name}</div>
                <div style={{ fontSize:12, color:'#64748b' }}>Role: <strong>{user.role}</strong> · {visibleCount} of {MODULES.length} tabs visible</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY:'auto', padding:'24px 28px', flex:1 }}>

          {/* Branch Assignment */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Branch Assignment</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:10 }}>Assign this user to a specific branch location.</div>
            <select
              className="form-select"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              style={{ maxWidth:320 }}
            >
              <option value="">No specific branch (All access)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Tab Access Section */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Tab Visibility</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>Control which sidebar tabs this user can see and access.</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {MODULES.map(mod => {
                const meta = MODULE_META[mod];
                const active = canView(mod);
                return (
                  <div
                    key={mod}
                    onClick={() => toggleTabAccess(mod)}
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'14px 16px', borderRadius:12, cursor:'pointer',
                      border: active ? '1.5px solid #111' : '1.5px solid #e2e8f0',
                      background: active ? '#f8fafc' : '#fff',
                      transition:'all 0.15s',
                    }}
                  >
                    {/* Module icon */}
                    <div style={{ width:36, height:36, borderRadius:10, background: active ? '#111' : '#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>
                      {meta.icon}
                    </div>
                    {/* Label */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color: active ? '#111' : '#64748b' }}>{meta.label}</div>
                      <div style={{ fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{meta.desc}</div>
                    </div>
                    {/* Toggle */}
                    <div style={{ width:36, height:20, borderRadius:10, background: active ? '#111' : '#d1d5db', flexShrink:0, position:'relative', transition:'background 0.2s' }}>
                      <div style={{ width:16, height:16, background:'#fff', borderRadius:'50%', position:'absolute', top:2, left: active ? 18 : 2, transition:'left 0.2s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced permissions */}
          <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:16 }}>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontWeight:600, fontSize:13, color:'#374151', padding:0, marginBottom: showAdvanced ? 16 : 0 }}
            >
              <span style={{ fontSize:11, color:'#94a3b8' }}>{showAdvanced ? '▼' : '▶'}</span>
              Advanced Permissions (Create / Edit / Delete)
            </button>

            {showAdvanced && (
              <table className="data-table" style={{ marginTop:4 }}>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th style={{ textAlign:'center' }}>View</th>
                    <th style={{ textAlign:'center' }}>Create</th>
                    <th style={{ textAlign:'center' }}>Edit</th>
                    <th style={{ textAlign:'center' }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod} style={{ opacity: canView(mod) ? 1 : 0.45 }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span>{MODULE_META[mod].icon}</span>
                          <span style={{ fontWeight:500, fontSize:13 }}>{MODULE_META[mod].label}</span>
                        </div>
                      </td>
                      {ACTIONS.map(act => (
                        <td key={act} style={{ textAlign:'center' }}>
                          <input
                            type="checkbox"
                            checked={!!permsMap?.[mod]?.[act]}
                            disabled={act !== 'view' && !canView(mod)}
                            onChange={() => onToggle(mod, act)}
                            style={{ cursor: act !== 'view' && !canView(mod) ? 'not-allowed' : 'pointer', width:15, height:15 }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button className="btn btn-outline btn-sm" onClick={onReset}>↺ Reset to Role Defaults</button>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-black" onClick={() => onSave(selectedBranch)}>Save Permissions</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CLEAR DATA MODAL ──────────────────────────────────────────────────────────
const CLEARABLE_MODULES = [
  { key: 'billing',       label: 'Billing & Invoices',     icon: '🧾', desc: 'Invoices, returns & exchanges', color: '#3b82f6' },
  { key: 'inventory',     label: 'Inventory & Services',   icon: '📦', desc: 'Products & categories',         color: '#f97316' },
  { key: 'vendors',       label: 'Vendors & Purchases',    icon: '🚚', desc: 'Vendors, purchase orders, bills', color: '#8b5cf6' },
  { key: 'banking',       label: 'Banking',                icon: '🏦', desc: 'All banking transactions',      color: '#0ea5e9' },
  { key: 'expenses',      label: 'Expenses',               icon: '💵', desc: 'All expense records',           color: '#ef4444' },
  { key: 'notifications', label: 'Notifications',          icon: '🔔', desc: 'All notification history',      color: '#64748b' },
];

function ClearDataModal({ onClose, onCleared }) {
  const [selected, setSelected] = useState({});
  const [counts, setCounts] = useState({});
  const [step, setStep] = useState('select'); // 'select' | 'confirm'
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    window.electron.invoke('settings:getTableCounts', {}).then(setCounts).catch(() => {});
  }, []);

  function toggle(key) {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const chosen = CLEARABLE_MODULES.filter(m => selected[m.key]);

  async function confirmClear() {
    if (chosen.length === 0) return;
    setClearing(true);
    const r = await window.electron.invoke('settings:clearData', { modules: chosen.map(m => m.key) });
    setClearing(false);
    if (r.success) {
      toast.success(`Cleared: ${chosen.map(m => m.label).join(', ')}`);
      onCleared();
      onClose();
    } else {
      toast.error('Some tables could not be cleared: ' + r.errors.join(', '));
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width:560, maxHeight:'88vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding:'24px 28px 18px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:42, height:42, borderRadius:12, background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🗑️</div>
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>Clear Data</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Permanently delete records from selected modules</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>✕</button>
          </div>
        </div>

        {step === 'select' && (
          <>
            <div style={{ overflowY:'auto', padding:'20px 28px', flex:1 }}>
              <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>
                Select which module data you want to permanently remove. This action cannot be undone.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {CLEARABLE_MODULES.map(mod => {
                  const active = !!selected[mod.key];
                  const count = counts[mod.key] ?? '...';
                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggle(mod.key)}
                      style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:12, cursor:'pointer', border: active ? `1.5px solid ${mod.color}` : '1.5px solid #e2e8f0', background: active ? `${mod.color}08` : '#fff', transition:'all 0.15s' }}
                    >
                      {/* Icon */}
                      <div style={{ width:40, height:40, borderRadius:10, background: active ? `${mod.color}18` : '#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                        {mod.icon}
                      </div>
                      {/* Info */}
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13, color: active ? '#111' : '#374151' }}>{mod.label}</div>
                        <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{mod.desc}</div>
                      </div>
                      {/* Record count badge */}
                      <div style={{ fontSize:12, fontWeight:600, color: count > 0 ? mod.color : '#94a3b8', background: count > 0 ? `${mod.color}12` : '#f1f5f9', borderRadius:8, padding:'3px 10px', flexShrink:0 }}>
                        {count} records
                      </div>
                      {/* Checkbox */}
                      <div style={{ width:20, height:20, borderRadius:5, border: active ? `2px solid ${mod.color}` : '2px solid #d1d5db', background: active ? mod.color : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, color:'#fff', fontWeight:700, transition:'all 0.15s' }}>
                        {active && '✓'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding:'16px 28px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'#94a3b8' }}>{chosen.length} module{chosen.length !== 1 ? 's' : ''} selected</span>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button
                  disabled={chosen.length === 0}
                  onClick={() => setStep('confirm')}
                  style={{ padding:'8px 20px', borderRadius:8, fontWeight:600, fontSize:13, cursor: chosen.length === 0 ? 'not-allowed' : 'pointer', background: chosen.length > 0 ? '#ef4444' : '#f1f5f9', color: chosen.length > 0 ? '#fff' : '#94a3b8', border:'none', transition:'all 0.15s' }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div style={{ padding:'24px 28px', flex:1, overflowY:'auto' }}>
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:16, marginBottom:20 }}>
                <div style={{ fontWeight:700, color:'#dc2626', marginBottom:6, fontSize:14 }}>⚠️ This action is irreversible</div>
                <div style={{ fontSize:13, color:'#7f1d1d' }}>
                  All records in the selected modules will be <strong>permanently deleted</strong> and cannot be recovered unless you have a backup.
                </div>
              </div>

              <div style={{ fontWeight:600, fontSize:13, marginBottom:12 }}>You are about to clear:</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {chosen.map(mod => (
                  <div key={mod.key} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca' }}>
                    <span style={{ fontSize:18 }}>{mod.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{mod.label}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{counts[mod.key] ?? 0} records will be deleted</div>
                    </div>
                    <span style={{ fontSize:12, color:'#ef4444', fontWeight:600 }}>DELETE</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'16px 28px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <button className="btn btn-outline" onClick={() => setStep('select')}>← Back</button>
              <button
                disabled={clearing}
                onClick={confirmClear}
                style={{ padding:'8px 24px', borderRadius:8, fontWeight:700, fontSize:13, cursor: clearing ? 'not-allowed' : 'pointer', background:'#ef4444', color:'#fff', border:'none' }}
              >
                {clearing ? 'Clearing...' : '🗑️ Yes, Clear Selected Data'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── BACKUP & SECURITY ─────────────────────────────────────────────────────────
function BackupSecurity() {
  const [logs, setLogs] = useState([]);
  const [showClear, setShowClear] = useState(false);

  function load() {
    window.electron.invoke('backup:getLogs').then(setLogs);
  }

  useEffect(() => { load(); }, []);

  async function backupNow() {
    await window.electron.invoke('backup:now');
    toast.success('Backup completed!');
    load();
  }

  async function restoreBackup() {
    const filePath = await window.electron.invoke('settings:chooseRestoreFile');
    if (!filePath) return;
    if (!window.confirm('This will replace the current database. Are you sure?')) return;
    const r = await window.electron.invoke('settings:restoreBackup', { filePath });
    if (r.success) {
      toast.success('Database restored! Please restart the app.');
      load();
    } else {
      toast.error('Restore failed');
    }
  }

  return (
    <div className="card">
      <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Backup & Restore</div>
      <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Manage your database security and recovery points</div>

      <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:16, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:24 }}>🛡️</span>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>CURRENT STATUS</span>
              <span className="badge badge-green">SYSTEM HEALTHY</span>
            </div>
            <div style={{ fontWeight:600, fontSize:13, marginTop:2 }}>Last Successful Backup: {logs[0]?.date_time?.split('T')[0] || 'Never'}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>Next scheduled backup: Today, 00:00 UTC</div>
          </div>
        </div>
        <button className="btn btn-outline btn-sm">View Details</button>
      </div>

      <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:16, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:600 }}>Auto Backup</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Automatically back up your data daily at midnight (00:00 UTC)</div>
        </div>
        <div style={{ width:44, height:24, borderRadius:12, background:'#111', cursor:'pointer', position:'relative' }}>
          <div style={{ width:20, height:20, background:'#fff', borderRadius:'50%', position:'absolute', top:2, right:2 }} />
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:24 }}>
        <button className="btn btn-black" onClick={backupNow}>☁ Backup Now</button>
        <button className="btn btn-outline" onClick={restoreBackup}>↺ Restore Data</button>
        <button
          onClick={() => setShowClear(true)}
          style={{ padding:'8px 16px', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', background:'#fef2f2', color:'#ef4444', border:'1.5px solid #fecaca' }}
        >
          🗑️ Clear Data
        </button>
      </div>

      <div style={{ fontWeight:700, marginBottom:12 }}>Recent Activity</div>
      <table className="data-table">
        <thead><tr><th>Activity</th><th>Date & Time</th><th>Size</th><th>Status</th></tr></thead>
        <tbody>
          {logs.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'#9ca3af', padding:20 }}>No backups yet</td></tr>}
          {logs.map((l,i) => (
            <tr key={i}>
              <td style={{ display:'flex', alignItems:'center', gap:8 }}><span>{l.type?.includes('Manual')?'👤':l.type?.includes('Cleared')?'🗑️':'⏱'}</span>{l.type}</td>
              <td>{l.date_time?.replace('T',' ').split('.')[0]}</td>
              <td>{l.size_mb ? `${l.size_mb} MB` : '--'}</td>
              <td><span className={`badge ${l.status==='Success'?'badge-green':'badge-red'}`}>● {l.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      {showClear && <ClearDataModal onClose={() => setShowClear(false)} onCleared={load} />}
    </div>
  );
}

// ── CURRENCY & LANGUAGE ──────────────────────────────────────────────────────
function CurrencyLanguage() {
  const [settings, setSettings] = useState({ currency:'INR', currency_symbol:'₹', language:'en', date_format:'DD/MM/YYYY' });
  useEffect(() => { window.electron.invoke('settings:getAll').then(s => { if(s) setSettings(prev => ({...prev, ...s})); }).catch(() => {}); }, []);

  async function save() {
    await window.electron.invoke('settings:saveAll', settings);
    toast.success('Settings saved!');
  }

  return (
    <div style={{ marginTop:32, borderTop:'1px solid #e5e7eb', paddingTop:24 }}>
      <div style={{ fontWeight:600, fontSize:16, marginBottom:16 }}>Currency & Language</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:600 }}>
        <div>
          <label className="form-label">Currency</label>
          <select className="form-select" value={settings.currency} onChange={e => {
            const symbolMap = { INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'د.إ', ZAR:'R', XOF:'FCFA', XAF:'FCFA' };
            setSettings(p => ({...p, currency:e.target.value, currency_symbol: symbolMap[e.target.value] || p.currency_symbol }));
          }}>
            <option value="INR">INR — Indian Rupee (₹)</option>
            <option value="USD">USD — US Dollar ($)</option>
            <option value="EUR">EUR — Euro (€)</option>
            <option value="GBP">GBP — British Pound (£)</option>
            <option value="AED">AED — UAE Dirham (د.إ)</option>
            <option value="ZAR">ZAR — South African Rand (R)</option>
            <option value="XOF">XOF — West African CFA Franc (FCFA)</option>
            <option value="XAF">XAF — Central African CFA Franc (FCFA)</option>
          </select>
        </div>
        <div>
          <label className="form-label">Currency Symbol</label>
          <input className="form-input" value={settings.currency_symbol} onChange={e => setSettings(p => ({...p, currency_symbol:e.target.value}))} placeholder="₹" />
        </div>
        <div>
          <label className="form-label">Language</label>
          <select className="form-select" value={settings.language} onChange={e => setSettings(p => ({...p, language:e.target.value}))}>
            <optgroup label="English">
              <option value="en">English</option>
              <option value="en-ZA">English (South Africa)</option>
            </optgroup>
            <optgroup label="French">
              <option value="fr">Français (French)</option>
            </optgroup>
            <optgroup label="South African Languages">
              <option value="af">Afrikaans</option>
              <option value="zu">Zulu (isiZulu)</option>
              <option value="xh">Xhosa (isiXhosa)</option>
              <option value="st">Sotho (Sesotho)</option>
              <option value="tn">Tswana (Setswana)</option>
              <option value="ts">Tsonga (Xitsonga)</option>
              <option value="ve">Venda (Tshivenda)</option>
              <option value="nr">Ndebele (isiNdebele)</option>
              <option value="ss">Swati (siSwati)</option>
            </optgroup>
            <optgroup label="Indian Languages">
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label className="form-label">Date Format</label>
          <select className="form-select" value={settings.date_format} onChange={e => setSettings(p => ({...p, date_format:e.target.value}))}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
      </div>
      <button className="btn btn-black" style={{ marginTop:16 }} onClick={save}>Save Currency & Language</button>
    </div>
  );
}

// ── BRANCH MANAGEMENT ────────────────────────────────────────────────────────
function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', contact: '' });

  useEffect(() => { load(); }, []);

  function load() {
    window.electron.invoke('branches:getAll').then(setBranches).catch(() => {});
  }

  function openAdd() {
    setEditing(null);
    setForm({ name:'', code:'', address:'', contact:'' });
    setShowModal(true);
  }

  function openEdit(b) {
    setEditing(b);
    setForm({ name:b.name, code:b.code||'', address:b.address||'', contact:b.contact||'' });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Branch name required');
      return;
    }
    if (editing) {
      await window.electron.invoke('branches:update', { id: editing.id, ...form });
    } else {
      await window.electron.invoke('branches:create', form);
    }
    toast.success(editing ? 'Branch updated' : 'Branch created');
    setShowModal(false);
    load();
  }

  async function deleteBranch(id) {
    if (!window.confirm('Delete this branch?')) return;
    const r = await window.electron.invoke('branches:delete', { id });
    if (r.success) {
      toast.success('Branch deleted');
      load();
    } else {
      toast.error(r.error || 'Cannot delete branch');
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:18 }}>Branch Management</div>
          <div style={{ fontSize:13, color:'#6b7280' }}>Manage store branches</div>
        </div>
        <button className="btn btn-black" onClick={openAdd}>+ Add Branch</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Branch Name</th><th>Code</th><th>Address</th><th>Contact</th><th>Actions</th></tr></thead>
        <tbody>
          {branches.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'#9ca3af', padding:20 }}>No branches yet</td></tr>}
          {branches.map(b => (
            <tr key={b.id}>
              <td style={{ fontWeight:600 }}>{b.name}</td>
              <td>{b.code || '—'}</td>
              <td>{b.address || '—'}</td>
              <td>{b.contact || '—'}</td>
              <td>
                <button className="btn btn-outline btn-sm" onClick={() => openEdit(b)} style={{ marginRight:8 }}>Edit</button>
                <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#ef4444', border:'none' }} onClick={() => deleteBranch(b.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:32, width:480, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>{editing ? 'Edit Branch' : 'Add Branch'}</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:24 }}>Branch details</div>
            <div style={{ display:'grid', gap:14 }}>
              <div>
                <label className="form-label">Branch Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} placeholder="e.g. Main Branch" />
              </div>
              <div>
                <label className="form-label">Branch Code</label>
                <input className="form-input" value={form.code} onChange={e => setForm(p => ({...p, code:e.target.value}))} placeholder="e.g. BR-001" />
              </div>
              <div>
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))} placeholder="Branch address" />
              </div>
              <div>
                <label className="form-label">Contact</label>
                <input className="form-input" value={form.contact} onChange={e => setForm(p => ({...p, contact:e.target.value}))} placeholder="Phone / email" />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:12, marginTop:24 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-black" onClick={save}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── INVOICE DESIGNER ─────────────────────────────────────────────────────────
const TEMPLATE_COLORS = [
  { label: 'Midnight Black', value: '#111111' },
  { label: 'Royal Blue',     value: '#1d4ed8' },
  { label: 'Forest Green',   value: '#15803d' },
  { label: 'Crimson Red',    value: '#b91c1c' },
  { label: 'Deep Purple',    value: '#7c3aed' },
  { label: 'Ocean Teal',     value: '#0f766e' },
  { label: 'Burnt Orange',   value: '#c2410c' },
  { label: 'Slate Gray',     value: '#475569' },
];

const TEMPLATE_STYLES = [
  { value: 'classic',  label: 'Classic',  desc: 'Clean header with logo left, details right' },
  { value: 'modern',   label: 'Modern',   desc: 'Bold color band with white text header' },
  { value: 'minimal',  label: 'Minimal',  desc: 'Borderless, typography-focused layout' },
];

const DEFAULT_SETTINGS = {
  inv_prefix: 'INV', inv_suffix: '', inv_start_number: 1001, inv_padding: 4,
  seller_name: '', seller_tagline: '', seller_address: '', seller_phone: '',
  seller_email: '', seller_website: '', seller_gstin: '', seller_pan: '', seller_logo_path: '',
  template_color: '#111111', template_style: 'classic',
  show_customer_phone: true, show_customer_email: false, show_customer_gstin: true,
  show_due_date: true, show_po_number: true, show_hsn: true,
  show_discount: true, show_tax_breakdown: true, show_bank_details: true,
  bank_name: '', bank_account_no: '', bank_ifsc: '', bank_branch: '',
  footer_notes: 'Thank you for your business!',
  terms_conditions: 'Payment due within 30 days.',
  custom_fields: [],
};

function InvoiceDesigner() {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [section, setSection] = useState('numbering');
  const [newField, setNewField] = useState({ label: '', value: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electron.invoke('invoiceSettings:get', {})
      .then(data => {
        if (data) {
          const parsed = {};
          Object.keys(DEFAULT_SETTINGS).forEach(k => {
            parsed[k] = data[k] !== undefined ? data[k] : DEFAULT_SETTINGS[k];
          });
          parsed.custom_fields = Array.isArray(data.custom_fields) ? data.custom_fields : [];
          setS(parsed);
        }
      })
      .catch(() => {});
  }, []);

  function set(key, val) { setS(prev => ({ ...prev, [key]: val })); }

  function previewNumber() {
    const num = String(s.inv_start_number || 1001).padStart(Number(s.inv_padding) || 4, '0');
    return `${s.inv_prefix || ''}${num}${s.inv_suffix || ''}`;
  }

  function addCustomField() {
    if (!newField.label.trim()) return;
    setS(prev => ({ ...prev, custom_fields: [...(prev.custom_fields || []), { label: newField.label.trim(), value: newField.value.trim() }] }));
    setNewField({ label: '', value: '' });
  }

  function removeCustomField(idx) {
    setS(prev => ({ ...prev, custom_fields: prev.custom_fields.filter((_, i) => i !== idx) }));
  }

  async function save() {
    setSaving(true);
    const r = await window.electron.invoke('invoiceSettings:save', s).catch(() => ({ success: false }));
    setSaving(false);
    if (r.success) toast.success('Invoice design saved!');
    else toast.error('Failed to save');
  }

  const SECTIONS = [
    { key: 'numbering',  icon: '🔢', label: 'Invoice Numbering' },
    { key: 'seller',     icon: '🏢', label: 'Seller Details' },
    { key: 'template',   icon: '🎨', label: 'Template & Colors' },
    { key: 'fields',     icon: '👁', label: 'Show / Hide Fields' },
    { key: 'bank',       icon: '🏦', label: 'Bank Details' },
    { key: 'custom',     icon: '✏️', label: 'Custom Fields' },
    { key: 'footer',     icon: '📝', label: 'Footer & Terms' },
  ];

  return (
    <div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Invoice Designer</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Customize how your invoices look and what information they show</div>
          </div>
          <button className="btn btn-black" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Design'}
          </button>
        </div>

        {/* Live number preview banner */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Next Invoice Number Preview:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: s.template_color || '#111', background: '#fff', border: `2px solid ${s.template_color || '#111'}`, borderRadius: 8, padding: '4px 14px' }}>
            {previewNumber()}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>· Template: <strong>{TEMPLATE_STYLES.find(t => t.value === s.template_style)?.label || 'Classic'}</strong></span>
          <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: s.template_color || '#111' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '185px 1fr', gap: 20 }}>
          {/* Left section nav */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS.map(sec => (
              <div
                key={sec.key}
                onClick={() => setSection(sec.key)}
                style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: section === sec.key ? 600 : 400, background: section === sec.key ? '#f1f5f9' : 'transparent', color: section === sec.key ? '#111' : '#374151', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}
              >
                <span style={{ fontSize: 15 }}>{sec.icon}</span> {sec.label}
              </div>
            ))}
          </div>

          {/* Right content */}
          <div style={{ minHeight: 380 }}>

            {/* ── INVOICE NUMBERING ─────────────────────────────── */}
            {section === 'numbering' && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Invoice Numbering</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Set the format for auto-generated invoice numbers.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="form-label">Prefix</label>
                    <input className="form-input" value={s.inv_prefix} onChange={e => set('inv_prefix', e.target.value)} placeholder="e.g. INV" />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Appears before the number (e.g. INV, BILL, SA)</div>
                  </div>
                  <div>
                    <label className="form-label">Suffix</label>
                    <input className="form-input" value={s.inv_suffix} onChange={e => set('inv_suffix', e.target.value)} placeholder="e.g. /2025 or leave blank" />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Appears after the number (e.g. /2025, -ZA)</div>
                  </div>
                  <div>
                    <label className="form-label">Starting Number</label>
                    <input className="form-input" type="number" value={s.inv_start_number} onChange={e => set('inv_start_number', parseInt(e.target.value) || 1)} />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>The first invoice will use this number</div>
                  </div>
                  <div>
                    <label className="form-label">Number Padding (digits)</label>
                    <select className="form-select" value={s.inv_padding} onChange={e => set('inv_padding', parseInt(e.target.value))}>
                      {[3,4,5,6].map(n => <option key={n} value={n}>{n} digits (e.g. {String(s.inv_start_number||1001).padStart(n,'0')})</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Preview</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: '#111', marginTop: 4 }}>{previewNumber()}</div>
                </div>
              </div>
            )}

            {/* ── SELLER DETAILS ────────────────────────────────── */}
            {section === 'seller' && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Seller Details</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Override company info shown on invoices (leave blank to use Company Profile values).</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Business Name on Invoice</label>
                    <input className="form-input" value={s.seller_name} onChange={e => set('seller_name', e.target.value)} placeholder="Leave blank to use Company Profile name" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Tagline / Slogan</label>
                    <input className="form-input" value={s.seller_tagline} onChange={e => set('seller_tagline', e.target.value)} placeholder="e.g. Your trusted electrical partner" />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={s.seller_phone} onChange={e => set('seller_phone', e.target.value)} placeholder="+91-9876543210" />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input className="form-input" value={s.seller_email} onChange={e => set('seller_email', e.target.value)} placeholder="billing@company.com" />
                  </div>
                  <div>
                    <label className="form-label">Website</label>
                    <input className="form-input" value={s.seller_website} onChange={e => set('seller_website', e.target.value)} placeholder="www.company.com" />
                  </div>
                  <div>
                    <label className="form-label">GSTIN / VAT Number</label>
                    <input className="form-input" value={s.seller_gstin} onChange={e => set('seller_gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
                  </div>
                  <div>
                    <label className="form-label">PAN Number</label>
                    <input className="form-input" value={s.seller_pan} onChange={e => set('seller_pan', e.target.value)} placeholder="AAAAA0000A" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Address on Invoice</label>
                    <textarea className="form-input" rows={3} value={s.seller_address} onChange={e => set('seller_address', e.target.value)} placeholder="Full business address as it should appear on invoice" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TEMPLATE & COLORS ─────────────────────────────── */}
            {section === 'template' && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Template & Color Theme</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Choose the visual style and accent color for your printed invoices.</div>

                <div style={{ marginBottom: 24 }}>
                  <label className="form-label">Layout Style</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {TEMPLATE_STYLES.map(t => (
                      <div
                        key={t.value}
                        onClick={() => set('template_style', t.value)}
                        style={{ padding: '14px', borderRadius: 12, cursor: 'pointer', border: s.template_style === t.value ? `2px solid ${s.template_color}` : '1.5px solid #e2e8f0', background: s.template_style === t.value ? '#f8fafc' : '#fff', textAlign: 'center', transition: 'all 0.15s' }}
                      >
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{t.value === 'classic' ? '📄' : t.value === 'modern' ? '🖼️' : '📋'}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{t.desc}</div>
                        {s.template_style === t.value && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: s.template_color }}>✓ Selected</div>}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="form-label">Accent Color</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {TEMPLATE_COLORS.map(c => (
                      <div
                        key={c.value}
                        onClick={() => set('template_color', c.value)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: s.template_color === c.value ? `2px solid ${c.value}` : '1.5px solid #e2e8f0', background: s.template_color === c.value ? '#f8fafc' : '#fff' }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: c.value, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                        <span style={{ fontSize: 12, fontWeight: s.template_color === c.value ? 700 : 400 }}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10 }}>
                    <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Custom Color</label>
                    <input type="color" value={s.template_color} onChange={e => set('template_color', e.target.value)} style={{ width: 36, height: 36, padding: 2, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748b' }}>{s.template_color}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── SHOW / HIDE FIELDS ────────────────────────────── */}
            {section === 'fields' && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Show / Hide Invoice Fields</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Toggle which fields appear on the printed invoice.</div>
                {[
                  { key: 'show_customer_phone', label: 'Customer Phone Number', desc: 'Show customer phone on invoice' },
                  { key: 'show_customer_email', label: 'Customer Email Address', desc: 'Show customer email on invoice' },
                  { key: 'show_customer_gstin', label: 'Customer GSTIN / VAT No.', desc: 'Show customer tax number' },
                  { key: 'show_due_date',        label: 'Payment Due Date',       desc: 'Show the payment due date field' },
                  { key: 'show_po_number',       label: 'PO / Reference Number',  desc: 'Show purchase order reference' },
                  { key: 'show_hsn',             label: 'HSN / SAC Code',         desc: 'Show HSN code column in items table' },
                  { key: 'show_discount',        label: 'Discount Column',         desc: 'Show discount in items table' },
                  { key: 'show_tax_breakdown',   label: 'Tax Breakdown (CGST/SGST)', desc: 'Show detailed tax lines in summary' },
                  { key: 'show_bank_details',    label: 'Bank Details',            desc: 'Show bank details section at bottom' },
                ].map(f => (
                  <div
                    key={f.key}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, border: '1px solid #f1f5f9', marginBottom: 8, background: s[f.key] ? '#f8faff' : '#fff' }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.desc}</div>
                    </div>
                    <div
                      onClick={() => set(f.key, !s[f.key])}
                      style={{ width: 44, height: 24, borderRadius: 12, background: s[f.key] ? '#111' : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}
                    >
                      <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: s[f.key] ? 22 : 2, transition: 'left 0.2s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── BANK DETAILS ──────────────────────────────────── */}
            {section === 'bank' && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Bank Details on Invoice</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>These details appear at the bottom of the invoice so customers can pay via bank transfer.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="form-label">Bank Name</label>
                    <input className="form-input" value={s.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. HDFC Bank" />
                  </div>
                  <div>
                    <label className="form-label">Account Number</label>
                    <input className="form-input" value={s.bank_account_no} onChange={e => set('bank_account_no', e.target.value)} placeholder="e.g. 50100123456789" />
                  </div>
                  <div>
                    <label className="form-label">IFSC / Swift Code</label>
                    <input className="form-input" value={s.bank_ifsc} onChange={e => set('bank_ifsc', e.target.value)} placeholder="e.g. HDFC0001234" />
                  </div>
                  <div>
                    <label className="form-label">Branch</label>
                    <input className="form-input" value={s.bank_branch} onChange={e => set('bank_branch', e.target.value)} placeholder="e.g. Andheri West, Mumbai" />
                  </div>
                </div>
                {!s.show_bank_details && (
                  <div style={{ marginTop: 16, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: 12, fontSize: 12, color: '#92400e' }}>
                    ⚠️ Bank details section is currently hidden on invoices. Enable it in <strong>Show / Hide Fields</strong>.
                  </div>
                )}
              </div>
            )}

            {/* ── CUSTOM FIELDS ─────────────────────────────────── */}
            {section === 'custom' && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Custom Fields</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Add extra label-value pairs that appear in the invoice header (e.g. "VAT Reg No.", "Quotation Ref", "Delivery Address").</div>

                {(s.custom_fields || []).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13, border: '1.5px dashed #e2e8f0', borderRadius: 12, marginBottom: 20 }}>
                    No custom fields yet. Add one below.
                  </div>
                )}

                {(s.custom_fields || []).map((cf, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <input className="form-input" style={{ flex: '0 0 160px' }} value={cf.label} onChange={e => { const arr = [...s.custom_fields]; arr[idx] = { ...arr[idx], label: e.target.value }; set('custom_fields', arr); }} placeholder="Label" />
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>:</span>
                    <input className="form-input" style={{ flex: 1 }} value={cf.value} onChange={e => { const arr = [...s.custom_fields]; arr[idx] = { ...arr[idx], value: e.target.value }; set('custom_fields', arr); }} placeholder="Value" />
                    <button onClick={() => removeCustomField(idx)} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>✕</button>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 16, padding: '14px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <input className="form-input" style={{ flex: '0 0 160px' }} value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} placeholder="Field Label" onKeyDown={e => e.key === 'Enter' && addCustomField()} />
                  <input className="form-input" style={{ flex: 1 }} value={newField.value} onChange={e => setNewField(p => ({ ...p, value: e.target.value }))} placeholder="Field Value (or leave blank)" onKeyDown={e => e.key === 'Enter' && addCustomField()} />
                  <button className="btn btn-black btn-sm" onClick={addCustomField}>+ Add</button>
                </div>
              </div>
            )}

            {/* ── FOOTER & TERMS ────────────────────────────────── */}
            {section === 'footer' && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Footer & Terms</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Text that appears at the bottom of every invoice.</div>
                <div className="form-group">
                  <label className="form-label">Thank You / Footer Note</label>
                  <textarea className="form-input" rows={3} value={s.footer_notes} onChange={e => set('footer_notes', e.target.value)} placeholder="e.g. Thank you for your business!" />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Shown prominently at the bottom of the invoice</div>
                </div>
                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Terms & Conditions</label>
                  <textarea className="form-input" rows={4} value={s.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} placeholder="e.g. Payment due within 30 days. Goods once sold cannot be returned." />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Fine print at the bottom of the invoice</div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Save button at bottom */}
        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 24, paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => { setS(DEFAULT_SETTINGS); toast('Reset to defaults', { icon: '↺' }); }}>Reset to Defaults</button>
          <button className="btn btn-black" onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save Design'}</button>
        </div>
      </div>
    </div>
  );
}

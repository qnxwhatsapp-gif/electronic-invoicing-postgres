import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FALLBACK_ROLES = ['Owner', 'Accountant', 'Billing Operator', 'Inventory Manager'];

const ROLE_ICONS = {
  'Owner': '👑',
  'Accountant': '📒',
  'Billing Operator': '🧾',
  'Inventory Manager': '📦',
};

export default function Login() {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    setRolesLoading(true);
    try {
      const result = await window.electron.invoke('auth:getRoles', {});
      if (Array.isArray(result) && result.length > 0) {
        setRoles(result);
      } else {
        // Fallback: use hardcoded roles
        setRoles(FALLBACK_ROLES);
      }
    } catch {
      setRoles(FALLBACK_ROLES);
    } finally {
      setRolesLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedRole) { setUsers([]); setSelectedUser(''); return; }
    window.electron.invoke('auth:getUsersByRole', { role: selectedRole })
      .then(list => {
        setUsers(Array.isArray(list) ? list : []);
        setSelectedUser('');
      })
      .catch(() => setUsers([]));
  }, [selectedRole]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedRole) { setError('Please select a user type.'); return; }
    if (!selectedUser) { setError('Please select a user.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true); setError('');
    const result = await login(selectedUser, password);
    setLoading(false);
    if (result.success) { navigate('/dashboard'); }
    else { setError(result.error || 'Invalid credentials.'); }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-box" />
          <div className="login-company">Invoicing App</div>
          <div className="login-subtitle">Sign in to your account</div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>

          {/* Step 1 — User Type */}
          <div className="form-group">
            <label className="form-label">User Type</label>
            {rolesLoading ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e2e8f0', borderRadius: 10 }}>
                Loading user types...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {roles.map(role => (
                  <div
                    key={role}
                    onClick={() => { setSelectedRole(role); setError(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: selectedRole === role ? '2px solid #111' : '1.5px solid #e2e8f0',
                      background: selectedRole === role ? '#f1f5f9' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{ROLE_ICONS[role] || '👤'}</span>
                    <span style={{ fontSize: 12, fontWeight: selectedRole === role ? 700 : 500, color: selectedRole === role ? '#111' : '#374151', lineHeight: 1.3 }}>
                      {role}
                    </span>
                    {selectedRole === role && (
                      <span style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — Select User */}
          {selectedRole && (
            <div className="form-group">
              <label className="form-label">Select User</label>
              <select
                className="form-select"
                value={selectedUser}
                onChange={e => { setSelectedUser(e.target.value); setError(''); }}
                style={{ fontSize: 14 }}
              >
                <option value="">— Choose a user —</option>
                {users.map(u => (
                  <option key={u.id} value={u.name}>
                    {u.name}{u.mobile ? ` (${u.mobile})` : ''}
                  </option>
                ))}
              </select>
              {users.length === 0 && (
                <div style={{ fontSize: 11, color: '#f97316', marginTop: 4 }}>
                  No active users for this role.
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Password */}
          {selectedUser && (
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                style={{ paddingRight: 40 }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 10, top: 30, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-black"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 8, opacity: (!selectedRole || !selectedUser || !password || loading) ? 0.6 : 1 }}
            disabled={loading || !selectedRole || !selectedUser || !password}
          >
            {loading ? 'Signing in...' : 'Login →'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          <strong>Demo:</strong> Select <em>Owner</em> → <em>admin</em> → password: <code>admin123</code>
        </div>
      </div>
    </div>
  );
}

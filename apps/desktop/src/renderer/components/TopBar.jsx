import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../hooks/useSearch';

// ── Notification icon map ──────────────────────────────────────────────────
const NOTIF_ICONS = {
  low_stock: '📦',
  credit_due: '💳',
  bill_due:   '📋',
  invoice:    '🧾',
  payment:    '✅',
  info:       'ℹ️',
};

const NOTIF_COLORS = {
  low_stock: '#f97316',
  credit_due: '#ef4444',
  bill_due:   '#f59e0b',
  invoice:    '#3b82f6',
  payment:    '#22c55e',
  info:       '#64748b',
};

// ── NotificationBell ───────────────────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke('notifications:getAll', {});
      setNotifications(result.notifications || []);
      setUnread(result.unread || 0);
    } catch {
      setNotifications([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 60 seconds for new notifications
  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  function handleOpen() {
    setOpen(v => !v);
    if (!open) load();
  }

  async function markRead(id) {
    await window.electron.invoke('notifications:markRead', { id });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    await window.electron.invoke('notifications:markRead', {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnread(0);
  }

  async function deleteRead() {
    await window.electron.invoke('notifications:delete', {});
    setNotifications(prev => prev.filter(n => !n.is_read));
  }

  async function handleClick(n) {
    if (!n.is_read) await markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
        title="Notifications"
      >
        <span style={{ fontSize: 18 }}>🔔</span>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', minWidth: 16, height: 16,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
            border: '1.5px solid #fff',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 360, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 500, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
              {unread > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{unread}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: 11, color: '#3b82f6', cursor: 'pointer', fontWeight: 500, padding: 0 }}>
                  Mark all read
                </button>
              )}
              {notifications.some(n => n.is_read) && (
                <button onClick={deleteRead} style={{ background: 'none', border: 'none', fontSize: 11, color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                  Clear read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>No notifications</div>
              </div>
            )}
            {!loading && notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex', gap: 12, padding: '12px 16px',
                  cursor: n.link ? 'pointer' : 'default',
                  background: n.is_read ? '#fff' : '#f8faff',
                  borderBottom: '1px solid #f8fafc',
                  transition: 'background 0.1s',
                  alignItems: 'flex-start',
                }}
                onMouseEnter={e => { if (n.link) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? '#fff' : '#f8faff'}
              >
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `${NOTIF_COLORS[n.type] || '#64748b'}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  {NOTIF_ICONS[n.type] || 'ℹ️'}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: 13, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, marginBottom: 4 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{timeAgo(n.created_at)}</div>
                </div>

                {/* Mark read on hover */}
                {!n.is_read && (
                  <button
                    onClick={e => { e.stopPropagation(); markRead(n.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 14, padding: '2px 4px', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}
                    title="Mark as read"
                    onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                  >
                    ✓
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <button onClick={() => { load(); }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
                Refresh ↺
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TopBar ─────────────────────────────────────────────────────────────────
export default function TopBar() {
  const { currentUser, logout, can } = useAuth();
  const { query, results, loading, open, setOpen, search, clear } = useSearch();
  const navigate = useNavigate();
  const searchRef = useRef(null);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { clear(); searchRef.current?.blur(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleResultClick(item) {
    clear();
    switch (item.type) {
      case 'invoice':  navigate('/billing'); break;
      case 'product':  navigate('/inventory'); break;
      case 'vendor':   navigate('/vendors'); break;
      case 'user':     navigate('/settings'); break;
      case 'expense':  navigate('/expenses'); break;
      default: break;
    }
  }

  return (
    <div className="topbar">
      <div />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Search */}
        <div className="topbar-search">
          <span className="search-icon" style={{ fontSize: 13 }}>🔍</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => search(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder="Search invoices, products, users...  Ctrl+K"
          />
          {open && results && (
            <div className="search-dropdown">
              {can('billing', 'view') && results.invoices?.length > 0 && (
                <>
                  <div className="search-section-title">📄 Invoices</div>
                  {results.invoices.map(item => (
                    <div key={item.id} className="search-result-item" onClick={() => handleResultClick(item)}>
                      <span style={{ fontWeight: 600 }}>{item.invoice_no}</span>
                      <span style={{ color: '#6b7280' }}>{item.customer_name}</span>
                      <span style={{ marginLeft: 'auto', color: '#16a34a' }}>₹{item.grand_total}</span>
                    </div>
                  ))}
                </>
              )}
              {can('inventory', 'view') && results.products?.length > 0 && (
                <>
                  <div className="search-section-title">📦 Products</div>
                  {results.products.map(item => (
                    <div key={item.id} className="search-result-item" onClick={() => handleResultClick(item)}>
                      <span style={{ fontWeight: 600 }}>{item.sku}</span>
                      <span>{item.name}</span>
                      <span style={{ marginLeft: 'auto', color: '#6b7280' }}>Stock: {item.current_stock}</span>
                    </div>
                  ))}
                </>
              )}
              {can('vendors', 'view') && results.vendors?.length > 0 && (
                <>
                  <div className="search-section-title">🏢 Vendors</div>
                  {results.vendors.map(item => (
                    <div key={item.id} className="search-result-item" onClick={() => handleResultClick(item)}>
                      <span>{item.name}</span>
                      <span style={{ color: '#6b7280' }}>{item.company_name}</span>
                    </div>
                  ))}
                </>
              )}
              {can('settings', 'view') && results.users?.length > 0 && (
                <>
                  <div className="search-section-title">👤 Users</div>
                  {results.users.map(item => (
                    <div key={item.id} className="search-result-item" onClick={() => handleResultClick(item)}>
                      <span>{item.name}</span>
                      <span style={{ color: '#6b7280' }}>{item.role}</span>
                    </div>
                  ))}
                </>
              )}
              {loading && <div style={{ padding: 14, color: '#9ca3af', fontSize: 13 }}>Searching...</div>}
              {!loading && Object.values(results).every(r => !r?.length) && (
                <div style={{ padding: 14, color: '#9ca3af', fontSize: 13 }}>No results found for "{query}"</div>
              )}
              <div className="search-view-all" onClick={clear}>View all results for "{query}" →</div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User avatar + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={logout} title="Logout">
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
            {currentUser?.name?.[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Logout</span>
        </div>
      </div>
    </div>
  );
}

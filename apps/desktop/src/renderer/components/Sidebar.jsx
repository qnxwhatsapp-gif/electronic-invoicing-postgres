import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { label: 'Dashboard',            path: '/dashboard', module: 'dashboard',  icon: '⊞' },
  { label: 'Billing & Invoice',    path: '/billing',   module: 'billing',    icon: '👤' },
  { label: 'Inventory & Services', path: '/inventory', module: 'inventory',  icon: '📦' },
  { label: 'Vendors & Purchases',  path: '/vendors',   module: 'vendors',    icon: '🚚' },
  { label: 'Banking',              path: '/banking',   module: 'banking',    icon: '🏦' },
  { label: 'Expenses',             path: '/expenses',  module: 'expenses',   icon: '💵' },
  { label: 'Reports',              path: '/reports',   module: 'reports',    icon: '📊' },
  { label: 'Settings',             path: '/settings',  module: 'settings',   icon: '⚙️' },
];

export default function Sidebar() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-box" />
        <span className="sidebar-logo-text">LOGO</span>
      </div>
      <nav className="sidebar-nav">
        {NAV.filter(item => can(item.module, 'view')).map(item => (
          <div
            key={item.path}
            className={`nav-item ${pathname.startsWith(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

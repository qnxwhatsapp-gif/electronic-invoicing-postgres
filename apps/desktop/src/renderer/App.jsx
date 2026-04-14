import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BillingInvoice from './pages/BillingInvoice';
import InventoryServices from './pages/InventoryServices';
import VendorsPurchases from './pages/VendorsPurchases';
import Banking from './pages/Banking';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AccessDenied from './components/AccessDenied';
import './styles/global.css';

function ProtectedRoute({ children, module }) {
  const { currentUser, can } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (module && !can(module, 'view')) return <AccessDenied />;
  return children;
}

function AppLayout() {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', background: '#f5f5f5', padding: '24px' }}>
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute module="billing"><BillingInvoice /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute module="inventory"><InventoryServices /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute module="vendors"><VendorsPurchases /></ProtectedRoute>} />
            <Route path="/banking" element={<ProtectedRoute module="banking"><Banking /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute module="expenses"><Expenses /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute module="reports"><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute module="settings"><Settings /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

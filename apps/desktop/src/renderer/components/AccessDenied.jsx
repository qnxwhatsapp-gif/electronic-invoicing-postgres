import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Access Denied</h2>
      <p style={{ color: '#6b7280', fontSize: 14 }}>You don't have permission to view this page.</p>
      <p style={{ color: '#9ca3af', fontSize: 13 }}>Contact your administrator to request access.</p>
      <button className="btn btn-outline" onClick={() => navigate(-1)}>← Go Back</button>
    </div>
  );
}

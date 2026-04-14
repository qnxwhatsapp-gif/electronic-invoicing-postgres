import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      loadPermissions(user);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadPermissions(user) {
    if (user.role === 'Owner') { setPermissions(null); setLoading(false); return; }
    const perms = await window.electron.invoke('permissions:getForUser', { userId: user.id, role: user.role });
    setPermissions(perms);
    setLoading(false);
  }

  async function login(username, password) {
    const result = await window.electron.invoke('auth:login', { username, password });
    if (result.success) {
      setCurrentUser(result.user);
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      await loadPermissions(result.user);
    }
    return result;
  }

  function logout() {
    setCurrentUser(null);
    setPermissions(null);
    localStorage.removeItem('currentUser');
  }

  function can(module, action) {
    if (!currentUser) return false;
    if (currentUser.role === 'Owner') return true;
    if (!permissions) return false;
    return permissions?.[module]?.[action] === true;
  }

  return (
    <AuthContext.Provider value={{ currentUser, permissions, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

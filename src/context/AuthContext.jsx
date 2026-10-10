import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('safetyai_token') || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('safetyai_user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Compute normalized role flags
  const rawRole = (user?.role || '').toUpperCase();
  const isAdmin = rawRole === 'ADMIN' || rawRole === 'ADMINISTRATOR' || !!user?.is_admin;
  const isResponder = rawRole === 'RESPONDER' || rawRole === 'HSE_OFFICER' || !!user?.is_responder;
  const isCitizen = !isAdmin && !isResponder;
  const activeRole = isAdmin ? 'ADMIN' : isResponder ? 'RESPONDER' : 'USER';

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 400);

    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('safetyai_token');
        const storedUser = localStorage.getItem('safetyai_user');

        if (storedToken && storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setToken(storedToken);
            setLoading(false);

            api.getProfile()
              .then(freshUser => {
                if (freshUser) {
                  setUser(freshUser);
                  localStorage.setItem('safetyai_user', JSON.stringify(freshUser));
                }
              })
              .catch(err => {
                if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
                  localStorage.removeItem('safetyai_token');
                  localStorage.removeItem('safetyai_user');
                  setUser(null);
                  setToken(null);
                }
              });
            return;
          } catch {
            localStorage.removeItem('safetyai_token');
            localStorage.removeItem('safetyai_user');
            setUser(null);
            setToken(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    return () => clearTimeout(safetyTimer);
  }, []);

  const login = async (emailOrOrg, maybeEmail, maybePassword) => {
    let orgId = '';
    let email = '';
    let password = '';

    if (maybePassword !== undefined) {
      orgId = emailOrOrg;
      email = maybeEmail;
      password = maybePassword;
    } else {
      email = emailOrOrg;
      password = maybeEmail;
    }

    const data = await api.login(email, password, orgId);
    localStorage.setItem('safetyai_token', data.access_token);
    localStorage.setItem('safetyai_user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (registerPayload) => {
    const data = await api.register(registerPayload);
    localStorage.setItem('safetyai_token', data.access_token);
    localStorage.setItem('safetyai_user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    api.logout().catch(() => {});
    localStorage.removeItem('safetyai_token');
    localStorage.removeItem('safetyai_user');
    setUser(null);
    setToken(null);
  };

  const updateUser = (updatedFields) => {
    setUser(prev => {
      const updated = { ...(prev || {}), ...updatedFields };
      try {
        localStorage.setItem('safetyai_user', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save updated user to localStorage', e);
      }
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isAuthenticated: !!user, 
      role: activeRole,
      isAdmin, 
      isResponder, 
      isCitizen, 
      login, 
      register, 
      logout, 
      updateUser, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

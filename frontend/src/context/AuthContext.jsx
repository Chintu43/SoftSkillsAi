import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Restore last known user from localStorage so the UI is not blank
    // on page load. The checkAuth effect will refresh it from the server.
    const saved = localStorage.getItem('skillforge_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // On every mount, if a token exists, re-fetch the FULL profile from the
  // backend so any score updates from a previous session are reflected.
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('skillforge_token');
      if (token) {
        try {
          const profile = await api.getProfile();
          setUser(profile);
          localStorage.setItem('skillforge_user', JSON.stringify(profile));
        } catch (err) {
          console.warn('Token validation notice:', err.message);
          // Token is invalid/expired — clear only auth keys, NOT all localStorage
          localStorage.removeItem('skillforge_token');
          localStorage.removeItem('skillforge_user');
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    // Step 1: obtain token + initial profile from login endpoint
    const data = await api.login(email, password);
    localStorage.setItem('skillforge_token', data.token);

    // Step 2: immediately fetch the authoritative full profile so
    // all persisted scores / session counts are loaded correctly.
    let fullProfile = data.user;
    try {
      fullProfile = await api.getProfile();
    } catch (e) {
      // If profile fetch fails, fall back to the login response data
    }

    localStorage.setItem('skillforge_user', JSON.stringify(fullProfile));
    setUser(fullProfile);
    return data;
  };

  const register = async (name, email, password) => {
    const data = await api.register(name, email, password);
    localStorage.setItem('skillforge_token', data.token);
    localStorage.setItem('skillforge_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    // Remove ONLY the auth session keys — never clear all localStorage
    // so that no other persisted data is accidentally wiped.
    localStorage.removeItem('skillforge_token');
    localStorage.removeItem('skillforge_user');
    setUser(null);
  };

  // Call this after a session completes to refresh the user's scores in
  // the dashboard without requiring a full page reload.
  const refreshUser = async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
      localStorage.setItem('skillforge_user', JSON.stringify(profile));
    } catch (e) {
      console.warn('refreshUser error:', e.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

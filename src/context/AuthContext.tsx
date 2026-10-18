import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isTechnician: boolean;
  login: (username: string, pass: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; role?: string; full_name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (role: 'ADMIN' | 'TECHNICIAN') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const res = await api.getMe();
      if (res.authenticated && res.user) {
        setUser(res.user);
      } else {
        // Try fallback demo login as Admin if no active session
        try {
          const loginRes = await api.login({ username: 'admin', password: 'AdminPass123!' });
          if (loginRes.user) {
            localStorage.setItem('netpulse_token', loginRes.token);
            setUser(loginRes.user);
          }
        } catch {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({ username, password: pass });
      localStorage.setItem('netpulse_token', res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { username: string; email: string; password: string; role?: string; full_name?: string }) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem('netpulse_token', res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('netpulse_token');
    setUser(null);
  };

  const switchUser = async (role: 'ADMIN' | 'TECHNICIAN') => {
    setIsLoading(true);
    try {
      const username = role === 'ADMIN' ? 'admin' : 'technician';
      const pass = role === 'ADMIN' ? 'AdminPass123!' : 'TechPass123!';
      const res = await api.login({ username, password: pass });
      localStorage.setItem('netpulse_token', res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isTechnician = user?.role === 'TECHNICIAN' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        isTechnician,
        login,
        register,
        logout,
        switchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

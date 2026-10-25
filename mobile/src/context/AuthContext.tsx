import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '@togetherflix/shared';
import { StorageService } from '../services/storage';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  createPartnerInvite: (email: string) => Promise<{ inviteCode: string; expiresAt: string }>;
  acceptPartnerInvite: (code: string) => Promise<void>;
  unlinkPartner: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadCachedAuth();
  }, []);

  async function loadCachedAuth() {
    try {
      const cachedToken = await StorageService.getToken();
      const cachedUser = await StorageService.getUser();

      if (cachedToken) {
        setToken(cachedToken);
        if (cachedUser) setUser(cachedUser);

        // Background profile refresh to verify token validity
        try {
          const res = await api.auth.getMe();
          if (res.success && res.user) {
            setUser(res.user);
            await StorageService.setUser(res.user);
          }
        } catch {
          // Token may have expired
          await logout();
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await api.auth.login(email, password);
    if (res.success) {
      setToken(res.accessToken);
      setUser(res.user);
      await StorageService.setToken(res.accessToken);
      await StorageService.setUser(res.user);
    }
  }

  async function register(email: string, password: string, displayName: string) {
    const res = await api.auth.register(email, password, displayName);
    if (res.success) {
      setToken(res.accessToken);
      setUser(res.user);
      await StorageService.setToken(res.accessToken);
      await StorageService.setUser(res.user);
    }
  }

  async function logout() {
    setToken(null);
    setUser(null);
    await StorageService.clearAll();
  }

  async function refreshProfile() {
    const res = await api.auth.getMe();
    if (res.success && res.user) {
      setUser(res.user);
      await StorageService.setUser(res.user);
    }
  }

  async function createPartnerInvite(email: string) {
    const res = await api.auth.createPartnerInvite(email);
    return { inviteCode: res.inviteCode, expiresAt: res.expiresAt };
  }

  async function acceptPartnerInvite(code: string) {
    const res = await api.auth.acceptPartnerInvite(code);
    if (res.success && res.user) {
      setUser(res.user);
      await StorageService.setUser(res.user);
    }
  }

  async function unlinkPartner() {
    const res = await api.auth.unlinkPartner();
    if (res.success && res.user) {
      setUser(res.user);
      await StorageService.setUser(res.user);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        createPartnerInvite,
        acceptPartnerInvite,
        unlinkPartner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

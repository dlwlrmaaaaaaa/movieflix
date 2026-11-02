import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { UserProfile } from '@togetherflix/shared';
import { StorageService } from '../services/storage';
import { onSessionRevoked } from '../services/authEvents';
import { queryClient } from '../services/queryClient';
import { api } from '../services/api';

interface AuthContextType {
  sessionNotice: string;
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
  const [sessionNotice, setSessionNotice] = useState('');
  const currentToken = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  currentToken.current = token;
  useEffect(() => onSessionRevoked((revokedToken, message) => {
    if (currentToken.current !== revokedToken) return;
    queryClient.clear();
    currentToken.current = null; setSessionNotice(message); setToken(null); setUser(null);
    void StorageService.clearAll();
  }), []);
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
    setSessionNotice('');
    if (res.success) {
      setToken(res.accessToken);
      setUser(res.user);
      await StorageService.setToken(res.accessToken);
      await StorageService.setUser(res.user);
    }
  }

  async function register(email: string, password: string, displayName: string) {
    const res = await api.auth.register(email, password, displayName);
    setSessionNotice('');
    if (res.success) {
      setToken(res.accessToken);
      setUser(res.user);
      await StorageService.setToken(res.accessToken);
      await StorageService.setUser(res.user);
    }
  }

  async function logout() {
    try { await api.auth.logout(); } catch { /* The local session must still end offline. */ }
    queryClient.clear();
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
        sessionNotice,
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

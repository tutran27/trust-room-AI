'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, setToken, getToken } from '../lib/api-client';
import type { AuthResult, NonceResult, SessionUser } from '../lib/api-types';
import { getDemoAddress, signAuthMessage, type WalletKind } from '../lib/wallet';

const WALLET_KIND_KEY = 'trustroom_wallet_kind';

interface AuthState {
  address: string | null;
  user: SessionUser | null;
  status: 'idle' | 'connecting' | 'authenticated' | 'error';
  error: string | null;
  walletKind: WalletKind;
  connect: (kind?: WalletKind) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [walletKind, setWalletKind] = useState<WalletKind>('demo');

  // Restore a session from a stored token on mount.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // Restore walletKind from localStorage
    const storedKind = localStorage.getItem(WALLET_KIND_KEY);
    if (storedKind === 'phantom' || storedKind === 'demo') {
      setWalletKind(storedKind);
    }
    apiFetch<SessionUser>('/auth/session')
      .then((session) => {
        setUser(session);
        setAddress(session.wallet ?? session.walletAddress ?? null);
        setStatus('authenticated');
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem(WALLET_KIND_KEY);
      });
  }, []);

  const connect = useCallback(async (kind: WalletKind = 'demo') => {
    setStatus('connecting');
    setError(null);
    setWalletKind(kind);
    try {
      const addr = await connectAddress(kind);
      const nonce = await apiFetch<NonceResult>('/auth/nonce', {
        method: 'POST',
        auth: false,
        body: { walletAddress: addr },
      });
      const signed = await signAuthMessage(kind, nonce.message);
      const result = await apiFetch<AuthResult>('/auth/verify-signature', {
        method: 'POST',
        auth: false,
        body: {
          challengeId: nonce.challengeId,
          walletAddress: signed.address,
          nonce: nonce.nonce,
          signature: signed.signature,
        },
      });
      setToken(result.accessToken);
      setAddress(result.walletAddress);
      setUser({ wallet: result.walletAddress, userId: result.userId });
      setStatus('authenticated');
      localStorage.setItem(WALLET_KIND_KEY, kind);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to connect wallet.');
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAddress(null);
    setStatus('idle');
    localStorage.removeItem(WALLET_KIND_KEY);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ address, user, status, error, walletKind, connect, logout }),
    [address, user, status, error, walletKind, connect, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Resolve a Phantom address (demo path is handled inline).
async function connectAddress(kind: WalletKind): Promise<string> {
  if (kind === 'phantom') {
    const { connectPhantom } = await import('../lib/wallet');
    return connectPhantom();
  }
  return getDemoAddress();
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

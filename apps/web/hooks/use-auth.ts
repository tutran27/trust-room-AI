'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDemoAddress, signAuthMessage, shortAddress as fmtShortAddr, type WalletKind } from '@/lib/wallet';
import { apiFetch, getToken, setToken } from '@/lib/api';

const WALLET_KIND_KEY = 'trustroom_wallet_kind';

interface AuthState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  shortAddress: string;
  token: string | null;
  walletKind: WalletKind | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    shortAddress: '—',
    token: null,
    walletKind: null,
  });

  // Restore session from stored token on mount (same key as AuthProvider)
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const storedKind = localStorage.getItem(WALLET_KIND_KEY) as WalletKind | null;
    apiFetch<{ wallet: string; walletAddress?: string }>('/auth/session')
      .then((session) => {
        const addr = session.wallet ?? session.walletAddress ?? null;
        setState({
          isConnected: true,
          isConnecting: false,
          address: addr,
          shortAddress: addr ? fmtShortAddr(addr) : '—',
          token,
          walletKind: storedKind || 'demo',
        });
      })
      .catch(() => {
        // Session expired — clear
        setToken(null);
        localStorage.removeItem(WALLET_KIND_KEY);
      });
  }, []);

  const connect = useCallback(async (kind: WalletKind = 'demo') => {
    setState((s) => ({ ...s, isConnecting: true }));

    try {
      // 1. Get wallet address
      let address: string;
      if (kind === 'phantom') {
        const { connectPhantom, hasPhantom } = await import('@/lib/wallet');
        if (!hasPhantom()) {
          throw new Error('Phantom wallet not found. Please install the Phantom extension.');
        }
        address = await connectPhantom();
      } else {
        address = getDemoAddress();
      }

      // 2. Get nonce from API
      const nonceRes = await apiFetch<{ challengeId: string; nonce: string; message: string }>(
        '/auth/nonce',
        { method: 'POST', auth: false, body: { walletAddress: address } },
      );

      // 3. Sign the message
      const signed = await signAuthMessage(kind, nonceRes.message);

      // 4. Verify signature
      const result = await apiFetch<{ accessToken: string; userId: string; walletAddress: string }>(
        '/auth/verify-signature',
        {
          method: 'POST',
          auth: false,
          body: {
            challengeId: nonceRes.challengeId,
            walletAddress: signed.address,
            nonce: nonceRes.nonce,
            signature: signed.signature,
          },
        },
      );

      // 5. Save session
      setToken(result.accessToken);
      localStorage.setItem(WALLET_KIND_KEY, kind);

      setState({
        isConnected: true,
        isConnecting: false,
        address: result.walletAddress,
        shortAddress: fmtShortAddr(result.walletAddress),
        token: result.accessToken,
        walletKind: kind,
      });
    } catch (err) {
      setState((s) => ({ ...s, isConnecting: false }));
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setToken(null);
    localStorage.removeItem(WALLET_KIND_KEY);
    setState({
      isConnected: false,
      isConnecting: false,
      address: null,
      shortAddress: '—',
      token: null,
      walletKind: null,
    });
  }, []);

  return {
    ...state,
    connect,
    disconnect,
  };
}

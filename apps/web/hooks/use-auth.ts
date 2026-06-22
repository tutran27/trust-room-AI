'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getDemoAddress,
  hasPhantom,
  connectPhantom,
  signAuthMessage,
  shortAddress,
  type WalletKind,
} from '@/lib/wallet';
import { apiFetch } from '@/lib/api';

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

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('trustroom_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.address && parsed.token) {
          setState({
            isConnected: true,
            isConnecting: false,
            address: parsed.address,
            shortAddress: shortAddress(parsed.address),
            token: parsed.token,
            walletKind: parsed.walletKind || 'demo',
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const connect = useCallback(async (kind: WalletKind = 'demo') => {
    setState((s) => ({ ...s, isConnecting: true }));

    try {
      let address: string;

      if (kind === 'phantom') {
        if (!hasPhantom()) {
          throw new Error('Phantom wallet not found. Please install the Phantom extension.');
        }
        address = await connectPhantom();
      } else {
        address = getDemoAddress();
      }

      // Get nonce from API
      const nonceRes = await apiFetch<{ nonce: string }>(`/auth/nonce/${address}`);
      const nonce = nonceRes.nonce;

      // Sign the auth message
      const message = `TrustRoom Authentication\nAddress: ${address}\nNonce: ${nonce}`;
      const { signature } = await signAuthMessage(kind, message);

      // Verify with API
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const verifyRes = await fetch(`${apiBase}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, nonce }),
      }).then((r) => r.json()) as { access_token: string };

      const token = verifyRes.access_token;

      // Save session
      localStorage.setItem(
        'trustroom_auth',
        JSON.stringify({ address, token, walletKind: kind })
      );

      setState({
        isConnected: true,
        isConnecting: false,
        address,
        shortAddress: shortAddress(address),
        token,
        walletKind: kind,
      });
    } catch (err) {
      setState((s) => ({ ...s, isConnecting: false }));
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('trustroom_auth');
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
    hasPhantom: hasPhantom(),
  };
}
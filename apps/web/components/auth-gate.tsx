'use client';

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@trustroom/ui';
import { useAuth } from '../providers/auth-provider';
import { Shield, Wallet, Zap } from 'lucide-react';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error, connect } = useAuth();

  if (status === 'connecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 px-6">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-surface-600 font-medium">Đang kết nối ví và xác thực phiên…</p>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-50 to-brand-50/30 px-6">
        <Card className="w-full max-w-md">
          <div className="p-8 space-y-6">
            {/* Logo */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-surface-900 tracking-tight">
                  TrustRoom
                </h1>
                <p className="text-sm text-surface-500 mt-1">
                  Connect your wallet to continue
                </p>
              </div>
            </div>

            {error ? (
              <Alert variant="danger" title="Không thể xác thực">
                {error}
              </Alert>
            ) : null}

            <div className="space-y-3">
              <button
                onClick={() => connect('phantom')}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-brand-600 text-white px-4 py-3 text-sm font-semibold hover:bg-brand-500 transition-all shadow-sm shadow-brand-500/20 active:scale-[0.98]"
              >
                <Wallet className="w-5 h-5" />
                Connect Phantom Wallet
              </button>

              <button
                onClick={() => connect('demo')}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-surface-700 border border-surface-300 px-4 py-3 text-sm font-medium hover:bg-surface-50 transition-all active:scale-[0.98]"
              >
                <Zap className="w-5 h-5" />
                Continue with Demo Wallet
              </button>
            </div>

            <p className="text-xs text-center text-surface-400">
              No private keys required. Sign a message to verify ownership.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

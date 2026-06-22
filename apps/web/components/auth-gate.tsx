'use client';

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@trustroom/ui';
import { useAuth } from '../providers/auth-provider';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error, connect } = useAuth();

  if (status === 'connecting') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Spinner />
          <span>Đang kết nối ví và xác thực phiên…</span>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Đăng nhập để tiếp tục</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <Alert variant="danger" title="Không thể xác thực">{error}</Alert> : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => connect('phantom')}>Kết nối Phantom</Button>
              <Button variant="secondary" onClick={() => connect('demo')}>Demo wallet</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

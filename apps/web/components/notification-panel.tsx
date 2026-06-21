'use client';

import { Alert, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@trustroom/ui';
import { useNotifications } from '../hooks/use-api';
import { formatRelativeTime } from '../lib/format';
import { useAuth } from '../providers/auth-provider';
import { StatusBadge } from './status-badge';

export function NotificationPanel() {
  const { status } = useAuth();
  const notifications = useNotifications(status === 'authenticated');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông báo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.isLoading ? (
          <>
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </>
        ) : notifications.isError ? (
          <Alert variant="danger" title="Không tải được thông báo">
            {notifications.error instanceof Error ? notifications.error.message : 'Lỗi không xác định.'}
          </Alert>
        ) : notifications.data && notifications.data.length > 0 ? (
          notifications.data.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-100">{item.title}</p>
                  <p className="text-sm text-slate-300">{item.message}</p>
                </div>
                <StatusBadge value={item.read ? 'Resolved' : 'Open'} />
              </div>
              <p className="text-xs text-slate-500">{formatRelativeTime(item.createdAt)}</p>
            </div>
          ))
        ) : (
          <Alert title="Chưa có thông báo">Các thay đổi realtime của deal sẽ hiện ở đây.</Alert>
        )}
      </CardContent>
    </Card>
  );
}

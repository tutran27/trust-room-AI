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
      <CardContent className="space-y-2">
        {notifications.isLoading ? (
          <>
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </>
        ) : notifications.isError ? (
          <Alert variant="danger" title="Không tải được thông báo">
            {notifications.error instanceof Error ? notifications.error.message : 'Lỗi không xác định.'}
          </Alert>
        ) : notifications.data && notifications.data.length > 0 ? (
          notifications.data.slice(0, 6).map((item) => (
            <div key={item.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{item.message}</p>
                </div>
                <StatusBadge value={item.read ? 'Resolved' : 'Open'} />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{formatRelativeTime(item.createdAt)}</p>
            </div>
          ))
        ) : (
          <Alert title="Chưa có thông báo">Các thay đổi realtime của deal sẽ hiện ở đây.</Alert>
        )}
      </CardContent>
    </Card>
  );
}

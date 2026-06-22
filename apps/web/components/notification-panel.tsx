'use client';

import { Alert, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@trustroom/ui';
import { useNotifications } from '../hooks/use-api';
import { formatRelativeTime } from '../lib/format';
import { useAuth } from '../providers/auth-provider';
import { useSocket } from '../providers/socket-provider';
import { StatusBadge } from './status-badge';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  dealId?: string;
  createdAt: string;
}

export function NotificationPanel() {
  const { status } = useAuth();
  const { socket } = useSocket();
  const [liveNotifications, setLiveNotifications] = useState<RealtimeNotification[]>([]);
  const notifications = useNotifications(status === 'authenticated');
  const [newAlert, setNewAlert] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const onNotification = (payload: RealtimeNotification) => {
      setLiveNotifications((current) => [payload, ...current].slice(0, 10));
      setNewAlert(true);
      setTimeout(() => setNewAlert(false), 5000);
    };

    socket.on('notification', onNotification);
    return () => { socket.off('notification', onNotification); };
  }, [socket]);

  const allNotifications = [
    ...liveNotifications,
    ...(notifications.data ?? []),
  ].slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Notifications</CardTitle>
            {newAlert && (
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            )}
          </div>
          <Bell className="w-4 h-4 text-surface-400" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.isLoading ? (
          <>
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </>
        ) : allNotifications.length > 0 ? (
          allNotifications.map((item) => (
            <div key={item.id} className="rounded-xl border border-surface-200 bg-white p-3 shadow-sm transition-colors hover:bg-surface-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-800">{item.title}</p>
                  <p className="mt-0.5 text-xs text-surface-500 line-clamp-2">{item.message}</p>
                </div>
                <StatusBadge value={item.createdAt ? 'Open' : 'Resolved'} />
              </div>
              <p className="mt-2 text-[11px] text-surface-400">{formatRelativeTime(item.createdAt)}</p>
            </div>
          ))
        ) : (
          <Alert title="No notifications">Real-time deal updates will appear here.</Alert>
        )}
      </CardContent>
    </Card>
  );
}

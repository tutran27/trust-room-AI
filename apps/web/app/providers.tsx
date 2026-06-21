'use client';

import type { ReactNode } from 'react';
import { QueryProvider } from '../providers/query-provider';
import { AuthProvider } from '../providers/auth-provider';
import { SocketProvider } from '../providers/socket-provider';
import { FloatingMeetingBar } from '../components/floating-meeting-bar';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <SocketProvider>
          {children}
          <FloatingMeetingBar />
        </SocketProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

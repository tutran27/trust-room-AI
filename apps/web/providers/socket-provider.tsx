'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

const WS_URL = (
  process.env.NEXT_PUBLIC_WS_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000'
).replace(/\/$/, '');

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  joinDeal: (dealId: string, wallet?: string) => void;
  leaveDeal: (dealId: string) => void;
  joinMeeting: (meetingId: string, wallet?: string) => void;
  leaveMeeting: (meetingId: string) => void;
  sendChat: (msg: {
    dealId: string;
    message: string;
    sender: string;
    speakerRole?: 'buyer' | 'seller';
  }) => void;
}

const SocketContext = createContext<SocketState | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocketState] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
    });
    socketRef.current = socket;
    setSocketState(socket);
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
    };
  }, []);

  const joinDeal = useCallback((dealId: string, wallet?: string) => {
    socketRef.current?.emit('join_deal', { dealId, wallet });
  }, []);

  const leaveDeal = useCallback((dealId: string) => {
    socketRef.current?.emit('leave_deal', { dealId });
  }, []);

  const joinMeeting = useCallback((meetingId: string, wallet?: string) => {
    socketRef.current?.emit('join_meeting', { meetingId, wallet });
  }, []);

  const leaveMeeting = useCallback((meetingId: string) => {
    socketRef.current?.emit('leave_meeting', { meetingId });
  }, []);

  const sendChat = useCallback(
    (msg: { dealId: string; message: string; sender: string; speakerRole?: 'buyer' | 'seller' }) => {
      socketRef.current?.emit('chat_message', msg);
    },
    [],
  );

  return (
    <SocketContext.Provider
      value={{ socket, connected, joinDeal, leaveDeal, joinMeeting, leaveMeeting, sendChat }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketState {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}

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
  joinUser: (wallet: string) => void;
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

  // Track wallet for auto-rejoin on reconnect
  const walletRef = useRef<string | null>(null);

  const joinUser = useCallback((wallet: string) => {
    walletRef.current = wallet;
    socketRef.current?.emit('join_user', { wallet });
  }, []);

  const joinDeal = useCallback((dealId: string, wallet?: string) => {
    if (wallet) walletRef.current = wallet;
    socketRef.current?.emit('join_deal', { dealId, wallet: wallet ?? walletRef.current ?? undefined });
  }, []);

  const leaveDeal = useCallback((dealId: string) => {
    socketRef.current?.emit('leave_deal', { dealId });
  }, []);

  const joinMeeting = useCallback((meetingId: string, wallet?: string) => {
    if (wallet) walletRef.current = wallet;
    socketRef.current?.emit('join_meeting', { meetingId, wallet: wallet ?? walletRef.current ?? undefined });
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

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
    });
    socketRef.current = socket;
    setSocketState(socket);
    socket.on('connect', () => {
      setConnected(true);
      // Auto-rejoin user room on reconnect if wallet was previously joined
      if (walletRef.current) {
        socket.emit('join_user', { wallet: walletRef.current });
      }
    });
    socket.on('disconnect', () => setConnected(false));
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        joinUser,
        joinDeal,
        leaveDeal,
        joinMeeting,
        leaveMeeting,
        sendChat,
      }}
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

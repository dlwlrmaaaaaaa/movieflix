import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { Socket } from 'socket.io-client';
import { notifySessionRevoked } from '../services/authEvents';
import { socketService } from '../services/socket';
import { useAuth } from './AuthContext';
import { ClientToServerEvents, ServerToClientEvents } from '@togetherflix/shared';

interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  latencyMs: number;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const pathname = usePathname();
  const inParty = pathname.startsWith('/room/') || pathname.startsWith('/party/');
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  useEffect(() => {
    let active = true;
    let connectedSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    setIsConnected(false);
    if (!token || !inParty) { socketService.disconnect(); setSocket(null); return; }
    void socketService.connect(token).then((client) => {
      if (!active) { client.disconnect(); return; }
      connectedSocket = client;
      setSocket(client); setIsConnected(client.connected);
      client.on('connect', () => { if (active) setIsConnected(true); });
      client.on('disconnect', () => { if (active) setIsConnected(false); });
      client.on('auth:session_revoked', ({ message }) => { notifySessionRevoked(token, message); client.disconnect(); });
      client.on('connect_error', (error) => { if (error.data?.code === 'SESSION_REPLACED') notifySessionRevoked(token, error.message); });
      timer = setInterval(() => {
        if (client.connected && active) void socketService.calibrateClock().then(({ rttMs }) => { if (active) setLatencyMs(Math.round(rttMs / 2)); });
      }, 15000);
    });
    return () => { active = false; if (timer) clearInterval(timer); connectedSocket?.disconnect(); };
  }, [token, inParty]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, latencyMs }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}

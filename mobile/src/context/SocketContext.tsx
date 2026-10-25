import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
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
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socketService.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    let isMounted = true;

    async function initSocket() {
      const s = await socketService.connect();
      if (!isMounted) return;

      setSocket(s);
      setIsConnected(s.connected);

      s.on('connect', () => {
        if (!isMounted) return;
        setIsConnected(true);
      });

      s.on('disconnect', () => {
        if (!isMounted) return;
        setIsConnected(false);
      });

      // Periodically calibrate clock & measure latency
      const timer = setInterval(async () => {
        if (s.connected && isMounted) {
          const { rttMs } = await socketService.calibrateClock();
          setLatencyMs(Math.round(rttMs / 2));
        }
      }, 15000);

      return () => {
        clearInterval(timer);
      };
    }

    initSocket();

    return () => {
      isMounted = false;
    };
  }, [token]);

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

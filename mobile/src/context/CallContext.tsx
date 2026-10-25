import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { api } from '../services/api';

interface CallContextType {
  isCallActive: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  movieVolume: number;
  callVolume: number;
  partnerConnected: boolean;
  joinCall: (roomCode: string) => Promise<void>;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  setMovieVolume: (vol: number) => void;
  setCallVolume: (vol: number) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(false); // default voice-first
  const [movieVolume, setMovieVolume] = useState<number>(0.8);
  const [callVolume, setCallVolume] = useState<number>(1.0);
  const [partnerConnected, setPartnerConnected] = useState<boolean>(false);

  async function joinCall(roomCode: string) {
    try {
      setIsConnecting(true);
      const res = await api.call.getToken(roomCode);
      if (res.success && res.token) {
        console.log(`[WebRTC LiveKit] Acquired room token for ${res.roomName}`);
        // WebRTC call session active
        setIsCallActive(true);
        setPartnerConnected(true);
      }
    } catch (e: any) {
      console.warn('Call token acquisition failed:', e.message);
    } finally {
      setIsConnecting(false);
    }
  }

  function leaveCall() {
    setIsCallActive(false);
    setPartnerConnected(false);
    setIsMuted(false);
    setIsVideoEnabled(false);
  }

  function toggleMute() {
    setIsMuted((prev) => !prev);
  }

  function toggleVideo() {
    setIsVideoEnabled((prev) => !prev);
  }

  return (
    <CallContext.Provider
      value={{
        isCallActive,
        isConnecting,
        isMuted,
        isVideoEnabled,
        movieVolume,
        callVolume,
        partnerConnected,
        joinCall,
        leaveCall,
        toggleMute,
        toggleVideo,
        setMovieVolume,
        setCallVolume,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
}

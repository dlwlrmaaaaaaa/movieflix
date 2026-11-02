import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConnectionState, Room, RoomEvent, Track, type VideoTrack } from 'livekit-client';
import { usePathname } from 'expo-router';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

interface CallContextType {
  isCallActive: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  movieVolume: number;
  callVolume: number;
  partnerConnected: boolean;
  isScreenSharing: boolean;
  screenShareTrack: VideoTrack | null;
  isSharedAudioMuted: boolean;
  audioPlaybackBlocked: boolean;
  callError: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  joinCall: (roomCode: string) => Promise<void>;
  leaveCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  startScreenShare: (roomCode: string) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleSharedAudioMute: () => void;
  resumeAudioPlayback: () => Promise<void>;
  setMovieVolume: (vol: number) => void;
  setCallVolume: (vol: number) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const pathname = usePathname();
  const inParty = pathname.startsWith('/room/') || pathname.startsWith('/party/');
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [movieVolume, setMovieVolume] = useState(0.8);
  const [callVolume, setCallVolume] = useState(1);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareTrack, setScreenShareTrack] = useState<VideoTrack | null>(null);
  const [isSharedAudioMuted, setIsSharedAudioMuted] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<CallContextType['connectionState']>('disconnected');
  const roomRef = useRef<Room | null>(null);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const audioElementsRef = useRef(new Map<HTMLMediaElement, boolean>());
  const sharedAudioMutedRef = useRef(false);

  const refreshScreenShare = (room: Room) => {
    const remoteTrack = Array.from(room.remoteParticipants.values())
      .map((participant) => participant.getTrackPublication(Track.Source.ScreenShare)?.track)
      .find(Boolean) as VideoTrack | undefined;
    const localTrack = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as VideoTrack | undefined;
    setScreenShareTrack(remoteTrack || localTrack || null);
    setIsScreenSharing(Boolean(remoteTrack || localTrack));
  };

  const removeAudioElements = () => {
    audioElementsRef.current.forEach((_isScreenAudio, element) => element.remove());
    audioElementsRef.current.clear();
  };

  useEffect(() => () => {
    removeAudioElements();
    void roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  async function joinCall(roomCode: string) {
    if (roomRef.current?.state === ConnectionState.Connected) return;
    if (connectPromiseRef.current) return connectPromiseRef.current;

    const connectPromise = (async () => {
      try {
        setIsConnecting(true);
        setConnectionState('connecting');
        setCallError(null);
        const res = await api.call.getToken(roomCode);
        if (!res.success || !res.token || !res.serverUrl) throw new Error('Could not connect to the screen-share room.');

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        const refreshParticipants = () => setPartnerConnected(room.remoteParticipants.size > 0);
        const refreshAudioStatus = () => setAudioPlaybackBlocked(!room.canPlaybackAudio);

        room.on(RoomEvent.ParticipantConnected, refreshParticipants);
        room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const element = track.attach();
            element.autoplay = true;
            const isScreenAudio = track.source === Track.Source.ScreenShareAudio;
            element.muted = sharedAudioMutedRef.current && isScreenAudio;
            element.style.display = 'none';
            document.body.appendChild(element);
            audioElementsRef.current.set(element, isScreenAudio);
          }
          refreshScreenShare(room);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((element) => {
            audioElementsRef.current.delete(element);
            element.remove();
          });
          refreshScreenShare(room);
        });
        room.on(RoomEvent.LocalTrackPublished, () => refreshScreenShare(room));
        room.on(RoomEvent.LocalTrackUnpublished, () => refreshScreenShare(room));
        room.on(RoomEvent.AudioPlaybackStatusChanged, refreshAudioStatus);
        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (state === ConnectionState.Connected) setConnectionState('connected');
          else if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) setConnectionState('reconnecting');
          else if (state === ConnectionState.Connecting) setConnectionState('connecting');
          else setConnectionState('disconnected');
        });
        room.on(RoomEvent.Disconnected, () => {
          removeAudioElements();
          setIsCallActive(false);
          setPartnerConnected(false);
          setScreenShareTrack(null);
          setIsScreenSharing(false);
          setConnectionState('disconnected');
        });

        await room.connect(res.serverUrl, res.token, { autoSubscribe: true, maxRetries: 3 });

        refreshParticipants();
        refreshScreenShare(room);
        refreshAudioStatus();
        setIsCallActive(true);
        setIsMuted(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to connect to the screen-share room.';
        setCallError(message);
        setConnectionState('failed');
        await roomRef.current?.disconnect().catch(() => undefined);
        roomRef.current = null;
        throw new Error(message);
      } finally {
        setIsConnecting(false);
        connectPromiseRef.current = null;
      }
    })();
    connectPromiseRef.current = connectPromise;
    return connectPromise;
  }

  async function leaveCall() {
    removeAudioElements();
    await roomRef.current?.disconnect().catch(() => undefined);
    roomRef.current = null;
    setIsCallActive(false);
    setIsConnecting(false);
    setPartnerConnected(false);
    setIsScreenSharing(false);
    setScreenShareTrack(null);
    setAudioPlaybackBlocked(false);
    setConnectionState('disconnected');
  }

  useEffect(() => { if (!token || !inParty) void leaveCall().catch(() => undefined); }, [token, inParty]);

  async function toggleMute() {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    const nextMuted = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setIsMuted(nextMuted);
  }

  async function toggleVideo() {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    const nextEnabled = !isVideoEnabled;
    await room.localParticipant.setCameraEnabled(nextEnabled);
    setIsVideoEnabled(nextEnabled);
  }

  async function startScreenShare(roomCode: string) {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('This browser does not support screen or tab capture.');
    if (roomRef.current?.state !== ConnectionState.Connected) await joinCall(roomCode);
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) throw new Error('Connect to the room before sharing.');
    try {
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true,
        video: { displaySurface: 'browser' },
        resolution: { width: 1920, height: 1080, frameRate: 30 },
        selfBrowserSurface: 'include',
        surfaceSwitching: 'include',
        systemAudio: 'include',
      });
      refreshScreenShare(room);
    } catch (error) {
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Screen sharing was cancelled or permission was denied.'
        : error instanceof Error ? error.message : 'Screen sharing is unavailable.';
      setCallError(message);
      setIsScreenSharing(false);
      throw new Error(message);
    }
  }

  async function stopScreenShare() {
    const room = roomRef.current;
    if (room?.state === ConnectionState.Connected && room.localParticipant.isScreenShareEnabled) {
      await room.localParticipant.setScreenShareEnabled(false);
    }
    if (room) refreshScreenShare(room);
  }

  function toggleSharedAudioMute() {
    const nextMuted = !isSharedAudioMuted;
    sharedAudioMutedRef.current = nextMuted;
    setIsSharedAudioMuted(nextMuted);
    audioElementsRef.current.forEach((isScreenAudio, element) => { if (isScreenAudio) element.muted = nextMuted; });
  }

  async function resumeAudioPlayback() {
    const room = roomRef.current;
    if (!room) return;
    await room.startAudio();
    setAudioPlaybackBlocked(!room.canPlaybackAudio);
  }

  return <CallContext.Provider value={{
    isCallActive, isConnecting, isMuted, isVideoEnabled, movieVolume, callVolume,
    partnerConnected, isScreenSharing, screenShareTrack, isSharedAudioMuted,
    audioPlaybackBlocked, callError, connectionState, joinCall, leaveCall,
    toggleMute, toggleVideo, startScreenShare, stopScreenShare,
    toggleSharedAudioMute, resumeAudioPlayback, setMovieVolume, setCallVolume,
  }}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
}

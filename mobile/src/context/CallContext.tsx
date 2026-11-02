import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { PermissionsAndroid, Platform, type Permission } from 'react-native';
import '../services/livekitGlobals';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';
import { ConnectionState, Room, RoomEvent, Track, type VideoTrack } from 'livekit-client';
import { usePathname } from 'expo-router';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { CallConnectionLifecycle } from '../services/callConnectionLifecycle';

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
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(false); // default voice-first
  const [movieVolume, setMovieVolume] = useState<number>(0.8);
  const [callVolume, setCallVolume] = useState<number>(1.0);
  const [partnerConnected, setPartnerConnected] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [screenShareTrack, setScreenShareTrack] = useState<VideoTrack | null>(null);
  const [isSharedAudioMuted, setIsSharedAudioMuted] = useState<boolean>(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<CallContextType['connectionState']>('disconnected');
  const livekitRoomRef = useRef<Room | null>(null);
  const connectionLifecycle = useRef(new CallConnectionLifecycle()).current;
  const connectedRoomCode = useRef<string | null>(null);
  const audioSessionStartedRef = useRef(false);

  useEffect(() => () => {
    // Wait for connect/publication to settle before closing its peer connection.
    void connectionLifecycle.stop(disconnectRoom).catch(() => undefined);
  }, [connectionLifecycle]);

  async function disconnectRoom() {
    const room = livekitRoomRef.current;
    livekitRoomRef.current = null;
    connectedRoomCode.current = null;
    room?.removeAllListeners();
    try { await room?.disconnect(); }
    finally {
      if (audioSessionStartedRef.current) await AudioSession.stopAudioSession();
      audioSessionStartedRef.current = false;
    }
  }

  async function requestPermission(permission: Permission, name: string): Promise<void> {
    if (Platform.OS !== 'android') return;

    const result = await PermissionsAndroid.request(permission, {
      title: `${name} permission needed`,
      message: `AnnahFlix needs access to your ${name.toLowerCase()} for calls.`,
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });

    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(`${name} permission was not granted.`);
    }
  }

  function joinCall(roomCode: string): Promise<void> {
    return connectionLifecycle.run(roomCode, async (isCurrent) => {
      const existing = livekitRoomRef.current;
      if (existing && existing.state !== ConnectionState.Disconnected) {
        if (connectedRoomCode.current !== roomCode) throw new Error('Leave the current call before connecting to another room.');
        if (existing.state === ConnectionState.Connected || existing.state === ConnectionState.Reconnecting || existing.state === ConnectionState.SignalReconnecting) return;
      }
      setIsConnecting(true);
      setConnectionState('connecting');
      setCallError(null);
      let connected = false;
      let room: Room | null = null;
      try {
        await disconnectRoom();
        if (!isCurrent()) return;
        const res = await api.call.getToken(roomCode);
        if (!isCurrent()) return;
        if (!res.success || !res.token || !res.serverUrl) throw new Error('Could not connect to the sharing room.');

        const livekitRoom = new Room();
        room = livekitRoom;
        livekitRoomRef.current = livekitRoom;
        connectedRoomCode.current = roomCode;
        const active = () => isCurrent() && livekitRoomRef.current === livekitRoom;
        const refreshScreenShare = () => {
          if (!active()) return;
          const remoteTrack = Array.from(livekitRoom.remoteParticipants.values())
            .map((participant) => participant.getTrackPublication(Track.Source.ScreenShare)?.track)
            .find(Boolean) as VideoTrack | undefined;
          const localTrack = livekitRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as VideoTrack | undefined;
          setScreenShareTrack(remoteTrack || localTrack || null);
          setIsScreenSharing(Boolean(localTrack));
        };
        const refreshParticipants = () => { if (active()) setPartnerConnected(livekitRoom.remoteParticipants.size > 0); };
        livekitRoom.on(RoomEvent.ParticipantConnected, refreshParticipants);
        livekitRoom.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
        livekitRoom.on(RoomEvent.TrackSubscribed, refreshScreenShare);
        livekitRoom.on(RoomEvent.TrackUnsubscribed, refreshScreenShare);
        livekitRoom.on(RoomEvent.LocalTrackPublished, refreshScreenShare);
        livekitRoom.on(RoomEvent.LocalTrackUnpublished, refreshScreenShare);
        livekitRoom.on(RoomEvent.Disconnected, () => {
          if (!active()) return;
          setIsCallActive(false);
          setPartnerConnected(false);
          setScreenShareTrack(null);
          setIsScreenSharing(false);
          setConnectionState('disconnected');
        });
        livekitRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (!active()) return;
          if (state === ConnectionState.Connected) setConnectionState('connected');
          else if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) setConnectionState('reconnecting');
          else if (state === ConnectionState.Connecting) setConnectionState('connecting');
          else setConnectionState('disconnected');
        });
        await AudioSession.configureAudio({ android: { audioTypeOptions: AndroidAudioTypePresets.communication } });
        if (!isCurrent()) return;
        await AudioSession.startAudioSession();
        audioSessionStartedRef.current = true;
        if (!isCurrent()) return;
        await livekitRoom.connect(res.serverUrl, res.token, { autoSubscribe: true, maxRetries: 2 });
        if (!active()) return;
        if (livekitRoom.state !== ConnectionState.Connected) throw new Error('The sharing connection closed. Tap Connect to Share to retry.');
        // Joining/subscribing does not require publishing a microphone track.
        // Request microphone permission only when the user explicitly unmutes.
        connected = true;
        setIsMuted(true);
        setIsVideoEnabled(false);
        refreshParticipants();
        refreshScreenShare();
        setConnectionState('connected');
        setIsCallActive(true);
      } catch (error) {
        if (!isCurrent()) return;
        const message = error instanceof Error ? error.message : 'Unable to connect to the sharing room.';
        setIsCallActive(false);
        setCallError(message);
        setConnectionState('failed');
        throw new Error(message);
      } finally {
        // connect() has settled before cleanup; stale listeners cannot affect a retry.
        if (!connected && (!room || livekitRoomRef.current === room)) await disconnectRoom().catch(() => undefined);
        if (isCurrent()) setIsConnecting(false);
      }
    });
  }

  async function leaveCall() {
    await connectionLifecycle.stop(disconnectRoom);
    setIsCallActive(false);
    setIsConnecting(false);
    setConnectionState('disconnected');
    setPartnerConnected(false);
    setIsMuted(true);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setScreenShareTrack(null);
    setIsSharedAudioMuted(false);
    setCallError(null);
  }

  useEffect(() => { if (!token || !inParty) void leaveCall().catch(() => undefined); }, [token, inParty]);

  async function toggleMute() {
    const code = connectedRoomCode.current;
    if (!code) return;
    return connectionLifecycle.run(code, async (isCurrent) => {
      const room = livekitRoomRef.current;
      if (!room || room.state !== ConnectionState.Connected) return;
      const nextMuted = room.localParticipant.isMicrophoneEnabled;
      try {
        if (!nextMuted) await requestPermission(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, 'Microphone');
        if (!isCurrent() || livekitRoomRef.current !== room) return;
        await room.localParticipant.setMicrophoneEnabled(!nextMuted);
        if (isCurrent()) setIsMuted(nextMuted);
      } catch (error) {
        if (!isCurrent()) return;
        const message = error instanceof Error ? error.message : 'Unable to change microphone state.';
        setCallError(message);
        return;
      }
    });
  }

  async function toggleVideo() {
    const code = connectedRoomCode.current;
    if (!code || !isCallActive) return;
    return connectionLifecycle.run(code, async (isCurrent) => {
      const room = livekitRoomRef.current;
      if (!room || room.state !== ConnectionState.Connected) return;
      const nextEnabled = !isVideoEnabled;
      try {
        if (nextEnabled) await requestPermission(PermissionsAndroid.PERMISSIONS.CAMERA, 'Camera');
        if (!isCurrent() || livekitRoomRef.current !== room) return;
        await room.localParticipant.setCameraEnabled(nextEnabled);
        if (isCurrent()) setIsVideoEnabled(nextEnabled);
      } catch (error) {
        if (isCurrent()) setCallError(error instanceof Error ? error.message : 'Unable to change camera state.');
      }
    });
  }

  async function startScreenShare(roomCode: string) {
    if (Platform.OS === 'ios') throw new Error('iOS screen sharing requires a native Broadcast Upload Extension, which is not included in this Expo build yet.');
    await joinCall(roomCode);
    return connectionLifecycle.run(roomCode, async (isCurrent) => {
      const room = livekitRoomRef.current;
      if (!isCurrent() || !room || room.state !== ConnectionState.Connected) throw new Error('Connect the room call before sharing your screen.');
      try {
        await room.localParticipant.setScreenShareEnabled(true, { audio: true });
        if (!isCurrent() || livekitRoomRef.current !== room) return;
        const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as VideoTrack | undefined;
        setScreenShareTrack(track || null);
        setIsScreenSharing(Boolean(track));
      } catch (error) {
        if (!isCurrent()) return;
        const message = error instanceof Error ? error.message : 'Screen capture permission was denied or is unavailable.';
        setCallError(message);
        setIsScreenSharing(false);
        throw new Error(message);
      }
    });
  }

  async function stopScreenShare() {
    const code = connectedRoomCode.current;
    if (!code) return;
    return connectionLifecycle.run(code, async (isCurrent) => {
      const room = livekitRoomRef.current;
      if (room?.state === ConnectionState.Connected && room.localParticipant.isScreenShareEnabled) await room.localParticipant.setScreenShareEnabled(false);
      if (!isCurrent()) return;
      setIsScreenSharing(false);
      setScreenShareTrack(null);
    });
  }

  function toggleSharedAudioMute() {
    const nextMuted = !isSharedAudioMuted;
    setIsSharedAudioMuted(nextMuted);
    const room = livekitRoomRef.current;
    room?.remoteParticipants.forEach((participant) => {
      const track = participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track as any;
      track?.setVolume?.(nextMuted ? 0 : 1);
    });
  }

  async function resumeAudioPlayback() {
    // Native playback is managed by AudioSession. The web provider implements
    // LiveKit's user-gesture-based Room.startAudio() recovery.
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
        isScreenSharing,
        screenShareTrack,
        isSharedAudioMuted,
        audioPlaybackBlocked: false,
        callError,
        connectionState,
        joinCall,
        leaveCall,
        toggleMute,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
        toggleSharedAudioMute,
        resumeAudioPlayback,
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

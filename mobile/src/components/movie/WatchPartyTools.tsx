import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRoom } from '../../context/RoomContext';
import { useCall } from '../../context/CallContext';
import { useSocket } from '../../context/SocketContext';
import { Button } from '../ui/Button';
import { WhisperChatSheet } from '../couple/WhisperChatSheet';

/** Party features stay accessible here and never appear in Watch Only. */
export function WatchPartyTools() {
  const { room, isHost } = useRoom();
  const { socket } = useSocket();
  const { isCallActive, isConnecting, isScreenSharing, joinCall, startScreenShare, stopScreenShare, connectionState } = useCall();
  const [expanded, setExpanded] = useState(false);
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const observedShare = useRef(false);
  const code = room!.code;
  useEffect(() => {
    if (room?.playbackMode === 'SCREEN_SHARE' && !isHost && !isCallActive) void joinCall(code).catch(() => undefined);
  }, [code, room?.playbackMode, isHost]);
  useEffect(() => {
    if (!isHost) return;
    if (isScreenSharing) observedShare.current = true;
    else if (observedShare.current) { observedShare.current = false; socket?.emit('screen:stop', { roomCode: code }); }
  }, [code, isHost, isScreenSharing, socket]);
  const action = async (work: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await work(); } catch (failure: any) { setError(failure.message || 'Unable to connect.'); }
    finally { setBusy(false); }
  };
  const share = () => action(async () => {
    if (isScreenSharing) { observedShare.current = false; await stopScreenShare(); socket?.emit('screen:stop', { roomCode: code }); }
    else { await startScreenShare(code); socket?.emit('screen:start', { roomCode: code }); }
  });
  return <View style={{ gap: 12 }}>
    <Button title={expanded ? 'Hide party tools' : 'Party tools'} variant="secondary" onPress={() => setExpanded(!expanded)} />
    {expanded ? <View style={{ gap: 12 }}>
      <Button title="Room chat" variant="secondary" onPress={() => setChat(true)} />
      {!isCallActive ? <Button title="Connect voice / stream" variant="secondary" loading={isConnecting} disabled={busy || isConnecting} onPress={() => action(() => joinCall(code))} /> : null}
      {isHost ? <Button title={isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share'} variant="secondary" disabled={busy || !isCallActive} onPress={share} /> : null}
      <Text style={{ color: '#999', fontSize: 11, lineHeight: 18 }}>{connectionState === 'connected' ? 'Voice / stream connected.' : 'Connect before starting capture.'} {Platform.OS === 'web' ? 'Choose the movie tab and enable tab audio in the browser picker.' : 'Approve device capture when prompted; audio support depends on Android and the selected content.'} Protected content restrictions are respected.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: '#f08a8a', fontSize: 12 }}>{error}</Text> : null}
    </View> : null}
    <WhisperChatSheet visible={chat} onClose={() => setChat(false)} />
  </View>;
}

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { useRoom } from '../context/RoomContext';

/** Restore a room from its URL after refresh; joining never creates a room. */
export function useRoomSession(code: string) {
  const { user, isLoading } = useAuth();
  const { room, joinRoom } = useRoom();
  const { leaveCall } = useCall();
  useEffect(() => { if (room?.status === 'ENDED') void leaveCall(); }, [room?.status]);
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    if (isLoading) return;
    if (!/^TF-[2-9A-HJ-NP-Z]{4}$/.test(code)) { setError('Invalid room code.'); return; }
    if (!user) { router.replace(`/(auth)/login?partyCode=${encodeURIComponent(code)}` as any); return; }
    if (room?.code === code) return;
    let active = true;
    setError('');
    joinRoom(code).catch((failure) => { if (active) setError(failure.message || 'Unable to restore this room.'); });
    return () => { active = false; };
  }, [code, user?.id, isLoading, room?.code]);
  return { loading: isLoading || room?.code !== code, error: room?.code === code && room.status === 'ENDED' ? 'This watch party has ended.' : error };
}

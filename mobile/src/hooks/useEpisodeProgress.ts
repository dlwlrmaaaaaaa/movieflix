import { useCallback, useEffect, useRef, useState } from 'react';
import { dramas } from '../services/dramas';
export function useEpisodeProgress(episodeId?: string, periodic = true) {
  const session = useRef<{ id: string; sequence: number } | null>(null);
  const latest = useRef({ position: 0, duration: 0 });
  const [resume, setResume] = useState<number | null>(null);
  const [error, setError] = useState('');
  const flush = useCallback((position?: number, duration?: number) => {
    if (position !== undefined && duration !== undefined) latest.current = { position, duration };
    const current = session.current;
    if (!episodeId || !current || latest.current.duration <= 0) return;
    void dramas.progress(episodeId, current.id, ++current.sequence, latest.current.position, latest.current.duration).catch((failure) => setError(failure.message || 'Progress could not be saved.'));
  }, [episodeId]);
  useEffect(() => {
    let active = true; session.current = null; setResume(null); setError(''); latest.current = { position: 0, duration: 0 };
    if (!episodeId) return;
    dramas.progressSession(episodeId).then((result) => { if (active) { session.current = { id: result.sessionId, sequence: 0 }; setResume(result.positionSeconds); } }).catch((failure) => { if (active) { setError(failure.message); setResume(0); } });
    const timer = periodic ? setInterval(() => flush(), 15000) : undefined;
    return () => { active = false; if (timer) clearInterval(timer); flush(); session.current = null; };
  }, [episodeId, flush, periodic]);
  const timeline = (position: number, duration: number) => { latest.current = { position, duration }; };
  return { resume, flush, timeline, error };
}

/** Centralized authorization and late-join state rules for room sockets. */
export function canHostControl(hostId: string, userId: string): boolean {
  return hostId === userId;
}

/** Restore the room to its usable non-screen-share mode after the host leaves. */
export function screenShareFallbackMode(hasSelectedMovie: boolean, hasIframe = false): 'DIRECT' | 'IFRAME' | 'MANUAL' {
  return hasSelectedMovie ? 'DIRECT' : hasIframe ? 'IFRAME' : 'MANUAL';
}

export function lateJoinPlayback(position: number, isPlaying: boolean) {
  return {
    action: isPlaying ? 'PLAY' as const : 'PAUSE' as const,
    position: Math.max(0, position),
    isPlaying,
  };
}

/** The host may only schedule an initial start after both private-room viewers are ready. */
export function canStartSynchronizedPlayback(
  participantIds: Array<string | null | undefined>,
  viewerStates: Array<{ userId: string; selectedMovieId: string; state: string }>,
  selectedMovieId: string | null | undefined,
): boolean {
  const users = participantIds.filter((id): id is string => Boolean(id));
  return Boolean(selectedMovieId) && users.length === 2 && users.every((userId) =>
    viewerStates.some((viewer) => viewer.userId === userId && viewer.selectedMovieId === selectedMovieId && viewer.state === 'READY')
  );
}

/** Converts an authoritative server timestamp into the position a late joiner should load. */
export function expectedPlaybackPosition(position: number, isPlaying: boolean, lastUpdatedServerTime: number, now = Date.now()): number {
  return Math.max(0, position + (isPlaying ? Math.max(0, now - lastUpdatedServerTime) / 1000 : 0));
}

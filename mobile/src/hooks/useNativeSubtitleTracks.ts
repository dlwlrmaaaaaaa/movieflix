import { useEffect, useRef } from 'react';
import type { VideoPlayer } from 'expo-video';
import type { PlayerSubtitleTrack, SubtitlePlayerProps } from '../services/subtitleTracks';

type SubtitleBridge = { annahSubtitleTracks?: PlayerSubtitleTrack[]; annahSubtitleTrackId?: string | null };
export function useNativeSubtitleTracks(player: VideoPlayer, sourceKey: string, options: SubtitlePlayerProps) {
  const callback = useRef(options.onSubtitleTracks); callback.current = options.onSubtitleTracks;
  const selection = useRef(options.nativeSubtitleId); selection.current = options.nativeSubtitleId;
  useEffect(() => {
    if (!callback.current && selection.current === undefined) return;
    const bridge = player as VideoPlayer & SubtitleBridge;
    let previous = ''; let applied: string | null | undefined;
    const update = () => {
      try {
        const tracks = bridge.annahSubtitleTracks;
        const supported = Array.isArray(tracks);
        const desired = selection.current;
        // Tracks may appear after readyToPlay (live HLS / DASH). Retry selection
        // when discovered, without recreating or seeking the video player.
        if (supported && desired !== undefined && desired !== applied && (desired === null || tracks.some((track) => track.id === desired))) {
          bridge.annahSubtitleTrackId = desired; applied = desired;
        }
        const state = { supported, tracks: supported ? tracks : [] };
        const signature = JSON.stringify(state);
        if (signature !== previous) { previous = signature; callback.current?.(state); }
      } catch { if (previous !== 'unsupported') { previous = 'unsupported'; callback.current?.({ supported: false, tracks: [] }); } }
    };
    update(); const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [player, sourceKey]);
  useEffect(() => {
    try {
      const bridge = player as VideoPlayer & SubtitleBridge;
      if (options.nativeSubtitleId !== undefined && Array.isArray(bridge.annahSubtitleTracks)) bridge.annahSubtitleTrackId = options.nativeSubtitleId;
    } catch { /* An older APK can still use imported external subtitles. */ }
  }, [player, options.nativeSubtitleId]);
}

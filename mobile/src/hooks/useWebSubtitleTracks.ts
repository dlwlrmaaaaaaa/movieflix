import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { SubtitlePlayerProps } from '../services/subtitleTracks';

export function useWebSubtitleTracks(element: RefObject<HTMLVideoElement | null>, sourceKey: string, options: SubtitlePlayerProps) {
  const callback = useRef(options.onSubtitleTracks); callback.current = options.onSubtitleTracks;
  const selection = useRef(options.nativeSubtitleId); selection.current = options.nativeSubtitleId;
  useEffect(() => {
    const video = element.current;
    if (!video) return;
    let signature = '';
    const update = () => {
      const tracks = Array.from(video.textTracks).filter((track) => track.kind === 'subtitles' || track.kind === 'captions');
      if (selection.current !== undefined) tracks.forEach((track, index) => { const mode = String(index) === selection.current ? 'showing' : 'disabled'; if (track.mode !== mode) track.mode = mode; });
      const state = { supported: true, tracks: tracks.map((track, index) => ({ id: String(index), language: track.language || 'und', label: track.label || track.language || 'Subtitles', format: 'browser text track', selected: track.mode === 'showing' })) };
      const next = JSON.stringify(state); if (next !== signature) { signature = next; callback.current?.(state); }
    };
    update(); video.textTracks.addEventListener('addtrack', update); video.textTracks.addEventListener('removetrack', update); video.textTracks.addEventListener('change', update);
    const timer = setInterval(update, 1000);
    return () => { clearInterval(timer); video.textTracks.removeEventListener('addtrack', update); video.textTracks.removeEventListener('removetrack', update); video.textTracks.removeEventListener('change', update); };
  }, [element, sourceKey]);
}

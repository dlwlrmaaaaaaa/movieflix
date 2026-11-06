import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  uri: string; initialPosition?: number; subtitleOverlay?: React.ReactNode;
  onProgress: (position: number, duration: number) => void;
  onPosition?: (position: number) => void; onTimeline?: (position: number, duration: number) => void;
  onError?: (message: string) => void; onEnded?: () => void;
}
export function SoloVideoPlayer({ uri, initialPosition = 0, subtitleOverlay, ...callbacks }: Props) {
  const element = useRef<HTMLVideoElement | null>(null); const frame = useRef<View>(null);
  const latest = useRef(callbacks); latest.current = callbacks;
  const [blocked, setBlocked] = useState(false);
  const sample = () => {
    const video = element.current;
    if (video) { latest.current.onPosition?.(video.currentTime); latest.current.onTimeline?.(video.currentTime, Number.isFinite(video.duration) ? video.duration : 0); }
  };
  const flush = () => { const video = element.current; if (video && Number.isFinite(video.duration) && video.duration > 0) latest.current.onProgress(video.currentTime, video.duration); };
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => { sample(); if (++tick % 60 === 0) flush(); }, 250);
    const leave = () => flush(); window.addEventListener('pagehide', leave);
    return () => { flush(); clearInterval(timer); window.removeEventListener('pagehide', leave); };
  }, [uri]);
  return <View ref={frame} style={styles.frame}>{React.createElement('video', {
    ref: element, src: uri, controls: true, playsInline: true, autoPlay: true, preload: 'auto',
    controlsList: 'nofullscreen', disablePictureInPicture: !!subtitleOverlay,
    onLoadedMetadata: () => { if (element.current) { element.current.currentTime = initialPosition; void element.current.play().catch(() => setBlocked(true)); } },
    onEnded: () => { sample(); flush(); latest.current.onEnded?.(); }, onPause: flush,
    onError: () => latest.current.onError?.('This source could not be played in this browser. Retry or use the Android app.'),
    style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' },
  })}{subtitleOverlay}<TouchableOpacity style={styles.button} onPress={() => { const target = frame.current as unknown as HTMLElement; void target?.requestFullscreen?.().catch(() => latest.current.onError?.('Fullscreen is unavailable.')); }}><Text style={styles.text}>Fullscreen</Text></TouchableOpacity>{blocked ? <TouchableOpacity style={styles.play} onPress={() => void element.current?.play().then(() => setBlocked(false))}><Text style={styles.text}>Tap to play</Text></TouchableOpacity> : null}</View>;
}
const styles = StyleSheet.create({ frame: { flex: 1, width: '100%', backgroundColor: '#000', minHeight: 240 }, button: { position: 'absolute', right: 12, top: 12, padding: 10, backgroundColor: '#222c' }, text: { color: '#fff' }, play: { position: 'absolute', alignSelf: 'center', top: '40%', backgroundColor: '#222', padding: 20 } });

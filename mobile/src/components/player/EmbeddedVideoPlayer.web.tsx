import React from 'react';
import type { EmbeddedVideoPlayerProps } from './EmbeddedVideoPlayer';

export function EmbeddedVideoPlayer({ url, title, onLoad, onError, allowFullscreen = true }: EmbeddedVideoPlayerProps) {
  return React.createElement('iframe', {
    src: url,
    title,
    allow: `autoplay; ${allowFullscreen ? 'fullscreen; ' : ''}picture-in-picture; encrypted-media`,
    allowFullScreen: allowFullscreen,
    loading: 'eager',
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-presentation',
    referrerPolicy: 'strict-origin-when-cross-origin',
    onLoad,
    onError: () => onError?.('The embedded player failed to load.'),
    style: { width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
  });
}

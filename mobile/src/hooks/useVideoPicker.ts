import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { LocalMovieFile } from '../context/RoomContext';

export function useVideoPicker() {
  const [isPicking, setIsPicking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function pickVideo(): Promise<LocalMovieFile | null> {
    try {
      setIsPicking(true);
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: false, // directly access file without duplicating multi-gigabyte file
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const name = asset.name || 'movie.mp4';
      const uri = asset.uri;
      const size = asset.size;

      // Approximate fallback duration heuristic from size if metadata is probed later by video player
      // (e.g. 1080p standard bitrate ~ 2500 kbps: size / (2500 * 1000 / 8) -> duration)
      // The native player will immediately update with the exact microsecond duration upon loading.
      const estimatedDuration = size ? Math.round(size / (2500000 / 8)) : 7200;

      const file: LocalMovieFile = {
        uri,
        name,
        size: size || null,
        durationSeconds: estimatedDuration,
      };

      return file;
    } catch (err: any) {
      const msg = err.message || 'Failed to select video file.';
      setError(msg);
      return null;
    } finally {
      setIsPicking(false);
    }
  }

  return { pickVideo, isPicking, error };
}

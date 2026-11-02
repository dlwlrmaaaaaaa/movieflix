import { useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { CloudMovie } from '@togetherflix/shared';
import { LocalMovieFile } from '../context/RoomContext';
import { api } from '../services/api';

const RETRIES_PER_PART = 3;

function base64Bytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function useMovieUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const activeMovieIdRef = useRef<string | null>(null);

  async function upload(file: LocalMovieFile): Promise<CloudMovie> {
    if (!file.size) throw new Error('The selected file size is unavailable. Choose a file from device storage.');
    setError(null); setProgress(0); setUploadingName(file.name); cancelledRef.current = false;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : extension === 'mov' ? 'video/quicktime' : 'video/x-matroska';
    const started = await api.movies.initiateUpload({ title: file.name.replace(/\.[^.]+$/, ''), originalFilename: file.name, mimeType, fileSize: file.size });
    activeMovieIdRef.current = started.movie.id;
    const parts: Array<{ partNumber: number; eTag: string }> = [];
    const partCount = Math.ceil(file.size / started.partSizeBytes);
    try {
      for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
        if (cancelledRef.current) throw new Error('Upload cancelled.');
        const position = (partNumber - 1) * started.partSizeBytes;
        const length = Math.min(started.partSizeBytes, file.size - position);
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64, position, length });
        const body = base64Bytes(base64);
        let uploadError: Error | null = null;
        for (let attempt = 0; attempt < RETRIES_PER_PART; attempt += 1) {
          try {
            const { uploadUrl } = await api.movies.signPart(started.movie.id, partNumber);
            const response = await fetch(uploadUrl, { method: 'PUT', body, headers: { 'Content-Type': mimeType } });
            const eTag = response.headers.get('etag');
            if (!response.ok || !eTag) throw new Error(`Part ${partNumber} failed (${response.status}).`);
            parts.push({ partNumber, eTag }); uploadError = null; break;
          } catch (caught: any) { uploadError = caught instanceof Error ? caught : new Error('Upload failed.'); }
        }
        if (uploadError) throw uploadError;
        setProgress(Math.round((partNumber / partCount) * 100));
      }
      const complete = await api.movies.completeUpload(started.movie.id, parts);
      return complete.movie;
    } catch (caught) {
      await api.movies.cancelUpload(started.movie.id).catch(() => undefined);
      throw caught;
    } finally {
      activeMovieIdRef.current = null; setUploadingName(null); setProgress(null);
    }
  }

  async function cancel() {
    cancelledRef.current = true;
    if (activeMovieIdRef.current) await api.movies.cancelUpload(activeMovieIdRef.current).catch(() => undefined);
  }

  return { upload, cancel, progress, uploadingName, error, setError };
}

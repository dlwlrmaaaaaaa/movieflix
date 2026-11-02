import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export interface PickedMpdFile {
  name: string;
  xml: string;
}

const MAX_MANIFEST_BYTES = 1024 * 1024;

/** Picks a small manifest only; video segments always remain at their authorized origin. */
export function useMpdPicker() {
  const [isPickingMpd, setIsPickingMpd] = useState(false);
  const [mpdPickerError, setMpdPickerError] = useState<string | null>(null);

  async function pickMpd(): Promise<PickedMpdFile | null> {
    try {
      setIsPickingMpd(true);
      setMpdPickerError(null);
      const result = await DocumentPicker.getDocumentAsync({
        // Android file providers commonly expose downloaded .mpd files as
        // application/octet-stream (or no MIME type), which makes a strict
        // DASH MIME filter show the file but disable tapping it. Select any
        // document here; the filename and backend XML checks remain strict.
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return null;
      const asset = result.assets[0];
      const name = asset.name || 'manifest.mpd';
      if (!/\.mpd$/i.test(name)) throw new Error('Select an MPEG-DASH manifest with a .mpd filename.');
      if (asset.size && asset.size > MAX_MANIFEST_BYTES) throw new Error('MPD manifest must be 1 MB or smaller.');
      const xml = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      if (!xml.trim()) throw new Error('Selected MPD file is empty.');
      return { name, xml };
    } catch (error: any) {
      setMpdPickerError(error?.message || 'Unable to read the MPD manifest.');
      return null;
    } finally {
      setIsPickingMpd(false);
    }
  }

  return { pickMpd, isPickingMpd, mpdPickerError };
}

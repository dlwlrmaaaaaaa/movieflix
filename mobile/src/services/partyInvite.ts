import { Platform, Share } from 'react-native';

export function partyInviteUrl(code: string): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
  const base = configured || origin || process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  return base ? `${base}/party/${encodeURIComponent(code)}` : `togetherflix://party/${encodeURIComponent(code)}`;
}

export async function copyPartyText(text: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // Native platforms retain the OS share/copy sheet without adding a dependency.
  await Share.share({ message: text });
  return false;
}

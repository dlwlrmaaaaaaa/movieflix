import type { SubtitleCue } from '@togetherflix/shared';
export interface PlayerSubtitleTrack {
  id: string; language: string; label: string; format: string; selected: boolean;
}
export interface PlayerSubtitleState { supported: boolean; tracks: PlayerSubtitleTrack[] }
export interface SubtitlePlayerProps {
  /** undefined preserves the native default; null explicitly turns native text off. */
  nativeSubtitleId?: string | null;
  onSubtitleTracks?: (state: PlayerSubtitleState) => void;
}
export function subtitleLanguage(language: string): string {
  const value = language.toLowerCase().replace(/_/g, '-');
  if (['zh-cn', 'zh-sg', 'zho-hans', 'zh-hans'].includes(value)) return 'zh-hans';
  if (['zh-tw', 'zh-hk', 'zho-hant', 'zh-hant'].includes(value)) return 'zh-hant';
  const base = value.split('-')[0];
  return ({ eng: 'en', kor: 'ko', tl: 'fil', tgl: 'fil', zho: 'zh', chi: 'zh' } as Record<string, string>)[base] || base;
}
export function subtitleLanguageMatches(trackLanguage: string, preference: string): boolean {
  return subtitleLanguage(trackLanguage) === subtitleLanguage(preference);
}
export function subtitleLabel(language: string, fallback?: string): string {
  const known: Record<string, string> = { en: 'English', fil: 'Filipino', ko: 'Korean', 'zh-hans': 'Chinese Simplified', 'zh-hant': 'Chinese Traditional', zh: 'Chinese' };
  return known[subtitleLanguage(language)] || fallback || language || 'Subtitles';
}
export function activeSubtitleText(cues: readonly SubtitleCue[], position: number, offset = 0): string {
  if (!Number.isFinite(position) || !Number.isFinite(offset)) return '';
  const time = position - offset;
  return cues.filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.start <= time && cue.end > time).map((cue) => cue.text).join('\n');
}

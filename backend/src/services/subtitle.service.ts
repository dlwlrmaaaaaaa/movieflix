import type { SubtitleCue } from '@togetherflix/shared';

export const SUBTITLE_LANGUAGES = ['en', 'fil', 'ko', 'zh-Hans', 'zh-Hant'] as const;
export function validSubtitleLanguage(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(value);
}
function timestamp(value: string): number {
  const match = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)[.,](\d{3})$/.exec(value);
  if (!match) throw new Error('Invalid subtitle timestamp.');
  const result = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
  if (result > 86400) throw new Error('Subtitle timestamp exceeds 24 hours.');
  return result;
}
function vttTime(value: number) {
  const ms = Math.round(value * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
/** Admin supplies UTF-8 subtitle text. Never fetch arbitrary subtitle URLs on the server. */
export function normalizeSubtitles(input: unknown): { vtt: string; cues: SubtitleCue[] } {
  if (typeof input !== 'string' || Buffer.byteLength(input, 'utf8') > 1024 * 1024 || input.includes('\uFFFD') || input.includes('\0')) throw new Error('Supply a valid UTF-8 subtitle file up to 1 MB.');
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const blocks = text.replace(/^WEBVTT[^\n]*(?:\n(?:Kind|Language):[^\n]*)*(?:\n|$)/i, '').trim().split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    if (!block.trim() || /^(NOTE|STYLE|REGION)(\s|$)/.test(block)) continue;
    const lines = block.split('\n');
    const index = lines.findIndex((line) => line.includes('-->'));
    if (index < 0 || index > 1) throw new Error('Subtitle cue is missing a timestamp.');
    const match = /^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines[index]);
    if (!match) throw new Error('Malformed subtitle timing.');
    const start = timestamp(match[1]); const end = timestamp(match[2]);
    const content = lines.slice(index + 1).join('\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (end <= start || !content || content.length > 4000) throw new Error('Invalid subtitle cue duration or text.');
    cues.push({ start, end, text: content });
    if (cues.length > 20000) throw new Error('Too many subtitle cues.');
  }
  if (!cues.length) throw new Error('No subtitle cues found.');
  cues.sort((a, b) => a.start - b.start);
  return { cues, vtt: `WEBVTT\n\n${cues.map((cue, i) => `${i + 1}\n${vttTime(cue.start)} --> ${vttTime(cue.end)}\n${cue.text.replace(/-->/g, '→')}`).join('\n\n')}\n` };
}

import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns/promises';
import { isPrivateAddress, parsePublicStreamUrl } from './streamValidation';
import { normalizeSubtitles } from './subtitle.service';

const MAX_BYTES = 1024 * 1024;
const SUBTITLE_MIME_TYPES = new Set(['text/vtt', 'application/x-subrip', 'application/srt', 'text/srt', 'text/plain']);
export function validateSubtitleMime(contentType: string, pathname: string) {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  if (!SUBTITLE_MIME_TYPES.has(mime) && !(mime === 'application/octet-stream' && /\.(srt|vtt)$/i.test(pathname))) throw new Error('The URL must return a VTT or SRT subtitle file, not a webpage.');
  const charset = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(contentType)?.[1]?.toLowerCase();
  if (charset && !['utf-8', 'utf8', 'us-ascii'].includes(charset)) throw new Error('Convert this subtitle file to UTF-8 before importing.');
}
/** Import once, as an admin. Playback uses saved cues, so URL expiry and browser
 * CORS do not interrupt captions. Never proxy authenticated pages or redirects. */
export async function importRemoteSubtitle(rawUrl: unknown) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 8192) throw new Error('Enter a direct authorized subtitle URL.');
  const url = parsePublicStreamUrl(rawUrl);
  // URL.hostname retains brackets for IPv6 literals; normalize before lookup.
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((address) => isPrivateAddress(address.address))) throw new Error('Subtitle URL must use a public host.');
  const address = addresses.find((entry) => entry.family === 4) || addresses[0];
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      headers: { Accept: 'text/vtt, application/x-subrip, text/plain', 'Accept-Encoding': 'identity' },
      // Pin the checked address. TLS still verifies the original hostname.
      lookup: (_name, options, done) => options.all ? done(null, [address]) : done(null, address.address, address.family),
    }, (response) => {
      const fail = (message: string) => { response.destroy(); reject(new Error(message)); };
      if (response.statusCode === 401 || response.statusCode === 403) return fail('The subtitle URL denied access or expired. Supply a current authorized URL.');
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) return fail('Subtitle redirects are not followed. Supply the direct file URL.');
      if (response.statusCode !== 200) return fail('The subtitle file could not be downloaded.');
      try { validateSubtitleMime(String(response.headers['content-type'] || ''), url.pathname); } catch (error) { response.destroy(); reject(error); return; }
      if (Number(response.headers['content-length'] || 0) > MAX_BYTES) return fail('Subtitle file exceeds 1 MB.');
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_BYTES) fail('Subtitle file exceeds 1 MB.'); else chunks.push(chunk); });
      response.on('error', reject); response.on('aborted', () => reject(new Error('Subtitle download was interrupted.')));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    const timeout = setTimeout(() => request.destroy(new Error('Subtitle download timed out.')), 7000);
    request.once('close', () => clearTimeout(timeout)); request.once('error', reject);
  });
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Subtitle file must use valid UTF-8 encoding.'); }
  return normalizeSubtitles(text);
}

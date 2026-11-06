import dns from 'node:dns/promises';
import net from 'node:net';
import { ENV } from '../config/env';

export type StreamFormat = 'AUTO' | 'DASH' | 'HLS' | 'MP4' | 'WEBM';

export function isPrivateAddress(address: string): boolean {
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      const tail = normalized.slice(7);
      if (net.isIP(tail) === 4) return isPrivateAddress(tail);
      // Reject hexadecimal IPv4-mapped addresses rather than risk bypassing the IPv4 guard.
      return true;
    }
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) || normalized.startsWith('ff');
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return true;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 || parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127 || parts[0] === 169 && parts[1] === 254 ||
    parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

/** Syntactic SSRF guard. DNS results are checked separately before a server fetch. */
export function parsePublicStreamUrl(rawUrl: string): URL {
  let url: URL;
  try { url = new URL(rawUrl.trim()); } catch { throw new Error('Enter a valid streaming URL.'); }
  if (url.protocol !== 'https:' && !(ENV.ALLOW_HTTP_STREAMS && url.protocol === 'http:')) {
    throw new Error('Streaming URLs must use HTTPS. Set ALLOW_HTTP_STREAMS=true only for local development.');
  }
  if (url.username || url.password) throw new Error('Streaming URLs cannot contain embedded credentials.');
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || (net.isIP(host) && isPrivateAddress(host))) {
    throw new Error('Streaming URL must use a public host.');
  }
  return url;
}

export function detectStreamFormat(url: URL, selected: StreamFormat = 'AUTO', contentType = ''): Exclude<StreamFormat, 'AUTO'> {
  const path = url.pathname.toLowerCase();
  const type = contentType.toLowerCase();
  const detected: Exclude<StreamFormat, 'AUTO'> | null = path.endsWith('.mpd') || type.includes('dash+xml') ? 'DASH'
    : path.endsWith('.m3u8') || type.includes('mpegurl') ? 'HLS'
      : path.endsWith('.mp4') || type.startsWith('video/mp4') ? 'MP4'
        : path.endsWith('.webm') || type.startsWith('video/webm') ? 'WEBM' : null;
  if (selected !== 'AUTO' && detected && selected !== detected) {
    throw new Error(`The streaming URL does not appear to be ${selected === 'DASH' ? 'an MPEG-DASH (.mpd)' : selected === 'HLS' ? 'an HLS (.m3u8)' : selected === 'WEBM' ? 'a WebM' : 'an MP4'} source.`);
  }
  return selected === 'AUTO' ? detected || 'MP4' : selected;
}

/**
 * Checks an admin-provided source without following redirects. Rejecting private
 * DNS targets prevents this endpoint being used as an internal-network proxy.
 */
export async function validateRemoteStream(rawUrl: string, selected: StreamFormat): Promise<{ url: string; format: Exclude<StreamFormat, 'AUTO'> }> {
  const url = parsePublicStreamUrl(rawUrl);
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error('Streaming host could not be verified as a public address.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'error', signal: controller.signal });
    // Some valid CDNs do not allow HEAD. A tiny ranged GET validates reachability
    // without downloading the movie or proxying it through this server.
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' }, redirect: 'error', signal: controller.signal });
    }
    if (response.status === 401 || response.status === 403) throw new Error('The streaming source denied access (401/403). Update its authorized URL before saving.');
    if (!response.ok) throw new Error(`Streaming source is not reachable (HTTP ${response.status}).`);
    return { url: url.toString(), format: detectStreamFormat(url, selected, response.headers.get('content-type') || '') };
  } catch (error: any) {
    if (error?.message?.startsWith('The streaming source') || error?.message?.startsWith('Streaming source is')) throw error;
    throw new Error('Unable to reach the streaming source. Check the URL, certificate, and authorization.');
  } finally {
    clearTimeout(timer);
  }
}

import { AuthorizedPlaybackSource, TmdbMovieDetails } from '@togetherflix/shared';
import { ENV } from '../config/env';
import { MemoryCache } from '../services/memoryCache';
import { VideoProvider, VideoProviderCandidate } from './VideoProvider';

const cache = new MemoryCache();

function scalar(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).find(Boolean) || '';
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function normalizeMovieTitle(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function releaseYear(value: unknown): number | null {
  const match = scalar(value).match(/(?:^|\D)(18|19|20)\d{2}(?:\D|$)/);
  return match ? Number(match[0].match(/\d{4}/)?.[0]) : null;
}

function acceptedLicense(rawUrl: unknown): { name: string; url: string } | null {
  const value = scalar(rawUrl).trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (host === 'creativecommons.org' && (path.startsWith('/licenses/') || path.startsWith('/publicdomain/'))) {
      return { name: path.includes('/publicdomain/') ? 'Public Domain' : 'Creative Commons', url: url.toString() };
    }
    if (host === 'rightsstatements.org' && path.toLowerCase().includes('/noc-')) {
      return { name: 'No Copyright', url: url.toString() };
    }
  } catch {
    return null;
  }
  return null;
}

export function isRecognizedLicenseUrl(rawUrl: unknown): boolean {
  return acceptedLicense(rawUrl) !== null;
}

function archiveDownloadUrl(identifier: string, name: string): string {
  const encodedName = name.split('/').map(encodeURIComponent).join('/');
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodedName}`;
}

export class InternetArchiveProvider implements VideoProvider {
  readonly id = 'internet_archive';

  async search(movie: TmdbMovieDetails): Promise<VideoProviderCandidate[]> {
    if (!movie.releaseYear) return [];
    const title = movie.title.replace(/["\\]/g, ' ').trim();
    const url = new URL('https://archive.org/advancedsearch.php');
    url.searchParams.set('q', `title:("${title}") AND mediatype:movies AND year:${movie.releaseYear}`);
    ['identifier', 'title', 'year', 'licenseurl'].forEach((field) => url.searchParams.append('fl[]', field));
    url.searchParams.set('rows', '10');
    url.searchParams.set('page', '1');
    url.searchParams.set('output', 'json');
    const data: any = await this.fetchJson(url.toString(), 8000);
    const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
    return docs.map((doc: any) => ({
      id: scalar(doc.identifier),
      title: scalar(doc.title),
      releaseYear: releaseYear(doc.year),
      licenseUrl: scalar(doc.licenseurl) || null,
    })).filter((candidate: VideoProviderCandidate) =>
      /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(candidate.id)
      && normalizeMovieTitle(candidate.title) === normalizeMovieTitle(movie.title)
      && candidate.releaseYear === movie.releaseYear
      && acceptedLicense(candidate.licenseUrl)
    );
  }

  async getDetails(id: string): Promise<any> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(id)) throw new Error('Invalid Internet Archive identifier.');
    return this.fetchJson(`https://archive.org/metadata/${encodeURIComponent(id)}?extended_err=1`, 10000);
  }

  async getPlayableSources(candidate: VideoProviderCandidate, movie: TmdbMovieDetails): Promise<AuthorizedPlaybackSource[]> {
    const details = await this.getDetails(candidate.id);
    const metadata = details?.metadata || {};
    const license = acceptedLicense(metadata.licenseurl || candidate.licenseUrl);
    if (!license
      || scalar(metadata.mediatype).toLowerCase() !== 'movies'
      || normalizeMovieTitle(scalar(metadata.title)) !== normalizeMovieTitle(movie.title)
      || releaseYear(metadata.year || metadata.date) !== movie.releaseYear) return [];

    const files = Array.isArray(details.files) ? details.files : [];
    const playable = files.map((file: any) => {
      const name = scalar(file.name);
      const format = scalar(file.format).toLowerCase();
      const isMp4 = /\.mp4$/i.test(name) && (format.includes('mpeg4') || format.includes('h.264') || format.includes('512kb'));
      const isWebm = /\.webm$/i.test(name) || format.includes('webm');
      if ((!isMp4 && !isWebm) || name.includes('_thumb')) return null;
      return {
        providerId: 'internet_archive' as const,
        sourceId: candidate.id,
        title: movie.title,
        releaseYear: movie.releaseYear!,
        playbackUrl: archiveDownloadUrl(candidate.id, name),
        format: isMp4 ? 'MP4' as const : 'WEBM' as const,
        mimeType: isMp4 ? 'video/mp4' : 'video/webm',
        licenseName: license.name,
        licenseUrl: license.url,
        detailsUrl: `https://archive.org/details/${encodeURIComponent(candidate.id)}`,
        score: (isMp4 ? 10 : 0) + (scalar(file.source).toLowerCase() === 'original' ? 2 : 0) + Math.min(Number(file.size) || 0, 10_000_000_000) / 10_000_000_000,
      };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);

    const candidates: AuthorizedPlaybackSource[] = playable.slice(0, 3).map((entry: any) => {
      const { score: _score, ...source } = entry;
      return { ...source, sourceId: `${candidate.id}:${new URL(source.playbackUrl).pathname.split('/').pop()}` } as AuthorizedPlaybackSource;
    });
    const validation = await Promise.all(candidates.map((source: AuthorizedPlaybackSource) => this.validateSource(source)));
    return candidates.filter((_source: AuthorizedPlaybackSource, index: number) => validation[index]);
  }

  async validateSource(source: AuthorizedPlaybackSource): Promise<boolean> {
    try {
      const url = new URL(source.playbackUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'archive.org' || !url.pathname.startsWith('/download/')) return false;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
        const type = response.headers.get('content-type')?.toLowerCase() || '';
        return response.ok && (type.startsWith('video/') || /\.(mp4|webm)$/i.test(url.pathname));
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }

  private async fetchJson(url: string, timeoutMs: number): Promise<any> {
    const cached = cache.get<any>(url);
    if (cached) return cached;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`Internet Archive returned ${response.status}.`);
      return cache.set(url, await response.json(), ENV.INTERNET_ARCHIVE_CACHE_TTL_SECONDS);
    } finally {
      clearTimeout(timer);
    }
  }
}

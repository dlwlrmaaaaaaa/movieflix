import { prisma } from '../prisma';
import { MovieSourceType, MovieStatus } from '@prisma/client';
import { AuthorizedPlaybackSource, CloudMovie, TmdbMovieDetails } from '@togetherflix/shared';
import { ENV } from '../config/env';
import { R2Service } from './r2.service';
import { StreamFormat, validateRemoteStream } from './streamValidation';
import { validateImportedMpd } from './mpdImport.service';

const PART_SIZE_BYTES = 8 * 1024 * 1024;
const supportedMimeTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']);

export class MovieService {
  static format(movie: any): CloudMovie {
    return { id: movie.id, ownerId: movie.ownerId, title: movie.title, originalFilename: movie.originalFilename, mimeType: movie.mimeType, fileSize: Number(movie.fileSize), status: movie.status, sourceType: movie.sourceType, streamingFormat: movie.streamingFormat, description: movie.description, durationSeconds: movie.durationSeconds, posterUrl: movie.posterUrl || (movie.posterKey ? `/api/movies/${movie.id}/poster` : null), tmdbId: movie.tmdbId, providerId: movie.providerId, providerSourceId: movie.providerSourceId, licenseUrl: movie.licenseUrl, createdAt: movie.createdAt.toISOString(), updatedAt: movie.updatedAt.toISOString() };
  }

  static async createAuthorizedProviderMovie(ownerId: string, movie: TmdbMovieDetails, source: AuthorizedPlaybackSource) {
    if (source.providerId !== 'internet_archive' || !source.playbackUrl.startsWith('https://archive.org/download/')) {
      throw new Error('The selected provider source is not authorized.');
    }
    const record = await prisma.movie.create({
      data: {
        ownerId,
        title: movie.title,
        description: movie.overview || null,
        durationSeconds: movie.runtimeMinutes ? movie.runtimeMinutes * 60 : null,
        posterUrl: movie.posterUrl,
        originalFilename: new URL(source.playbackUrl).pathname.split('/').pop() || `${movie.title}.${source.format.toLowerCase()}`,
        storageKey: `provider/${source.providerId}/${source.sourceId}/${Date.now()}`,
        mimeType: source.mimeType,
        fileSize: BigInt(0),
        status: MovieStatus.READY,
        sourceType: MovieSourceType.STREAM,
        streamingUrl: source.playbackUrl,
        streamingFormat: source.format,
        tmdbId: movie.id,
        providerId: source.providerId,
        providerSourceId: source.sourceId,
        licenseUrl: source.licenseUrl,
      },
    });
    return this.format(record);
  }

  static async list(role: 'ADMIN' | 'USER', ownerId: string) {
    const where = role === 'ADMIN' ? {} : { status: MovieStatus.READY };
    return (await prisma.movie.findMany({ where, orderBy: { updatedAt: 'desc' } })).map(this.format);
  }

  static async initiate(ownerId: string, input: { title: string; originalFilename: string; mimeType: string; fileSize: number }) {
    if (!supportedMimeTypes.has(input.mimeType)) throw new Error('Unsupported video format. Upload MP4 (H.264/AAC recommended), WebM, MOV, or MKV.');
    if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > ENV.R2_MAX_MOVIE_BYTES) throw new Error(`Movie must be between 1 byte and ${Math.floor(ENV.R2_MAX_MOVIE_BYTES / (1024 * 1024 * 1024))} GB.`);
    const used = await prisma.movie.aggregate({ where: { ownerId, status: { in: [MovieStatus.UPLOADING, MovieStatus.PROCESSING, MovieStatus.READY] } }, _sum: { fileSize: true } });
    if (Number(used._sum.fileSize || 0) + input.fileSize > ENV.R2_USER_QUOTA_BYTES) throw new Error('Movie library storage quota exceeded. Delete a movie before uploading another.');
    const title = input.title.trim() || input.originalFilename.replace(/\.[^.]+$/, '');
    const safeName = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const movie = await prisma.movie.create({ data: { ownerId, title, originalFilename: input.originalFilename, storageKey: `pending/${Date.now()}-${safeName}`, mimeType: input.mimeType, fileSize: BigInt(input.fileSize) } });
    const storageKey = `movies/${ownerId}/${movie.id}/${safeName}`;
    try {
      const uploadId = await R2Service.createMultipartUpload(storageKey, input.mimeType);
      const updated = await prisma.movie.update({ where: { id: movie.id }, data: { storageKey, multipartUploadId: uploadId } });
      return { movie: this.format(updated), uploadId, partSizeBytes: PART_SIZE_BYTES };
    } catch (error) {
      await prisma.movie.update({ where: { id: movie.id }, data: { status: MovieStatus.FAILED } });
      throw error;
    }
  }

  static async createStream(ownerId: string, input: { title: string; description?: string | null; posterUrl?: string | null; streamingUrl: string; streamingFormat?: StreamFormat }) {
    const title = input.title?.trim();
    if (!title) throw new Error('Movie title is required.');
    const { url, format } = await validateRemoteStream(input.streamingUrl, input.streamingFormat || 'AUTO');
    const originalFilename = new URL(url).pathname.split('/').pop() || `${title}.${format === 'DASH' ? 'mpd' : format === 'HLS' ? 'm3u8' : format === 'WEBM' ? 'webm' : 'mp4'}`;
    const mimeType = format === 'DASH' ? 'application/dash+xml' : format === 'HLS' ? 'application/vnd.apple.mpegurl' : format === 'WEBM' ? 'video/webm' : 'video/mp4';
    const movie = await prisma.movie.create({
      data: {
        ownerId,
        title,
        description: input.description?.trim() || null,
        posterUrl: input.posterUrl?.trim() || null,
        originalFilename,
        storageKey: `stream/${Date.now()}-${Math.random().toString(36).slice(2)}`,
        mimeType,
        fileSize: BigInt(0),
        status: MovieStatus.READY,
        sourceType: MovieSourceType.STREAM,
        streamingUrl: url,
        streamingFormat: format,
      },
    });
    return this.format(movie);
  }

  static async importMpd(ownerId: string, input: { title: string; description?: string | null; posterUrl?: string | null; originalFilename: string; manifestXml: string; manifestBaseUrl?: string | null }) {
    const title = input.title?.trim();
    if (!title) throw new Error('Movie title is required.');
    if (!/\.mpd$/i.test(input.originalFilename || '')) throw new Error('Select an MPEG-DASH .mpd manifest file.');
    const manifest = await validateImportedMpd(input.manifestXml, input.manifestBaseUrl);
    const fileSize = Buffer.byteLength(manifest.normalizedXml, 'utf8');
    const provisionalKey = `manifests/pending/${Date.now()}-${Math.random().toString(36).slice(2)}.mpd`;
    const movie = await prisma.movie.create({
      data: {
        ownerId,
        title,
        description: input.description?.trim() || null,
        posterUrl: input.posterUrl?.trim() || null,
        originalFilename: input.originalFilename,
        storageKey: provisionalKey,
        mimeType: 'application/dash+xml',
        fileSize: BigInt(fileSize),
        status: MovieStatus.PROCESSING,
        sourceType: MovieSourceType.MANIFEST,
        streamingFormat: 'DASH',
        manifestBaseUrl: manifest.manifestBaseUrl,
      },
    });
    const storageKey = `manifests/${ownerId}/${movie.id}/manifest.mpd`;
    try {
      await R2Service.putObject(storageKey, manifest.normalizedXml, 'application/dash+xml');
      const ready = await prisma.movie.update({ where: { id: movie.id }, data: { storageKey, status: MovieStatus.READY } });
      return this.format(ready);
    } catch (error) {
      await prisma.movie.update({ where: { id: movie.id }, data: { status: MovieStatus.FAILED } });
      throw error;
    }
  }

  static async uploadPart(ownerId: string, movieId: string, partNumber: number) {
    const movie = await this.owned(ownerId, movieId, MovieStatus.UPLOADING);
    if (!movie.multipartUploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) throw new Error('Invalid upload part.');
    return { uploadUrl: await R2Service.signUploadPart(movie.storageKey, movie.multipartUploadId, partNumber), expiresInSeconds: 900 };
  }

  static async complete(ownerId: string, movieId: string, parts: Array<{ partNumber: number; eTag: string }>) {
    const movie = await this.owned(ownerId, movieId, MovieStatus.UPLOADING);
    if (!movie.multipartUploadId || !Array.isArray(parts) || parts.length === 0) throw new Error('No uploaded parts were supplied.');
    await prisma.movie.update({ where: { id: movieId }, data: { status: MovieStatus.PROCESSING } });
    try {
      await R2Service.completeMultipartUpload(movie.storageKey, movie.multipartUploadId, parts);
      const object = await R2Service.headObject(movie.storageKey);
      if (Number(object.ContentLength) !== Number(movie.fileSize)) throw new Error('Uploaded file size did not match the selected file.');
      const ready = await prisma.movie.update({ where: { id: movieId }, data: { status: MovieStatus.READY, multipartUploadId: null } });
      await prisma.movieUploadPart.createMany({ data: parts.map((part) => ({ movieId, partNumber: part.partNumber, eTag: part.eTag })), skipDuplicates: true });
      return this.format(ready);
    } catch (error) {
      await prisma.movie.update({ where: { id: movieId }, data: { status: MovieStatus.FAILED } });
      throw error;
    }
  }

  static async abort(ownerId: string, movieId: string) {
    const movie = await this.owned(ownerId, movieId);
    if (movie.multipartUploadId) await R2Service.abortMultipartUpload(movie.storageKey, movie.multipartUploadId).catch(() => undefined);
    await prisma.movie.delete({ where: { id: movieId } });
  }

  static async playback(userId: string, movieId: string) {
    const movie = await prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie || movie.status !== MovieStatus.READY) throw new Error('Movie is not ready for playback.');
    const room = await prisma.room.findFirst({ where: { selectedMovieId: movieId, OR: [{ hostId: userId }, { guestId: userId }], status: { not: 'ENDED' } } });
    if (!room && movie.ownerId !== userId) throw new Error('You are not authorized to play this movie.');
    if (movie.sourceType === MovieSourceType.STREAM) {
      if (!movie.streamingUrl) throw new Error('This streaming movie no longer has a valid source URL.');
      return { playbackUrl: movie.streamingUrl, expiresInSeconds: null, sourceType: movie.sourceType, streamingFormat: movie.streamingFormat };
    }
    return { playbackUrl: await R2Service.signedPlaybackUrl(movie.storageKey), expiresInSeconds: 3600, sourceType: movie.sourceType, streamingFormat: null };
  }

  static async update(movieId: string, input: { title?: string; description?: string | null; durationSeconds?: number | null; posterUrl?: string | null; streamingUrl?: string; streamingFormat?: StreamFormat }) {
    const title = input.title?.trim();
    if (title !== undefined && !title) throw new Error('Movie title cannot be empty.');
    const current = await prisma.movie.findUnique({ where: { id: movieId } });
    if (!current) throw new Error('Movie not found.');
    let streamUpdate: Record<string, unknown> = {};
    if (input.streamingUrl !== undefined || input.streamingFormat !== undefined) {
      if (current.sourceType !== MovieSourceType.STREAM) throw new Error('Only streaming movies have a streaming URL.');
      const { url, format } = await validateRemoteStream(input.streamingUrl || current.streamingUrl || '', input.streamingFormat || (current.streamingFormat as StreamFormat) || 'AUTO');
      streamUpdate = { streamingUrl: url, streamingFormat: format };
    }
    const movie = await prisma.movie.update({ where: { id: movieId }, data: { ...(title !== undefined ? { title } : {}), ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}), ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}), ...(input.posterUrl !== undefined ? { posterUrl: input.posterUrl?.trim() || null } : {}), ...streamUpdate } });
    return this.format(movie);
  }

  static async owned(ownerId: string, id: string, requiredStatus?: MovieStatus) {
    const movie = await prisma.movie.findFirst({ where: { id, ownerId } });
    if (!movie) throw new Error('Movie not found.');
    if (requiredStatus && movie.status !== requiredStatus) throw new Error(`Movie is ${movie.status.toLowerCase()}.`);
    return movie;
  }
}

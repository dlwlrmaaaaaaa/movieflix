import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { prisma } from '../src/prisma';
import { DramaService } from '../src/services/drama.service';
import { classifyDrama, TmdbService } from '../src/services/tmdb.service';
import { normalizeSubtitles } from '../src/services/subtitle.service';
import { ENV } from '../src/config/env';
import { RoomService } from '../src/services/room.service';
import dramaRoutes from '../src/routes/drama.routes';
import { SocketManager } from '../src/sockets/socketManager';
import { generateToken } from '../src/utils/token';
import { io } from '../../mobile/node_modules/socket.io-client';

async function main() {
  const testUrl = process.env.DRAMA_TEST_DATABASE_URL;
  assert(testUrl && new URL(testUrl).hostname === '127.0.0.1' && new URL(testUrl).pathname === '/annahflix_drama_test', 'Tests require the isolated local test database.');
  assert.equal((await prisma.movie.findUniqueOrThrow({ where: { id: 'legacy-movie' } })).title, 'Preserved movie');
  assert.equal(classifyDrama('ko', ['KR']), 'k-drama');
  assert.equal(classifyDrama('ko', ['US']), 'tv');
  assert.equal(classifyDrama('zh', ['CN']), 'c-drama');
  for (const countries of [['TW'], ['HK'], ['CN', 'TW'], ['CN', 'HK']]) assert.equal(classifyDrama('zh', countries), 'tv');
  const normalized = normalizeSubtitles('1\n00:00:01,200 --> 00:00:03,400\nHello <b>world</b>\n\n2\n00:00:04,000 --> 00:00:05,000\n안녕하세요');
  assert.equal(normalized.cues[0].text, 'Hello world'); assert(normalized.vtt.includes('00:00:01.200'));
  assert.equal(normalizeSubtitles(normalized.vtt).cues.length, 2);
  for (const invalid of ['1\n99:99:99,000 --> 00:00:02,000\nBad', '1\n00:00:05,000 --> 00:00:01,000\nBad', 'no timestamps', '\uFFFD']) assert.throws(() => normalizeSubtitles(invalid));
  const originalFetch = global.fetch; const urls: URL[] = [];
  ENV.TMDB_ACCESS_TOKEN = 'fixture-token';
  global.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname !== 'api.themoviedb.org') return originalFetch(input, options);
    urls.push(url);
    if (url.pathname.includes('/season/')) return Response.json({ name: 'Season 1', episodes: [2, 1, 3].map((n) => ({ episode_number: n, name: `Episode ${n}`, runtime: 1, overview: '', air_date: '2026-01-01' })) });
    if (url.pathname.endsWith('/tv/991234')) return Response.json({ id: 991234, name: 'Fixture Drama', original_name: '드라마', original_language: 'ko', origin_country: ['KR'], number_of_seasons: 2, first_air_date: '2026-01-01', genres: [{ id: 18, name: 'Drama' }], seasons: [{ season_number: 1, name: 'Season 1', episode_count: 3 }], credits: { cast: [{ name: 'Fixture Actor' }] } });
    return Response.json({ page: Number(url.searchParams.get('page') || 1), total_pages: 3, total_results: 60, results: [
      { id: 1, name: 'Korean', original_language: 'ko', origin_country: ['KR'], genre_ids: [18] },
      { id: 2, name: 'Mainland', original_language: 'zh', origin_country: ['CN'], genre_ids: [18] },
      { id: 3, name: 'Taiwan', original_language: 'zh', origin_country: ['TW'], genre_ids: [18] },
      { id: 4, name: 'Hong Kong', original_language: 'zh', origin_country: ['HK'], genre_ids: [18] },
    ] });
  };
  const korean = await TmdbService.dramas('k-drama', 2);
  assert.equal(korean.results[0].title, 'Korean'); assert.equal(korean.results.length, 1);
  assert.equal(urls[0].searchParams.get('with_original_language'), 'ko'); assert.equal(urls[0].searchParams.get('with_origin_country'), 'KR'); assert.equal(urls[0].searchParams.get('page'), '2');
  await TmdbService.dramas('k-drama', 2); assert.equal(urls.length, 1, 'TMDB responses are cached');
  const chinese = await TmdbService.dramas('c-drama', 1); assert.deepEqual(chinese.results.map((item) => item.title), ['Mainland']);
  assert.equal(urls[1].searchParams.get('with_origin_country'), 'CN');
  await TmdbService.dramas('c-drama', 1, true); assert.equal(urls.at(-1)?.pathname, '/3/trending/tv/week');
  await TmdbService.dramas('tv', 1, false, { query: 'Fixture', year: '2026' }); assert.equal(urls.at(-1)?.pathname, '/3/search/tv');
  const host = await prisma.user.create({ data: { email: 'host@example.test', passwordHash: 'test', displayName: 'Host', role: 'ADMIN' } });
  const guest = await prisma.user.create({ data: { email: 'guest@example.test', passwordHash: 'test', displayName: 'Guest' } });
  const other = await prisma.user.create({ data: { email: 'other@example.test', passwordHash: 'test', displayName: 'Other' } });
  await DramaService.importSeason(991234, 1); await DramaService.importSeason(991234, 1);
  const episodes = await DramaService.season(991234, 1, host.id);
  assert.deepEqual(episodes.map((episode) => episode.episodeNumber), [1, 2, 3]); assert.equal(await prisma.episode.count(), 3);
  assert(!episodes[0].available); await assert.rejects(DramaService.playback(guest.id, episodes[0].id), /Episode unavailable/);
  const movies = await Promise.all([1, 2].map((n) => prisma.movie.create({ data: { ownerId: host.id, title: `Episode ${n}`, originalFilename: `${n}.mp4`, storageKey: `fixture/${n}`, mimeType: 'video/mp4', fileSize: 0, sourceType: 'STREAM', status: 'READY', streamingUrl: `https://media.example.test/${n}.mp4`, streamingFormat: 'MP4' } })));
  for (let i = 0; i < 2; i++) await DramaService.attachSource(host.id, episodes[i].id, movies[i].id);
  const session = await DramaService.beginProgress(guest.id, episodes[0].id);
  assert.equal((await DramaService.saveProgress(guest.id, episodes[0].id, { sessionId: session.sessionId, sequence: 2, positionSeconds: 50, durationSeconds: 60 })).count, 1);
  assert.equal((await DramaService.saveProgress(guest.id, episodes[0].id, { sessionId: session.sessionId, sequence: 1, positionSeconds: 10, durationSeconds: 60 })).count, 0);
  const newer = await DramaService.beginProgress(guest.id, episodes[0].id);
  assert.equal(newer.positionSeconds, 50);
  assert.equal((await DramaService.saveProgress(guest.id, episodes[0].id, { sessionId: session.sessionId, sequence: 3, positionSeconds: 1, durationSeconds: 60 })).count, 0);
  await DramaService.saveProgress(guest.id, episodes[0].id, { sessionId: newer.sessionId, sequence: 1, positionSeconds: 58, durationSeconds: 60 });
  assert((await DramaService.continueWatching(guest.id))[0].completed);
  await assert.rejects(DramaService.saveProgress(guest.id, episodes[0].id, { sessionId: newer.sessionId, sequence: 2, positionSeconds: Infinity, durationSeconds: 60 }));
  await DramaService.addSubtitle(episodes[0].id, { language: 'en', label: 'English', text: normalized.vtt });
  const prepared = await DramaService.playback(guest.id, episodes[0].id);
  assert.equal(prepared.subtitles.length, 1); assert.equal(prepared.movieId, movies[0].id);
  const app = express(); app.use(express.json()); app.use('/api/dramas', dramaRoutes);
  const server = http.createServer(app); const gateway = new SocketManager(server, '*'); app.set('roomGateway', gateway);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const tokens = new Map([host, guest, other].map((user) => [user.id, generateToken({ userId: user.id, email: user.email })]));
  const request = async (userId: string, path: string, body?: any, method = 'POST') => {
    const response = await originalFetch(base + path, { method, headers: { Authorization: `Bearer ${tokens.get(userId)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  const clients: ReturnType<typeof io>[] = [];
  try {
    assert.equal((await request(guest.id, `/api/dramas/episodes/${episodes[0].id}/source`, { movieId: movies[0].id }, 'PUT')).status, 403);
    const result = await request(host.id, `/api/dramas/episodes/${episodes[0].id}/party`, {});
    assert.equal(result.status, 201); const room = result.body.room;
    await RoomService.joinRoom(room.code, guest.id);
    const socket = async (userId: string) => {
      const client = io(base, { auth: { token: tokens.get(userId) }, transports: ['websocket'] }); clients.push(client);
      await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
      await new Promise<void>((resolve, reject) => client.emit('room:join', { roomCode: room.code }, (reply: any) => reply.success ? resolve() : reject(new Error(reply.message))));
      return client;
    };
    const hostSocket = await socket(host.id); const guestSocket = await socket(guest.id);
    const event = (client: any, name: string, action: () => void) => new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { client.off(name, done); reject(new Error(`Timed out waiting for ${name}`)); }, 5000);
      const done = (payload: any) => { clearTimeout(timer); resolve(payload); }; client.once(name, done); action();
    });
    const blocked = await event(hostSocket, 'room:error', () => hostSocket.emit('playback:play', { roomCode: room.code, movieId: movies[0].id, position: 0, clientTimestamp: Date.now() }));
    assert.equal(blocked.code, 'VIEWERS_NOT_READY');
    await RoomService.setViewerState(room.code, host.id, movies[0].id, 'READY'); await RoomService.setViewerState(room.code, guest.id, movies[0].id, 'READY');
    const guestDenied = await event(guestSocket, 'room:error', () => guestSocket.emit('playback:play', { roomCode: room.code, movieId: movies[0].id, position: 0, clientTimestamp: Date.now() })); assert.match(guestDenied.message, /host/);
    const start = await event(guestSocket, 'playback:sync', () => hostSocket.emit('playback:play', { roomCode: room.code, movieId: movies[0].id, position: 0, clientTimestamp: Date.now() })); assert(start.scheduledStartTime > start.serverTime);
    const paused = await event(guestSocket, 'playback:sync', () => hostSocket.emit('playback:pause', { roomCode: room.code, movieId: movies[0].id, position: 10 })); assert.equal(paused.action, 'PAUSE');
    const sought = await event(guestSocket, 'playback:sync', () => hostSocket.emit('playback:seek', { roomCode: room.code, movieId: movies[0].id, position: 20 })); assert.equal(sought.position, 20);
    const current = (await RoomService.getRoomByCode(room.code))!;
    const payload = { episodeId: episodes[1].id, expected: { movieId: movies[0].id, version: current.playbackVersion } };
    assert.equal((await request(guest.id, `/api/dramas/rooms/${room.code}/episode`, payload)).status, 403);
    assert.equal((await request(other.id, `/api/dramas/rooms/${room.code}/next`, undefined, 'GET')).status, 403);
    assert.equal((await request(host.id, `/api/dramas/rooms/${room.code}/episode`, { ...payload, ended: true })).status, 409, 'Early ended event is rejected');
    const transitioned = await Promise.all([request(host.id, `/api/dramas/rooms/${room.code}/episode`, payload), request(host.id, `/api/dramas/rooms/${room.code}/episode`, payload)]);
    assert.deepEqual(transitioned.map((item) => item.status).sort(), [200, 409]);
    const nextRoom = (await RoomService.getRoomByCode(room.code))!;
    assert.equal(nextRoom.selectedMovie?.id, movies[1].id); assert(!nextRoom.playbackIsPlaying); assert.equal(nextRoom.playbackPosition, 0);
    assert.equal(await RoomService.allViewersReady(room.code), false);
    await assert.rejects(RoomService.setViewerState(room.code, guest.id, movies[0].id, 'READY'));
    assert.equal(await DramaService.next(episodes[1].id), null, 'Missing sources are not sent to a broken player');
    assert.equal((await request(guest.id, `/api/dramas/episodes/${episodes[1].id}/playback`, undefined, 'GET')).status, 200);
    console.log('Drama migration, metadata filters/cache, sources, subtitle validation, stale progress, HTTP authorization, two-device scheduled start/pause/seek, atomic episode transition, readiness reset, and missing-next checks passed.');
  } finally { for (const client of clients) client.disconnect(); await new Promise<void>((resolve) => server.close(() => resolve())); global.fetch = originalFetch; await prisma.$disconnect(); }
}
void main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });

import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import bcrypt from 'bcryptjs';
import authRoutes from '../src/routes/auth.routes';
import { startAuthSession } from '../src/services/authSession.service';
import { io as connectSocket } from '../../mobile/node_modules/socket.io-client';
import { prisma } from '../src/prisma';
import { RoomService } from '../src/services/room.service';
import { TmdbService } from '../src/services/tmdb.service';
import { StreamingSourceService } from '../src/services/streamingSource.service';
import { LiveKitService } from '../src/services/livekit.service';
import { embedProviderRegistry } from '../src/services/embedProviderRegistry';
import { DiscoveryController } from '../src/controllers/discovery.controller';
import roomRoutes from '../src/routes/room.routes';
import { authMiddleware } from '../src/middlewares/auth.middleware';
import { SocketManager } from '../src/sockets/socketManager';
import { generateToken } from '../src/utils/token';
import { validatedRoomCode } from '../src/utils/roomCode';

// Exercise the real HTTP controllers, room service and Socket.IO gateway against
// isolated in-memory persistence. No production database or providers are changed.
const users: any[] = ['host', 'guest', 'other'].map((id) => ({ id, email: `${id}@example.test`, displayName: id, role: 'USER' }));
const rooms: any[] = [];
const movies: any[] = [];
const viewers: any[] = [];
const messages: any[] = [];
const db = prisma as any;
const hydrate = (room: any) => room ? { ...room, host: users.find((item) => item.id === room.hostId), guest: users.find((item) => item.id === room.guestId), filesMetadata: [], viewerStates: viewers.filter((item) => item.roomId === room.id), selectedMovie: movies.find((item) => item.id === room.selectedMovieId) || null } : null;
const locate = (where: any) => rooms.find((item) => where.id ? item.id === where.id : item.code === where.code);
function update(room: any, data: any) {
  Object.entries(data).forEach(([key, value]: any) => { room[key] = value?.increment ? (room[key] || 0) + value.increment : value; });
  return hydrate(room);
}
db.user.findUnique = async ({ where }: any) => users.find((item) => where.id ? item.id === where.id : item.email === where.email) || null;
db.user.update = async ({ where, data }: any) => { const user = users.find((item) => item.id === where.id); Object.assign(user, data); return user; };
db.user.updateMany = async ({ where, data }: any) => { const user = users.find((item) => item.id === where.id && (item.activeSessionId ?? null) === where.activeSessionId); if (!user) return { count: 0 }; Object.assign(user, data); return { count: 1 }; };
db.room.findUnique = async ({ where }: any) => hydrate(locate(where));
db.room.create = async ({ data }: any) => {
  const room = { id: `room-${rooms.length}`, guestId: null, playbackPosition: 0, playbackIsPlaying: false, playbackVersion: 0, playbackMode: 'MANUAL', createdAt: new Date(), ...data };
  rooms.push(room); return hydrate(room);
};
db.room.update = async ({ where, data }: any) => update(locate(where), data);
db.room.updateMany = async ({ where, data }: any) => {
  const room = locate(where);
  if (!room || ('guestId' in where && room.guestId !== where.guestId) || (where.status?.not && room.status === where.status.not)) return { count: 0 };
  update(room, data); return { count: 1 };
};
db.movie.create = async ({ data }: any) => { const movie = { id: `movie-${movies.length}`, createdAt: new Date(), updatedAt: new Date(), ...data }; movies.push(movie); return movie; };
db.movie.findFirst = async ({ where }: any) => movies.find((item) => item.id === where.id && item.status === where.status);
db.roomViewerState.deleteMany = async ({ where }: any) => { for (let i = viewers.length - 1; i >= 0; i--) if (viewers[i].roomId === where.roomId && (!where.userId || viewers[i].userId === where.userId)) viewers.splice(i, 1); return { count: 1 }; };
db.roomMovieMeta.deleteMany = async () => ({ count: 0 });
db.roomViewerState.upsert = async ({ where, create, update: data }: any) => { const found = viewers.find((item) => item.roomId === where.roomId_userId.roomId && item.userId === where.roomId_userId.userId); if (found) Object.assign(found, data); else viewers.push(create); };
db.chatMessage.create = async ({ data }: any) => { const message = { id: `message-${messages.length}`, createdAt: new Date(), ...data }; messages.push(message); return message; };
db.chatMessage.findMany = async ({ where }: any) => messages.filter((item) => item.roomId === where.roomId).slice(-100).reverse();
db.$transaction = async (operations: any[]) => Promise.all(operations);
const movie = { rating: 8, voteCount: 100, originalTitle: 'Authorized test movie', releaseDate: '2000-01-01', releaseYear: 2000, backdropUrl: null, genreIds: [18], genres: [{ id: 18, name: 'Drama' }], trailer: null, id: 550, title: 'Authorized test movie', posterUrl: 'https://image.tmdb.org/t/p/w500/test.jpg', runtimeMinutes: 90, overview: '' };
TmdbService.details = async () => movie as any;
let direct = false;
StreamingSourceService.find = async () => direct ? [{ providerId: 'internet_archive', sourceId: 'licensed-test', playbackUrl: 'https://archive.org/download/licensed-test/movie.mp4', format: 'MP4', mimeType: 'video/mp4' } as any] : [];
embedProviderRegistry.resolveAll = async (request) => [{ providerId: 'authorized-test', providerName: 'Authorized Test', mediaType: 'movie', tmdbId: (request as any).tmdbId, embedUrl: 'https://player.example.test/embed/movie/550', supportsWeb: true, supportsMobile: true, supportsPlaybackControl: false, supportsSynchronization: false }];
LiveKitService.removeParticipant = async () => undefined;

async function main() {
  assert.equal(validatedRoomCode(' tf-ab23 '), 'TF-AB23');
  assert.throws(() => validatedRoomCode({ code: 'TF-AB23' }));
  assert.throws(() => validatedRoomCode('TF-OOOO'));
  for (const user of users) { user.passwordHash = await bcrypt.hash('test-password', 4); user.createdAt = new Date(); }
  const app = express(); app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.post('/api/movies/:id/watch-party', authMiddleware, DiscoveryController.createWatchParty);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(400).json({ success: false, message: error.message }));
  const server = http.createServer(app);
  const gateway = new SocketManager(server, '*'); app.set('roomGateway', gateway);
  await new Promise<void>((resolve) => server.listen(process.env.TF_BROWSER_FIXTURE === '1' ? 4109 : 0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const tokens = Object.fromEntries(users.map((user) => [user.id, generateToken({ userId: user.id, email: user.email })]));
  if (process.env.TF_BROWSER_FIXTURE === '1') {
    direct = true;
    app.get('/__test/video.mp4', (_req, res) => res.sendFile(path.join(os.tmpdir(), 'togetherflix-test-flower.mp4')));
    app.get('/api/movies/:id/playback', (_req, res) => res.json({ success: true, playbackUrl: `${base}/__test/video.mp4` }));
    app.get('/__test/session/:user', (req, res) => { const user = users.find((item) => item.id === req.params.user); res.json({ user, accessToken: tokens[req.params.user] }); });
    app.get('/__test/player', (_req, res) => res.type('html').send('<body style="background:#09090b;color:white;font:24px system-ui;display:grid;place-items:center"><p>Authorized test iframe</p></body>'));
    app.get('/api/auth/me', authMiddleware, (req: any, res) => res.json({ success: true, user: users.find((item) => item.id === req.user.id) }));
    app.get('/api/users/:list', (_req, res) => res.json({ success: true, items: [] }));
    app.get('/api/movies/:id/embed', (_req, res) => { const player = { providerId: 'authorized-test', providerName: 'Authorized Test', mediaType: 'movie', tmdbId: 550, embedUrl: `${base}/__test/player`, supportsWeb: true, supportsMobile: true, supportsPlaybackControl: false, supportsSynchronization: false }; res.json({ success: true, player, players: [player, { ...player, providerId: 'second-test', providerName: 'Second Test', embedUrl: `${base}/__test/player?server=second` }] }); });
    app.get('/api/movies/:id/stream', (_req, res) => res.json({ success: true, sources: [{ provider: 'internet_archive', type: 'mp4', licenseName: 'Test fixture', licenseUrl: 'https://example.test/license' }] }));
    app.get('/api/movies/:id', (req, res) => {
      if (!['trending', 'popular', 'top-rated', 'now-playing', 'upcoming', 'search'].includes(req.params.id)) { res.json({ success: true, movie }); return; }
      const offset = Math.max(0, ['trending', 'popular', 'top-rated', 'upcoming', 'now-playing'].indexOf(req.params.id)) * 24;
      const results = process.env.TF_PERF_FIXTURE === '1' ? Array.from({ length: 24 }, (_, index) => ({ ...movie, id: 550 + offset + index, title: index + offset === 0 ? movie.title : `Fixture movie ${offset + index}`, backdropUrl: 'https://image.tmdb.org/t/p/w780/fixture-backdrop.jpg', posterUrl: `https://image.tmdb.org/t/p/w500/fixture-${offset + index}.jpg` })) : [movie];
      res.json({ success: true, results, page: 1, totalPages: 1, totalResults: results.length });
    });
    embedProviderRegistry.resolveAll = async () => [{ providerId: 'authorized-test', providerName: 'Authorized Test', mediaType: 'movie', tmdbId: 550, embedUrl: `${base}/__test/player`, supportsWeb: true, supportsMobile: true, supportsPlaybackControl: false, supportsSynchronization: false }];
    const webRoot = path.resolve(__dirname, '../../mobile/dist');
    app.use(express.static(webRoot));
    app.get('*', (_req, res) => res.sendFile(path.join(webRoot, 'index.html')));
    console.log(`Isolated browser fixture listening at ${base}`);
    return;
  }
  const clients: ReturnType<typeof connectSocket>[] = [];
  const request = async (user: string, path: string, data?: any) => { const response = await fetch(`${base}${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${tokens[user]}`, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) }); return { status: response.status, body: await response.json() as any }; };
  const socket = async (user: string, code: string) => {
    const client = connectSocket(base, { auth: { token: tokens[user] }, transports: ['websocket'], forceNew: true }); clients.push(client);
    await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    await new Promise<void>((resolve, reject) => client.emit('room:join', { roomCode: code }, (result: any) => result.success ? resolve() : reject(new Error(result.error))));
    return client;
  };
  const event = (client: any, name: string) => new Promise<any>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${name}`)), 4000); client.once(name, (payload: any) => { clearTimeout(timeout); resolve(payload); }); });
  try {
    assert.equal((await request('host', '/api/rooms/invalid')).status, 400);
    assert.equal((await request('host', '/api/movies/invalid/watch-party', {})).status, 400);
    assert.equal((await request('host', '/api/movies/550/watch-party', { providerId: 'vidcore' })).status, 404);
    assert.equal(rooms.length, 0);
    const created = await request('host', '/api/movies/550/watch-party', { providerId: 'authorized-test', hostId: 'other' });
    assert.equal(created.status, 201);
    const room = created.body.room;
    assert.equal(room.hostId, 'host'); assert.equal(room.playbackMode, 'IFRAME');
    assert.equal(room.catalogSelection.tmdbId, 550); assert.equal(room.catalogSelection.title, movie.title); assert.equal(room.catalogSelection.providerId, 'authorized-test');
    let host = await socket('host', room.code);
    const membershipChanged = event(host, 'room:updated');
    const joined = await request('guest', '/api/rooms/join', { code: room.code });
    const hostRoom = await membershipChanged;
    assert.equal(hostRoom.guestId, 'guest');
    assert.equal(hostRoom.participants.length, 2);
    assert.ok(hostRoom.participants.some((participant: any) => participant.id === 'guest' && !participant.isHost));
    assert.equal(joined.body.room.id, room.id); assert.equal(rooms.length, 1);
    assert.equal((await request('guest', `/api/rooms/${room.code}`)).body.room.catalogSelection.posterUrl, movie.posterUrl);
    assert.equal((await request('guest', `/api/rooms/${room.code}/embed?platform=web`)).status, 409);
    assert.equal((await request('host', `/api/rooms/${room.code}/embed?platform=web`)).body.player.tmdbId, 550);
    assert.equal((await request('other', '/api/rooms/join', { code: room.code })).status, 400);
    assert.equal((await request('other', `/api/rooms/${room.code}`)).status, 403);
    const guest = await socket('guest', room.code);
    const deniedStart = await new Promise<any>((resolve) => guest.emit('party:start', { roomCode: room.code }, resolve)); assert.equal(deniedStart.success, false);
    assert.equal((await request('guest', `/api/rooms/${room.code}/start`, {})).status, 400);
    host.disconnect();
    const httpStart = await request('host', `/api/rooms/${room.code}/start`, {}); assert.equal(httpStart.status, 200); assert.ok(httpStart.body.room.catalogSelection.launchAt);
    host = await socket('host', room.code);
    const started = await new Promise<any>((resolve) => host.emit('party:start', { roomCode: room.code }, resolve)); assert.equal(started.success, true);
    const openedRoom = (await request('guest', `/api/rooms/${room.code}`)).body.room; assert.ok(openedRoom.catalogSelection.launchAt > 0);
    assert.equal((await request('guest', `/api/rooms/${room.code}/embed?platform=web`)).body.player.providerId, 'authorized-test');
    assert.equal(openedRoom.playbackIsPlaying, false);
    const invalidCode = event(guest, 'room:error'); guest.emit('playback:seek', { roomCode: 'bad-code', position: 10 }); assert.equal((await invalidCode).code, 'INVALID_ROOM_REQUEST');
    const chat = event(guest, 'room:chat_message_received'); host.emit('room:chat_message', { roomCode: room.code, text: 'Ready for movie night?' });
    assert.equal((await chat).text, 'Ready for movie night?');
    assert.equal((await request('guest', `/api/rooms/${room.code}/messages`)).body.messages.length, 1);
    const rejected = event(guest, 'room:error'); guest.emit('playback:play', { roomCode: room.code, position: 20 }); assert.match((await rejected).message, /host/);
    assert.equal((await request('guest', `/api/rooms/${room.code}/close`, {})).status, 400);
    await request('guest', `/api/rooms/${room.code}/leave`, {});
    assert.equal((await request('host', `/api/rooms/${room.code}`)).body.room.status, 'WATCHING');
    const race = await Promise.all([request('guest', '/api/rooms/join', { code: room.code }), request('other', '/api/rooms/join', { code: room.code })]);
    assert.deepEqual(race.map((item) => item.status).sort(), [200, 400]);
    assert.equal((await request('host', `/api/rooms/${room.code}/guest/remove`, {})).body.room.guestId, null);
    await request('host', `/api/rooms/${room.code}/leave`, {});
    assert.equal((await request('guest', '/api/rooms/join', { code: room.code })).status, 400);
    direct = true;
    const directRoom = (await request('host', '/api/movies/550/watch-party', { positionSeconds: 42 })).body.room;
    assert.equal(directRoom.playbackMode, 'DIRECT'); assert.equal(directRoom.playbackPosition, 42); assert.equal(directRoom.catalogSelection.providerId, 'internet_archive');
    await request('guest', '/api/rooms/join', { code: directRoom.code });
    const directHost = await socket('host', directRoom.code); const directGuest = await socket('guest', directRoom.code);
    await RoomService.setViewerState(directRoom.code, 'host', directRoom.selectedMovie.id, 'READY');
    await RoomService.setViewerState(directRoom.code, 'guest', directRoom.selectedMovie.id, 'READY');
    await RoomService.setViewerState(directRoom.code, 'guest', directRoom.selectedMovie.id, 'BUFFERING');
    const buffering = event(directHost, 'room:error'); directHost.emit('playback:play', { roomCode: directRoom.code, position: 42 }); assert.equal((await buffering).code, 'VIEWERS_NOT_READY');
    await RoomService.setViewerState(directRoom.code, 'guest', directRoom.selectedMovie.id, 'READY');
    const sync = event(directGuest, 'playback:sync'); directHost.emit('playback:play', { roomCode: directRoom.code, position: 42 });
    const state = await sync; assert.equal(state.isPlaying, true); assert.equal(state.position, 42); assert.ok(state.scheduledStartTime > state.serverTime);
    const guestSeek = event(directGuest, 'room:error'); directGuest.emit('playback:seek', { roomCode: directRoom.code, position: 100 }); assert.match((await guestSeek).message, /host/);
    const seeked = event(directGuest, 'playback:sync'); directHost.emit('playback:seek', { roomCode: directRoom.code, position: 43 }); const seekState = await seeked; assert.equal(seekState.position, 43); assert.ok(seekState.scheduledStartTime > seekState.serverTime);
    const paused = event(directGuest, 'playback:sync'); directHost.emit('playback:pause', { roomCode: directRoom.code, position: 44 }); assert.equal((await paused).isPlaying, false);
    const lateGuest = connectSocket(base, { auth: { token: tokens.guest }, transports: ['websocket'], forceNew: true }); clients.push(lateGuest);
    await new Promise<void>((resolve) => lateGuest.once('connect', resolve));
    const lateState = event(lateGuest, 'playback:sync'); lateGuest.emit('room:join', { roomCode: directRoom.code }, () => undefined);
    assert.equal((await lateState).position, 44);
    const unchanged = await request('guest', '/api/rooms/join', { code: directRoom.code }); assert.equal(unchanged.body.room.id, directRoom.id); assert.equal(rooms.length, 2);
    const revoked = event(directGuest, 'auth:session_revoked');
    const login = await request('guest', '/api/auth/login', { email: 'guest@example.test', password: 'test-password' });
    assert.equal(login.status, 200);
    assert.match((await revoked).message, /another device/);
    assert.equal((await request('guest', `/api/rooms/${directRoom.code}`)).status, 401);
    const oldSocket = connectSocket(base, { auth: { token: tokens.guest }, transports: ['websocket'], forceNew: true, reconnection: false }); clients.push(oldSocket);
    assert.equal((await event(oldSocket, 'connect_error')).data.code, 'SESSION_REPLACED');
    tokens.guest = login.body.accessToken;
    assert.equal((await request('guest', `/api/rooms/${directRoom.code}`)).status, 200);
    const signedOut = await request('guest', '/api/auth/logout', {}); assert.equal(signedOut.status, 200);
    assert.equal((await request('guest', '/api/auth/me')).status, 401);
    console.log('Single-device HTTP/socket session revocation checks passed.');
    console.log('Watch party HTTP, metadata, authorization, coordinated iframe opening, direct sync and refresh checks passed.');
  } finally {
    clients.forEach((client) => client.disconnect());
    await new Promise<void>((resolve) => (gateway as any).io.close(resolve));
    await prisma.$disconnect();
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });

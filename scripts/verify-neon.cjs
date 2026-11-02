// Opt-in integration check: uses real Neon/Postgres, real HTTP and Socket.IO.
// Creates uniquely named test accounts and removes only those records afterward.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { loadBackendEnvironment } = require('../backend/environment.cjs');
const dotenv = require('../backend/node_modules/dotenv');
const { io } = require('../mobile/node_modules/socket.io-client');

const root = path.resolve(__dirname, '..');
const mobileOnly = process.argv.includes('--mobile-only');
const envOption = process.argv.indexOf('--env');
if (envOption !== -1) {
  if (!process.argv[envOption + 1]) throw new Error('--env requires a file.');
  Object.assign(process.env, dotenv.parse(fs.readFileSync(path.resolve(root, process.argv[envOption + 1]))));
}
loadBackendEnvironment();
// Prisma 5 may auto-load backend/.env on import; initialize our env first.
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const dbUrl = new URL(process.env.DATABASE_URL || '');
assert.ok(dbUrl.hostname.endsWith('.neon.tech'), 'This test requires a Neon database.');
assert.ok(dbUrl.hostname.includes('-pooler.'), 'Application queries must use the Neon pooled endpoint.');
assert.ok(process.env.DATABASE_URL_UNPOOLED, 'A direct migration URL is required.');
assert.ok(!new URL(process.env.DATABASE_URL_UNPOOLED).hostname.includes('-pooler.'));
const db = new PrismaClient();
const suffix = randomUUID();
const emails = [`neon-check-host-${suffix}@example.invalid`, `neon-check-guest-${suffix}@example.invalid`];
const password = randomBytes(24).toString('hex');
const verificationJwtSecret = randomBytes(48).toString('hex');
const sockets = [];
let child;
let logs = '';
let base;
let roomId;
const checks = [];
function pass(message) { checks.push(message); console.log(`PASS ${message}`); }
function sanitized(message) {
  let text = String(message);
  for (const [key, value] of Object.entries(process.env)) {
    if (value?.length >= 8 && /SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL/.test(key)) text = text.split(value).join('[redacted]');
  }
  return text;
}
async function http(endpoint, { token, status = 200, body, method = 'GET' } = {}) {
  const response = await fetch(`${base}${endpoint}`, {
    method, headers: { 'Content-Type': 'application/json', ...(!mobileOnly ? { Origin: 'https://annahflix.example.test' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${endpoint}: ${data.message || response.statusText}`);
  return data;
}
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
async function start() {
  const port = await freePort(); base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['deploy/start.mjs'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production', JWT_SECRET: verificationJwtSecret, CORS_ORIGIN: mobileOnly ? '' : 'https://annahflix.example.test', PUBLIC_WEB_URL: mobileOnly ? '' : 'https://annahflix.example.test', TRUST_PROXY_HOPS: '1', ALLOW_HTTP_STREAMS: 'false' },
  });
  child.stdout.on('data', (data) => { logs += data; });
  child.stderr.on('data', (data) => { logs += data; });
  child.on('error', (error) => { logs += error.message; });
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`API startup failed: ${sanitized(logs)}`);
    try { const response = await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(2000) }); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API readiness timed out: ${sanitized(logs)}`);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  // Stop only the process tree created by this verification run.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
  await exited;
}
function nextEvent(socket, event) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => { clearTimeout(timer); resolve(payload); };
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out waiting for ${event}`)); }, 15000);
    socket.once(event, handler);
  });
}
async function connect(token, roomCode) {
  const socket = io(base, { auth: { token }, transports: ['websocket'], autoConnect: false, reconnection: false });
  sockets.push(socket);
  const connected = nextEvent(socket, 'connect'); socket.connect(); await connected;
  const result = await new Promise((resolve, reject) => socket.timeout(15000).emit('room:join', { roomCode }, (error, payload) => error ? reject(error) : resolve(payload)));
  assert.equal(result.success, true, result.error);
  return socket;
}

(async () => {
  try {
    console.log(`Verifying Neon branch: ${process.env.NEON_BRANCH || 'configured branch'}`);
    await start();
    assert.equal((await http('/health/ready')).status, 'ready');
    pass('production-mode API startup and real Neon database readiness');
    const host = await http('/api/auth/register', { method: 'POST', status: 201, body: { email: emails[0], password, displayName: 'Neon verification host' } });
    const guest = await http('/api/auth/register', { method: 'POST', status: 201, body: { email: emails[1], password, displayName: 'Neon verification guest' } });
    const account = await db.user.findUniqueOrThrow({ where: { id: host.user.id } });
    assert.equal(account.email, emails[0]); assert.ok(account.passwordHash !== password); assert.ok(account.activeSessionId);
    assert.equal((await http('/api/auth/me', { token: host.accessToken })).user.id, host.user.id);
    pass('registration and authenticated profile persist through Prisma/Postgres');
    const created = await http('/api/rooms', { method: 'POST', token: host.accessToken, status: 201, body: {} });
    const code = created.room.code; roomId = created.room.id;
    if (mobileOnly) {
      const browser = await fetch(`${base}/health`, { headers: { Origin: 'https://unconfigured.example.test' } });
      assert.equal(browser.headers.get('access-control-allow-origin'), null);
      const invitation = await fetch(`${base}/party/${code}`, { redirect: 'manual' });
      assert.equal(invitation.status, 200);
      assert.ok((await invitation.text()).includes(`togetherflix://party/${code}`));
      pass('native requests work without website settings; browser CORS stays disabled and invitations use app deep links');
    }
    await http('/api/rooms/join', { method: 'POST', token: guest.accessToken, body: { code } });
    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    assert.equal(room.guestId, guest.user.id);
    assert.equal((await http(`/api/rooms/${code}`, { token: host.accessToken })).room.guestId, guest.user.id);
    pass('host creates room, guest joins, and host reads persisted membership');
    const hostSocket = await connect(host.accessToken, code);
    const guestSocket = await connect(guest.accessToken, code);
    const incoming = nextEvent(guestSocket, 'room:chat_message_received');
    hostSocket.emit('room:chat_message', { roomCode: code, text: `Neon persistence check ${suffix}` });
    assert.equal((await incoming).senderId, host.user.id);
    const chat = await http(`/api/rooms/${code}/messages`, { token: guest.accessToken });
    assert.equal(chat.messages.at(-1).text, `Neon persistence check ${suffix}`);
    assert.equal(await db.chatMessage.count({ where: { roomId } }), 1);
    pass('Socket.IO chat reaches guest and is readable from Neon through HTTP');
    await http('/api/users/watchlist', { method: 'POST', status: 201, token: host.accessToken, body: { tmdbId: 550 } });
    assert.ok((await http('/api/users/watchlist', { token: host.accessToken })).items.some((item) => item.tmdbId === 550));
    await http('/api/users/continue-watching/550', { method: 'PUT', token: host.accessToken, body: { positionSeconds: 120, durationSeconds: 7200 } });
    assert.equal((await db.watchProgress.findUniqueOrThrow({ where: { userId_tmdbId: { userId: host.user.id, tmdbId: 550 } } })).positionSeconds, 120);
    assert.ok((await http('/api/users/continue-watching', { token: host.accessToken })).items.some((item) => item.tmdbId === 550 && item.positionSeconds === 120));
    pass('live TMDB metadata, watchlist, and continue-watching save/read correctly');
    const login = await http('/api/auth/login', { method: 'POST', body: { email: emails[0], password } });
    const rejected = await http('/api/auth/me', { token: host.accessToken, status: 401 });
    assert.equal(rejected.code, 'SESSION_REPLACED');
    assert.equal((await http('/api/auth/me', { token: login.accessToken })).user.id, host.user.id);
    pass('new login revokes the previous device session using Neon persistence');
    sockets.forEach((socket) => socket.disconnect());
    await stop(); await start();
    assert.equal((await http(`/api/rooms/${code}`, { token: login.accessToken })).room.guestId, guest.user.id);
    assert.ok((await http('/api/users/watchlist', { token: login.accessToken })).items.some((item) => item.tmdbId === 550));
    pass('accounts, room membership, watchlist, and session survive API restart');
  } catch (error) {
    console.error(`FAIL ${sanitized(error.stack || error.message)}`); process.exitCode = 1;
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await stop();
    try {
      const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const ids = users.map((user) => user.id);
      if (ids.length) {
        await db.movieHistory.deleteMany({ where: { userId: { in: ids } } });
        await db.room.deleteMany({ where: { hostId: { in: ids } } });
        await db.user.deleteMany({ where: { id: { in: ids } } });
      }
      pass('temporary verification accounts and their records removed');
    } catch (error) { console.error(`FAIL cleanup: ${sanitized(error.message)}`); process.exitCode = 1; }
    await db.$disconnect();
  }
  if (!process.exitCode) console.log(`Neon end-to-end verification passed (${checks.length} checks).`);
})();

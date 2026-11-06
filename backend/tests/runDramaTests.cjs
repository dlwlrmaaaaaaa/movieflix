const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const name = `annahflix-drama-test-${randomUUID().slice(0, 8)}`;
const password = randomUUID();
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
try {
  docker('run', '--detach', '--name', name, '--env', `POSTGRES_PASSWORD=${password}`, '--env', 'POSTGRES_DB=annahflix_drama_test', '--publish', '127.0.0.1::5432', 'postgres:16-alpine');
  const port = docker('port', name, '5432/tcp').split(':').pop();
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/annahflix_drama_test`;
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, DRAMA_TEST_DATABASE_URL: url };
  // pg_isready retries locally; no external or production database is contacted.
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); ready = true; break; } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); }
  }
  if (!ready) throw new Error('Local PostgreSQL did not become ready.');
  const initial = fs.readFileSync(path.join(root, 'prisma/migrations/20261102000000_initial_schema/migration.sql'), 'utf8');
  const legacy = `INSERT INTO "User" (id,email,"passwordHash","displayName","updatedAt") VALUES ('legacy-user','legacy@example.test','test','Legacy',now());
    INSERT INTO "Movie" (id,"ownerId",title,"originalFilename","storageKey","mimeType","fileSize",status,"updatedAt") VALUES ('legacy-movie','legacy-user','Preserved movie','legacy.mp4','legacy/movie','video/mp4',123,'READY',now());`;
  execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'annahflix_drama_test', '-v', 'ON_ERROR_STOP=1'], { input: initial + legacy, stdio: ['pipe', 'ignore', 'inherit'] });
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'resolve', '--applied', '20261102000000_initial_schema'], { cwd: root, env, stdio: 'inherit' });
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: root, env, stdio: 'inherit' });
  execFileSync(process.execPath, [require.resolve('tsx/cli'), 'tests/drama.test.ts'], { cwd: root, env, stdio: 'inherit' });
} finally {
  try { docker('rm', '--force', name); } catch { /* Preserve original test failure. */ }
}

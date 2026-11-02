import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadBackendEnvironment } from '../environment.cjs';

test('Neon root variables reach the API without replacing existing backend service settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'annahflix-env-test-'));
  const backend = path.join(root, 'backend'); fs.mkdirSync(backend);
  try {
    fs.writeFileSync(path.join(root, '.env.local'), 'DATABASE_URL=postgresql://test@ep-test-pooler.neon.tech/db\nDATABASE_URL_UNPOOLED=postgresql://test@ep-test.neon.tech/db\nNEON_BRANCH=production\n');
    fs.writeFileSync(path.join(backend, '.env'), 'DATABASE_URL=postgresql://test@localhost/db\nLIVEKIT_API_SECRET=existing-test-secret\nJWT_SECRET=local-test-secret\n');
    const env = loadBackendEnvironment(backend, { JWT_SECRET: 'injected-test-secret' });
    assert.equal(new URL(env.DATABASE_URL!).hostname, 'ep-test-pooler.neon.tech');
    assert.equal(new URL(env.DATABASE_URL_UNPOOLED!).hostname, 'ep-test.neon.tech');
    assert.equal(env.JWT_SECRET, 'injected-test-secret');
    assert.equal(env.LIVEKIT_API_SECRET, 'existing-test-secret');
    assert.equal(env.NEON_BRANCH, 'production');
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('ordinary Postgres can reuse its direct URL; a Neon pooler never becomes a migration URL', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'annahflix-env-test-'));
  const backend = path.join(root, 'backend'); fs.mkdirSync(backend);
  try {
    const local = loadBackendEnvironment(backend, { DATABASE_URL: 'postgresql://test@localhost/db' });
    assert.equal(local.DATABASE_URL_UNPOOLED, local.DATABASE_URL);
    const pooled = loadBackendEnvironment(backend, { DATABASE_URL: 'postgresql://test@ep-test-pooler.neon.tech/db' });
    assert.equal(pooled.DATABASE_URL_UNPOOLED, undefined);
  } finally { fs.rmSync(root, { recursive: true }); }
});

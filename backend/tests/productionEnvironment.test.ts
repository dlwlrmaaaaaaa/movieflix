import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateProductionEnvironment } from '../src/config/production';

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://test:private-password@db.example.test/annahflix?sslmode=require',
  JWT_SECRET: 'a-random-production-secret-of-at-least-32-characters',
  CORS_ORIGIN: 'https://annahflix.example.test',
  PUBLIC_WEB_URL: 'https://annahflix.example.test',
  TMDB_ACCESS_TOKEN: 'private-tmdb-token',
  TRUST_PROXY_HOPS: '1',
};

test('production accepts configured HTTPS deployment and local development stays usable', () => {
  validateProductionEnvironment(valid);
  validateProductionEnvironment({ NODE_ENV: 'development' });
});

test('mobile-only production starts without a website or browser origin', () => {
  validateProductionEnvironment({ ...valid, CORS_ORIGIN: undefined, PUBLIC_WEB_URL: undefined });
  validateProductionEnvironment({ ...valid, CORS_ORIGIN: '', PUBLIC_WEB_URL: '' });
  validateProductionEnvironment({ ...valid, CORS_ORIGIN: '  ', PUBLIC_WEB_URL: '  ' });
  // Either optional setting may be configured independently.
  validateProductionEnvironment({ ...valid, CORS_ORIGIN: undefined });
  validateProductionEnvironment({ ...valid, PUBLIC_WEB_URL: undefined });
});

test('production rejects unsafe defaults without exposing credential values', () => {
  for (const [key, value] of Object.entries({ JWT_SECRET: 'dev_only', CORS_ORIGIN: '*', PUBLIC_WEB_URL: 'http://example.test', TRUST_PROXY_HOPS: 'true', ALLOW_HTTP_STREAMS: 'true', DATABASE_URL: 'not-a-database' })) {
    assert.throws(() => validateProductionEnvironment({ ...valid, [key]: value }), (error: any) => {
      assert.match(error.message, new RegExp(key));
      assert.ok(!error.message.includes('private-password'));
      assert.ok(!error.message.includes('private-tmdb-token'));
      return true;
    });
  }
});

test('production permits either TMDB credential format and requires one', () => {
  validateProductionEnvironment({ ...valid, TMDB_ACCESS_TOKEN: '', TMDB_API_KEY: 'test-api-key' });
  assert.throws(() => validateProductionEnvironment({ ...valid, TMDB_ACCESS_TOKEN: '' }), /TMDB/);
});

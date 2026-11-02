import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryCache } from '../src/services/memoryCache';
import { RequestLimiter } from '../src/services/requestLimiter';
import { queryClient } from '../../mobile/src/services/queryClient';
import { TmdbService, UpstreamServiceError } from '../src/services/tmdb.service';
import { ENV } from '../src/config/env';

test('simultaneous cold metadata requests share one upstream operation', async () => {
  const cache = new MemoryCache(3); let loads = 0;
  const results = await Promise.all(Array.from({ length: 20 }, () => cache.getOrLoad('movie:550', 60, async () => { loads++; await Promise.resolve(); return { id: 550 }; })));
  assert.equal(loads, 1); assert.ok(results.every((result) => result.id === 550));
  await cache.getOrLoad('movie:550', 60, async () => { loads++; return { id: 550 }; });
  assert.equal(loads, 1);
});

test('failed loads are not cached and bounded cache evicts least recently used metadata', async () => {
  const cache = new MemoryCache(2);
  await assert.rejects(cache.getOrLoad('error', 60, async () => { throw new Error('offline'); }));
  assert.equal(await cache.getOrLoad('error', 60, async () => 'recovered'), 'recovered');
  cache.set('movie:a', 'a', 60); cache.get('error'); cache.set('movie:b', 'b', 60);
  assert.equal(cache.get('movie:a'), undefined); assert.equal(cache.get('error'), 'recovered');
});

test('TMDB work stays inside the concurrency limit, including queued requests', async () => {
  const limiter = new RequestLimiter(4); let active = 0; let peak = 0;
  await Promise.all(Array.from({ length: 30 }, () => limiter.run(async () => { active++; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 2)); active--; })));
  assert.equal(peak, 4); assert.equal(active, 0);
});

test('client metadata requests deduplicate and reuse fresh responses across routes', async () => {
  let requests = 0;
  const options = { queryKey: ['test', 'movie', 550], staleTime: 60_000, queryFn: async () => { requests++; await Promise.resolve(); return { id: 550 }; } };
  await Promise.all([queryClient.fetchQuery(options), queryClient.fetchQuery(options)]);
  await queryClient.fetchQuery(options);
  assert.equal(requests, 1); queryClient.clear();
});

test('obsolete client searches abort their fetch and do not cache old results', async () => {
  let aborted = false;
  const pending = queryClient.fetchQuery({ queryKey: ['test-search', 'old'], queryFn: ({ signal }) => new Promise((resolve, reject) => { signal.addEventListener('abort', () => { aborted = true; reject(new Error('cancelled')); }); }) });
  await queryClient.cancelQueries({ queryKey: ['test-search', 'old'] });
  await pending.catch(() => undefined);
  assert.equal(aborted, true); assert.equal(queryClient.getQueryData(['test-search', 'old']), undefined); queryClient.clear();
});

test('TMDB service deduplicates actual fetches, sizes backdrops, and honors Retry-After', async () => {
  const originalFetch = global.fetch;
  const originalToken = ENV.TMDB_ACCESS_TOKEN;
  ENV.TMDB_ACCESS_TOKEN = 'isolated-test-token';
  let upstreamCalls = 0;
  try {
    global.fetch = async () => {
      upstreamCalls++;
      await Promise.resolve();
      return new Response(JSON.stringify({ id: 991101, title: 'Test metadata', backdrop_path: '/test.jpg', genres: [] }), { status: 200 });
    };
    const movies = await Promise.all(Array.from({ length: 20 }, () => TmdbService.details(991101)));
    assert.equal(upstreamCalls, 1);
    assert.ok(movies.every((movie) => movie.backdropUrl?.includes('/w1280/')));
    await TmdbService.details(991101);
    assert.equal(upstreamCalls, 1);
    global.fetch = async () => { upstreamCalls++; return new Response('', { status: 429, headers: { 'Retry-After': '2' } }); };
    await assert.rejects(TmdbService.details(991102), (error) => error instanceof UpstreamServiceError && error.statusCode === 429 && error.retryAfterSeconds === 2);
    const callsAtLimit = upstreamCalls;
    await assert.rejects(TmdbService.details(991103), (error) => error instanceof UpstreamServiceError && error.statusCode === 429);
    assert.equal(upstreamCalls, callsAtLimit);
  } finally { global.fetch = originalFetch; ENV.TMDB_ACCESS_TOKEN = originalToken; }
});

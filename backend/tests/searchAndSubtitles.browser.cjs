// Optional browser regression suite. Requires a user-built mobile/dist, the
// existing local Playwright setup, and the authorized flower MP4 fixture.
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.TF_PLAYWRIGHT_PATH || path.join(os.tmpdir(), 'togetherflix-ui-tools/node_modules/playwright'));
const app = express();
app.get('/fixture.mp4', (_req, res) => res.sendFile(path.join(os.tmpdir(), 'togetherflix-test-flower.mp4')));
app.use(express.static(path.resolve(__dirname, '../../mobile/dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve(__dirname, '../../mobile/dist/index.html')));
const server = http.createServer(app);
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const requests = []; const failures = []; const errors = []; const progress = [];
  const user = { id: 'search-viewer', email: 'viewer@example.test', displayName: 'Viewer', role: 'USER' };
  const result = (id, title, mediaType = 'tv') => ({ id, title, mediaType, category: mediaType === 'tv' ? 'cdrama' : 'movie', originalTitle: title, posterUrl: null, releaseDate: '2026-01-01', originalLanguage: 'zh', originCountries: ['CN'], genreIds: [18], rating: 8 });
  const episode = { id: 'fixture-episode', dramaId: 'fixture-drama', seasonId: 'fixture-season', seasonNumber: 1, episodeNumber: 1, title: 'Fixture episode', description: '', available: true, watched: false, runtime: 1, thumbnailUrl: null, airDate: null };
  const drama = { tmdbId: 300, title: 'New drama', originalTitle: 'New drama', category: 'c-drama', originalLanguage: 'zh', originCountry: ['CN'], posterUrl: null, backdropUrl: null, description: 'Correct drama details', year: 2026, rating: 8, genres: ['Drama'], cast: [], seasons: [{ seasonNumber: 1, title: 'Season 1', episodeCount: 1 }] };
  const subtitles = [{ id: 'en-file', language: 'en', label: 'English', cues: [{ start: 0, end: 2, text: 'Caption before seek' }, { start: 2, end: 60, text: 'Caption after seek' }] }];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.routeWebSocket('**/socket.io/**', (socket) => socket.close());
    await context.addInitScript((profile) => { localStorage.setItem('@togetherflix_access_token', 'fixture'); localStorage.setItem('@togetherflix_user_profile', JSON.stringify(profile)); }, user);
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url()); const p = url.pathname;
      if (!p.startsWith('/api/')) return url.origin === base ? route.continue() : route.abort();
      const ok = (body) => route.fulfill({ json: body }).catch(() => undefined);
      if (p === '/api/auth/me') return ok({ success: true, user });
      if (p === '/api/search') {
        requests.push(url); const query = url.searchParams.get('query');
        if (query === 'old query') { await new Promise((resolve) => setTimeout(resolve, 1000)); return ok({ page: 1, nextPage: null, results: [result(99, 'Old stale drama')] }); }
        const page = Number(url.searchParams.get('page'));
        return ok({ page, nextPage: page === 1 ? 2 : null, results: page === 1 ? [result(300, 'New drama'), result(300, 'New drama'), result(300, 'New movie', 'movie')] : [result(300, 'New drama'), result(301, 'Another drama')] });
      }
      if (p === '/api/dramas/300') return ok({ drama });
      if (p.endsWith('/seasons/1')) return ok({ episodes: [episode] });
      if (p.endsWith('/subtitles')) return ok({ subtitles });
      if (p.endsWith('/progress-session')) return ok({ sessionId: 'fixture-session', positionSeconds: 0 });
      if (p.endsWith('/progress')) { progress.push(route.request().postDataJSON()); return ok({ accepted: true }); }
      if (p.endsWith('/playback')) return ok({ episode, drama, movieId: 'fixture-source', playbackUrl: `${base}/fixture.mp4`, expiresInSeconds: null, subtitles: [] });
      if (p.endsWith('/next')) return ok({ episode: null });
      if (p === '/api/dramas') return ok({ page: 1, totalPages: 1, results: [] });
      if (p.startsWith('/api/movies/')) return ok({ results: [], page: 1, totalPages: 1 });
      return ok({ success: true, items: [], messages: [] });
    });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message)); page.on('requestfailed', (request) => failures.push(request));
    await page.goto(`${base}/home`);
    const search = page.getByRole('textbox', { name: 'Search movies, K-Dramas, C-Dramas, TV Shows', exact: true });
    await search.waitFor(); assert.equal(await search.count(), 1);
    assert.equal(await page.getByRole('textbox', { name: 'Search drama titles', exact: true }).count(), 0);
    const bounds = await search.boundingBox(); assert(bounds && bounds.y < 250);
    await search.fill('old query');
    await page.waitForRequest((request) => new URL(request.url()).searchParams.get('query') === 'old query');
    await search.fill('new query');
    await page.getByRole('button', { name: 'Open New drama', exact: true }).waitFor();
    await page.waitForTimeout(1200);
    assert.equal(await page.getByRole('button', { name: 'Open Old stale drama', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Open New drama', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Open New movie', exact: true }).count(), 1);
    assert(requests.filter((url) => url.searchParams.get('query') === 'new query' && url.searchParams.get('page') === '1').length === 1);
    assert(failures.some((request) => request.url().includes('old+query') || request.url().includes('old%20query')));
    if (await page.getByRole('button', { name: 'Load more', exact: true }).count()) await page.getByRole('button', { name: 'Load more', exact: true }).click();
    await page.getByRole('button', { name: 'Open Another drama', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open New drama', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Open New drama', exact: true }).click();
    await page.waitForURL(/\/drama\/300$/); await page.getByText('Correct drama details', { exact: true }).waitFor();
    await page.getByText('Watch Now', { exact: true }).click();
    await page.locator('video').waitFor(); await page.getByText('Caption before seek', { exact: true }).waitFor();
    await page.locator('video').evaluate((video) => { video.pause(); video.currentTime = 3; });
    await page.getByText('Caption after seek', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Off', exact: true }).click();
    await page.getByText('Caption after seek', { exact: true }).waitFor({ state: 'hidden' });
    // Browser text-track discovery is exercised without assuming HLS support.
    await page.locator('video').evaluate((video) => { const track = video.addTextTrack('subtitles', 'Filipino', 'fil'); track.addCue(new VTTCue(0, 60, 'Native browser caption')); track.mode = 'hidden'; });
    await page.getByRole('button', { name: /Filipino, browser text track/ }).click();
    await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'showing');
    assert.equal(await page.locator('video').count(), 1); assert(progress.length > 0); assert.deepEqual(errors, []);
    console.log('Unified search/cancellation/pagination/navigation and external/browser subtitle regression checks passed.');
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

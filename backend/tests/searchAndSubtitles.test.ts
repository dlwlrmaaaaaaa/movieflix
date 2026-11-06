import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { classifyTvContent, contentDetailsPath, contentIdentity, normalizeSearchQuery, uniqueContentResults } from '../../shared/src/search';
import type { ContentSearchResult } from '../../shared/src/search';
import { activeSubtitleText, subtitleLabel, subtitleLanguageMatches } from '../../mobile/src/services/subtitleTracks';
import { normalizeSubtitles, validSubtitleLanguage } from '../src/services/subtitle.service';
import { validateSubtitleMime } from '../src/services/remoteSubtitle.service';
import { isPrivateAddress } from '../src/services/streamValidation';
import { TmdbService } from '../src/services/tmdb.service';
import { ENV } from '../src/config/env';

const content = (id: number, mediaType: 'movie' | 'tv', title = 'Same title'): ContentSearchResult => ({ id, mediaType, title, category: mediaType === 'movie' ? 'movie' : 'cdrama', originalTitle: title, posterUrl: null, releaseDate: null, originalLanguage: 'zh', originCountries: ['CN'], genreIds: [18], rating: 8 });
test('canonical media identity preserves distinct productions and removes cross-page TV duplicates', () => {
  const results = uniqueContentResults([content(123, 'tv'), content(123, 'tv'), content(123, 'movie'), content(456, 'tv')]);
  assert.deepEqual(results.map(contentIdentity), ['tv:123', 'movie:123', 'tv:456']);
  assert.equal(contentDetailsPath(results[0]), '/drama/123'); assert.equal(contentDetailsPath(results[1]), '/movie/123');
});
test('classification requires matching language and origin and excludes Taiwan/Hong Kong from mainland', () => {
  assert.equal(classifyTvContent('ko', ['KR']), 'kdrama'); assert.equal(classifyTvContent('ko', []), 'tv');
  assert.equal(classifyTvContent('en', ['KR']), 'tv'); assert.equal(classifyTvContent('zh', ['CN']), 'cdrama');
  for (const countries of [['TW'], ['HK'], ['CN', 'HK'], ['CN', 'TW'], []]) assert.equal(classifyTvContent('zh', countries), 'tv');
});
test('query normalization handles whitespace without changing original-language titles', () => {
  assert.equal(normalizeSearchQuery('  我的\n  드라마  '), '我的 드라마'); assert.equal(normalizeSearchQuery(' \t\n '), '');
});
test('one cached TV search feeds all category filters, scans later pages, and exposes its cursor', async () => {
  const originalFetch = global.fetch; const originalToken = ENV.TMDB_ACCESS_TOKEN; ENV.TMDB_ACCESS_TOKEN = 'test-token';
  const calls: URL[] = [];
  global.fetch = async (input) => {
    const url = new URL(String(input)); calls.push(url);
    const page = Number(url.searchParams.get('page'));
    return Response.json({ page, total_pages: 5, results: page === 1 ? [{ id: 11, name: 'Other TV', original_language: 'en', origin_country: ['US'], genre_ids: [18] }] : [{ id: 12, name: 'Mainland Drama', original_language: 'zh', origin_country: ['CN'], genre_ids: [18] }] });
  };
  try {
    const first = await TmdbService.searchContent(' unique-regression-20261106 ', 1, { category: 'cdrama' });
    assert.equal(calls.length, 3); assert(first.results.some((item) => item.id === 12)); assert.equal(first.nextPage, 4);
    assert.equal(first.results.filter((item) => item.id === 12).length, 1);
    await TmdbService.searchContent('unique-regression-20261106', 1, { category: 'tv' });
    assert.equal(calls.length, 3, 'category changes reuse cached upstream TV pages');
    const second = await TmdbService.searchContent('unique-regression-20261106', first.nextPage, { category: 'cdrama' });
    assert.equal(second.nextPage, null); assert.equal(calls.length, 5);
    assert.equal(uniqueContentResults([...first.results, ...second.results]).filter((item) => item.id === 12).length, 1);
    const count = calls.length;
    assert.deepEqual((await TmdbService.searchContent('  ', 1)).results, []); assert.equal(calls.length, count);
    await assert.rejects(TmdbService.searchContent('x', 1)); await assert.rejects(TmdbService.searchContent('x'.repeat(101), 1));
    await assert.rejects(TmdbService.searchContent('valid query', 1, { year: 'bad' }));
  } finally { global.fetch = originalFetch; ENV.TMDB_ACCESS_TOKEN = originalToken; }
});
test('SRT and VTT normalize safely and overlay cues follow pause, seek, and timing offset', () => {
  const input = '\uFEFF1\r\n00:00:01,000 --> 00:00:03,000\r\n<b>Hello</b>\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\n안녕하세요';
  const normalized = normalizeSubtitles(input);
  assert.equal(activeSubtitleText(normalized.cues, 2), 'Hello'); assert.equal(activeSubtitleText(normalized.cues, 2), 'Hello', 'paused clock is stable');
  assert.equal(activeSubtitleText(normalized.cues, 6), '안녕하세요', 'seek chooses destination cue');
  assert.equal(activeSubtitleText(normalized.cues, 4), ''); assert.equal(activeSubtitleText(normalized.cues, 3.2, 0.5), 'Hello');
  assert.equal(activeSubtitleText([], 1), '');
  assert.deepEqual(normalizeSubtitles(normalized.vtt).cues, normalized.cues);
  assert.equal(normalizeSubtitles('WEBVTT\nKind: captions\nLanguage: en\n\n00:01.000 --> 00:02.000\nHello').cues.length, 1);
  for (const malformed of ['<html>Page</html>', '1\n00:00:03,000 --> 00:00:01,000\nBackwards', '1\n00:99:00,000 --> 00:99:01,000\nBad', '\uFFFD']) assert.throws(() => normalizeSubtitles(malformed));
});
test('subtitle labels match actual language metadata including ExoPlayer ISO-639 aliases', () => {
  assert(subtitleLanguageMatches('eng', 'en')); assert(subtitleLanguageMatches('tl', 'fil'));
  assert(subtitleLanguageMatches('zh-CN', 'zh-Hans')); assert(!subtitleLanguageMatches('zh-TW', 'zh-Hans'));
  assert.equal(subtitleLabel('zh-Hant'), 'Chinese Traditional'); assert(validSubtitleLanguage('ja')); assert(!validSubtitleLanguage('../en'));
});
test('remote subtitle validation rejects web pages, invalid encodings, and private/mapped hosts', () => {
  validateSubtitleMime('text/vtt; charset=utf-8', '/subtitles'); validateSubtitleMime('application/octet-stream', '/en.srt');
  assert.throws(() => validateSubtitleMime('text/html', '/en.vtt')); assert.throws(() => validateSubtitleMime('text/plain; charset=windows-1252', '/en.srt'));
  for (const address of ['127.0.0.1', '10.0.0.1', '100.64.0.1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fe80::1']) assert(isPrivateAddress(address));
});
test('Android track bridge applies once to the installed SDK 51 adapter and fails on an unknown layout', () => {
  const require = createRequire(__filename);
  const { patchVideoModule } = require('../../mobile/plugins/withSubtitleTracks.js');
  const packageFile = require.resolve('../../mobile/node_modules/expo-video/package.json');
  const source = fs.readFileSync(require('node:path').join(require('node:path').dirname(packageFile), 'android/src/main/java/expo/modules/video/VideoModule.kt'), 'utf8');
  const patched = patchVideoModule(source);
  assert.equal(patchVideoModule(patched), patched);
  assert(patched.includes('Property("annahSubtitleTracks")')); assert(patched.includes('Property("annahSubtitleTrackId")'));
  assert.throws(() => patchVideoModule('unknown adapter'));
});

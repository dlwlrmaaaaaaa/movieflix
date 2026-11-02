import { SyncEngine } from '../src/sockets/utils/syncEngine';
import { generateRoomCode } from '../src/utils/roomCode';
import { generateToken, verifyToken } from '../src/utils/token';
import { canStartSynchronizedPlayback, expectedPlaybackPosition, screenShareFallbackMode } from '../src/sockets/utils/roomPolicy';
import { detectStreamFormat, parsePublicStreamUrl } from '../src/services/streamValidation';
import { validateImportedMpd } from '../src/services/mpdImport.service';
import { isRecognizedLicenseUrl, normalizeMovieTitle } from '../src/providers/InternetArchiveProvider';
import { StreamingSourceService } from '../src/services/streamingSource.service';
import { EmbedProviderRegistry, validatedTmdbId } from '../src/services/embedProviderRegistry';
import { buildMovieEmbedUrl, buildTvEpisodeEmbedUrl, EmbedMediaRequest, validatedEpisode, validatedSeason } from '../src/services/embedUrlBuilder';
import { EMBED_PROVIDER_CONFIGS, EmbedProviderConfig } from '../src/config/embedProviders';
import { ConfiguredEmbedProvider } from '../src/providers/ConfiguredEmbedProvider';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName}`);
    failed++;
  }
}

console.log('🧪 Running TogetherFlix Backend Test Suite...\n');

// 1. Room Code Generation
console.log('[1. Room Code Suite]');
const code1 = generateRoomCode();
assert(/^TF-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(code1), `Room code format (${code1})`);

let noAmbiguous = true;
for (let i = 0; i < 50; i++) {
  if (/[0O1I]/.test(generateRoomCode())) {
    noAmbiguous = false;
    break;
  }
}
assert(noAmbiguous, 'No ambiguous characters (0, O, 1, I) across 50 generated codes');

// 2. Title Normalization
console.log('\n[2. Movie Title Normalization]');
const clean1 = SyncEngine.cleanMovieTitle('Inception.2010.1080p.BluRay.x264-[YTS.MX].mp4');
assert(clean1 === 'inception 2010', `Clean YTS tag: "${clean1}" === "inception 2010"`);

const clean2 = SyncEngine.cleanMovieTitle('La.La.Land.2016.720p.WEBRip.x265-RARBG.mkv');
assert(clean2 === 'la la land 2016', `Clean RARBG tag: "${clean2}" === "la la land 2016"`);

// 3. Compatibility Heuristics
console.log('\n[3. Compatibility Heuristics]');
const hostExact = {
  userId: 'u1',
  displayName: 'Partner 1',
  fileName: 'Interstellar.2014.1080p.mp4',
  durationSeconds: 10140.2,
  isReady: false,
  pickedAt: new Date().toISOString(),
};
const guestExact = {
  userId: 'u2',
  displayName: 'Partner 2',
  fileName: 'Interstellar (2014) [YTS].mp4',
  durationSeconds: 10140.8,
  isReady: false,
  pickedAt: new Date().toISOString(),
};

const resExact = SyncEngine.evaluateCompatibility(hostExact, guestExact);
assert(resExact.grade === 'PERFECT_MATCH', 'Identical duration identified as PERFECT_MATCH');
assert(resExact.durationDiffSeconds <= 1.0, 'Duration delta <= 1.0s');

const guestWarning = { ...guestExact, durationSeconds: 10144.5 };
const resWarning = SyncEngine.evaluateCompatibility(hostExact, guestWarning);
assert(resWarning.grade === 'COMPATIBLE_WARNING', '4.3s duration difference identified as COMPATIBLE_WARNING');

const guestMismatch = { ...guestExact, durationSeconds: 10800.0 };
const resMismatch = SyncEngine.evaluateCompatibility(hostExact, guestMismatch);
assert(resMismatch.grade === 'MISMATCH_ALERT', '>6s duration difference identified as MISMATCH_ALERT');

// 4. JWT Authentication
console.log('\n[4. JWT Token Authentication]');
const testToken = generateToken({ userId: 'user-xyz-99', email: 'love@togetherflix.com' });
assert(typeof testToken === 'string' && testToken.length > 20, 'Token generated');

const decoded = verifyToken(testToken);
assert(decoded.userId === 'user-xyz-99', `Decoded userId matches: "${decoded.userId}"`);
assert(decoded.email === 'love@togetherflix.com', `Decoded email matches: "${decoded.email}"`);

console.log('\n[5. Shared Cloud Movie Readiness]');
const viewerStates = [
  { userId: 'host', selectedMovieId: 'movie', state: 'READY' },
  { userId: 'guest', selectedMovieId: 'movie', state: 'READY' },
];
assert(canStartSynchronizedPlayback(['host', 'guest'], viewerStates, 'movie'), 'Both prepared viewers can start together');
assert(!canStartSynchronizedPlayback(['host', 'guest'], [{ ...viewerStates[1], state: 'BUFFERING' }, viewerStates[0]], 'movie'), 'Buffering viewer prevents start');
assert(expectedPlaybackPosition(10, true, 1000, 3500) === 12.5, 'Late join position uses authoritative server time');
assert(screenShareFallbackMode(true) === 'DIRECT', 'Stopped screen sharing returns a room with a selected movie to direct mode');
assert(screenShareFallbackMode(false) === 'MANUAL', 'Stopped screen sharing without a selected movie returns to manual mode');

console.log('\n[6. Remote Streaming Source Policy]');
assert(detectStreamFormat(parsePublicStreamUrl('https://cdn.example.com/movie.mpd')) === 'DASH', 'MPEG-DASH manifest is detected');
assert(detectStreamFormat(parsePublicStreamUrl('https://cdn.example.com/movie.m3u8')) === 'HLS', 'HLS manifest is detected');
assert(detectStreamFormat(parsePublicStreamUrl('https://cdn.example.com/movie.webm')) === 'WEBM', 'WebM source is detected');
let rejectedPrivateUrl = false;
try { parsePublicStreamUrl('https://127.0.0.1/internal.mpd'); } catch { rejectedPrivateUrl = true; }
assert(rejectedPrivateUrl, 'Private streaming URLs are blocked before fetch');

console.log('\n[7. Authorized Provider Matching]');
assert(normalizeMovieTitle('Night of the Living Dead!') === normalizeMovieTitle('Night-of-the-Living-Dead'), 'Provider titles normalize deterministically');
assert(isRecognizedLicenseUrl('https://creativecommons.org/publicdomain/mark/1.0/'), 'Explicit Creative Commons public-domain mark is accepted');
assert(!isRecognizedLicenseUrl('https://example.com/license') && !isRecognizedLicenseUrl(''), 'Unknown or missing licenses are rejected');

console.log('\n[8. Authorized Embed Provider Policy]');
assert(EMBED_PROVIDER_CONFIGS.every((provider) => !provider.enabled || (
  provider.distributionPermissionVerified
  && provider.baseUrl.startsWith('https://')
  && provider.allowedEmbedHosts.includes(new URL(provider.baseUrl).hostname)
  && !provider.supportsPlaybackControl
  && !provider.supportsSynchronization
)), 'Enabled iframe providers require verified permission, HTTPS allowlisting, and no undocumented playback control');
let rejectedEmbedId = false;
try { validatedTmdbId('not-a-movie'); } catch { rejectedEmbedId = true; }
assert(rejectedEmbedId, 'Invalid TMDB IDs are rejected before provider resolution');

const permittedTestProvider = {
  id: 'youtube-official-test', name: 'YouTube Official Test Player', enabled: true,
  distributionPermissionVerified: true, supportsWeb: true, supportsMobile: true,
  supportsPlaybackControl: false, supportsSynchronization: false,
  allowedEmbedHosts: ['www.youtube-nocookie.com'],
  isAvailable: async (request: EmbedMediaRequest) => request.tmdbId === 1,
  getEmbedUrl: (_request: EmbedMediaRequest) => 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
};
const disabledTestProvider = { ...permittedTestProvider, id: 'disabled-test', enabled: false };

const templateConfig: EmbedProviderConfig = {
  id: 'template-test', name: 'Template Test', enabled: true,
  distributionPermissionVerified: true, baseUrl: 'https://player.example.com',
  moviePath: '/embed/movie/{TMDB_ID}',
  tvPath: '/embed/tv/{TMDB_ID}/{SEASON}/{EPISODE}',
  tvQueryPath: '/embed/tv/{TMDB_ID}?s={SEASON}&e={EPISODE}',
  tvUrlFormat: 'path', supportsWeb: true, supportsMobile: true,
  supportsPlaybackControl: false, supportsSynchronization: false,
  allowedEmbedHosts: ['player.example.com'],
};
assert(buildMovieEmbedUrl(templateConfig, 533535) === 'https://player.example.com/embed/movie/533535', 'Movie iframe URL maps a validated TMDB ID');
assert(buildTvEpisodeEmbedUrl(templateConfig, 1399, 2, 3) === 'https://player.example.com/embed/tv/1399/2/3', 'TV iframe path maps TMDB, season, and episode IDs');
assert(buildTvEpisodeEmbedUrl(templateConfig, 1399, 2, 3, 'query') === 'https://player.example.com/embed/tv/1399?s=2&e=3', 'TV iframe query format maps validated episode fields');
let rejectedEpisodeInput = false;
try { validatedSeason(0); validatedEpisode('episode-one'); } catch { rejectedEpisodeInput = true; }
assert(rejectedEpisodeInput, 'Invalid season or episode values are rejected');
let rejectedUndocumentedControl = false;
try { new ConfiguredEmbedProvider({ ...templateConfig, supportsPlaybackControl: true, supportsSynchronization: true }); } catch { rejectedUndocumentedControl = true; }
assert(rejectedUndocumentedControl, 'Generic iframe providers cannot claim playback control or synchronization');

console.log(`\n========================================`);
console.log(`🎉 Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);

const minimalMpd = `<?xml version="1.0"?><MPD type="static"><Period><AdaptationSet contentType="video"><Representation id="v1" bandwidth="1000"><SegmentTemplate timescale="1" /></Representation></AdaptationSet><AdaptationSet contentType="audio"><Representation id="a1" bandwidth="128" /></AdaptationSet></Period></MPD>`;
void Promise.all([
  validateImportedMpd(minimalMpd),
  StreamingSourceService.find({
    id: 1, title: 'Test Movie', originalTitle: 'Test Movie', overview: '', releaseDate: '1950-01-01', releaseYear: 1950,
    posterUrl: null, backdropUrl: null, rating: 0, voteCount: 0, genreIds: [], runtimeMinutes: 90, genres: [], trailer: null,
  }, [{
    id: 'failing-provider',
    search: async () => { throw new Error('provider offline'); },
    getDetails: async () => ({}),
    getPlayableSources: async () => [],
    validateSource: async () => false,
  }]),
  new EmbedProviderRegistry([disabledTestProvider, permittedTestProvider]).resolve(1, 'web'),
  new EmbedProviderRegistry([{ ...permittedTestProvider, distributionPermissionVerified: false }]).resolve(1, 'web'),
  new EmbedProviderRegistry([new ConfiguredEmbedProvider(templateConfig)]).resolveTvEpisode(1399, 2, 3, 'web'),
  new EmbedProviderRegistry([new ConfiguredEmbedProvider(templateConfig)]).resolveTvEpisode(1399, 2, 3, 'web', 'query'),
]).then(([imported, failedProviderSources, embeddedPlayer, unauthorizedPlayer, tvPathPlayer, tvQueryPlayer]) => {
  assert(imported.videoRepresentations === 1 && imported.audioRepresentations === 1, 'MPD import identifies video and audio representations');
  assert(failedProviderSources.length === 0, 'Provider failures return no fake or unrelated source');
  assert(embeddedPlayer?.embedUrl.startsWith('https://www.youtube-nocookie.com/embed/') === true, 'Permitted test player renders from its allowlisted HTTPS host');
  assert(embeddedPlayer?.supportsSynchronization === false, 'Embed without a control API is marked unsynchronized');
  assert(unauthorizedPlayer === null, 'Provider without verified distribution permission remains disabled');
  assert(tvPathPlayer?.mediaType === 'tv' && tvPathPlayer.season === 2 && tvPathPlayer.episode === 3, 'TV descriptor preserves media and episode metadata');
  assert(tvPathPlayer?.embedUrl === 'https://player.example.com/embed/tv/1399/2/3', 'Registry selects the configured TV path format');
  assert(tvQueryPlayer?.embedUrl === 'https://player.example.com/embed/tv/1399?s=2&e=3', 'Registry supports a TV query-format override');
  console.log(`Final Test Results: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

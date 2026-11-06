# Search and subtitle changes

## Findings from the existing code

- `home.tsx` mounted both MovieDiscovery and DramaDiscovery for the search view.
  Each component owned a different input, query state, debounce, and search UI.
- DramaDiscovery queried the same TV search separately for K-Drama, C-Drama, and
  general TV rows. A C-Drama consequently appeared in multiple rows. The movie
  component searched only page one.
- The subtitle selector only read imported `EpisodeSubtitle` database records.
  It never discovered container, HLS, DASH, or browser text tracks. No imported
  file meant that the selector had no tracks even when a stream contained text.
- Preferences used a device-wide storage key. Missing tracks, failed track
  requests, and unsupported native controls were not distinguished.
- Installed versions are Expo SDK 51 and expo-video 1.1.x. The installed Android
  sources use Media3 1.2.1 PlayerView and include DASH/HLS modules, but expose no
  JavaScript subtitle-track discovery/selection properties.
- Embedded providers run independent iframe/WebView players. Their tracks are
  controlled inside those players; they cannot be inspected through expo-video.

## Implementation

### One search interface

Home owns one UnifiedSearch component. Its field and category filters stay above
the scrolling content. MovieDiscovery and DramaDiscovery retain browsing,
watchlists, history, hero cards, and discovery rows, while their search interfaces
and independent search state have been removed. Search results route movies to
`/movie/:id` and every TV category to the existing `/drama/:id` screen.

`GET /api/search` accepts `query`, `category` (`all`, `movie`, `kdrama`, `cdrama`,
`tv`), `page`, `year`, `country`, and `genre`. TV Shows means all television,
including dramas. Each result appears once in the single results list.

The shared result model uses `movie:ID` and `tv:ID` identities. Classification
requires matching language and origin. Mainland C-Drama excludes Taiwan/Hong Kong
origins. Missing origin metadata falls back to general TV rather than inferring
mainland origin from language alone.

The service reuses TMDB credentials, cache, concurrency limits, request
deduplication, retry/timeouts, and Retry-After handling. Category-filtered title
queries scan at most three upstream pages per response and return an explicit
next-page cursor. The UI debounces 350 ms, passes cancellation signals, hides
stale-query results, paginates, deduplicates across pages, and uses virtualized
lists and appropriately sized poster images. Cache lifetime is bounded; the
infinite query retains at most 25 pages. Blank text never triggers title search.
Year/country/genre-only browsing uses the discovery endpoints instead.

Movie origin metadata is hydrated through the existing bounded cache/limiter only
when a country-filtered title search needs it. Normal title searches do not load
details for every card. The legacy movie/drama search endpoints remain available
for existing clients.

### Subtitle playback

- Imported UTF-8 SRT/VTT files remain supported. SRT converts to validated VTT and
  timed cues. Malformed timestamps, invalid encoding, and oversized files fail
  before replacing the saved track. VTT Kind/Language headers are accepted.
- Admins can import a direct authorized subtitle URL through the existing
  subtitle endpoint. The server checks MIME, charset, status, size, and public
  DNS addresses. DNS is pinned for the request, redirects are rejected, and a
  seven-second deadline limits downloads. Expired/denied URLs return an error.
  No browser or app credentials are forwarded. Saved cues avoid playback-time
  CORS and signed-URL-expiry problems.
- Browser players discover their actual `textTracks`. The Android config plugin
  adds discovery/selection properties to expo-video 1.1.9/1.1.10's existing native
  adapter. It exposes only supported text tracks and uses Media3 selection
  overrides; it does not replace the player or alter audio/video selection.
- Native tracks expose their identifier, language, label, MIME format, and selected
  state. The selector includes actual imported/native tracks and Off, recognizes
  English/Filipino/Korean/Chinese aliases, and preserves other available languages.
- Preferences are stored locally under the authenticated user's ID. Host and
  guest choose independently; subtitle changes emit no synchronization commands.
- Imported cues use the actual player clock at a fixed sampling interval. They
  follow pause/seek/rate changes and support a bounded local timing offset.
  Native tracks use the player's renderer and clock; their timing cannot be
  adjusted by the external-overlay offset.
- Subtitle requests are independent of video loading for new clients, and errors
  have a retry state. Track changes do not remount, seek, or restart the player.
- Embedded player screens tell viewers to use the provider's CC/Subtitles control.
  The app does not fabricate languages or inject scripts to bypass provider APIs.

## Files

Search:

- `shared/src/search.ts`, `shared/src/index.ts`
- `backend/src/services/tmdb.service.ts`, `backend/src/routes/search.routes.ts`,
  `backend/src/index.ts`
- `mobile/src/services/contentSearch.ts`,
  `mobile/src/components/movie/UnifiedSearch.tsx`
- `mobile/app/(main)/home.tsx`, `MovieDiscovery.tsx`, `DramaDiscovery.tsx`

Subtitles:

- `mobile/plugins/withSubtitleTracks.js`, `mobile/app.json`, `mobile/UPDATES.md`
- `mobile/src/services/subtitleTracks.ts`, `mobile/src/services/dramas.ts`
- `mobile/src/hooks/useNativeSubtitleTracks.ts`, `useWebSubtitleTracks.ts`
- `mobile/src/components/player/EpisodeSubtitles.tsx`, native/web
  `SoloVideoPlayer` and `VideoPlayerView` implementations
- `mobile/app/episode/[id].tsx`, movie watch/embed screens, `WatchPartyRoom.tsx`,
  `EpisodeAdmin.tsx`
- `backend/src/services/remoteSubtitle.service.ts`, `subtitle.service.ts`,
  `streamValidation.ts`, `drama.service.ts`, `backend/src/routes/drama.routes.ts`

Regression coverage added:

- `backend/tests/searchAndSubtitles.test.ts`: classification, canonical identity,
  routing, normalized/invalid queries, cached TV search, pagination, subtitle
  conversion/timing/language metadata, MIME/address guards, and plugin idempotence.
- `backend/tests/searchAndSubtitles.browser.cjs`: one visible top search input,
  request cancellation, stale responses, duplicate/paginated cards, details
  navigation, authorized MP4/external cues, seek/Off, browser track discovery,
  and retaining one video element. It uses isolated intercepted APIs and the
  existing local authorized flower MP4 fixture.
- `backend/package.json` exposes `test:search-subtitles` for a future requested run.

## Release and verification status

No builds, type checks, tests, browser checks, commits, pushes, publishing,
deployments, or migrations were run for this change, as requested. The regression
files are additions, not evidence that the checks passed. Existing movie, LiveKit,
and two-phone playback require runtime regression verification before release.

The Android subtitle bridge changes native code. App version/runtime is 1.0.1;
build and install a new APK to enable it. OTA alone cannot add native properties
to an older APK. Expo, expo-video, and Android permissions remain unchanged.
Future compatible JS/UI changes can use OTA on this runtime. Deploy the new API
separately. No database schema or migration changes are needed for this refactor.

Android HLS/DASH text availability depends on the actual manifest, codecs, and
Media3 support. WebVTT/compatible TTML tracks are delegated to the native player;
this is not a claim that a particular source has been tested. Image-based or
unsupported subtitles are not converted. Browser HLS/DASH/text capabilities vary.
The bridge is Android-only; iOS retains external overlays and existing native
behavior. Remote URL import expects UTF-8 VTT/SRT, not TTML or webpages.

Subtitle playback is implemented but remains unverified on a supported Android
source. In particular, the config plugin must be compiled in an explicitly
requested future build and exercised with a known subtitle-bearing source.

Primary references consulted:

- [TMDB search](https://developer.themoviedb.org/docs/finding-data)
- [TMDB TV discovery](https://developer.themoviedb.org/reference/discover-tv)
- [Media3 track selection API](https://developer.android.com/reference/androidx/media3/common/TrackSelectionParameters.Builder)
- [Media3 subtitle format support](https://developer.android.com/media/media3/exoplayer/supported-formats)

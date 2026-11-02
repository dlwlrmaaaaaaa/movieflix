# Movie discovery, licensed playback, and screen sharing

## Architecture

TogetherFlix remains an Expo React Native application backed by Express, Prisma/PostgreSQL, Socket.IO, and LiveKit. The existing cloud library, manual stream/manifest import, room codes, chat, reactions, host-authoritative playback, and synchronized player are unchanged and remain available.

The new discovery flow is:

1. The mobile home screen requests trending, popular, top-rated, upcoming, or searched movie metadata from the TogetherFlix backend.
2. The backend calls TMDB with a server-only credential and returns normalized metadata and image URLs. TMDB results are not treated as playable media.
3. Opening a movie asks the backend for authorized sources. The Internet Archive provider requires an exact normalized title, matching release year, movie media type, an explicit recognized Creative Commons/public-domain rights URL, and a reachable MP4 or WebM file.
4. When a source exists, the backend resolves it again, creates a server-owned library record, creates a room, and selects the movie. The client never submits or chooses an arbitrary provider URL.
5. Every participant retrieves the same authorized source through the existing room playback endpoint and uses the existing Socket.IO synchronization engine.

If no source passes every check, the UI displays: “No playable source is currently available for this movie.”

## API routes

All routes require the existing bearer-token authentication:

- `GET /api/movies/trending?page=1`
- `GET /api/movies/popular?page=1`
- `GET /api/movies/top-rated?page=1`
- `GET /api/movies/upcoming?page=1`
- `GET /api/movies/search?q=...&page=1`
- `GET /api/movies/:tmdbId`
- `GET /api/movies/:tmdbId/sources`
- `POST /api/movies/:tmdbId/watch-party`

Discovery requests are rate limited and cached in memory. Upstream timeouts, rate limits, invalid input, and missing configuration return safe user-facing errors.

## Environment

Add one TMDB application credential to `backend/.env` (the read access token is preferred):

```env
TMDB_ACCESS_TOKEN=your-tmdb-api-read-access-token
TMDB_API_KEY=your-v3-api-key
TMDB_CACHE_TTL_SECONDS=900
INTERNET_ARCHIVE_CACHE_TTL_SECONDS=3600
```

Existing `DATABASE_URL`, `JWT_SECRET`, LiveKit, and R2 variables are still required for their corresponding features. Never add TMDB credentials to `EXPO_PUBLIC_*` variables.

## Screen sharing

Screen sharing reuses LiveKit rather than creating a second raw peer-to-peer WebRTC stack. LiveKit performs authenticated offer/answer/ICE and TURN/SFU routing; Socket.IO authorizes the host and stores/announces the room playback mode.

Android builds enable the LiveKit MediaProjection foreground service. The host must initiate capture and accept the Android system prompt. Shared audio is requested but depends on the Android version and whether the source application permits audio capture. Stopping capture releases the published track and returns the room to direct playback when a movie is selected.

iOS screen sharing is intentionally reported as unavailable in the current build. It requires an iOS Broadcast Upload Extension and native App Group configuration, which cannot be provided by a JavaScript-only Expo configuration change. Voice/video calling continues to work on iOS.

Screen capture does not bypass DRM, protected surfaces, provider controls, or application terms.

## Setup and verification

```powershell
cd shared
npm.cmd install
npm.cmd run build

cd ..\backend
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma db push
npm.cmd run build
npm.cmd test

cd ..\mobile
npm.cmd install
npx.cmd tsc --noEmit
npx.cmd expo prebuild --clean
npx.cmd expo run:android
```

Because screen sharing adds native Android service configuration, Expo Go is not sufficient. Rebuild the development client or EAS build after changing `app.json`.

## Known limitations

- Internet Archive metadata is uploader-supplied. TogetherFlix therefore requires explicit licensing metadata and exact title/year matching, but administrators should still review a source if its rights are disputed.
- Discovery caches are per backend process. A shared Redis cache would be appropriate when horizontally scaling the API.
- Expo Video support varies by OS and codec. MP4/H.264 is the most portable; WebM availability depends on the device decoder.
- Screen-share audio is not guaranteed by Android or by the application being captured.
- iOS screen sharing needs a native Broadcast Upload Extension before it can be enabled.
- The current room model remains intentionally limited to a host and one guest. LiveKit can scale beyond that, but the Prisma room membership model must be generalized first.

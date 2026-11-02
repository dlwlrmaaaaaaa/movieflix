# TogetherFlix streaming providers

## Implemented provider

TogetherFlix uses a backend-only provider registry in `backend/src/services/streamingSource.service.ts`.
Providers implement `VideoProvider`, returning only sources that pass movie matching, license, URL, and
reachability checks. TMDB remains the metadata catalog and is not treated as a video host.

The configured provider is `internet_archive`:

- searches the documented Internet Archive catalog and metadata endpoints;
- requires an exact normalized TMDB title and release-year match;
- requires an explicit Creative Commons, Public Domain, or recognized No Copyright URL;
- accepts only reachable HTTPS MP4 or WebM files from `archive.org/download/`;
- can return up to three validated files, allowing the solo player to fail over to another source.

Official developer resources:

- https://archivesupport.zendesk.com/hc/en-us/articles/360001495812-Developer-Resources
- https://archive.org/developers/

## Stream resolution API

Authenticated clients can call:

```http
GET /api/movies/:tmdbId/stream
```

The endpoint returns `200` with normalized direct-playback sources, `404` when providers responded but
no authorized match exists, or `502` when every configured provider failed. A successful source reports
its provider reference, MP4/WebM/HLS/DASH type, MIME type, direct-playback and synchronization support,
license URL, and provider details URL. The API never invents a playback URL.

Compatibility endpoints `/sources`, `/watch`, and `/watch-party` remain available. Watch Now prepares
owner-authorized library records for each resolved source and automatically switches to the next source
if native playback fails. Watch Party selects one validated source for every participant so Socket.IO
continues to synchronize one canonical media timeline.

## Verified live example

On 2026-11-01, TMDB movie `10331` (`Night of the Living Dead`, 1968) resolved to a licensed Internet
Archive MP4. The stream endpoint returned `200`, and a real ranged request returned `206`,
`Content-Type: video/mp4`, `Content-Range: bytes 0-1023/598512838`, and 1,024 media bytes.

Availability is dynamic because Internet Archive item metadata and files can change.

## VidCloud and MegaCloud

No official public developer API, direct-playback contract, licensing documentation, or supported player
control integration for VidCloud or MegaCloud was located during implementation. TogetherFlix therefore
does not scrape their pages, use unofficial extractor APIs, unwrap iframe sources, or bypass access/DRM.
They are not configured providers.

YouTube has an official controllable iframe player API, but that is a separate embed mode rather than a
direct MP4/HLS/DASH provider and is intentionally not substituted into the existing native direct player.

## Format and platform notes

The provider contract supports MP4, WebM, HLS, and DASH. The React Native app uses `expo-video` and each
platform's native media stack rather than browser-only `hls.js` or `dash.js`. Actual codec/container
support therefore depends on Android ExoPlayer or iOS AVPlayer. Manual authorized streams, R2 uploads,
screen sharing, room invitations, chat, readiness, late-join state, and host-controlled Socket.IO sync
remain intact.

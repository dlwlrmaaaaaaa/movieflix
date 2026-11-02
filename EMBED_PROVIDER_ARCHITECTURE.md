# Authorized embed-provider architecture

TogetherFlix supports an isolated embedded-player mode without changing its direct MP4, WebM, HLS,
DASH, upload, screen-sharing, or synchronized watch-party paths. The checked-in provider template is
unverified and disabled by default.

## Resolution flow

Authenticated clients call:

```http
GET /api/movies/:tmdbId/embed?platform=web|mobile
```

The backend first validates the TMDB movie, then checks the registered embed providers. A provider is
eligible only when all of these are true:

- `enabled` is true;
- `distributionPermissionVerified` is true;
- the requested web/mobile platform is supported;
- the provider reports that the TMDB ID is available;
- the generated URL uses HTTPS and an explicitly allowlisted host.

Otherwise, the endpoint returns `404`. It never invents an embed URL and never extracts a media URL.

TV episode templates can be resolved through:

```http
GET /api/movies/tv/:tmdbId/:season/:episode/embed?platform=web|mobile&format=path|query
```

The `format` parameter is optional. When omitted, the provider's configured `tvUrlFormat` is used.

## Registering a provider

Edit `backend/src/config/embedProviders.ts` after retaining documentation that establishes both iframe
permission and content-distribution authorization. Set the provider's HTTPS `baseUrl`, exact movie/TV
templates, and the exact hostname in `allowedEmbedHosts`. Only then set both
`distributionPermissionVerified` and `enabled` to `true`.

`backend/src/services/embedUrlBuilder.ts` validates TMDB IDs, seasons, episodes, and both supported TV URL
formats. `ConfiguredEmbedProvider` adapts the editable configuration to the provider registry. The registry
still requires an allowlisted HTTPS host before returning a descriptor.

For providers with a documented availability API, replace `ConfiguredEmbedProvider.isAvailable` with an
authorized availability check. Do not inspect iframe HTML or extract media URLs.

## Players

- Web: `EmbeddedVideoPlayer.web.tsx` renders a sandboxed iframe with fullscreen support.
- Android/iOS: `EmbeddedVideoPlayer.tsx` uses the official Expo-compatible `react-native-webview` package,
  blocks HTTP, pop-up windows, and top-level navigation outside the configured embed host.
- `app/movie/[id]/embed.tsx` provides loading, failure, capability notice, and Back to Movies behavior.

Watch Now opens an eligible embed when configured, with direct playback retained as a separate action.
Watch with Party creates a room with canonical movie/provider metadata. Direct sources use host-controlled
synchronization; iframe parties open the same authorized provider for joined viewers after the host starts the movie. Iframe timelines remain independent.

## Playback controls and watch parties

An iframe that only emits progress events is not enough for synchronized control. Set
`supportsPlaybackControl` to true only when the official provider API documents parent-to-player play,
pause, live seek, position reads, state/error events, and origin validation. Without all of those,
TogetherFlix labels the mode independent and does not show synchronized host controls. Chat and room
invitations remain available in direct and iframe catalog parties. See TOGETHERFLIX_WATCH_PARTY.md.

## Test provider

Tests use Google's documented YouTube IFrame API sample video on `youtube-nocookie.com` solely to verify
allowlisting and descriptor rendering. It is injected into the test registry and is not registered in
production. No fake movie source is exposed to users.

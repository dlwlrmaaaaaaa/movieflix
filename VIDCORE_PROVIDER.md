# VidCore configuration and verification

Modified implementation paths:
- backend/src/config/embedProviders.ts
- backend/src/providers/ConfiguredEmbedProvider.ts
- backend/src/services/embedUrlBuilder.ts
- backend/src/services/embedProviderRegistry.ts
- backend/src/controllers/discovery.controller.ts
- mobile/src/services/api.ts
- mobile/app/movie/[id]/embed.tsx
- backend/tests/vidcore.test.ts
- VIDCORE_PROVIDER.md

VidCore uses id `vidcore`, name `VidCore`, baseUrl `https://www.vidcore.org`, and moviePath `/embed/movie/{TMDB_ID}`. Its provider-specific `allowedEmbedHosts` is exactly `['www.vidcore.org']`. Both `enabled` and `distributionPermissionVerified` are false. There are no TV paths. Playback control and synchronization are false; web/mobile capability flags are true but require real-device verification before activation.

The existing `custom-embed` entry and its `['videasy.xyz']` allowlist are preserved. This checkout contained no VidSrc configuration; no VidSrc endpoint or permission claim was invented.

Before enabling, retain evidence of iframe embedding permission and distribution rights for the intended content, territories, and app origins. Test the documented endpoint with authorized content on deployed web and mobile origins, including CSP frame-ancestors, X-Frame-Options, sandbox, fullscreen, redirects and WebView behavior. The provider website could not be fetched during implementation; permission and compatibility remain unverified. An allowlist entry alone grants no rights and does not activate the provider.

After verification, set both VidCore flags `distributionPermissionVerified` and `enabled` to true in backend/src/config/embedProviders.ts, then restart/redeploy the backend. Leave control/synchronization flags false. Do not relax iframe restrictions or invent TV endpoints. Disabled or unverified providers never appear in API player options.

GET /api/movies/:tmdbId/embed?platform=web|mobile retains the legacy `player` field and adds `players`, containing only eligible providers for that movie/platform. The screen lists their names and switches locally while retaining the movie and room state. Switching reloads the iframe; playback position is not preserved without an official player API. TV resolution remains available for existing providers; VidCore is excluded. Availability is template eligibility, not proof a title can play. Remote framing restrictions may prevent playback and must be respected.

Validation commands (Windows):
```
cd backend
npm.cmd test
npx.cmd tsx tests/vidcore.test.ts
npx.cmd tsc --noEmit
cd ../mobile
npx.cmd tsc --noEmit
```

Manual checks: open an existing TMDB movie and its embed screen; VidCore must be absent by default. In an isolated environment with authorized providers enabled, confirm names appear and switching preserves the TMDB ID. Check failure recovery by selecting another server. After authorization, validate VidCore on web and physical mobile devices. Smoke-test Watch Now, Watch with Party, direct video sources, Socket.IO chat/invitations and WebRTC screen sharing. These interactive flows were not exercised by automated checks.

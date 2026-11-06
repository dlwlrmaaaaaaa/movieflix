# AnnahFlix / TogetherFlix project rules

These instructions apply throughout this repository. Follow the user's current
instructions and preserve their existing work.

## User execution preferences

- Make the requested local edits only. Do not run builds, tests, type checks,
  `tsc --noEmit`, lint, web exports, browser checks, or other verification commands
  unless the user explicitly requests them.
- Do not commit, push, publish EAS updates, start EAS builds, deploy services,
  submit releases, or apply database migrations unless explicitly requested.
- Do not ask routinely to run these actions. Leave execution to the user and
  clearly state which actions were not run.
- These preferences supersede any general build or testing workflow in this file.

## Before changing code

- Inspect the relevant implementation before editing. Check `git status` and
  preserve uncommitted changes. Do not reset, overwrite, or commit unrelated work.
- Reuse the existing Expo React Native frontend, Express backend, shared
  TypeScript types, Prisma models, TMDB client, and playback infrastructure.
- Make additive, focused changes. Avoid unnecessary dependency upgrades,
  architecture replacements, database restructuring, and design changes.
- Implement working behavior with validation and clear loading/error states.
  Do not substitute mock playback or placeholder screens for requested features.

## Preserve existing functionality

- Keep movie discovery, the movie library, authentication, and admin tools working.
- Preserve R2 uploads, MPD imports, and authorized DASH, HLS, MP4, and WebM sources.
- Keep room creation/joining, Socket.IO synchronization, LiveKit calling,
  microphone controls, and the current Android configuration working.
- Treat dramas as series with seasons and episodes; do not merge whole series
  into movie records. Reuse validated library records for episode sources.
- TMDB supplies metadata, not playable video. Do not fabricate sources or claim
  an episode is playable merely because its metadata exists.

## APK builds and automatic updates

- Read `mobile/UPDATES.md` before changing build or update behavior.
- Keep the configured `appVersion` runtime policy unless a change is explicitly
  requested or necessary and its compatibility consequences are explained.
- Compatible JavaScript, UI, and bundled asset changes can use EAS Update when
  all required native capabilities already exist in the installed APK.
- Changes to native dependencies, permissions, config plugins, or Expo/native
  configuration require a compatibility review. When the native runtime changes,
  bump `expo.version` in `mobile/app.json` and explain that the user must
  build/install a new APK. Do not run the build unless explicitly requested.
- Do not publish native-dependent changes under the older app version.
  Android build-number auto-increment does not change this requirement.
- Preview APKs receive preview-channel updates; production builds receive
  production-channel updates. Use the matching EAS environment and API settings.
- A newly built APK already includes the current code. Do not tell the user to
  publish an OTA update immediately after building unless there is a specific need.
- Backend changes require a separate backend deployment. An OTA update does not
  deploy the API or apply database migrations.
- Describe automatic update timing accurately: checking/downloading on launch
  does not guarantee immediate installation during an active session.
- Do not publish updates, deploy services, or apply production migrations without
  authorization. Existing explicit authorization remains valid; do not ask again.

## Embedded providers and episode playback

- Keep provider configuration centralized in
  `backend/src/config/embedProviders.ts`. Respect enablement, permission, platform,
  and HTTPS host checks. Do not invent verification of distribution permission.
- Preserve manual server selection and bounded fallback. Reset attempts on retry;
  avoid infinite retry loops and stale callbacks from replaced players.
- Distinguish document-load success from actual video playback. Cross-origin
  iframe errors and progress cannot reliably be inspected without a documented API.
- VidSrc and VidCore episode paths use
  `/embed/tv/{TMDB_ID}/{SEASON}/{EPISODE}`. Do not discard the selected episode.
- Do not claim generic iframes support synchronized play/pause/seek, reliable
  completion detection, or automatic progress tracking without an implemented API.
- Use authorized direct sources and the existing player for synchronized episodes.
  Show unavailable states when no direct source is assigned.

## Watch Party and progress rules

- Reuse the existing synchronization engine; do not create a separate drama engine.
- Only the host selects episodes and controls play, pause, seek, and advancement.
  Enforce this on the server, not only in the UI.
- Both devices must resolve the same episode/source, preload paused, report actual
  player readiness, and follow a server-scheduled start.
- Scope readiness, control commands, and next-episode transitions to the active
  source/playback generation. Reject stale or duplicate transitions atomically.
- Never let host and guest independently advance. Reset readiness and position
  for the next episode and wait for both viewers before starting together.
- Preserve reconnection behavior and clean up player, socket, and timer listeners.
- Throttle authenticated progress saves and persist pause, leave, and end events.
  Use session/sequence checks so delayed writes cannot overwrite newer progress.
- Only display subtitles that exist. Validate imported timestamps and encoding;
  keep subtitle language, off, and timing controls working where supported.

## Database, security, and performance

- Use additive Prisma migrations, transactions, indexes, and uniqueness constraints.
  Preserve existing data. If migration testing is explicitly requested, use an
  isolated database rather than production.
- Never use production data or credentials for destructive test fixtures. Do not
  print secrets or commit environment files.
- Keep admin-only source management and authenticated playback/progress APIs.
- Reuse stream/manifest validation; do not bypass access controls, DRM, or signed URLs.
- Reuse TMDB caching, request deduplication, concurrency limits, and rate-limit
  handling. Paginate discovery and lazy-load seasons and episode lists.
- Classify K-Drama using Korean language and South Korean origin. Classify mainland
  C-Drama using Chinese language and Chinese origin; exclude Taiwan/Hong Kong
  origins from that category unless the product requirements change.
- Debounce search, cancel stale client requests, virtualize lists, and avoid
  unnecessary database writes, metadata overfetching, or duplicate video players.

## Verification and handoff

- Follow the execution preferences above: do not run builds, tests, type checks,
  lint, exports, browser checks, or other verification commands unless requested.
- If the user requests verification, choose checks relevant to their request.
  Keep database fixtures isolated and distinguish mocked checks from live behavior.
- State what changed, what passed, what remains unverified, and whether rollout
  needs an OTA update, backend deployment, migration, or new APK.
- Distinguish code implemented locally from code deployed. Do not claim real-phone
  codec playback, LiveKit audio, or production migrations were tested when they were not.
- Keep explanations and commands concise. On this Windows workspace, use
  `npm.cmd` / `npx.cmd` if PowerShell blocks the `.ps1` wrappers.

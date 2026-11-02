# TogetherFlix watch-party flow

## Current behavior (November 2, 2026)

Membership recovery fix: HTTP joins now broadcast the authoritative participant list immediately. Clients refresh on foreground and periodically, without allowing stale HTTP responses to overwrite newer socket updates. Host reconnect announcements retain the real guest ID. Start movie now uses authenticated POST /api/rooms/:code/start, so a lost host socket does not disable iframe opening; server host/guest/provider checks remain enforced. Socket provider remounts create a fresh socket rather than returning a disconnected cached instance. Regression tests cover a guest joining without a socket and a host starting with its socket disconnected.

This section supersedes the earlier screen-sharing UI instructions below.

- Watch with Party is enabled for an authorized iframe or direct source. The direct-source requirement message has been removed.
- Iframe parties: the host presses Start movie, which persists a shared opening timestamp and opens the selected provider/movie for joined guests. A loading screen appears while the iframe loads. Late joins and refreshes reuse this opening state. This is coordinated player opening; iframe play, pause and seeking remain independent and may require each viewer to press Play.
- Direct parties: native/HTML video players retain host-only play/pause/seek and server-timestamp synchronization. The web player now uses HTML media readiness events because the installed Expo Video 1.1 web adapter does not emit its native statusChange events.
- Catalog party rooms no longer show camera, room chat or screen-sharing controls. Voice uses a microphone icon. Guests have no app timeline controls. The app owns the fullscreen frame; provider-requested fullscreen is disabled in party embeds. Provider controls inside a cross-origin iframe cannot be removed by the app. Android Back exits the app-owned iframe fullscreen frame; browsers use Escape.
- A new login creates User.activeSessionId and revokes the previous session's HTTP token and Socket.IO connection. Clients clear the old login and disconnect voice. POST /api/auth/logout revokes the active session too. Existing legacy tokens remain valid only until the account next signs in. The additive schema update was applied and verified locally: backend/prisma/updates/20261102_single_device_session.sql.
- New event: party:start, host-authorized, opens iframe players together without setting playbackIsPlaying or pretending iframe timelines are synchronized. GET /api/rooms/:code/embed now permits a joined guest after launch.
- Verified: backend HTTP/socket/session tests, seven call lifecycle tests, backend/mobile type checks, and two-browser tests for coordinated iframe launch, app-owned fullscreen, direct play/pause and forced sign-out.

Additional modified/created files include backend/src/services/authSession.service.ts, backend/src/controllers/auth.controller.ts, backend/src/services/auth.service.ts, backend/src/routes/auth.routes.ts, backend/src/middlewares/auth.middleware.ts, backend/src/utils/token.ts, mobile/src/services/authEvents.ts, mobile/src/context/AuthContext.tsx, mobile/src/context/SocketContext.tsx, mobile/src/services/socket.ts, mobile/src/context/CallContext.tsx, mobile/src/context/CallContext.web.tsx, mobile/src/components/player/EmbeddedVideoPlayer.tsx, mobile/src/components/player/EmbeddedVideoPlayer.web.tsx, mobile/src/components/player/VideoPlayerView.web.tsx and shared/src/events.ts.


The catalog homepage now contains browsing, search and navigation. Join Party opens /join. Movie details offer Watch Now and Watch with Party. Watch Now prefers an eligible iframe; Watch Direct Source retains direct playback. Watch with Party creates the selected movie room and opens /room/:code.

## Components and state

WatchPartyRoom is the responsive catalog-room interface: movie title/poster/provider, player, invitation, participants with host indicators, chat, status, host controls, screen sharing and local volume/fullscreen. Desktop uses a sidebar; mobile stacks panels. Browser copy actions use the clipboard; native platforms use the OS share/copy sheet.

useRoomSession restores a room from its URL after authentication or refresh. /party/:code joins the existing room without creating another. Login/register preserve pending invitations. Chat loads the last 100 messages after refresh.

Room.catalogSelection is a new JSONB field containing server-derived TMDB ID, title, poster URL, media type, provider ID/name and player type. Its shared type also permits season/episode. Existing fields retain identities, playback position, playing flag, server timestamp, version, direct movie and playback mode. IFRAME is added to the existing enum. Catalog movie/provider selection stays fixed. Direct metadata and playable movie ID are written together during room creation.

Movie IDs and room codes are validated. Provider IDs must match enabled, authorized providers. Host identity comes from authentication. The guest slot is claimed atomically. Guests leaving release their slot; hosts leaving end the room. Hosts can remove guests.

## Routes and events

- Updated POST /api/movies/:id/watch-party accepts optional providerId, platform and positionSeconds; returns canonical room metadata. Explicit iframe selections require authorization. Without explicit selection, direct discovery remains preferred, then eligible embeds.
- Existing POST /api/rooms/join joins the same room and returns metadata/state. Rejoining is idempotent; full and ended rooms are rejected.
- Existing GET /api/rooms/:code now enforces participant-only details and shared code validation.
- New GET /api/rooms/:code/embed?platform=web|mobile is active-host-only and rechecks current provider authorization. Guests watch the shared stream.
- New GET /api/rooms/:code/messages returns participant-only recent chat.
- New POST /api/rooms/:code/leave releases the guest slot or ends the host session.
- New POST /api/rooms/:code/guest/remove lets the active host remove the guest and requests LiveKit disconnection.
- Existing close route is host-only. Changes publish room:updated; removed users receive room:error with ROOM_REMOVED and lose socket membership.
- Existing room, chat, playback, viewer-state and screen:start/stop events are reused. Packet middleware validates room codes. Chat uses persistent IDs for deduplication.
- Screen-share stop/disconnect restores IFRAME for iframe rooms and DIRECT for direct rooms. Guest playback commands are rejected.
- Existing direct synchronization retains server timestamps and drift correction. Position polling uses current callbacks. Paused players do not send stale heartbeats during scheduled starts; pause cancels pending starts; explicit resync accepts the current server version.
- Backend /party/:code redirects to PUBLIC_WEB_URL when configured, otherwise retains the native deep-link landing page.

## Run (PowerShell)

Keep real PostgreSQL, TMDB and LiveKit settings in backend/.env. Stop the existing backend before generating Prisma's Windows engine: a running process held its DLL open during implementation. No database updates were applied automatically.

From the repository root:

    cd shared
    npm.cmd run build
    cd ../backend
    npx.cmd prisma db execute --file prisma/updates/20261102_watch_party_metadata.sql --schema prisma/schema.prisma
    npx.cmd prisma db execute --file prisma/updates/20261102_single_device_session.sql --schema prisma/schema.prisma
    npx.cmd prisma generate
    npm.cmd run dev

The SQL adds only the JSONB column and IFRAME enum value. For a fresh database, use npx.cmd prisma db push instead of the additive SQL. Dependencies are installed here; fresh checkouts need npm install in shared, backend and mobile first.

In a second terminal:

    cd 'C:/Users/Justin/APP MOVIE/mobile'
    $env:EXPO_PUBLIC_API_URL='http://localhost:4000'
    $env:EXPO_PUBLIC_SOCKET_URL='http://localhost:4000'
    $env:EXPO_PUBLIC_WEB_URL='http://localhost:8081'
    npx.cmd expo start --web --clear

Use the actual Expo port if different. Set backend PUBLIC_WEB_URL to that web origin for backend landing links. Deployed invitations need publicly reachable HTTPS origins; localhost links work only on the same computer. Native capture needs the existing development build rather than Expo Go.

## Two-browser test

1. Sign in as host and guest in separate browser profiles or an incognito window. Shared-local-storage tabs cannot represent separate accounts.
2. Verify no Create/Join room sections or code forms appear on the homepage. Check search, categories, posters and Join Party navigation.
3. Open a movie. Verify Watch Now loads an eligible iframe and server switching works. Check Watch Direct Source if available.
4. Return to details, choose a provider and click Watch with Party. Check title/poster/provider, room code and invitation.
5. In the guest browser choose Join Party, enter the copied code and join. Confirm the same movie and room load without creating a second room.
6. Send chat both ways. Refresh the guest and check movie metadata/history return. Open the invite URL and verify no manual code entry; test sign-in/register redirects.
7. For iframe parties, the guest waits without an independent iframe. Host clicks Connect to Share, then Start Screen Share from a separate click. Choose the movie tab and permit tab audio where supported. Check guest audio, mute/fullscreen and both browser/app stop controls. Respect protected capture restrictions.
8. For licensed direct playback, choose Direct synchronized source on details before creating the party. Wait for both players to be ready. Check host play/pause/seek, guest restrictions, reconnect, Resync and joining during playback.
9. Guest leaves: host room remains open. Test another join and Remove Guest. Host leaves: guest sees the ended state and invites stop working.
10. Repeat at mobile widths and on physical devices. Smoke-test legacy upload/direct rooms, calls, invitations and provider selection.

## Automated checks

    cd backend
    npm.cmd test
    npx.cmd tsc --noEmit
    npx.cmd prisma validate
    cd ../mobile
    npx.cmd tsc --noEmit

The test command includes the existing 38 checks, VidCore checks and a real HTTP/Socket.IO journey using isolated persistence. It tests metadata, authorization, malformed IDs/codes, competing joins, chat/history, screen-share state transitions, host-only play/pause/seek, buffering readiness and late joins.

The browser journey passed in separate desktop-host and 390px-guest Edge contexts, with synthetic authorized iframe content and real Socket.IO. It covers Watch Now, automatic creation, clipboard, code/invite joining, two-way chat, refresh, leave/remove and horizontal overflow. Screenshots are saved in the OS temporary directory. This does not validate real provider playback or WebRTC capture.

Reproduce the isolated browser test from the repository root:

    npm.cmd install --prefix "$env:TEMP/togetherflix-ui-tools" playwright --no-package-lock --ignore-scripts
    cd mobile
    $env:EXPO_PUBLIC_API_URL='http://localhost:4109'
    $env:EXPO_PUBLIC_SOCKET_URL='http://localhost:4109'
    $env:EXPO_PUBLIC_WEB_URL='http://localhost:4109'
    npx.cmd expo export --platform web --clear
    cd ../backend
    $env:TF_BROWSER_FIXTURE='1'
    npx.cmd tsx tests/watchPartyFlow.test.ts

Then, from another terminal at the repository root:

    node backend/tests/watchParty.browser.cjs

The script uses installed Edge; TF_PLAYWRIGHT_PATH may specify another Playwright module. The fixture binds only 127.0.0.1:4109. Stop it afterward, clear fixture overrides and rebuild for the real app. It changes no database or production flags.

## Limitations and validation status

Backend tests, both TypeScript checks, Prisma schema validation and the web export passed. The browser journey passed without page errors. Live PostgreSQL persistence and actual media playback/capture were not exercised. Apply the additive SQL before running the updated backend.

VidCore remains disabled/unverified; provider configurations were untouched by this redesign. This checkout has Custom Embed Provider at videasy.xyz, not a VidSrc-named entry; that configuration is preserved. No TV endpoints, undocumented iframe APIs or media extraction were added. Iframe controls are independent; parties require authorized host capture. Audio, autoplay, protected capture and device support remain platform/provider constraints.

Rooms retain the two-person limit. New party creation supports movies; existing TV embedding is retained. Removing a guest releases the slot rather than banning the account. Runtime playback state remains in one Socket.IO process with database snapshots; multiple instances need shared room/runtime infrastructure. LiveKit participant removal is best effort when its service is unreachable; backend access and local sessions are also revoked.

## Exact modified or created paths

- backend/.env.example
- backend/package.json
- backend/prisma/schema.prisma
- backend/prisma/updates/20261102_watch_party_metadata.sql
- backend/src/controllers/call.controller.ts
- backend/src/controllers/discovery.controller.ts
- backend/src/controllers/room.controller.ts
- backend/src/index.ts
- backend/src/routes/room.routes.ts
- backend/src/routes/partyLanding.routes.ts
- backend/src/services/livekit.service.ts
- backend/src/services/room.service.ts
- backend/src/sockets/socketManager.ts
- backend/src/sockets/utils/roomPolicy.ts
- backend/src/utils/roomCode.ts
- backend/tests/watchPartyFlow.test.ts
- backend/tests/watchParty.browser.cjs
- mobile/.env.example
- mobile/app/(auth)/login.tsx
- mobile/app/(auth)/register.tsx
- mobile/app/(main)/home.tsx
- mobile/app/_layout.tsx
- mobile/app/join.tsx
- mobile/app/movie/[id].tsx
- mobile/app/movie/[id]/embed.tsx
- mobile/app/room/[code]/index.tsx
- mobile/app/room/[code]/player.tsx
- mobile/src/components/movie/WatchPartyRoom.tsx
- mobile/src/components/player/VideoPlayerView.tsx
- mobile/src/context/PlaybackSyncContext.tsx
- mobile/src/context/RoomContext.tsx
- mobile/src/hooks/useRoomSession.ts
- mobile/src/services/api.ts
- mobile/src/services/partyInvite.ts
- shared/src/models.ts
- EMBED_PROVIDER_ARCHITECTURE.md
- TOGETHERFLIX_WATCH_PARTY.md


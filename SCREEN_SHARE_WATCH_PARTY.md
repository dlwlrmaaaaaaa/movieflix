# Embedded-player screen-share watch parties

TogetherFlix keeps the cross-origin embedded player intact. The host explicitly
chooses a browser tab, window, or display to capture; viewers subscribe to the
resulting LiveKit screen video/audio tracks. The app does not inspect the iframe,
read its playback state, or extract its media URLs.

## Architecture

- Socket.IO owns authenticated room membership, host authorization, chat,
  invitations, `screen:start`/`screen:stop`, and room mode updates.
- LiveKit is the existing WebRTC SFU. It performs SDP/ICE signaling, STUN/TURN
  traversal, track publication/subscription, late joining, and ICE restart on
  reconnect. A second peer-to-peer signaling protocol is intentionally not
  added.
- Only the room host receives a LiveKit token that can publish
  `SCREEN_SHARE` and `SCREEN_SHARE_AUDIO`. Viewers can subscribe but cannot
  publish screen tracks.
- Direct MP4/HLS/DASH playback continues to use the existing synchronized
  player. Iframe playback is not controlled through cross-origin APIs.

## Required environment

Backend `.env`:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/togetherflix?schema=public
JWT_SECRET=replace-with-a-long-random-secret
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

Mobile/web `.env`:

```dotenv
EXPO_PUBLIC_API_URL=https://your-backend.example.com
EXPO_PUBLIC_SOCKET_URL=https://your-backend.example.com
```

Never place `LIVEKIT_API_SECRET` or private TURN credentials in an
`EXPO_PUBLIC_*` variable. The backend creates short-lived room tokens after it
checks room membership.

For LiveKit Cloud, no separate app TURN variables are needed; TURN/TLS is
managed by LiveKit. For a self-hosted LiveKit server, configure its embedded
TURN service in the LiveKit server YAML (or `LIVEKIT_CONFIG`) and open the
matching firewall ports. A typical configuration is:

```yaml
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
turn:
  enabled: true
  domain: turn.example.com
  tls_port: 5349 # use 443 when there is no layer-4 load balancer
  udp_port: 3478
```

Use a trusted TLS certificate whose name matches the TURN domain. Expose the
signal endpoint through HTTPS/WSS and open TCP 7881, UDP 3478, the configured
UDP media range, and TURN/TLS. Adjust those ports to match the actual LiveKit
deployment.

## Run locally

In separate PowerShell terminals:

```powershell
cd "C:\Users\Justin\APP MOVIE\shared"
npm.cmd install
npm.cmd run build

cd "C:\Users\Justin\APP MOVIE\backend"
npm.cmd install
npx.cmd prisma generate
npm.cmd run dev

cd "C:\Users\Justin\APP MOVIE\mobile"
npm.cmd install
npm.cmd run web
```

For native Android/iOS, LiveKit uses native modules, so use an Expo development
build (`npm.cmd run android` or the corresponding iOS build), not Expo Go.

## Host flow

1. Open a TMDB movie and choose the embedded player.
2. Select **Share Party**, then copy/send the invitation.
3. Click **Start Share**. Browser capture is never started automatically.
4. In Chromium, select the browser tab containing the movie and enable
   **Share tab audio**. Sharing a window or full display often omits tab audio.
5. Keep using the iframe's own controls. The local preview and live status show
   what viewers receive.
6. Use **Stop Share** or the browser's native stop-sharing control to end it.

If the current tab is selected, the preview can create a visual hall-of-mirrors
effect. Selecting a dedicated movie tab gives viewers a cleaner image.

## Viewer flow

1. Open the invite link or enter its room code and join while authenticated.
2. The room automatically opens the shared-stream player when the host starts.
3. Use **Play audio** if the browser blocks autoplay, and use the viewer-only
   mute and fullscreen controls as needed.
4. Chat, invitation sharing, leaving, late joining, and reconnection continue
   through the existing room UI.

## Limitations

- Screen capture requires a direct user gesture and browser permission.
- Tab/system audio availability varies by browser and operating system.
- DRM-protected or otherwise protected video may be black or silent. TogetherFlix
  does not bypass those protections.
- Retransmit only content for which the host has permission.
- WebRTC latency and quality depend on capture settings, network, and device.
  Perfect synchronization and zero latency are not possible.
- Mobile browser screen capture is inconsistent. The desktop Chromium path is
  the primary embedded-player sharing experience; native capture depends on
  Android MediaProjection or the configured iOS ReplayKit mode.
- LiveKit is already an SFU, so host upload is not multiplied once per viewer as
  it would be with a peer-to-peer mesh. The deployment still needs enough SFU
  bandwidth and capacity for larger rooms.

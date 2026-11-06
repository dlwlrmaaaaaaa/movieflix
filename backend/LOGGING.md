# Backend and embedded-player logs

Logs are JSON lines written to the backend's standard output/error. Use the logs
view for the service hosting your backend, or the terminal running the backend.
No log database or new package is required.

## Events to look for

| Event | Meaning |
| --- | --- |
| `http.request` | API method/path, response status, duration, request ID |
| `http.unhandled_error` | Sanitized backend exception, linked to the request ID |
| `embed.selected` | Backend-selected provider, configured provider order, embed host |
| `embed.unavailable` / `embed.resolve_error` | No configured player or embed-resolution failure |
| `embed.room_selected` | Embed selected for a Watch Party |
| `player.attempt_started` | Client started loading a provider |
| `player.document_loaded` | Embedded document loaded; this does not prove video playback |
| `player.load_error` | Client-reported HTTP/network error and available native error/status code |
| `player.timeout` | Loading stalled or reached its total deadline |
| `player.fallback` | Old provider, next provider, and reason for switching |
| `player.server_selected` | Viewer selected/retried a server or requested Next server |
| `player.navigation_blocked` | WebView blocked navigation; only the target hostname is logged |
| `player.exhausted` | Every eligible server was attempted |

For VidEasy, the configured provider ID is `custom-embed`; providerName is
`VidEasy`. A fallback log has nextProviderId/nextProviderName, such as
`vidcore` / `VidCore`.

Example fields, not an observed failure:

```json
{"level":"warn","event":"player.load_error","providerName":"VidEasy","tmdbId":533535,"reason":"http_error","statusCode":403,"source":"client_report"}
{"level":"warn","event":"player.fallback","providerName":"VidEasy","nextProviderName":"VidCore","tmdbId":533535,"reason":"http_error","statusCode":403,"source":"client_report"}
```

Filter by `playbackSessionId` to follow one screen visit. `sequence` orders client
events even when network delivery changes their arrival order. `attempt` groups
one provider load. Backend HTTP and embed-selection events carry a server-generated
`requestId`; HTTP responses expose the same value in `X-Request-ID`.

For the current Android investigation, filter player events by
`deviceOS: "android"` and `providerName: "VidEasy"`. Older clients may send only
`platform: "mobile"`. Android renderer crashes/termination also generate
`player.load_error`, with a message distinguishing a crash from the OS closing
the renderer. Cookies and JavaScript remain enabled; no browser user-agent
spoofing or provider access-control bypass is added.

### VidEasy certificate failure reported on Android

An Android report for `videasy.xyz` contained native error code `3` and
`SSL error: The certificate authority is not trusted`, followed by a switch to
VidCore after 844 ms. This establishes a certificate-trust rejection on that
connection, rather than a loading timeout. It does not establish whether the
cause is an incomplete/untrusted certificate chain at the provider, a device
trust-store difference, or interception on the device/network.

New clients label native `SSL error:` failures with `reason: "ssl_error"`.
Older client versions may label the same error `network_error`; consult the
message and native code too. Deploy backend support for the new reason before
delivering that client update.

Certificate validation remains enabled. Fixing the provider's trusted certificate
chain or using a verified, authorized HTTPS endpoint is the appropriate source
change. Do not add SSL bypasses or silently accept untrusted certificates. A
successful browser load alone does not prove that Android WebView trusts the
same chain: browser and device trust behavior can differ.

## Delivery and privacy

The app sends authenticated, validated, best-effort events to
`POST /api/movies/player-events`. The endpoint has its own rate limit. The app
deduplicates repeated events and caps a session's reports; it sends no progress
ticks and does not retry or keep an offline event queue. Delivery failure does
not block playback. Missing telemetry therefore does not prove an event never
happened.

Player events are explicitly client reports, not verified provider availability.
Browser iframes cannot reliably expose internal video errors. Native WebView
events cannot establish that a movie actually played. Blocked-navigation logs do
not automatically authorize those hosts; inspect the hostname before changing
the allowlist.

No request bodies, headers, cookies, authentication tokens, full player URLs,
or URL query strings are logged. Error messages are bounded and sanitized.
Authenticated user IDs and public TMDB/provider identifiers are included for
correlation; email addresses are not included. Room invite codes are masked in
HTTP paths.

## Rollout

Deploy the backend edits to see API and provider-selection logs. To see WebView
errors, timeouts, blocked navigation, and fallback reasons, also deliver the
matching mobile code to the installed app. These logging additions use existing
native capabilities and do not require a new native module or migration. If the
installed APK has the same compatible runtime, the mobile edits are eligible for
OTA delivery. This does not replace any APK rebuild required by earlier native
subtitle changes.

No builds, tests, type checks, pushes, publishing, or deployments were run for
this logging change.

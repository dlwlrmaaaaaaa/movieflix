# App updates

Install one new APK containing expo-updates. Existing APKs cannot receive these updates retroactively.

Run from mobile/:

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli update --channel preview --environment preview --message "Describe the change"
```

Preview builds receive preview updates. For production builds publish using:

```sh
npx eas-cli update --channel production --environment production --message "Describe the change"
```

Use the same environment values as the matching build, including EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL. Publishing is separate from editing files.

The app checks on launch, waits up to three seconds, and otherwise opens its cached version while downloading in the background. Downloaded updates apply on a subsequent launch, without interrupting playback. Offline users retain their cached app.

Fingerprint runtime matching prevents incompatible native updates. Native libraries, permissions, and Expo upgrades require another APK. Compatible JavaScript and asset updates do not. Backend changes are deployed separately.

Movie servers appear in backend config order. Loading errors and a 25-second document-load timeout try each remaining server once. Retry resets attempts. Errors inside cross-origin players cannot reliably be detected: use Next server when a loaded player cannot play. TV only includes providers with TV endpoints.

# App updates

Install one new APK containing expo-updates. Existing APKs cannot receive these updates retroactively.

Run from mobile/:

```sh
npx eas-cli build --platform android --profile preview
```

Install the resulting APK on both phones. It already contains the current code; no update command is needed immediately after building.

After future compatible JavaScript or asset changes, publish to preview:

```sh
npx eas-cli update --channel preview --environment preview --message "Describe the change"
```

Preview builds receive preview updates. For production builds publish using:

```sh
npx eas-cli update --channel production --environment production --message "Describe the change"
```

Use the same environment values as the matching build, including EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL. Publishing is separate from editing files.

The app checks on launch, waits up to three seconds, and otherwise opens its cached version while downloading in the background. Downloaded updates apply on a subsequent launch, without interrupting playback. Offline users retain their cached app.

Runtime matching uses the appVersion policy: expo.version in app.json is the compatibility boundary (currently 1.0.1). Keep that version unchanged for compatible JavaScript and asset updates.

Whenever native libraries, config plugins, permissions, or the Expo SDK change, increment expo.version (for example, 1.0.0 to 1.0.1), then build and install a new APK before publishing updates for that version. Android versionCode auto-increment does not replace this step. Do not publish native-dependent changes under an older app version.

This policy replaces fingerprint matching to avoid differing local/EAS fingerprints. APKs built with the previous fingerprint runtime do not receive appVersion updates: rebuild and reinstall once. Backend changes are deployed separately.

Movie servers appear in backend config order. Loading errors and a 25-second document-load timeout try each remaining server once. Retry resets attempts. Errors inside cross-origin players cannot reliably be detected: use Next server when a loaded player cannot play. TV only includes providers with TV endpoints.


## Subtitle bridge release

The search/subtitle changes add the local `plugins/withSubtitleTracks.js` Android config plugin for expo-video 1.1.9 and 1.1.10. It exposes the existing Media3 text tracks to JavaScript; Expo and expo-video versions are unchanged. App version/runtime is now 1.0.1 because the bridge changes native code.

Build and install a new APK before using the stream subtitle selector. OTA updates alone cannot add the bridge to a 1.0.0 APK. Older APKs retain external subtitle overlays and receive a message that additional native controls need an updated app. Native/iOS subtitle selection is not added by this Android plugin.

Deploy the backend search endpoint and subtitle import changes separately. No database migration is needed for this refactor. Builds and tests were deliberately not run during implementation, per the user's instruction.

## EAS build failures

The subtitle plugin accepts expo-video 1.1.9 and 1.1.10. A log saying only
"Expected 1.1.9" was generated with the older plugin file; that uploaded build
does not change when local files are edited.

The subsequent build a04cf85f-f547-4cfa-9831-6058419949be passed prebuild and
failed during JavaScript bundling because Metro could not resolve
`@togetherflix/shared`. SDK 51 now explicitly watches and resolves the sibling
shared package. Its React Native source entry is separate from the backend's
compiled entry, so mobile bundling does not require shared/dist to be present.
These resolution edits have not been rebuilt or tested yet.

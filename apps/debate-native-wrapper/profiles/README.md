# Profiles

A profile is the one JSON file that holds every app-specific value of this wrapper: name,
identifier, version, URLs, icons, window, deep-link scheme, trusted origins, updater, and release
naming. Nothing else in `native-wrapper` hard-codes an app identity. Every other file either
reads the active profile or is generated from it by `scripts/configure.mjs`:

| Generated file | From |
|---|---|
| `src-tauri/tauri.conf.json` | name, identifier, version, window, bundle metadata, deep link, updater, macOS/iOS/Android minimums |
| `src-tauri/src/generated_scheme.rs` | `appName` (tray menu and tooltip), `deepLinkScheme`, `url`, `sources`, `defaultSource` |
| `src-tauri/capabilities/remote.json` | `trustedOrigins` (the remote IPC scope) |
| `src-tauri/Info.plist` | `mediaUsage` (macOS camera/microphone prompts) |
| `dist/splash-config.js` | `appName`, `url`, `sources`, `defaultSource` (the splash and settings pages) |

Read directly from the profile: `scripts/generate-icons.mjs` (`iconSource`),
`scripts/build-offline.mjs` (`offline.site`, `appName`), and the
`native-wrapper-release.yml` / `native-wrapper-updates.yml` workflows (`release`, via `jq`).
Never edit a generated file by hand; CI regenerates them and fails on any difference.

Copy `example.json` to `<your-app>.json` and fill in these fields:

| Field | Meaning |
|---|---|
| `appName` / `productName` | Display name used in window titles, installers, and store listings. |
| `identifier` | Reverse-DNS app id (e.g. `com.debate.ai`). Used as the Tauri `identifier`, the Android `applicationId`, and the iOS bundle id. Changing this after a store release changes the app's identity — don't. |
| `version` | Semantic version written into `tauri.conf.json`. Bump this to trigger a new store/release version. |
| `url` | The site this wrapper loads as its main window content. Must be served over HTTPS. |
| `deepLinkScheme` | Custom URL scheme (e.g. `debateai` → `debateai://...`) registered with the OS so the site's OAuth login page can hand a session back to the app window. See `docs/OAUTH.md`. |
| `iconSource` | Path (relative to the profile file) to a single square PNG, at least 1024x1024, used to generate every platform's icon set via `npm run icons`. |
| `copyright` / `category` / `shortDescription` | Metadata surfaced in installers and store listings. `category` should match the target store's taxonomy (e.g. Apple's `public.app-category.*`, Microsoft Store, Google Play categories — see `docs/APP_STORES.md`). |
| `sources` / `defaultSource` | Optional. The places the user can choose to load the app from, in the wrapper's settings page and the tray's "Load From" menu: a list of `{ "id", "label", "url" }`, where a `url` without a scheme is a page bundled in `dist/` (an offline build). `defaultSource` is the `id` used until the user picks. Without `sources`, the only source is `url`. |
| `updater` | Optional. Desktop auto-update: `{ "pubkey", "endpoints" }`. `pubkey` is the contents of the `.key.pub` from `tauri signer generate` (the key itself, not a path); `endpoints` are `https://` URLs of a `latest.json`. While `pubkey` is empty or missing, the app has no updater at all and builds need no signing key. See `docs/UPDATES.md`. |
| `trustedOrigins` | Origins (`https://host`, wildcard subdomains allowed, no path) allowed to use the scoped Tauri IPC bridge; written into `capabilities/remote.json`. Keep this to exactly the domains you control. Defaults to the origin of `url`. |
| `mediaUsage` | Optional. `{ "camera", "microphone" }`: the reasons macOS shows when the app asks for them (Info.plist). Default to a sentence naming `appName`. |
| `offline` | Optional. `{ "site" }`: the site the bundled offline build sends `/api` requests and sign-in to. Defaults to `url`. |
| `release` | Optional. `{ "tagPrefix", "name", "notes", "updateFeedTag" }`: the release tag prefix (`native-wrapper-v` → `native-wrapper-v1.2.3`), the GitHub release title and notes, and the fixed release that holds the update feed's `latest.json`. The workflows read these with `jq`. GitHub reads a workflow's `on:` trigger before any file, so the tag prefix is also written literally in both workflows; `configure` fails if they disagree. |
| `window` | Initial window size/behavior. `fullscreen: true` opens the app in true OS fullscreen (no window chrome); users can leave it with the in-app fullscreen toggle (F11 / Ctrl+Cmd+F). Set `false` for a normal maximized window instead. |
| `macos` / `ios` / `android` | Minimum OS versions: `macos.minimumSystemVersion` (default `10.15`), `ios.minimumSystemVersion` (default `14.0`), `android.minSdkVersion` (default `24`). The bundle id / package name on every platform is `identifier`. |

Run `WRAPPER_PROFILE=<your-app> bun run configure` (or just `bun run configure` for the default
`debate-ai` profile) to regenerate the files above, then `bun run icons` to regenerate
`src-tauri/icons/`. `dev` and every `build:*` script run `configure` first. The workflows use
`profiles/debate-ai.json`; to release a different profile, change their `PROFILE` env.

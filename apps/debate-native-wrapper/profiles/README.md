# Profiles

A profile is the one JSON file you edit to point this wrapper at a different site. Everything
else in `native-wrapper` — the Rust code, the OAuth handoff, the CI workflow — reads the active
profile instead of hard-coding an app identity.

Copy `example.json` to `<your-app>.json` and fill in these fields:

| Field | Meaning |
|---|---|
| `appName` / `productName` | Display name used in window titles, installers, and store listings. |
| `identifier` | Reverse-DNS app id (e.g. `com.debateai.app`). Used as the Tauri `identifier`, the Android `applicationId`, and the iOS bundle id unless overridden under `android`/`ios`. Changing this after a store release changes the app's identity — don't. |
| `version` | Semantic version written into `tauri.conf.json`. Bump this to trigger a new store/release version. |
| `url` | The site this wrapper loads as its main window content. Must be served over HTTPS. |
| `deepLinkScheme` | Custom URL scheme (e.g. `debateai` → `debateai://...`) registered with the OS so the site's OAuth login page can hand a session back to the app window. See `docs/OAUTH.md`. |
| `iconSource` | Path (relative to the profile file) to a single square PNG, at least 1024x1024, used to generate every platform's icon set via `npm run icons`. |
| `copyright` / `category` / `shortDescription` | Metadata surfaced in installers and store listings. `category` should match the target store's taxonomy (e.g. Apple's `public.app-category.*`, Microsoft Store, Google Play categories — see `docs/APP_STORES.md`). |
| `trustedOrigins` | Origins allowed to use the scoped Tauri IPC bridge (`capabilities/remote.json`) — keep this to exactly the domains you control. |
| `window` | Initial window size/behavior. `fullscreen: true` opens the app in true OS fullscreen (no window chrome); users can leave it with the in-app fullscreen toggle (F11 / Ctrl+Cmd+F). Set `false` for a normal maximized window instead. |
| `android` / `ios` | Mobile-specific overrides (package name, minimum OS version). |

Run `WRAPPER_PROFILE=<your-app> npm run configure` (or just `npm run configure` for the default
`debate-ai` profile) to regenerate `src-tauri/tauri.conf.json` and the deep-link scheme
registration from the active profile, then `npm run icons` to regenerate `src-tauri/icons/`.

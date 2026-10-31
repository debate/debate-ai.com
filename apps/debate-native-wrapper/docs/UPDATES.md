# Auto-update (desktop)

Installed desktop apps update themselves with
[`tauri-plugin-updater`](https://v2.tauri.app/plugin/updater/). Every build is signed with an
update key, every installed app carries the matching public key, and an update that does not
verify against it is refused. Android and iOS update through their stores instead.

## How it behaves

`src-tauri/src/updater.rs`, desktop only, driven from Rust (the wrapped site has no IPC access
to it — no capability grants an `updater:` permission):

1. At launch, and then once a day while the app sits in the tray, it fetches the feed
   (`plugins.updater.endpoints` in `tauri.conf.json`). A version newer than the running one is
   downloaded in the background. An unreachable feed or failed download is logged and retried
   at the next check; it never stops the app.
2. Installing waits until **no window is showing** (main window and mini player both hidden),
   because installing closes the app (Windows' installer does it outright) and a restart would
   drop the page the user is on. A launch at login starts in the tray, so there it installs
   straight away; otherwise it installs the next time the window is hidden.
3. It installs (NSIS in passive mode on Windows: a progress bar, no questions) and restarts.
   The restarted app goes back to the tray rather than opening its window, via a one-shot
   `start-hidden-once` marker in the app config dir (`background::start_hidden_next_launch`).

## Where the feed lives

`https://github.com/debate/debate-ai.com/releases/download/native-wrapper-updates/latest.json`
— the `latest.json` asset of a fixed `native-wrapper-updates` pre-release, not this repo's
"latest" release (which is shared with the extension and package releases).

1. A `native-wrapper-vX.Y.Z` tag runs `.github/workflows/native-wrapper-release.yml`. Its
   desktop jobs build signed updater bundles (`.app.tar.gz`, NSIS `-setup.exe`, `.AppImage`, each
   with a `.sig`) and merge them into a `latest.json` on the **draft** release.
2. Nobody is offered the build yet: draft files are not public.
3. Publishing the draft (a person, on GitHub) runs
   `.github/workflows/native-wrapper-updates.yml`, which copies that `latest.json` into the
   `native-wrapper-updates` release. Installed apps pick it up at their next check.
   Pre-releases are skipped. Running that workflow by hand with a tag re-points the feed.

Installed apps only move to a **higher** version. The release workflow refuses a tag whose
version differs from the profile's `version`, so bump the profile, run `bun run configure`,
commit, then tag.

## Turning it on (one-time, owner only)

The update key has been generated and the profile is configured. Auto-update is now
**on**: `profiles/debate-ai.json` carries the public key, `src-tauri/tauri.conf.json` has
`createUpdaterArtifacts: true` and the `plugins.updater` block, and `capabilities/default.json`
grants `updater:default` + `process:allow-restart`.

To regenerate the key (only if the current one is lost — losing it means installed apps can
never be updated again), run:

```bash
cd apps/debate-native-wrapper
./node_modules/.bin/tauri signer generate -w ~/.tauri/debate-ai.key -p "<password>" --force
```

Then update `profiles/debate-ai.json` → `updater.pubkey` with the new `.key.pub` contents,
run `npm run configure`, and commit. Add the new key to the repository secrets
(`TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) if the old ones are gone.
Locally, export both variables before building (a `.env` file does not work for these):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/debate-ai.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<password>"
```

## Testing an update end to end

1. Install build `1.0.0` (with the pubkey) on a test machine.
2. Bump the profile to `1.0.1`, tag `native-wrapper-v1.0.1`, wait for the release workflow,
   publish the draft, and check the "Native Wrapper Update Feed" run passed.
3. Start the installed `1.0.0` from the tray (or hide its window): it downloads, installs and
   comes back in the tray as `1.0.1`.

For a local check without a release, point a debug build at a local feed: sign any file with
`bunx tauri signer sign -f <key> <file>`, serve a `latest.json` naming it over
`http://127.0.0.1`, set `plugins.updater.endpoints` to that URL plus
`"dangerousInsecureTransportProtocol": true` in `tauri.conf.json` (don't commit it), and run the
debug binary with `--minimized`. It logs `downloading update …`, then `installing update …`;
a tampered file fails with "The signature verification failed".

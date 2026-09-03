# Building

## Local desktop dev

```bash
cd packages/native-wrapper
npm run dev          # regenerates tauri.conf.json from the debate-ai profile, then `tauri dev`
```

Opens a window pointed at `profiles/debate-ai.json`'s `url` (`https://debate-ai.com` by
default) — there is no local frontend to serve, the window loads the real site directly, so
`npm run dev` in `apps/debate-ai.com` is unrelated (only relevant if you also want to test
against a local dev server — point `profiles/debate-ai.json`'s `url` at
`http://localhost:3000` temporarily and re-run `npm run configure` to do that; don't commit that
change).

## Local desktop release build

```bash
npm run build:desktop
```

Requires the platform's own Tauri prerequisites (a C toolchain; on Linux,
`libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev` — see
[Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/) for Windows/macOS).
Output lands under `src-tauri/target/release/bundle/`.

## Android / iOS

See `docs/MOBILE.md` — needs host tooling (`android:init`/`ios:init`) this package can't install
for you.

## CI

- **`.github/workflows/native-wrapper-ci.yml`** — runs on every push/PR touching this package (or
  the auth code its OAuth handoff depends on): `cargo check` + `cargo clippy -D warnings` on
  Linux, plus a check that `src-tauri/tauri.conf.json` and `generated_scheme.rs` are still what
  `scripts/configure.mjs` would produce from `profiles/debate-ai.json` (catches hand-edits that
  drift out of sync with the profile they're supposed to be generated from).
- **`.github/workflows/native-wrapper-release.yml`** — on a `native-wrapper-vX.Y.Z` tag (or
  manually via workflow_dispatch), builds Windows (`.exe`/`.msi`), macOS (universal `.dmg`), and
  Linux (`.AppImage`/`.deb`) via [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action),
  and a best-effort unsigned Android `.aab`, attaching everything to a draft GitHub Release the
  same two-stage way `debate/cardmirror`'s own `release.yml` avoids a multi-job race on the
  release draft. Desktop code signing (macOS notarization, Windows Authenticode) activates
  automatically once the relevant secrets are set — see the workflow file's comments for exact
  names, and `docs/APP_STORES.md` for where those credentials come from. There is no iOS CI job;
  see that workflow's trailing comment and `docs/MOBILE.md` for why and how to add one.

To cut a release: bump `version` in `profiles/<name>.json`, run `npm run configure`, commit, then
`git tag native-wrapper-v1.0.0 && git push origin native-wrapper-v1.0.0`.

## Auto-update (not yet enabled)

`tauri-plugin-updater` is included in `Cargo.toml` and registered in `lib.rs` (desktop only), but
`tauri.conf.json`'s `plugins.updater.active` is `false` — there's no signing keypair or update
endpoint configured yet. To turn it on: `npx @tauri-apps/cli@2 signer generate`, store the
resulting private key as a `TAURI_SIGNING_PRIVATE_KEY` secret (and its password, if set, as
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`), set `plugins.updater.active: true` and an `endpoints` entry
pointing at this GitHub repo's releases (`tauri-action`'s `includeUpdaterJson` input, currently
`false` in the release workflow, generates the `latest.json` manifest the updater polls once you
flip both on).

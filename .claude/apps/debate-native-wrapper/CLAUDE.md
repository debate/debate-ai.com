# CLAUDE.md — `apps/debate-native-wrapper`

A **generic Tauri wrapper** that packages a website as a native desktop app.
Package name `native-wrapper`.

## It is not a workspace

The root `workspaces` globs are `["packages/*", "apps/debate-ai.com"]`, so this
app sits outside them: a root `bun install` does not install it, turbo never
builds it, and the root test run never reaches it.

It has its **own CI**: `.github/workflows/native-wrapper-ci.yml` and
`native-wrapper-release.yml`. Those are the only checks that cover it.

## Things that bite

- **One config file.** Every app-specific value (name, identifier, URLs,
  window, deep link, trusted origins, updater, release tag names) lives in
  `profiles/debate-ai.json`. `scripts/configure.mjs` generates `tauri.conf.json`,
  `src/generated_scheme.rs`, `capabilities/remote.json`, `Info.plist` and
  `dist/splash-config.js` from it; CI fails if they drift. Add a new
  app-specific value to the profile and `profiles/README.md`, never as a
  literal. The tag prefix in the two release workflows' `on:`/`if:` is the
  one unavoidable copy, and `configure` checks it.
- **Flatpak and Snap repackage the `.deb`.** `configure` also writes
  `flatpak/<app id>.yml` + `.metainfo.xml` and `snapcraft/snapcraft.yaml` from
  the profile's `flatpak` / `snap` blocks; `scripts/build-flatpak.sh` and
  `build-snap.sh` package a `.deb`, and the release workflow's best-effort
  `build-flatpak` / `build-snap` jobs use the Linux leg's `.deb` artifact. The
  updater is off inside either (`store_managed()` in `updater.rs`). Flathub
  submission is manual: see `docs/FLATPAK.md`.
- **Rust toolchain required.** A machine that builds the rest of this repo
  cannot necessarily build this.
- **It is generic on purpose.** Keep debate-specific behaviour out of it —
  configuration goes in, hardcoded product assumptions do not.
- Native behaviour (window, tray, updater, deep links) lives on the Rust side,
  not in the web layer. Looking for it in the JS is the usual wrong turn.
- Release signing and per-OS packaging differ per platform; a green build on one
  OS says nothing about the others.
- **A second window exists.** `src-tauri/src/mini_player.rs` opens a
  `mini-player` window (always-on-top capable). Both capability files list it
  in `windows`; a new permission the mini window needs goes there too, and any
  `on_window_event` handler written for `main` does not cover it.
- **A loopback server exists.** `src-tauri/src/desktop_bridge.rs` listens on
  `127.0.0.1:<desktopBridgePort>` so the site in a browser can open the mini
  window. It answers only the profile's own sites. The port is mirrored in
  `packages/debate-videos/src/lib/mini-player-window.ts`; change both.
- **Find in page is an injected script.** WebViews have no find bar, so
  `src-tauri/src/find_bar.rs` injects `find_bar.js` into every page of every
  window (splash, settings, any source, the mini player). It opens on
  Ctrl+F / Cmd+F only when no page handler called `preventDefault()` (an
  editor's own search wins), paints matches with the CSS Custom Highlight API
  so it never edits the page DOM, and is tested in `test/find-bar.test.ts`.
- **Auto-update is profile-driven.** `scripts/configure.mjs` writes
  `plugins.updater` + `bundle.createUpdaterArtifacts` only when the profile's
  `updater.pubkey` is set; `src-tauri/src/updater.rs` registers the plugin only
  when that block exists. Once it is set, every bundle build needs
  `TAURI_SIGNING_PRIVATE_KEY`. Installs wait until no window is visible. The feed
  is the fixed `native-wrapper-updates` release, moved by
  `native-wrapper-updates.yml` on publish. See `docs/UPDATES.md`.

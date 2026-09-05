# Android + iOS

The Rust core (`src-tauri/`) is already mobile-ready: `lib.rs`'s `run()` is gated with
`#[cfg_attr(mobile, tauri::mobile_entry_point)]`, the crate builds as a `staticlib`/`cdylib` for
FFI, and every desktop-only plugin (single-instance, updater, global-shortcut) is behind
`#[cfg(not(any(target_os = "android", target_os = "ios")))]`. What's missing is the generated
native project each platform needs around that core — and generating it needs host tooling this
package can't assume you have (an Android SDK/NDK install, or a Mac with Xcode), so it isn't
run automatically. Do it once per machine you build mobile from:

```bash
npm run android:init   # writes src-tauri/gen/android
npm run ios:init       # writes src-tauri/gen/apple  (macOS host only)
```

Both read `src-tauri/tauri.conf.json` (already configured for the active profile — see
`../profiles/README.md`) to set the package name / bundle id, deep-link scheme, and icons, so run
`npm run configure` first if you've changed profiles.

## Android

**Requirements** (from the [Tauri mobile prerequisites](https://v2.tauri.app/start/prerequisites/)):
- Android SDK + **NDK r28 or newer**. NDK ≥28 builds 16KB-page-aligned native libraries, which
  Google Play now requires for new apps/updates targeting recent devices — an older NDK needs a
  manual linker workaround this package doesn't set up for you.
- `ANDROID_HOME` and `NDK_HOME` environment variables pointing at your SDK/NDK install.
- The Android Rust targets: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.
- Minimum supported OS: **API 24** (set via `profiles/<name>.json`'s `android.minSdkVersion`);
  Google Play itself now requires new/updated apps to **target** API 36 — see
  `docs/APP_STORES.md`.

```bash
npm run android:dev      # runs on a connected device/emulator with hot reload
npm run android:build    # release build; add --apk for a plain APK instead of the .aab Play wants
```

## iOS

**Requirements**: a macOS host with full **Xcode** installed (not just the Command Line Tools),
and the iOS Rust targets: `rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim`.

```bash
npm run ios:dev
npm run ios:build -- --export-method app-store-connect   # or ad-hoc / development / enterprise
```

`ios:build` produces an unsigned/ad-hoc `.ipa` unless you've set up a signing identity and
provisioning profile in `src-tauri/gen/apple`'s Xcode project first (`npm run ios:init` opens it
for you to configure once) — see `docs/APP_STORES.md` for what App Store distribution needs
beyond that, including the "minimum functionality" review risk a webview-wrapper app like this one
should expect on iOS specifically.

## Should `gen/android` / `gen/apple` be committed?

This repo's `.gitignore` excludes them by default, since a freshly generated tree matches
`tauri.conf.json` exactly and re-running `init` reproduces it. If you hand-edit anything inside
`gen/` directly (native permissions, a custom Gradle/Xcode build step, manual signing config),
commit that tree instead — Tauri's mobile tooling is built to have `gen/` checked in and patched
in place for exactly that case, and future `init`/`build` runs preserve local edits rather than
clobbering them.

## CI

The Android job in `.github/workflows/native-wrapper-build.yml` builds a signed `.aab` when
release-signing secrets are configured, and is skipped otherwise (see that workflow's comments).
There is currently no iOS CI job — GitHub's hosted `macos-*` runners can build one (see
`docs/APP_STORES.md` for the Xcode/signing steps involved), but wiring up certificate and
provisioning-profile secrets is a decision for whoever holds the Apple Developer account, not
something to default to for every fork of this package.

# Compiling for each platform

`docs/BUILDING.md` covers the everyday commands. This file is the per-platform
detail: what to install on each OS (every Linux distro family included), which bundle
formats come out, and what actually blocks a build when it fails.

Everything below assumes you have already run the two setup steps once:

```bash
cd apps/debate-native-wrapper
npm install          # this package is OUTSIDE the root package.json workspaces
                     # (those are packages/* + apps/debate-ai.com), so a root-level
                     # install never creates its node_modules and `tauri` won't resolve
npm run configure    # profiles/debate-ai.json -> src-tauri/tauri.conf.json + generated_scheme.rs
```

and that Rust is installed (`curl https://sh.rustup.rs -sSf | sh`, or your distro's
`rustup`). Node 20+ or Bun 1.3+ runs the scripts; nothing here needs both.

## What each platform produces

| Host | `npm run build:desktop` produces | Under `src-tauri/target/release/bundle/` |
| --- | --- | --- |
| Linux | `.deb`, `.rpm`, `.AppImage` | `deb/`, `rpm/`, `appimage/` |
| Windows | `.exe` (NSIS), `.msi` (WiX) | `nsis/`, `msi/` |
| macOS | `.app`, `.dmg` | `macos/`, `dmg/` |
| Android | `.apk` / `.aab` | `src-tauri/gen/android/app/build/outputs/` |
| iOS | `.ipa` | `src-tauri/gen/apple/build/` |

`tauri.conf.json` sets `bundle.targets: "all"`, which means "every format valid on the
host you are building on" — not every format that exists. Narrow it per run with
`npm run build:desktop -- --bundles deb,appimage`.

## The rule that decides your Linux build

**A Linux build runs only on a distro at least as new as the one that built it.** The
binary links the host's glibc, GTK 3, libsoup3 and WebKitGTK; a `.deb` built on Ubuntu
24.04 will refuse to start on Debian 12 with a `GLIBC_2.38 not found`. Nothing about
the packaging fixes this — an AppImage bundles the app, not libc.

So the distro you build on is a distribution decision, not a convenience:

- **Build on the oldest release you intend to support.** Ubuntu 22.04 is the usual
  floor for a WebKitGTK 4.1 app and is what covers Debian 12, Mint 21, Pop!_OS 22.04
  and RHEL 9 derivatives in one go.
- **Cross-compiling between architectures is not practical here.** `--target
  aarch64-unknown-linux-gnu` needs the full GTK/WebKit/soup stack cross-built for the
  target too. Build arm64 on an arm64 machine (or a `ubuntu-24.04-arm` runner); that is
  what the release workflow does everywhere else.
- **The distro you build on has nothing to do with which package formats you get.**
  Tauri writes `.rpm` from a Rust crate rather than shelling out to `rpmbuild`, so a
  Debian host produces a valid `.rpm` — it just links Debian's libraries, which is the
  thing that matters.

### Linux system dependencies, by distro

The stack is the same everywhere: a C toolchain, WebKitGTK 4.1 and its headers, GTK 3,
libsoup3, librsvg (icons), libxdo (the global fullscreen shortcut), and — for AppImage
only — `patchelf` and network access at build time, because the bundler downloads
`linuxdeploy` on first use.

**Debian, Ubuntu, Mint, Pop!\_OS, Zorin, elementary, Kali, Raspberry Pi OS, MX, Devuan**

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

Debian 12 and Ubuntu 22.04 both carry WebKitGTK 4.1. On Ubuntu 20.04 and Debian 11 only
4.0 exists, which Tauri v2 does not support — those releases cannot build this.

**Fedora, RHEL 9+, CentOS Stream, Rocky, AlmaLinux, Amazon Linux 2023, Oracle Linux**

```bash
sudo dnf check-update
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel patchelf
sudo dnf group install "c-development"
```

On the RHEL rebuilds `webkit2gtk4.1-devel` lives in EPEL: `sudo dnf install
epel-release` first (and `crb`/`powertools` enabled — `sudo dnf config-manager
--set-enabled crb`).

**Fedora Silverblue, Kinoite and other rpm-ostree images**

```bash
sudo rpm-ostree install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel gcc gcc-c++ make
sudo systemctl reboot
```

A layered install needs the reboot before the headers are visible. A `toolbox enter`
container with the Fedora commands above avoids both the layering and the reboot, and
is the better habit on an image-based system.

**Arch, Manjaro, EndeavourOS, Garuda, CachyOS, Artix**

```bash
sudo pacman -Syu
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg xdotool patchelf
```

Rolling release means your build links whatever WebKitGTK shipped this week — fine for
running locally, the worst possible choice for producing artifacts other people
install. Do not cut releases from Arch.

**openSUSE Leap and Tumbleweed, SLE**

```bash
sudo zypper up
sudo zypper in webkit2gtk3-devel libopenssl-devel curl wget file \
  libappindicator3-1 librsvg-devel xdotool-devel patchelf
sudo zypper in -t pattern devel_basis
```

openSUSE's `webkit2gtk3-devel` is the soup3 (4.1) build despite the `3` in the name;
the soup2 build is the separate `webkit2gtk3-soup2-devel`, which is the wrong one.

**Alpine and postmarketOS**

```bash
sudo apk add build-base webkit2gtk-4.1-dev curl wget file openssl-dev \
  libayatana-appindicator-dev librsvg xdotool patchelf
```

Alpine is musl, not glibc, so its binary runs only on musl systems — an Alpine build is
a separate artifact from the glibc one, never a replacement for it. `webkit2gtk-4.1-dev`
is in the `community` repository.

**Gentoo**

```bash
sudo emerge --ask net-libs/webkit-gtk:4.1 dev-libs/libayatana-appindicator \
  net-misc/curl net-misc/wget sys-apps/file x11-misc/xdotool dev-util/patchelf
```

**Void**

```bash
sudo xbps-install -S webkit2gtk-devel gtk+3-devel libsoup3-devel librsvg-devel \
  xdotool-devel base-devel patchelf
```

**Solus**

```bash
sudo eopkg install -c system.devel
sudo eopkg install libwebkit-gtk41-devel librsvg-devel libappindicator-devel xdotool-devel patchelf
```

**NixOS**

Nix wants the dependencies in a shell rather than on the system. A `nix-shell -p` line
covers a one-off build:

```bash
nix-shell -p pkg-config openssl webkitgtk_4_1 gtk3 libsoup_3 librsvg \
             xdotool patchelf cargo rustc nodejs
```

For anything repeatable, write a `flake.nix` — the [NixOS wiki's Tauri
page](https://wiki.nixos.org/wiki/Tauri) has the current one, including the
`XDG_DATA_DIRS` and `WEBKIT_DISABLE_COMPOSITING_MODE` shell hooks NixOS needs at run
time.

**Anything else**

The package names change; the five libraries do not. Look for the `-dev`/`-devel`
packages of `webkit2gtk-4.1`, `gtk+-3.0`, `libsoup-3.0`, `librsvg-2.0` and `libxdo`,
then check with `pkg-config --modversion webkit2gtk-4.1`.

### Redistributable Linux formats

```bash
npm run build:desktop -- --bundles deb          # Debian family
npm run build:desktop -- --bundles rpm          # RHEL / SUSE family
npm run build:desktop -- --bundles appimage     # everything else
```

`deb` and `rpm` declare their dependencies, so the package manager tells the user what
is missing rather than the app dying at launch. The AppImage does not — it is the right
choice for distros whose package format you are not building, and the wrong one as a
default.

Flatpak and Snap are built *from* the `.deb`, not by the Tauri bundler:

- **Flatpak** — write a manifest using `org.gnome.Platform`/`Sdk` 47 and add the `.deb`
  as an `extra-data` source; the runtime supplies WebKitGTK, so the glibc rule above
  stops applying and one build covers every distro. This is the best answer for wide
  Linux distribution and the most setup.
- **Snap** — a `snapcraft.yaml` with `base: core24`, `confinement: strict`, and the
  `gnome` extension for the GTK stack.
- **AUR** — a `PKGBUILD` whose `source` is the release `.tar.gz`, built on the user's
  own machine, which sidesteps the Arch rolling-library problem entirely.

None of the three is wired up in this repo yet; each is a manifest file plus a CI job.

## Windows

Prerequisites, in this order:

1. **Microsoft C++ Build Tools** — the [Build Tools
   installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/), with the
   "Desktop development with C++" workload ticked. This is what supplies `link.exe`;
   Rust's MSVC toolchain cannot build without it.
2. **WebView2** — preinstalled on Windows 11 and on any updated Windows 10. On a bare
   image, install the [Evergreen
   Bootstrapper](https://developer.microsoft.com/microsoft-edge/webview2/).
3. **VBScript** — needed by the WiX toolchain that produces the `.msi`, and turned
   *off* by default on Windows 11 24H2 and newer. Settings → System → Optional features
   → More Windows features → tick VBSCRIPT. Skip it and only the `.msi` fails; the NSIS
   `.exe` still builds.

```powershell
npm run build:desktop                         # .exe (NSIS) + .msi (WiX)
npm run build:desktop -- --bundles nsis       # just the .exe
```

`tauri.conf.json` sets `windows.nsis.installMode: "currentUser"`, so the installer needs
no administrator prompt and writes under `%LOCALAPPDATA%`.

Architectures: `x86_64-pc-windows-msvc` is the default and covers ARM64 Windows through
emulation. For a native ARM64 build, `rustup target add aarch64-pc-windows-msvc` and
pass `--target aarch64-pc-windows-msvc`; it must be built on Windows either way, since
the MSVC linker and the WebView2 SDK have no working Linux cross-target.

Unsigned installers trigger SmartScreen's "Windows protected your PC" on first run.
Authenticode signing is wired into the release workflow through `WINDOWS_CERTIFICATE`
and `WINDOWS_CERTIFICATE_PASSWORD` — see the comment on those secrets in
`.github/workflows/native-wrapper-release.yml`, which flags that Tauri's Windows signing
variables have moved between versions and should be checked against the CLI version the
workflow resolves.

## macOS

```bash
xcode-select --install                        # Command Line Tools are enough for desktop
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

```bash
npm run build:desktop -- --target universal-apple-darwin --bundles dmg,app
```

The universal target builds both architectures and `lipo`s them into one binary — the
only artifact worth shipping, since a single `.dmg` then runs natively on Apple Silicon
and Intel. Dropping `--target` gives you a build for the machine you are on and nothing
else.

`bundle.macOS.minimumSystemVersion` is `10.15`, which is what the system-detection code
in `src-tauri/src/system_info.rs` assumes when it names releases (Catalina is the oldest
codename in its table).

An unsigned `.dmg` gets Gatekeeper's "unidentified developer" refusal, and on Apple
Silicon that is a hard block rather than a right-click-to-open. Signing and notarization
activate from the `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` secrets in
the release workflow; `docs/APP_STORES.md` covers where each credential comes from.

The Mac App Store build is a different bundle (`--bundles app` with an App Store config
overlay) and is sandboxed, which is the case `system_info.rs` handles by reading
`SystemVersion.plist` when it cannot spawn `sw_vers`.

## Android and iOS

`docs/MOBILE.md` has the full story — host tooling (Android Studio + NDK, or Xcode),
`npm run android:init` / `npm run ios:init` to generate the platform projects, then
`android:build` / `ios:build`. Both need signing material to produce anything
installable, and the release workflow degrades to unsigned artifacts without it.

The About system panel reports `os` and `arch` on mobile and leaves the OS version
blank: reading the Android release needs JNI and the iOS one needs `UIDevice`, and
`system_info.rs` reports nothing rather than guessing.

## Other Unixes

FreeBSD, OpenBSD and NetBSD have no Tauri bundler, but the app itself builds:

```bash
# FreeBSD
sudo pkg install webkit2-gtk3 gtk3 libsoup3 librsvg2 xdotool rust node
cd src-tauri && cargo build --release
```

The output is a plain executable in `src-tauri/target/release/`, to be packaged by hand
or run in place. `system_info.rs` falls through to its `uname` branch there and reports
e.g. `FreeBSD 14.1-RELEASE`.

## Checking a build did what you think

Open the app, then **Settings → System**. The About system panel is read straight from
the running binary, so it answers the questions a build raises directly:

- the distro line names the machine, not the one you built on — if a `.deb` built on
  Ubuntu 22.04 opens on Fedora 41 and says `Fedora Linux 41`, the glibc floor held;
- **Install format** shows `appimage`, `flatpak` or `snap` when a bundle is running as
  one, and the host's package format otherwise;
- **Web engine** names the actual webview — `WebKitGTK`, `WebView2` or `WKWebView` —
  which is the first thing to know about a rendering bug that only reproduces on one OS;
- **Display server** separates a Wayland session from X11 on Linux.

"Copy" puts the whole thing on the clipboard as plain text for a bug report.

If every field but the engine is missing on a desktop build, the `system_info` command
was rejected rather than absent: the site is *remote* content to the wrapper, and Tauri
v2 resolves the ACL for every call a remote origin makes. Check that
`src-tauri/permissions/allow-system-info.toml` exists and that `allow-system-info` is
listed in `src-tauri/capabilities/remote.json`.

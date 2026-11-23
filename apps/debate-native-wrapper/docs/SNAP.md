# Snap and the Snap Store

Like the Flatpak (`FLATPAK.md`), the snap **repackages the Tauri `.deb`**. snapcraft's `gnome`
extension supplies GTK and WebKitGTK; the snap stages the two extra libraries a Tauri tray app
links (`libayatana-appindicator3-1`, `libxdo3`). It is `strict`ly confined on `core24`.

## Files

| File | What it is |
|---|---|
| `snapcraft/snapcraft.yaml` | **Generated** from the profile's `snap` block by `bun run configure`; never edit it by hand. |
| `scripts/build-snap.sh` | Copies a `.deb` next to it as `app.deb` and runs `snapcraft pack`. |

The snap name, summary, description, license, contact, grade, store channel, plugs and staged
packages come from `profiles/debate-ai.json` (`snap`, falling back to the `flatpak` summary and
description). The build unpacks the `.deb`, installs the binary as `usr/bin/<snap name>`, and
rewrites the desktop file the way snapd wants it (`Exec=debate-ai %u`,
`Icon=${SNAP}/usr/share/icons/hicolor/128x128/apps/...`).

Plugs: `network`, `network-bind` (the desktop bridge on `127.0.0.1`), `audio-playback`,
`audio-record` and `camera` (live rounds), `home` (opening and saving files), plus what the
`gnome` extension adds (desktop, wayland, x11, opengl...). `audio-record` and `camera` are not
auto-connected: users run `snap connect debate-ai:camera` / `:audio-record`, or the Snap Store
grants them after a store request (see below).

Inside a snap the built-in updater is off (`store_managed()` in `src-tauri/src/updater.rs`).

## Setting up snapd on Ubuntu in WSL

Snap needs the `snapd` service, which needs systemd. In WSL:

1. Check systemd (Ubuntu terminal): `ps -p 1 -o comm=`. If it prints `systemd`, go to step 3.
2. Otherwise `sudo nano /etc/wsl.conf` and add (or update, under an existing `[boot]`):

   ```
   [boot]
   systemd=true
   ```

   Then in PowerShell (save your work, this stops every WSL distro):

   ```
   wsl --update
   wsl --shutdown
   wsl -d Ubuntu
   ```

   (Use the name from `wsl --list --verbose` if it isn't `Ubuntu`.)
3. Install and test snapd:

   ```bash
   sudo apt update
   sudo apt install -y snapd
   sudo systemctl enable --now snapd.socket
   sudo systemctl start snapd.service
   sudo snap wait system seed.loaded
   snap version                  # both snap and snapd should show a version
   sudo snap install hello-world && snap run hello-world
   ```

If snap cannot reach its server, collect `ps -p 1 -o comm=`,
`systemctl status snapd.socket snapd.service --no-pager` and
`journalctl -u snapd.service -b --no-pager -n 80`. GUI snaps on WSLg may need adjusting even when
CLI snaps work: confinement and WSLg's display and audio sockets don't always agree.

## Build and test locally

```bash
sudo snap install snapcraft --classic
sudo snap install lxd && sudo lxd init --auto     # snapcraft builds in an LXD container

cd apps/debate-native-wrapper
bun run build:desktop -- --bundles deb
bun run build:snap                                # snapcraft/debate-ai_<version>_amd64.snap
sudo snap install --dangerous snapcraft/debate-ai_*_amd64.snap
snap connect debate-ai:camera && snap connect debate-ai:audio-record
debate-ai
```

`bash scripts/build-snap.sh path/to/app.deb --destructive-mode` builds on the host instead of
LXD (only on an Ubuntu 24.04, matching `core24`). Test sign-in through `debateai://`, the
camera and microphone, the tray, the mini player and links, not just the launch.

## In the release workflow

`native-wrapper-release.yml` has a **Build Snap** job (best-effort):

1. It downloads the `native-wrapper-linux-deb` artifact from the Linux `build-desktop` leg,
   puts it at `snapcraft/app.deb`, and builds with `snapcore/action-build`.
2. The snap is attached to the release; the normalize step names it
   `debate-ai-<version>-linux-x64.snap`.
3. **Snap Store upload** runs only when the `SNAPCRAFT_STORE_CREDENTIALS` repository secret
   exists, and only for a real release. It releases to the profile's `snap.storeChannel`
   (`stable`; use `edge` or `candidate` to stage releases first). Until the secret is added the
   job only builds and attaches.

## Publishing on the Snap Store (manual setup, needs Alexa)

1. Create a Snapcraft account at <https://snapcraft.io> (Ubuntu One login).
2. Register the name: `snapcraft login`, then `snapcraft register debate-ai`. If the name is
   taken, change `snap.name` in the profile and run `bun run configure`.
3. Upload the first build by hand to check the listing:
   `snapcraft upload --release=edge debate-ai_<version>_amd64.snap`.
4. Request auto-connection of `camera` and `audio-record` on the Snap Store forum
   (<https://forum.snapcraft.io>, category "store-requests"), explaining live debate rounds.
   Until it's granted, users connect them with `snap connect`.
5. Fill in the listing on <https://snapcraft.io/debate-ai/listing>: icon, screenshots,
   description, category Education, links.
6. Let CI publish: `snapcraft export-login --snaps=debate-ai --channels=stable,candidate,edge
   --acls=package_access,package_push,package_release credentials.txt`, then save the file's
   contents as the `SNAPCRAFT_STORE_CREDENTIALS` repository secret (Settings → Secrets and
   variables → Actions). Delete `credentials.txt` afterwards.

From then on every `native-wrapper-vX.Y.Z` tag builds the snap and releases it to
`snap.storeChannel`; installed snaps update themselves.

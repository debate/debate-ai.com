# Flatpak and Flathub

The Linux Flatpak is not built by the Tauri bundler. It **repackages the `.deb`** that
`tauri build` already makes: the binary, the desktop file and the icons go into a Flatpak on
top of the GNOME runtime (51), which ships WebKitGTK and the rest of a Tauri app's libraries.
This follows Tauri's own guide (<https://v2.tauri.app/distribute/flatpak/>). Because the
runtime supplies the libraries, one Flatpak runs on every distro, unlike the `.deb` (see the
glibc rule in `PLATFORMS.md`).

## Files

| File | What it is |
|---|---|
| `flatpak/<app id>.yml` | The flatpak-builder manifest. **Generated** from the profile's `flatpak` block by `bun run configure`; never edit it by hand. |
| `flatpak/<app id>.metainfo.xml` | The AppStream listing (name, summary, description, links, screenshots, release, content rating). **Generated** too. |
| `scripts/build-flatpak.sh` | Copies a `.deb` next to the manifest as `app.deb`, builds, exports `flatpak/<app id>.flatpak`. |

The app id is the profile's `flatpak.appId`, or its `identifier` (`com.debate.ai`) when that is
unset. Everything else (summary, description, finish-args, categories, screenshots, release
date, content rating) is in `profiles/debate-ai.json` under `flatpak`; see
`profiles/README.md`.

The manifest installs the binary as `/app/bin/<command>` (`debate-ai`), copies anything the
`.deb` has under `usr/lib/`, rewrites the desktop file's `Exec=` program and `Icon=` (keeping
the `%u` that the `debateai://` login handoff needs) and installs every `NxN` icon size under
the app id.

Inside a Flatpak (and a snap) the built-in updater is off (`store_managed()` in
`src-tauri/src/updater.rs`): Flathub delivers the updates.

## Build and test locally

On Ubuntu, Debian, or Ubuntu on WSL (WSLg gives it a window):

```bash
sudo apt install flatpak
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.flatpak.Builder org.gnome.Platform//51 org.gnome.Sdk//51

cd apps/debate-native-wrapper
bun install --ignore-scripts
bun run build:desktop -- --bundles deb      # src-tauri/target/release/bundle/deb/*.deb
bun run build:flatpak -- --install          # builds, installs for this user, writes flatpak/com.debate.ai.flatpak
flatpak run com.debate.ai
```

Pass a `.deb` path to package one you downloaded instead
(`bash scripts/build-flatpak.sh ~/Downloads/debate-ai-1.0.0-linux-x64.deb --install`). Install a
built bundle elsewhere with `flatpak install --user com.debate.ai.flatpak`.

Lint the manifest:

```bash
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest flatpak/com.debate.ai.yml
```

Test more than the launch: sign in (the system browser hands back to the app through
`debateai://`), the camera and microphone in a live round, the tray icon, the mini player,
opening links, and the offline source. The sandbox can break things the `.deb` does not.
Two known differences: **Run on Startup** cannot register itself from inside the sandbox, and
the always-on-top mini player depends on the compositor (Wayland ignores always-on-top).

## In the release workflow

`native-wrapper-release.yml` has a **Build Flatpak** job (best-effort, like the mobile jobs):

1. The Linux leg of `build-desktop` uploads its `.deb` as the `native-wrapper-linux-deb`
   workflow artifact.
2. `build-flatpak` installs flatpak, `org.flatpak.Builder` and the GNOME runtime, lints the
   manifest (non-blocking), and runs `scripts/build-flatpak.sh` on that `.deb`.
3. The bundle is attached to the release; the normalize step names it
   `debate-ai-<version>-linux-x64.flatpak`.
4. On a real release it also writes `flatpak/com.debate.ai.flathub.yml`: the same manifest
   with `app.deb` replaced by the release's `debate-ai-<version>-linux-x64.deb` URL and its
   sha256. It is in the `native-wrapper-flatpak` workflow artifact, with the metainfo, ready for
   Flathub.

A failed Flatpak build never blocks the release.

## Publishing on Flathub (manual, needs Alexa)

A `.flatpak` on GitHub Releases installs anywhere, but getting into Flathub (GNOME Software,
KDE Discover) is a review process run by people, through a GitHub pull request. It cannot be
automated from this repo.

Before the first submission:

1. **Choose the final app id.** Flathub checks that you control the domain the id is named
   after. `com.debate.ai` means `debate.com`, which we do not control. Use one of:
   - `io.github.debate.DebateAI` (verified through the `debate` GitHub organization), or
   - `com.debate_ai.DebateAI` (verified by a token file on `https://debate-ai.com/.well-known/`).

   Set it as `flatpak.appId` in `profiles/debate-ai.json` and run `bun run configure`. The id
   is permanent once published. (`identifier`, the id the other stores use, stays as it is.)
2. **Add screenshots.** Flathub requires at least one. Put PNGs at stable URLs (for example
   committed under `apps/debate-web/public/`) and list them in `flatpak.screenshots`
   (`"https://..."` or `{ "url", "caption" }`).
3. **Check the content rating** at <https://hughsie.github.io/oars/generate.html> and copy
   the answers into `flatpak.contentRating` (now: `social-chat` and `social-audio` moderate,
   for live rounds).
4. **Check the license.** `flatpak.projectLicense` is
   `LicenseRef-proprietary=https://rights.institute/prosper`. Flathub accepts proprietary apps,
   but its reviewers may ask about redistribution rights.
5. Bump `flatpak.releaseDate` with every `version` bump.

Submitting:

1. Tag a release (`native-wrapper-vX.Y.Z`) so the `.deb` is public, and download the
   `native-wrapper-flatpak` artifact from that run.
2. Fork <https://github.com/flathub/flathub> and branch from **`new-pr`**.
3. Add `<app id>.yml` (renamed from the `.flathub.yml`) and `<app id>.metainfo.xml` at the root
   of the branch. Flathub builds from that branch, so the manifest must download the `.deb` by
   URL with a sha256, which the `.flathub.yml` already does.
4. Open the pull request **against `new-pr`** (not `master`), titled `Add <app id>`, and fill in
   the checklist. Reviewers comment on the PR; `bot, build` in a comment starts a test build.
5. After approval Flathub creates `github.com/flathub/<app id>`, and you become its maintainer.
   Verify the domain or GitHub org on <https://flathub.org/developer-portal>.

Every later release:

```
tag native-wrapper-vX.Y.Z → release workflow builds the .deb + .flatpak
  → copy url + sha256 from the run's .flathub.yml into flathub/<app id>
  → PR on that repo → Flathub's build passes → merge → users get the update
```

(Flathub's `x-checker-data` / flatpak-external-data-checker can open those update PRs by itself
once the repo exists.)

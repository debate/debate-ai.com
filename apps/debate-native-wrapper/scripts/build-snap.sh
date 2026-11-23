#!/usr/bin/env bash
# Builds a .snap from the Tauri Linux .deb (docs/SNAP.md).
#
#   bash scripts/build-snap.sh [path/to/app.deb]
#
# Without a path it takes the newest .deb in src-tauri/target/release/bundle/deb/
# (from `bun run build:desktop -- --bundles deb`). snapcraft/snapcraft.yaml is
# generated from the profile by `bun run configure`; this script copies the
# .deb next to it as app.deb and runs `snapcraft pack` there, which leaves
# snapcraft/<name>_<version>_amd64.snap. Needs snapd + snapcraft (and LXD or
# Multipass for the build environment; `--destructive-mode` builds on the host
# instead, on an Ubuntu matching the snap's base). Extra arguments after the
# .deb path go to snapcraft.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/snapcraft"
deb=""
if [ $# -gt 0 ] && [[ "$1" == *.deb ]]; then
  deb="$1"
  shift
fi

if [ ! -f "$dir/snapcraft.yaml" ]; then
  echo "No snapcraft/snapcraft.yaml; add a \"snap\" block to the profile and run \`bun run configure\`." >&2
  exit 1
fi
if [ -z "$deb" ]; then
  deb="$(ls -t "$root"/src-tauri/target/release/bundle/deb/*.deb 2>/dev/null | head -n 1 || true)"
fi
if [ -z "$deb" ] || [ ! -f "$deb" ]; then
  echo "No .deb found; build one with \`bun run build:desktop -- --bundles deb\` or pass its path." >&2
  exit 1
fi
if ! command -v snapcraft >/dev/null 2>&1; then
  echo "Install snapcraft first: sudo snap install snapcraft --classic" >&2
  exit 1
fi

cp "$deb" "$dir/app.deb"
echo "Packaging $deb as a snap"
cd "$dir"
snapcraft pack "$@"
ls -l "$dir"/*.snap

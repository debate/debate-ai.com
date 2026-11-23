#!/usr/bin/env bash
# Builds a .flatpak from the Tauri Linux .deb (docs/FLATPAK.md).
#
#   bash scripts/build-flatpak.sh [path/to/app.deb] [--install]
#
# Without a path it takes the newest .deb in src-tauri/target/release/bundle/deb/
# (from `bun run build:desktop -- --bundles deb`). The manifest and metainfo in
# flatpak/ are generated from the profile by `bun run configure`; this script
# only copies the .deb next to them as app.deb, runs flatpak-builder, and
# exports flatpak/<app id>.flatpak.
#
# Environment:
#   FLATHUB_DEB_URL  when set, also writes flatpak/<app id>.flathub.yml: the
#                    same manifest with app.deb swapped for this URL and the
#                    .deb's sha256, ready to copy into the Flathub repository.
#   FLATPAK_OUT      path of the exported bundle (default flatpak/<app id>.flatpak).
#
# Needs flatpak, the GNOME Platform/Sdk of the manifest's runtime-version, and
# either org.flatpak.Builder (from Flathub) or a host flatpak-builder.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/flatpak"
deb=""
install=0
for arg in "$@"; do
  case "$arg" in
    --install) install=1 ;;
    *) deb="$arg" ;;
  esac
done

manifest="$(find "$dir" -maxdepth 1 -name '*.yml' ! -name '*.flathub.yml' | head -n 1)"
if [ -z "$manifest" ]; then
  echo "No Flatpak manifest in flatpak/; add a \"flatpak\" block to the profile and run \`bun run configure\`." >&2
  exit 1
fi
app_id="$(basename "$manifest" .yml)"

if [ -z "$deb" ]; then
  deb="$(ls -t "$root"/src-tauri/target/release/bundle/deb/*.deb 2>/dev/null | head -n 1 || true)"
fi
if [ -z "$deb" ] || [ ! -f "$deb" ]; then
  echo "No .deb found; build one with \`bun run build:desktop -- --bundles deb\` or pass its path." >&2
  exit 1
fi
cp "$deb" "$dir/app.deb"
echo "Packaging $deb as $app_id"

if flatpak info org.flatpak.Builder >/dev/null 2>&1; then
  builder=(flatpak run org.flatpak.Builder)
elif command -v flatpak-builder >/dev/null 2>&1; then
  builder=(flatpak-builder)
else
  echo "Install org.flatpak.Builder (flatpak install --user flathub org.flatpak.Builder) or flatpak-builder." >&2
  exit 1
fi

cd "$dir"
build_args=(--force-clean --user --install-deps-from=flathub --repo=repo --state-dir=.flatpak-builder)
[ "$install" = 1 ] && build_args+=(--install)
"${builder[@]}" "${build_args[@]}" build-dir "$app_id.yml"

out="${FLATPAK_OUT:-$dir/$app_id.flatpak}"
flatpak build-bundle --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo repo "$out" "$app_id"
echo "Wrote $out"

if [ -n "${FLATHUB_DEB_URL:-}" ]; then
  sha="$(sha256sum app.deb | cut -d' ' -f1)"
  awk -v url="$FLATHUB_DEB_URL" -v sha="$sha" '
    $0 == "        path: app.deb" { print "        dest-filename: app.deb"; print "        url: " url; print "        sha256: " sha; next }
    { print }
  ' "$app_id.yml" > "$app_id.flathub.yml"
  echo "Wrote flatpak/$app_id.flathub.yml ($FLATHUB_DEB_URL, sha256 $sha)"
fi

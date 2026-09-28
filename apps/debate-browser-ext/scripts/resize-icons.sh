#!/usr/bin/env bash
# Regenerates the smaller extension icons from public/icon/128.png.
# Uses macOS `sips`; falls back to ImageMagick elsewhere.
set -euo pipefail

ICON_DIR="$(cd "$(dirname "$0")/../public/icon" && pwd)"
SRC="$ICON_DIR/128.png"

for size in 16 32 48 96; do
  out="$ICON_DIR/$size.png"
  if command -v sips >/dev/null; then
    sips -z "$size" "$size" "$SRC" --out "$out" >/dev/null
  else
    magick "$SRC" -resize "${size}x${size}" "$out"
  fi
  echo "wrote $out"
done

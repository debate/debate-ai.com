#!/usr/bin/env bash
# ==============================================================================
# Helper script to build native wrapper packages using Docker containers
# Usage:
#   ./scripts/build-docker.sh --linux
#   ./scripts/build-docker.sh --android
#   ./scripts/build-docker.sh --ios-core
#   ./scripts/build-docker.sh --all
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${WRAPPER_DIR}/dist-artifacts"

mkdir -p "${OUTPUT_DIR}/linux" "${OUTPUT_DIR}/android" "${OUTPUT_DIR}/ios"

build_linux() {
  echo "==> Building Linux packages (.deb, .rpm, .AppImage) in Docker..."
  docker build -f "${WRAPPER_DIR}/docker/Dockerfile.linux" -t debate-native-linux "${WRAPPER_DIR}"
  docker run --rm -v "${OUTPUT_DIR}/linux:/output" debate-native-linux
  echo "==> Linux packages saved to: ${OUTPUT_DIR}/linux"
}

build_android() {
  echo "==> Building Android packages (.apk, .aab) in Docker..."
  docker build -f "${WRAPPER_DIR}/docker/Dockerfile.android" -t debate-native-android "${WRAPPER_DIR}"
  docker run --rm -v "${OUTPUT_DIR}/android:/output" debate-native-android
  echo "==> Android packages saved to: ${OUTPUT_DIR}/android"
}

build_ios_core() {
  echo "==> Cross-compiling iOS static libraries in Docker..."
  docker build -f "${WRAPPER_DIR}/docker/Dockerfile.ios" -t debate-native-ios-core "${WRAPPER_DIR}"
  docker run --rm -v "${OUTPUT_DIR}/ios:/output" debate-native-ios-core
  echo "==> iOS static libraries saved to: ${OUTPUT_DIR}/ios"
}

TARGET="${1:-"--all"}"

case "${TARGET}" in
  --linux)
    build_linux
    ;;
  --android)
    build_android
    ;;
  --ios-core|--ios)
    build_ios_core
    ;;
  --all)
    build_linux
    build_android
    build_ios_core
    ;;
  *)
    echo "Unknown target: ${TARGET}"
    echo "Usage: $0 [--linux|--android|--ios-core|--all]"
    exit 1
    ;;
esac

echo "==> All requested builds finished successfully!"

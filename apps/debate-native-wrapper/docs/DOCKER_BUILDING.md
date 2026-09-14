# Docker & Cloud Containerized Builds

This document explains how to build the Debate AI native wrapper for **Linux**, **Android**, and **iOS** using headless Docker containers in local environments or cloud CI/CD pipelines (GitHub Actions, AWS CodeBuild, GCP Cloud Build, Kubernetes).

---

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) & [Docker Compose](https://docs.docker.com/compose/)
- No local Rust, GTK, Android SDK, or Node setup is required on your host machine when building through Docker.

---

## Quick Start: Building Targets

All container configurations live in `apps/debate-native-wrapper/docker/`.

### 1. Build Everything (Linux, Android, iOS Core)

```bash
cd apps/debate-native-wrapper
npm run docker:build:all
```

Artifacts will be output to:
- `dist-artifacts/linux/` (`.deb`, `.rpm`, `.AppImage`)
- `dist-artifacts/android/` (`.apk`, `.aab`)
- `dist-artifacts/ios/` (compiled static libraries for ARM64 and Simulator)

---

### 2. Linux Desktop Packages (.deb, .rpm, .AppImage)

The Linux container builds on `ubuntu:22.04` (glibc 2.35) with WebKitGTK 4.1, GTK3, AppIndicator, and RSVG libraries.

```bash
npm run docker:build:linux
```

Or using Docker CLI directly:
```bash
docker build -f docker/Dockerfile.linux -t debate-native-linux .
docker run --rm -v "$(pwd)/dist-artifacts/linux:/output" debate-native-linux
```

---

### 3. Android Packages (.apk, .aab)

The Android container includes OpenJDK 21, Android SDK (API 34/35/36), Android NDK r28 (16KB page-aligned), and the Rust Android targets.

```bash
npm run docker:build:android
```

Or using Docker CLI directly:
```bash
docker build -f docker/Dockerfile.android -t debate-native-android .
docker run --rm -v "$(pwd)/dist-artifacts/android:/output" debate-native-android
```

---

### 4. iOS Static Library Core

The iOS container compiles and verifies the Rust iOS static library (`aarch64-apple-ios` and `aarch64-apple-ios-sim`) inside Linux Docker.

```bash
npm run docker:build:ios-core
```

> **Note on iOS `.ipa` App Store Packaging:**
> Creating an archived, codesigned `.ipa` binary requires Xcode and Apple's macOS toolchain. For a full release build, use a macOS host or macOS GitHub Actions runner (`.github/workflows/native-wrapper-release.yml`).

---

## Multi-Container Docker Compose

You can also use Docker Compose to build and run any target service:

```bash
cd apps/debate-native-wrapper/docker

# Build all container images
docker compose build

# Run specific target
docker compose run --rm build-linux
docker compose run --rm build-android
docker compose run --rm build-ios-core
```

---

## Desktop Background Service & Global Shortcut

The native wrapper is configured to run as a persistent desktop background daemon with the following features:

1. **Autostart on Boot**: Automatically registers as a login item on macOS (LaunchAgent), Windows (Registry), and Linux (XDG Autostart).
2. **System Tray Integration**: Provides a system tray icon with Show/Hide toggle and Quit action. Closing the main window minimizes to the system tray instead of terminating the app.
3. **Global Shortcut (`Ctrl+`` / `Cmd+``)**:
   - Captures active text selection / clipboard from whichever application currently has focus across the OS.
   - Unminimizes and focuses the Debate AI window.
   - Dispatches `tauri-selected-text` and `quick-launch-text` events with the captured text into the web application.
   - The app's `GlobalCommandPalette` automatically opens pre-populated with the captured text for instant research or tool navigation.

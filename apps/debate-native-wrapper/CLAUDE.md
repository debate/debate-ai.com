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

- **Rust toolchain required.** A machine that builds the rest of this repo
  cannot necessarily build this.
- **It is generic on purpose.** Keep debate-specific behaviour out of it —
  configuration goes in, hardcoded product assumptions do not.
- Native behaviour (window, tray, updater, deep links) lives on the Rust side,
  not in the web layer. Looking for it in the JS is the usual wrong turn.
- Release signing and per-OS packaging differ per platform; a green build on one
  OS says nothing about the others.

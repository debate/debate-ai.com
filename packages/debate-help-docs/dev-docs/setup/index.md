---
title: Self-hosting
description: What a deployment of Debate AI is made of and what you need before you start
---

# Self-hosting Debate AI

How to run your own copy of the web app (`apps/debate-ai.com`): locally for development, and
on your own Cloudflare account in production. Everything here was taken from the code and
config in this repository; file paths are given so you can check them when they drift.

The guide is split into the pages of this section:

- [Run it locally](./local-development.md)
- [Database setup and migrations](./database.md)
- [Deploy to your Cloudflare account](./deploy.md)
- [Environment variables](./environment-variables.md)
- [Scheduled jobs and troubleshooting](./operations.md)

## What you are deploying

One Cloudflare Worker (`worker/index.ts`) that serves a Next.js App Router app built by
[vinext](https://github.com/cloudflare/vinext) (Vite), plus these Cloudflare resources, all
declared in `apps/debate-ai.com/wrangler.jsonc`:

| Binding | Kind | Used for | Required |
| --- | --- | --- | --- |
| `debate_db` | D1 database (`debate-ai-db`) | Every table in [database-schema.md](../database/app-schema.md) and [tabroom-schema.md](../database/tabroom-schema.md) | Yes |
| `ASSETS` | Static assets (`dist/client`) | The built client bundle | Yes (provided by the build) |
| `IMAGES` | Cloudflare Images | `/_next/image`-style resizing in `worker/index.ts` | Yes for image optimization |
| `DEBATE_ROOMS` | Durable Object `DebateRoomSignal` (SQLite-backed) | WebRTC signalling for webcam rounds (`lib/webcam/debate-room.ts`) | Only for webcam rooms |
| `DB_BACKUPS` | R2 bucket `debate-ai-db-backups` | Weekly SQL backups of content tables (`lib/admin/db-backup-r2.ts`) | Only for backups |
| `DB_BACKUPS_KV` | KV namespace (no id; wrangler provisions it) | `.sql.7z` copies of those backups | Only for backups |

Nearly all features live in `packages/debate-*` libraries the app mounts; you deploy only the
app. The browser extension (`apps/debate-browser-ext`) and native wrapper
(`apps/debate-native-wrapper`) are built separately and are not covered here.

## Prerequisites

- **Bun 1.4.x.** The repo pins `packageManager: bun@1.4.x`; CI uses 1.4.2. Do not use npm or yarn.
- **Git with submodules.** The build runs `.github/scripts/ensure-submodules.mjs`; clone with
  `git clone --recurse-submodules` or run `git submodule update --init --recursive`.
- **A Cloudflare account** for production. Wrangler, drizzle-kit and vinext are installed as
  dev dependencies by `bun install`; run them with `bunx` from `apps/debate-ai.com`.
- Node 22 is useful for some scripts but not required for the app.

```bash
git clone --recurse-submodules https://github.com/debate/debate-ai.com.git
cd debate-ai.com
bun install
```

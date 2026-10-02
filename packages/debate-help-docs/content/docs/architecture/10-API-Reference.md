---
title: "API Reference"
---

# API Reference
Relevant source files
- [apps/debate-ai.com/app/api/admin/videos/seed/route.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/admin/videos/seed/route.ts)
- [apps/debate-ai.com/lib/videos/seed-videos-to-db.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/videos/seed-videos-to-db.ts)
- [apps/debate-ai.com/public/debate-openapi.yml](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml)
- [apps/debate-ai.com/scripts/seed-videos.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/scripts/seed-videos.ts)
- [codecov.yml](https://github.com/debate/debate-ai.com/blob/34937310/codecov.yml)
- [docs/features/video-library.md](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/video-library.md?plain=1)
- [packages/debate-api-client/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1)
- [packages/debate-contributor-progress/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-contributor-progress/README.md?plain=1)
- [packages/debate-data-sync/src/videos/video-seed-sql.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/src/videos/video-seed-sql.ts)
- [packages/debate-data-sync/test/video-seed-sql.test.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/test/video-seed-sql.test.ts)
- [packages/debate-flow/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/README.md?plain=1)
- [packages/debate-round-practice-ai/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round-practice-ai/README.md?plain=1)
- [packages/debate-search-evidence/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-search-evidence/README.md?plain=1)

The Debate AI platform exposes a comprehensive suite of Next.js API routes that provide structured access to debate research content, video archives, AI-powered analysis, historical metadata, real-time collaborative flow editing, and user session management. These routes leverage a combination of flat-file JSON data sources (from the `debate-data-sync` package), Cloudflare D1 SQL storage accessed through the Drizzle ORM, and third-party AI services including Anthropic and Groq.

The entire API is formally documented using an OpenAPI 3.1.0 specification (`debate-openapi.yml`), served live at `/api/api-docs` and included in the service worker's pre-cache list for offline support. A fully typed SDK client (`debate-api-client`) is generated from this specification, greatly easing integration by frontend components and external clients.

---

## API Architecture Overview

The application utilizes the Next.js App Router's Route Handlers to produce a RESTful API surface under the `/api` base route. Where possible, these endpoints are designed to run on Cloudflare Workers as edge functions for low-latency global access.

The system employs a hybrid data backend model that has evolved over time:

- **Flat-file JSON source:** Many legacy and static reference datasets originate as bundled JSON assets (e.g., historical debate topics, dictionary, schools). These are served directly or used as fallback.
- **Cloudflare D1 SQL:** User data, debate rounds, flows, and video metadata increasingly reside in the Cloudflare D1 SQLite-compatible database accessed via the Drizzle ORM.
- **Local development:** During local runs, the fallback is a `libsql` SQLite file (`db.sqlite`) for seamless developer experience.

A critical example is the video library API (`/api/videos`), which uses SQL by default but falls back to JSON assets until the database is seeded. The seeding process is triggered via an admin endpoint and is idempotent to ensure consistency.

### System-to-Code Entity Mapping

This diagram bridges API concepts to code entities, illustrating request flow and data sources:

---

## OpenAPI Specification and Generated Client

The Debate AI REST API is comprehensively described by an OpenAPI 3.1.0 spec located at `apps/debate-ai.com/public/debate-openapi.yml`, which defines all endpoint paths, operations, request/response schemas, security requirements, and metadata [apps/debate-ai.com/public/debate-openapi.yml1-2550](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L1-L2550)

This specification is used to generate the official TypeScript SDK client, `debate-api-client`, published on npm. The SDK provides typed functions for every operation ID defined in the spec (e.g., `getVideoTranscript()`, `searchCards()`, `syncFlow()`, `reasonAiComplete()`), which return promises resolving to strongly typed data or error responses. The SDK uses `grab-url` for HTTP requests, providing caching, retries, rate limiting, and request deduplication [packages/debate-api-client/README.md1-62](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1#L1-L62)

The SDK generation pipeline uses the `@hey-api/openapi-ts` tool to produce TypeScript types and request builders from the OpenAPI YAML, then hand-written files implement the network client and operation functions. Releases are automated by GitHub Actions via the `npm-release.yml` workflow [packages/debate-api-client/README.md44-75](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1#L44-L75)[.github/workflows/npm-release.yml1-70](https://github.com/debate/debate-ai.com/blob/34937310/.github/workflows/npm-release.yml#L1-L70)

### OpenAPI to SDK Generation Flow Diagram

---

## API Route Groups Overview

### Content & Video API Routes

These endpoints serve metadata and media resources central to the video library and reference content.

- `/api/videos` — Returns a paginated feed of debate rounds and lectures, with rich filtering via URL query parameters: `style`, `year`, `category`, free-text `q`, sorting, and paging [apps/debate-ai.com/app/api/videos/route.ts3-32](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/videos/route.ts#L3-L32)
- `/api/videos/meta` — Supplies static metadata supporting the video feed UI such as counts, topic filters, and champions [apps/debate-ai.com/app/api/videos/meta/route.ts6-14](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/videos/meta/route.ts#L6-L14)
- `/api/history` — Provides combined data on historical debate topics and national champions, parsed from bundled JSON [apps/debate-ai.com/public/debate-openapi.yml127-145](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L127-L145)
- `/api/dictionary` — Returns the dictionary of debate terms and definitions [apps/debate-ai.com/public/debate-openapi.yml113-126](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L113-L126)
- `/api/schools` — Retrieves the cached list of debate schools [apps/debate-ai.com/public/debate-openapi.yml190-193](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L190-L193)
- `/api/names` — Supplies common debate team or speaker names [apps/debate-ai.com/public/debate-openapi.yml205-208](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L205-L208)
- `/api/tournaments` — Lists known debate tournaments [apps/debate-ai.com/public/debate-openapi.yml219-222](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L219-L222)
- `/api/youtube-stats` — Fetches YouTube channel statistics relevant to video content [apps/debate-ai.com/public/debate-openapi.yml233-236](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L233-L236)
- `/api/transcript` — Provides video transcripts for supported YouTube IDs [apps/debate-ai.com/public/debate-openapi.yml247-250](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L247-L250)
- `/api/sync-videos` — Triggers initiation or refresh of video syncs with YouTube [apps/debate-ai.com/public/debate-openapi.yml261-264](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L261-L264)
- `/api/video-issues` — Reports video content issues noted by admins or users [apps/debate-ai.com/public/debate-openapi.yml275-278](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L275-L278)

The video data is served from Cloudflare D1 with Drizzle ORM, seeded by JSON assets via the `/api/admin/videos/seed` POST endpoint [apps/debate-ai.com/app/api/admin/videos/seed/route.ts1-73](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/admin/videos/seed/route.ts#L1-L73) Until seeding runs, `/api/videos` falls back to serving from bundled JSON [apps/debate-ai.com/lib/videos/video-repository.ts70-111](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/videos/video-repository.ts#L70-L111) This approach supports incremental load and efficient pagination.

For detailed coverage, see [Content & Video API Routes](/debate/debate-ai.com/10.1-content-and-video-api-routes).

### AI, Search & Round API Routes

These routes provide advanced functionality, including AI analysis, search, round state management, and user preferences.

- `/api/analyze` — Sends debate card content to the Groq LLaMA 70B model for analysis, returning claims, flaws, and questions [apps/debate-ai.com/public/debate-openapi.yml48-111](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L48-L111)
- `/api/search` — Executes full-text search queries on debate evidence cards [apps/debate-ai.com/public/debate-openapi.yml290-293](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L290-L293)
- `/api/reason-ai` — Acts as a backend proxy for Anthropic LLM calls, hiding the API key and enforcing content size limits [apps/debate-ai.com/app/api/reason-ai/route.ts15-39](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/reason-ai/route.ts#L15-L39)
- `/api/judge-decisions` — Provides AI-generated judge decision history for rounds [apps/debate-ai.com/public/debate-openapi.yml304-307](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L304-L307)
- `/api/strategy-recommendations` — Offers AI-produced strategy recommendations [apps/debate-ai.com/public/debate-openapi.yml318-321](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L318-L321)
- `/api/drill-sets` — Manages sets of AI-driven practice drills [apps/debate-ai.com/public/debate-openapi.yml332-335](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L332-L335)
- `/api/flow-sync` — Enables collaborative live syncing of debate flow spreadsheets [apps/debate-ai.com/public/debate-openapi.yml346-349](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L346-L349)
- `/api/flow-presence` — Tracks user presence in shared flow editing sessions [apps/debate-ai.com/public/debate-openapi.yml360-363](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L360-L363)
- `/api/rounds` — CRUD endpoints for user-saved practice rounds [apps/debate-ai.com/public/debate-openapi.yml374-377](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L374-L377)
- `/api/flows` — CRUD endpoints for user-saved debate flows [apps/debate-ai.com/public/debate-openapi.yml388-391](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L388-L391)
- `/api/sprint-sessions` — Manages research sprint session metadata.
- `/api/settings` — User account preferences syncing [apps/debate-ai.com/public/debate-openapi.yml402-405](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L402-L405)
- `/api/leaderboard` — Combines TOC bid data with DebateDrills Elo ratings into leaderboard views [apps/debate-ai.com/public/debate-openapi.yml146-189](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L146-L189)

For details, see [AI, Search & Round API Routes](/debate/debate-ai.com/10.2-ai-search-and-round-api-routes).

### Admin Routes & Dashboard

Admin routes provide privileged access to manage video ingestion, user analytics, and application state.

- **AdminDashboard** and **UsersTable** React components serve as the primary administrative interface.
- `/api/admin/youtube/videos` — List, publish, and bulk publish YouTube videos [apps/debate-ai.com/public/debate-openapi.yml416-419](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L416-L419)
- `/api/admin/overview` — Displays system monitoring and analytics data [apps/debate-ai.com/public/debate-openapi.yml430-433](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L430-L433)
- `/api/admin/topic-starters` — Management endpoints for REASON editor topic starters [apps/debate-ai.com/public/debate-openapi.yml444-447](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/debate-openapi.yml#L444-L447)
- `/api/admin/videos/seed` — Endpoint to seed the SQL videos table from bundled JSON assets, safe to re-run [apps/debate-ai.com/app/api/admin/videos/seed/route.ts21-73](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/api/admin/videos/seed/route.ts#L21-L73) and [apps/debate-ai.com/lib/videos/seed-videos-to-db.ts1-58](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/videos/seed-videos-to-db.ts#L1-L58)
- Reuse-check purge API and scheduled worker for database maintenance.

For details, see [Admin Routes & Dashboard](/debate/debate-ai.com/10.3-admin-routes-and-dashboard).

---

## Natural Language to Code Entity Mapping

This diagram connects high-level user-facing system concepts to the actual implemented code files, focusing on video data flow and AI analysis, the two major pillars of the API.

---

### Summary

- The Debate AI API consists of modular, edge-friendly Next.js route handlers structured under `/api`.
- Core data is sourced from bundled JSON (for static/reference data) and Cloudflare D1 SQL (for dynamic, user-linked data).
- Video APIs use a hybrid fallback model and can be seeded via admin routes.
- AI-powered endpoints abstract and secure third-party LLM calls.
- The entire API surface is documented in the OpenAPI spec and consumed by the `debate-api-client` SDK.
- Admin APIs provide data maintenance and content publication functionality.

For in-depth technical details and route-specific documentation, please consult the respective child pages:

- [Content & Video API Routes](/debate/debate-ai.com/10.1-content-and-video-api-routes)
- [AI, Search & Round API Routes](/debate/debate-ai.com/10.2-ai-search-and-round-api-routes)
- [Admin Routes & Dashboard](/debate/debate-ai.com/10.3-admin-routes-and-dashboard)

---

## Sources

- apps/debate-ai.com/app/api/videos/route.ts:1-76
- apps/debate-ai.com/app/api/videos/meta/route.ts:1-41
- apps/debate-ai.com/app/api/reason-ai/route.ts:1-136
- apps/debate-ai.com/app/api/admin/videos/seed/route.ts:1-73
- apps/debate-ai.com/lib/videos/video-repository.ts:1-111
- apps/debate-ai.com/lib/videos/seed-videos-to-db.ts:1-59
- apps/debate-ai.com/public/debate-openapi.yml:1-2550
- packages/debate-api-client/README.md:1-76
- packages/debate-api-client/src/client.ts:1-119
- packages/debate-api-client/openapi-ts.config.ts:1-13
- .github/workflows/npm-release.yml:1-70
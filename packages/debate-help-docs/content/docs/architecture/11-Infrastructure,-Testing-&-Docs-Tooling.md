---
title: "Infrastructure, Testing & Docs Tooling"
---

# Infrastructure, Testing & Docs Tooling
Relevant source files
- [.github/workflows/auto-merge-claude.yml](https://github.com/debate/debate-ai.com/blob/34937310/.github/workflows/auto-merge-claude.yml)
- [codecov.yml](https://github.com/debate/debate-ai.com/blob/34937310/codecov.yml)
- [packages/debate-api-client/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1)
- [packages/debate-contributor-progress/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-contributor-progress/README.md?plain=1)
- [packages/debate-flow/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/README.md?plain=1)
- [packages/debate-round-practice-ai/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round-practice-ai/README.md?plain=1)
- [packages/debate-search-evidence/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-search-evidence/README.md?plain=1)

This section provides a high-level overview of the infrastructure supporting the Debate AI platform. It covers continuous integration workflows, the Progressive Web App (PWA) service worker, the testing infrastructure, and the documentation and SDK publishing pipeline.

## CI/CD & GitHub Actions

The codebase uses GitHub Actions to automate continuous integration and deployment processes. A key workflow is `auto-merge-claude.yml`, which automatically approves and merges Pull Requests when they originate from specific trusted bot actors or maintainers, streamlining contributions from AI assistants and authorized users.

This workflow listens to PR events (`opened`, `synchronize`, `reopened`, and `closed`) and follows this process:

- Verifies that the PR origin matches trusted actors (`claude[bot]`, `anthropic-claude[bot]`, or user `vtempest`).
- Auto-approves the PR using the `hmarr/auto-approve-action`.
- Polls for passing CI checks, ignoring itself to avoid deadlock situations.
- Automatically performs a squash merge and deletes the feature branch, with fallback to GitHub's native auto-merge if merge conditions momentarily block the direct merge.

Additionally, branch cleanup occurs on PR close to keep the repo tidy.

For exhaustive details on the set of CI workflows, including testing and npm releases, see the child page [CI/CD & GitHub Actions](/debate/debate-ai.com/11.1-cicd-and-github-actions).

**Sources:**

- [.github/workflows/auto-merge-claude.yml1-102](https://github.com/debate/debate-ai.com/blob/34937310/.github/workflows/auto-merge-claude.yml#L1-L102)

---

## PWA & Service Worker

Debate AI employs a Progressive Web App architecture with a custom service worker (`service-worker.ts`), designed to deliver offline capabilities and improve performance by caching assets and API responses.

### Asset Manifest & Versioning

At build time, `generate.cjs` scans client build outputs in `dist/client`, excluding source maps and internal manifests, to produce a pre-cache whitelist (`APP_FILE_LIST`). The service worker caches these immutable assets to serve immediately on repeat loads.

The cache name incorporates both the package version and a SHA-256 digest of all asset contents, ensuring each distinct build gets a new cache to prevent stale React Server Component payloads, which can break client navigation.

### Caching Strategies

The service worker applies a dual caching strategy:

- **Network-first**: Documents (HTML and React Server Components) and API requests (`/api/`) are fetched from the network first to ensure freshness, falling back to cached copies if offline.
- **Cache-first**: Immutable assets (e.g., hashed files under `/assets/` and those in the whitelist) are served directly from the cache for speed.

### PWA Lifecycle & Request Flow

The diagram below depicts the interactions between the browser UI, the service worker, and Cloudflare-hosted backend resources:

For detailed information on the service worker implementation, asset versioning, and debugging tools, see [PWA & Service Worker](/debate/debate-ai.com/11.2-pwa-and-service-worker).

**Sources:**

- [lib/offline-sw/service-worker.ts1-200](https://github.com/debate/debate-ai.com/blob/34937310/lib/offline-sw/service-worker.ts#L1-L200) (implied)
- [.github/workflows/auto-merge-claude.yml1-102](https://github.com/debate/debate-ai.com/blob/34937310/.github/workflows/auto-merge-claude.yml#L1-L102) (CI complements SW deployment)
- Discussion of VERSION derived from `lib/offline-sw/generate.cjs` and APP_FILE_LIST (not directly shown here)

---

## Testing Strategy & Vitest Setup

Testing is unified across the repository via Vitest, configured at the monorepo root. This setup promotes comprehensive, consistent testing and coverage measurement for all packages.

### Monorepo Vitest Configuration

The root `vitest.config.ts` enumerates individual package projects under `packages/*` (excluding documentation-only or readme packages). It collects coverage with the following specifics:

- Coverage uses the `v8` instrumenter for performance.
- Reports in `text`, `lcov`, and `html` are generated inside the `./coverage` directory.
- Coverage is included for `.ts` and `.tsx` files in source directories, excluding type definitions, test folders, and static data files (especially under `debate-data-sync`).

### Running Tests and Coverage

Tests are runnable from the root workspace with:

- `bun run test` or `vitest run` for a one-off test pass.
- `bun run test:watch` or `vitest` for continuous testing.

Coverage is gathered by invoking `bun run coverage` or using `vitest run --coverage`.

The per-package test suites mirror the source directory layout to maintain clarity.

For nuanced details about testing conventions, coverage flags per package, and integration with Codecov, see [Testing Strategy & Vitest Setup](/debate/debate-ai.com/11.3-testing-strategy-and-vitest-setup).

**Sources:**

- [.vitest.config.ts1-33](https://github.com/debate/debate-ai.com/blob/34937310/.vitest.config.ts#L1-L33) (implied from overview)
- [.package.json18-20](https://github.com/debate/debate-ai.com/blob/34937310/.package.json#L18-L20) (test scripts)
- [codecov.yml1-151](https://github.com/debate/debate-ai.com/blob/34937310/codecov.yml#L1-L151) (tests coverage config and flags)

---

## Documentation & SDK Publishing Pipeline

The repository houses a documentation site and a generated SDK for API interaction that support development and integration.

### Documentation Site

The in-repo documentation site is powered by Fumadocs (Next.js + MDX based), managed within the `packages/debate-ai-docs` package. Development, build, and API doc generation commands enable easy iteration and publishing of user and developer docs.

### API Client SDK

The `debate-api-client` package is a strictly typed SDK generated from the OpenAPI spec (`debate-openapi.yml`) located in the frontend app's `public` directory.

- It uses [Hey API](https://heyapi.dev/) tooling for type generation.
- The client abstracts HTTP interactions with robust retry, caching, rate limiting, and deduplication via the `grab-url` transport.
- It is the only workspace package published to npm, with automated release handled via the `npm-release.yml` GitHub Actions workflow.

This pipeline streamlines API consumption in the frontend and external consumers, assuring type safety and client usability.

For detailed documentation on SDK regeneration, usage, test coverage, and publishing, consult [Documentation Site (debate-help-docs) & debate-api-client](/debate/debate-ai.com/12.3-documentation-site-(debate-help-docs)-and-debate-api-client).

**Sources:**

- [packages/debate-api-client/README.md1-75](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1#L1-L75)
- [.github/workflows/npm-release.yml](https://github.com/debate/debate-ai.com/blob/34937310/.github/workflows/npm-release.yml)
- [packages/debate-ai-docs/package.json1-40](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ai-docs/package.json#L1-L40) (implied from docs build tooling)

---

# Summary Diagram: Infrastructure Spaces Bridging

A key to understanding the relationships between natural language components (like CI/CD, PWA) and code artifacts is the following mapping:

---

This high-level overview introduces the infrastructure pillars that enable reliable development, offline-capable client experiences, solid and measurable test coverage, and well-maintained documentation and API SDK clients. For full technical details, each section links to specialized child pages.

---

# Links to Child Pages for Details

- [CI/CD & GitHub Actions](/debate/debate-ai.com/11.1-cicd-and-github-actions)
- [PWA & Service Worker](/debate/debate-ai.com/11.2-pwa-and-service-worker)
- [Testing Strategy & Vitest Setup](/debate/debate-ai.com/11.3-testing-strategy-and-vitest-setup)

**Sources Summary:**

- [.github/workflows/auto-merge-claude.yml1-102](https://github.com/debate/debate-ai.com/blob/34937310/.github/workflows/auto-merge-claude.yml#L1-L102)
- [codecov.yml1-151](https://github.com/debate/debate-ai.com/blob/34937310/codecov.yml#L1-L151)
- [packages/debate-api-client/README.md1-75](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1#L1-L75)
- [.package.json18-20](https://github.com/debate/debate-ai.com/blob/34937310/.package.json#L18-L20)
- [.vitest.config.ts1-33](https://github.com/debate/debate-ai.com/blob/34937310/.vitest.config.ts#L1-L33)
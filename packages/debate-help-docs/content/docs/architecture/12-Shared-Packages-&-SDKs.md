---
title: "Shared Packages & SDKs"
---

# Shared Packages & SDKs
Relevant source files
- [packages/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/README.md?plain=1)
- [packages/debate-card-parser/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-parser/README.md?plain=1)
- [packages/debate-data-sync/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1)
- [packages/debate-editor/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/README.md?plain=1)
- [packages/debate-speech-writer/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-speech-writer/README.md?plain=1)
- [packages/debate-timer/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/README.md?plain=1)
- [packages/debate-timer/src/index.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/index.ts)
- [packages/debate-timer/src/timers/TimerProgressRing.tsx](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/timers/TimerProgressRing.tsx)
- [packages/debate-ui/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ui/README.md?plain=1)
- [packages/debate-videos/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-videos/README.md?plain=1)

This section provides an overview of the foundational shared packages that underpin the Debate AI monorepo. These packages deliver core UI components, timing mechanisms, documentation infrastructure, and the generated API client used across the platform. By centralizing these in the `packages/` directory, the system ensures type safety, visual consistency, and efficient development across different applications and features.

## Core Shared Packages Overview

The monorepo architecture leverages several key packages to provide common functionalities and maintain consistency. These packages are consumed by various applications and feature-specific modules within the monorepo.

| Package | Responsibility | Primary Consumers |
| --- | --- | --- |
| `debate-ui` | Shared UI kit: shadcn/Radix primitives, custom icons, layout components, and utility helpers. | `apps/debate-ai.com` (main app), `debate-round`, `debate-card-search`, `debate-videos` |
| `debate-timer` | Speech and prep timers, per-format speech times, word counting, and microphone transcription. | `debate-round` (FIAT module) |
| `debate-help-docs` | The documentation site for features and package READMEs, built on the Fumadocs framework. | External users, internal developers |
| `debate-api-client` | OpenAPI-generated SDK for interacting with the `debate-ai.com` API, providing type-safe API calls with caching and retry logic. | External integrations, `apps/debate-ai.com` internal APIs |

### Shared Packages Architecture

This diagram illustrates how the shared packages provide foundational services and components consumed by the main application and other feature modules:

Sources: [packages/README.md3-74](https://github.com/debate/debate-ai.com/blob/34937310/packages/README.md?plain=1#L3-L74)

---

## debate-ui — Shared Component Library

`debate-ui` is the central UI component library built atop **Radix UI** and **shadcn/ui** primitives. It includes an extensive custom icon set, layout components like the site footer and dock, shared panel shells, a global feature catalog, and utility helpers such as the `cn` function for conditional class merging and `setStateInURL` for URL query state manipulation. This package is the foundational visual and utility layer for all Debate AI web apps [packages/debate-ui/README.md3-37](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ui/README.md?plain=1#L3-L37)

Components are imported by explicit path to reduce bundle size—e.g., importing `Button` does not pull in heavy UI dependencies like charts or WebGL [packages/debate-ui/README.md9-15](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ui/README.md?plain=1#L9-L15) The package also supplies a shared `FeaturesPanel` that powers the global feature catalog UI.

For detailed component and utility usage, see [debate-ui — Shared Component Library](/debate/debate-ai.com/12.1-debate-ui-shared-component-library).

Sources: [packages/debate-ui/README.md1-37](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ui/README.md?plain=1#L1-L37)

---

## debate-timer Package

The standalone `debate-timer` package provides all timing and speech-related utilities for live rounds. It includes speech timers, prep timers, a word-counting component geared for asynchronous speech formats, and microphone recording hooks. Timing presets per debate format define speech lengths, which are the source of truth for the debate flow column setup in `debate-round`.

Key exports include:

- **`SpeechTimer`**: Component managing live speech countdowns.
- **`PrepTimer`**: Component managing preparation intervals between speeches.
- **`TimerProgressRing`**: A stateless SVG ring component visualizing elapsed time as a circular countdown, reusable independently from timer logic.
- **`SpeechWordCounter`**: Tracks word count live in word-count-based speech formats.
- **`useSpeechRecorder`**: Hook for microphone device selection, live audio waveform visualization, and recorded playback.

The package's internal layout organizes related logic by function: timers, hooks, recorder, audio assets, formats definitions, and type declarations [packages/debate-timer/README.md3-43](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/README.md?plain=1#L3-L43)[packages/debate-timer/src/index.ts1-9](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/index.ts#L1-L9)[packages/debate-timer/src/timers/TimerProgressRing.tsx1-54](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/timers/TimerProgressRing.tsx#L1-L54)

Below shows the primary exports linked to the internal modules:

For comprehensive API details and usage, see [debate-timer Package](/debate/debate-ai.com/12.2-debate-timer-package).

Sources: [packages/debate-timer/README.md1-50](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/README.md?plain=1#L1-L50)[packages/debate-timer/src/index.ts1-9](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/index.ts#L1-L9)[packages/debate-timer/src/timers/TimerProgressRing.tsx1-54](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/timers/TimerProgressRing.tsx#L1-L54)

---

## Documentation Site (debate-help-docs) & debate-api-client SDK

The `debate-help-docs` package hosts the official documentation site for the Debate AI platform, built with the Fumadocs framework. It publishes the product's feature documentation sourced from the `docs/features/` directory and package README files, providing a searchable, thematically organized online help system. The site layout and MDX components are configured for a developer- and user-friendly experience [packages/debate-help-docs/README.md1-51](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-help-docs/README.md?plain=1#L1-L51)

Adjacent is the `debate-api-client` package: an OpenAPI-generated TypeScript SDK automatically built from the platform's OpenAPI spec (`debate-openapi.yml`). It enables type-safe, easy-to-use API calls to `debate-ai.com`. The client wraps each API operation in functions that return `{ data?, error? }` without throwing, and integrates caching, retries, and request deduplication through `grab-url`. This architectural choice supports both external integrations and internal codebases that consume backend API endpoints.

The documentation site and the API client SDK are released via CI/CD flows, automating npm package publishing and versioning [packages/README.md6-13](https://github.com/debate/debate-ai.com/blob/34937310/packages/README.md?plain=1#L6-L13)[packages/debate-help-docs/content/docs/index.mdx1-14](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-help-docs/content/docs/index.mdx?plain=1#L1-L14)

For full documentation site and SDK usage details, see [Documentation Site (debate-help-docs) & debate-api-client](/debate/debate-ai.com/12.3-documentation-site-(debate-help-docs)-and-debate-api-client).

Sources: [packages/README.md6-13](https://github.com/debate/debate-ai.com/blob/34937310/packages/README.md?plain=1#L6-L13)[packages/debate-help-docs/README.md1-51](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-help-docs/README.md?plain=1#L1-L51)[packages/debate-help-docs/content/docs/index.mdx1-14](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-help-docs/content/docs/index.mdx?plain=1#L1-L14)

---

# Summary Diagram: Natural Language Concepts to Code Entities

This diagram maps "Natural Language Space" system components to corresponding "Code Entity Space" package names and main files, bridging conceptual understanding with the concrete codebase.

Sources: [packages/debate-ui/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ui/README.md?plain=1)[packages/debate-timer/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/README.md?plain=1)[packages/debate-help-docs/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-help-docs/README.md?plain=1)[packages/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/README.md?plain=1)

---

# References to Child Pages

This page is a parent overview. Detailed documentation of each foundational shared package can be found in the following child pages:

- [debate-ui — Shared Component Library](/debate/debate-ai.com/12.1-debate-ui-shared-component-library) — Detailed overview of the `debate-ui` package including primitives, icon sets, layout components, panel shells, feature catalogs, and utility helpers used throughout the codebase.
- [debate-timer Package](/debate/debate-ai.com/12.2-debate-timer-package) — Full API and component details of the `debate-timer` package: timer components, timer progress visuals, speech word counters, microphone hooks, and format definitions.
- [Documentation Site (debate-help-docs) & debate-api-client](/debate/debate-ai.com/12.3-documentation-site-(debate-help-docs)-and-debate-api-client) — In-depth coverage of the Fumadocs-powered help documentation site, content structure, MDX support, feature specs, and the OpenAPI-generated TypeScript API client SDK with its npm release process.

---

This overview clarifies how the Debate AI platform standardizes shared logic, UI, timers, and documentation tooling in these packages to enable consistent development and integration across all applications and modules.

Sources:[packages/README.md1-74](https://github.com/debate/debate-ai.com/blob/34937310/packages/README.md?plain=1#L1-L74)[packages/debate-ui/README.md1-37](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ui/README.md?plain=1#L1-L37)[packages/debate-timer/README.md1-50](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/README.md?plain=1#L1-L50)[packages/debate-timer/src/index.ts1-9](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/index.ts#L1-L9)[packages/debate-timer/src/timers/TimerProgressRing.tsx1-54](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/timers/TimerProgressRing.tsx#L1-L54)[packages/debate-help-docs/README.md1-51](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-help-docs/README.md?plain=1#L1-L51)[packages/debate-ai-docs/content/docs/index.mdx1-14](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ai-docs/content/docs/index.mdx?plain=1#L1-L14)
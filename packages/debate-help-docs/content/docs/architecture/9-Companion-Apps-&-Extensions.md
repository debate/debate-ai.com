---
title: "9. Companion Apps & Extensions"
---

# 9. Companion Apps & Extensions
Relevant source files
- [apps/debate-web-ext/.gitignore](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/.gitignore)
- [apps/debate-web-ext/components.json](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/components.json)
- [apps/debate-web-ext/components/ui/button.tsx](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/components/ui/button.tsx)
- [apps/debate-web-ext/components/ui/select.tsx](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/components/ui/select.tsx)
- [apps/debate-web-ext/components/ui/tabs.tsx](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/components/ui/tabs.tsx)
- [apps/debate-web-ext/components/ui/tooltip.tsx](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/components/ui/tooltip.tsx)
- [codecov.yml](https://github.com/debate/debate-ai.com/blob/34937310/codecov.yml)
- [packages/debate-api-client/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-api-client/README.md?plain=1)
- [packages/debate-contributor-progress/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-contributor-progress/README.md?plain=1)
- [packages/debate-flow/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow/README.md?plain=1)
- [packages/debate-round-practice-ai/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round-practice-ai/README.md?plain=1)
- [packages/debate-search-evidence/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-search-evidence/README.md?plain=1)

This section provides a high-level overview of the non-web-app surfaces of the Debate AI platform. It covers three main categories of companion applications that extend the core web experience provided at `debate-ai.com`:

- The **Tauri-based native wrapper**, which packages the web app as desktop and mobile native apps.
- **Browser extensions** that integrate specific utilities directly into web browsers.
- The **Practice vs AI** standalone application, a TypeScript port of a Go vs-bot server enabling AI-powered debate practice rounds.

These companion apps enhance accessibility, usability, and engagement by adapting Debate AI's central capabilities to different runtime environments and use cases.

**Sources:**

- [apps/debate-native-wrapper/README.md](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-native-wrapper/README.md?plain=1)
- [apps/debate-web-ext/README.md](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/README.md?plain=1)
- [apps/debate-timer-progress-ext/README.md](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-timer-progress-ext/README.md?plain=1)
- [packages/debate-round-practice-ai/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round-practice-ai/README.md?plain=1)

---

### 9.1 Native Wrapper (Tauri Desktop/Mobile)

The native wrapper, located in `apps/debate-native-wrapper`, uses the Tauri framework to package the `debate-ai.com` web application into native desktop and mobile applications:

- **Desktop platforms**: Windows, macOS, and Linux
- **Mobile platforms**: Android and iOS

This wrapper provides a standalone installed experience with integrated system features such as app icons, splash screens, and native configuration managed via `src-tauri`. A notable challenge addressed is Google OAuth sign-in compatibility: Tauri’s embedded webviews do not support popup redirects properly, so the wrapper uses a deep link scheme (`debateai://auth-callback`) for seamless Google authentication.

Build scripts and continuous integration/release workflows automate native app builds and deployments for multiple platforms.

For full details, see [Native Wrapper (Tauri Desktop/Mobile)](/debate/debate-ai.com/9.1-native-wrapper-(tauri-desktopmobile)).

**Sources:**

- [apps/debate-native-wrapper/README.md](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-native-wrapper/README.md?plain=1)
- [apps/debate-native-wrapper/src-tauri/config.rs](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-native-wrapper/src-tauri/config.rs)
- [apps/debate-native-wrapper/ci-release.yml](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-native-wrapper/ci-release.yml)

---

### 9.2 Browser Extensions

Two main browser extensions supplement the Debate AI platform:

1. **Card Reuse Check Extension (`apps/debate-web-ext`)**

This Manifest V3 (MV3) extension enables users to verify if the current web page contains content that has already been sourced into the Debate AI shared evidence library as cards. It integrates with the site's `/api/evidence-reuse-check` endpoint.

Core features include:

- Checking the current tab’s URL and querying reuse status from the backend.
- Managing a whitelist of domains to skip checks on.
- An options page for configuring API base URL and skip domains.
- A UI built with shadcn UI components for consistent styling and accessibility.
2. **Round Timer & Progress Extension (`apps/debate-timer-progress-ext`)**

This extension offers a debate round timer with visual progress tracking and exports timelines as PNG images. It is built using WXT (a web extension toolkit) and React, focusing on lightweight utility for timing debate rounds outside the main web app.

The two extensions target different user needs: reusable evidence detection and in-round timing respectively.

For full details, see [Browser Extensions](/debate/debate-ai.com/9.2-browser-extensions).

**Sources:**

- [apps/debate-web-ext/README.md](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/README.md?plain=1)
- [apps/debate-web-ext/popup.js1-73](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/popup.js#L1-L73)
- [apps/debate-web-ext/api.js](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/api.js)
- [apps/debate-web-ext/options.js](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/options.js)
- [apps/debate-web-ext/options.html](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-web-ext/options.html)

---

### 9.3 Practice vs AI (debate-round-practice-ai)

The `debate-round-practice-ai` package is a complete TypeScript port of an existing Go vs-bot server and client, enabling users to practice debate rounds against AI opponents.

Key aspects:

- **AI Opponents and Personalities**: Implements 13 distinct bot personas (from "Rookie Rick" to "Darth Vader"), fully ported from the original Go codebase.
- **Prompt Construction and Judging**: Contains sophisticated prompt templates and rubric-based AI judging logic to simulate realistic debate interactions.
- **Gamification**: Includes a points and badges system to reward wins, draws, and milestones like "FirstWin" or "FactMaster" badges.
- **Abstractions**:

- `ModelClient` interfaces allow for interchangeable AI model backends (Anthropic, Gemini, OpenAI), all implemented as plain TypeScript `fetch` clients.
- `DebateStore` abstracts data persistence, with an in-memory default and Drizzle ORM/D1-based storage for the live app.
- **Routing and Integration**: Exposes `/api/vsbot/*` routes for the Next.js `/versus-ai` page in the web app.
- **Changes from Upstream**:

- Authentication handled externally; backend receives a `DebateActor`.
- Routing simplified to a single Next.js route.
- Side effects during React state updates removed for React 18 compatibility.

This package enables standalone, offline-capable AI practice rounds while sharing much of Debate AI's core logic.

For full details, see [Practice vs AI (debate-round-practice-ai)](/debate/debate-ai.com/9.3-practice-vs-ai-(debate-round-practice-ai)).

**Sources:**

- [packages/debate-round-practice-ai/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round-practice-ai/README.md?plain=1)
- [apps/debate-ai.com/lib/practice-vs-ai/store.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/practice-vs-ai/store.ts)

---

This overview links out to child pages that provide detailed technical documentation of these companion apps and extensions:

- **[Native Wrapper (Tauri Desktop/Mobile)](/debate/debate-ai.com/9.1-native-wrapper-(tauri-desktopmobile))**
- **[Browser Extensions](/debate/debate-ai.com/9.2-browser-extensions)**
- **[Practice vs AI (debate-round-practice-ai)](/debate/debate-ai.com/9.3-practice-vs-ai-(debate-round-practice-ai))**

These companion applications complement the core web platform by adapting Debate AI’s capabilities to native desktop/mobile environments, browser tooling contexts, and AI-powered practice rounds respectively, forming an important part of the Debate AI ecosystem.
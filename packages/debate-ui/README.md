<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-ui"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Next.js-black?logo=nextdotjs&logoColor=white" alt="Next.js" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white" alt="shadcn/ui" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

# debate-ui

Shared UI kit for the debate apps: the shadcn/Radix primitives, the custom icon set,
the site footer, and the `cn`/URL-state helpers every debate package builds on.

Import components by path — there is no barrel, so a page that needs a button does not
pull in the WebGL and chart-heavy components:

```tsx
import { Button } from "debate-ui/src/primitives/button"
import { cn, setStateInURL } from "debate-ui/src/lib/utils"
import { IconFlowFlower } from "debate-ui/src/icons"
import { Footer } from "debate-ui/src/layout/footer"
import { FeaturesPanel } from "debate-ui/src/features/FeaturesPanel"
```

Consumers must render these inside a Next.js app (styled-jsx, `next/image`) and provide
`react` and `react-dom`. Tailwind classes live in the source files, so an app's stylesheet
has to register this directory with `@source` for them to be generated.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-ui/
├── src/
│   ├── charts/       # recharts wrappers
│   ├── effects/      # motion, glow, spotlight and 3D card effects
│   ├── features/     # the app-wide feature catalog and its /features page panel
│   ├── icons/        # custom SVG/PNG icon set + barrel
│   ├── layout/       # footer, dock, card and category grids
│   ├── lib/          # cn() and URL-state helpers
│   ├── panels/       # shared feature-panel shell primitives
│   └── primitives/   # shadcn/Radix primitives
└── test/             # Vitest suites for the class, URL, panel and catalog helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **8.27%** (tracked under
the `debate-ui` flag).

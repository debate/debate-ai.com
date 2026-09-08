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

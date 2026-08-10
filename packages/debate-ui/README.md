# debate-ui

Shared UI kit for the debate apps: the shadcn/Radix primitives, the custom icon set,
the site footer, and the `cn`/URL-state helpers every debate package builds on.

Import components by path — there is no barrel, so a page that needs a button does not
pull in the WebGL and chart-heavy components:

```tsx
import { Button } from "debate-ui/button"
import { cn, setStateInURL } from "debate-ui/utils"
import { IconFlowFlower } from "debate-ui/icons"
import { Footer } from "debate-ui/footer"
```

Consumers must render these inside a Next.js app (styled-jsx, `next/image`) and provide
`react` and `react-dom`. Tailwind classes live in the source files, so an app's stylesheet
has to register this directory with `@source` for them to be generated.

# debate-ui

The shared UI layer every debate-ai package renders with: the shadcn/Radix
primitives (`button`, `card`, `dialog`, `select`, `sidebar`, …), `cn` for merging
Tailwind classes, the `useIsMobile` hook and the panel building blocks
(`PanelShell`, `StatTile`, `useStoreSnapshot`).

```tsx
import { Button } from "@debate-ai/ui/primitives/button";
import { cn } from "@debate-ai/ui/lib/utils";
```

Nothing here knows about debaters, rounds or routes — it is the package the
feature packages depend on so they never have to import back from
`debate-webview`.

Styles are Tailwind utility classes; the host app's `app.css` lists this
package's `src` as an `@source`.

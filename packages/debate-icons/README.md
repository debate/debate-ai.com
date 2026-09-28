# debate-icons

Custom icons for Debate AI. General-purpose icons come from `lucide-react`;
this folder holds the icons that are specific to debate.

Each group of icons has a TypeScript `index.ts` that re-exports every file as
a named constant, so you import icons by name instead of by path. Each
constant's value is the asset URL your bundler gives for the file.

```ts
import { IconFlowFlower, IconVsAi } from "debate-icons/app-icons";
import { IconDebateCite, IconDebateS1nc } from "debate-icons/editor";

<img src={IconDebateCite} alt="Cite" width={16} height={16} />
```

> This folder has no `package.json` and is not a workspace yet, so the
> `debate-icons/...` specifier above does not resolve until one is added.
> Until then, import from the `index.ts` files by relative path.

## Layout

| Folder | Contents |
| --- | --- |
| [`app-icons/`](app-icons/) | 17 SVG and PNG icons for app navigation and feature tiles: flow, rounds, lectures, leaderboard, trophies, settings, theme, and the aff/neg speech bubbles. |
| [`editor/`](editor/) | 37 PNG toolbar icons for the card editor, all prefixed `icon-debate-`. |

## Naming

- **Files** are kebab-case and start with `icon-`: `icon-vs-ai.svg`,
  `icon-debate-cite.png`. Editor icons use the longer `icon-debate-` prefix.
- **Exports** are the filename in PascalCase: `icon-debate-fhat.png` exports
  as `IconDebateFhat`.
- In an editor icon name, the letter after `icon-debate-` groups the icon by
  toolbar area:

| Prefix | Area | Icons |
| --- | --- | --- |
| `f…` | Formatting | `fbox`, `fclear`, `fhat`, `fheading`, `fheadingnot`, `fhighlite`, `fnormal`, `fsimilar`, `fsmallall`, `fsmallallmore`, `ftoggle` |
| `s…` | Speech docs | Speech buttons (`s1ar`, `s1nc`, `s1nr`, `s2ac`, `s2ar`, `s2nc`, `s2nr`), plus `sblock`, `sbs`, `spbreak`, `spsave`, `spsave0`, `ssend` |
| `exp…` | Expandable file | `exp`, `expadd`, `expcreate`, `exppk`, `exprefresh` |
| `x…` | Cleanup | `xblanks`, `xlinks` |
| — | Card parts | `cite`, `citereq`, `warrant`, `returns`, `star`, `tub` |

Editor icons come in three sizes: 16 × 16 (`exp*` actions and `star`),
64 × 64 (the speech buttons, `sblock`, `spbreak`, `spsave*`, `ssend`) and
32 × 32 (the rest).

## Adding an icon

1. Put the file in the right folder, named as described above. Prefer SVG
   for new icons; use PNG only when the source art is raster.
2. Add an `export { default as IconName } from "./icon-name.svg";` line to
   that folder's `index.ts`.
3. Import it by name, never by path.

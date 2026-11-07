# debate-icons

Custom icons for Debate AI. General-purpose icons come from `lucide-react`;
this folder holds the icons that are specific to debate.

Each group of icons has a TypeScript `index.ts` that re-exports every file as
a named constant, so you import icons by name instead of by path. Each
constant's value is the asset URL your bundler gives for the file.

```ts
import { IconFlowFlower, IconVsAi } from "@debate-ai/icons/app-icons";
import { IconDebateCite, IconDebateS1nc } from "@debate-ai/icons/editor";
import { IconSchoolHarvard, IconSchoolToc } from "@debate-ai/icons/schools";

<img src={IconDebateCite} alt="Cite" width={16} height={16} />
```

The importing package lists `"@debate-ai/icons": "workspace:*"` in its
dependencies.

## Layout

| Folder | Contents |
| --- | --- |
| [`app-icons/`](app-icons/) | 17 SVG and PNG icons for app navigation and feature tiles: flow, rounds, lectures, leaderboard, trophies, settings, theme, and the aff/neg speech bubbles. |
| [`brand/`](brand/) | The Debate AI wordmark, `logo.png` (400 × 89). Import it as `DebateAiLogo` from `@debate-ai/icons/brand` (the login page and dialog, the footer, the privacy page and the docs header all do). The app also keeps serving it at `/logo.png` (see `ROOT_ASSETS` in `apps/debate-web/vite.config.ts`) for links from outside the bundle, such as the offline file list. |
| [`colleges/`](colleges/), [`high-schools/`](high-schools/), [`organizations/`](organizations/) | Logo PNGs named by school slug, exported from [`schools.ts`](schools.ts) as `@debate-ai/icons/schools` (`north-texas.png` is `IconSchoolNorthTexas`); `organizations/` holds tournament and league logos (TOC, NSDA, NDCA, NDT, CEDA, plus a copy of the Debate AI logo as `debate-ai.png`). Name lookups go through `getSchoolLogo` in `debate-rankings`; tests fail if a png is left unexported, or a college or high-school png unmapped. |
| [`mascots/`](mascots/) | Full-size college mascot illustrations (`kansas.png`, 1467 × 1072) plus 640px-wide webp images in `mascots/thumbs/`, exported from [`mascots.ts`](mascots.ts) as `@debate-ai/icons/mascots` (`IconMascotKansas`). The watch page shows a team's mascot above its stats; name lookups go through `getSchoolMascot` in `debate-rankings`. `harvard.png` is a copy of the Dartmouth art, so it has no thumbnail. |
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

A school logo goes in `colleges/` or `high-schools/`, named by school slug
rather than `icon-`, with its export line in `schools.ts` under that folder's
heading. Then map it in `SCHOOL_LOGO_MAP` (`schoolLogos.ts` in
`debate-rankings`). Give a school whose short name is shared by others its
full slug: `loyola-chicago.png`, because "Loyola" in the rankings is a high
school in California.

# App Navigation

How a feature page becomes reachable in the web app. Every feature panel in
this repo is mounted at its own route under `apps/debate-ai.com/app/`, but a
route only becomes *discoverable* once something links to it — otherwise it is
reachable only by typing the URL.

- **Component:** `apps/debate-ai.com/components/layout/CategoryDock.tsx`
- **Mounted:** once in the root `app/layout.tsx`, so it renders on every page

## Structure

`CategoryDock` is the app's single global navigation surface. It has two parts:

| Part | Contents |
| --- | --- |
| Primary dock (`NAV_ITEMS`) | Four top-level destinations — `/videos`, `/cards`, `/debate`, `/doc` — shown as icons, with `Alt+1`…`Alt+4` shortcuts |
| Settings menu (`SettingsMenu`) | A flat catalog of every other feature page, opened from the dock's Settings icon |

The dock renders at the top-left on desktop (`md+`) and as a fixed bottom bar
on mobile. Both render the same `SettingsMenu`, so a route added to the menu is
reachable from either.

There is no per-feature hub that owns discovery. `CoachHub`/`ResearchHub` mount
some panels as *sections* within a workspace page, but that is in addition to
the Settings-menu entry, not a substitute for it.

## Adding a feature page

A new feature panel needs all three of these, or it ships orphaned:

1. A route — `apps/debate-ai.com/app/<slug>/page.tsx` rendering the panel.
2. A `DropdownMenuItem` in `SettingsMenu` calling `router.push("/<slug>")`,
   with a `lucide-react` icon and a label matching the feature's name.
3. A `docs/features/<slug>.md` carrying a `**Nav:**` line naming the menu
   entry, so the doc and the menu can be checked against each other.

A "Back" link on the page itself points *out* to a parent hub; it does not make
the page discoverable, because nothing links *in*.

## Secondary pages

Four pages carry a "Back" link to a parent hub and were reachable only by URL
until they were added to the Settings menu:

| Route | Menu entry | Back link |
| --- | --- | --- |
| `/rank` | **Rankings** | `/videos` |
| `/speech-documents` | **Speech Documents** | `/reason-editor` |
| `/cards/scoring` | **LLM Card Scoring** | `/cards` |
| `/strategy` | **Scout-to-Strategy** | `/debate` |

## Known gaps

- `/login` has no menu entry by design — signing in opens `LoginDialog` from
  the Settings menu's account block so the current page survives. The route
  stays as a standalone deep-link target.
- Nothing checks the route/menu/doc correspondence automatically. The web app
  is not a Vitest project (the root config registers `packages/*` only), so
  `CategoryDock` has no test coverage and a newly orphaned page would not fail
  the suite.

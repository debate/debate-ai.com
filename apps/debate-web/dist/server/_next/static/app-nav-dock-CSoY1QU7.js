import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`App nav dock and tool sidebar`},r=`# App nav dock and tool sidebar [#app-nav-dock-and-tool-sidebar]

The macOS-style icon dock that carries the app's top-level destinations, and
the sidebar column that hosts it on every tool route.

- **Component:** \`apps/debate-ai.com/components/layout/CategoryDock.tsx\`
- **Sidebar shell:** \`packages/debate-webview/src/components/layout/AppSidebarShell.tsx\`
- **The one sidebar column:** \`packages/debate-videos/src/ui/layout/ResizableSidebarLayout.tsx\`
  (hide/show state in \`sidebar-collapse.ts\` beside it), filled by
  \`packages/debate-webview/src/components/layout/app-sidebar/\` off the video pages
- **The tree in it:** \`VideoSidebarTree\`, mounted off the video pages through
  \`LibrarySidebarTree\` (\`packages/debate-videos/src/components/category-gallery/\`)
- **Route predicates:** \`packages/debate-videos/src/components/category-gallery/sidebar-routes.ts\`
  (re-exported for app code as \`apps/debate-ai.com/lib/sidebar-routes.ts\`)
- **Dock primitive:** \`apps/debate-ai.com/lib/ui/layout/dock.tsx\`

## What it shows [#what-it-shows]

Five destinations \u2014 Videos, Shared, Debate, Practice vs AI, Research \u2014 plus a
gear-icon Settings menu, with \`Alt+1\`\u2026\`Alt+5\` shortcuts in dock order. The
icons carry no hover labels \u2014 in the sidebar-hosted dock the tooltips crowded
together over the nav tree \u2014 so each item's name lives in its \`aria-label\`
(read by screen readers) and in the icon art itself.

**Practice vs AI opens a menu instead of navigating.** A plain click on that
icon does not go to \`/practice/versus-ai\` \u2014 it opens the site-nav menu described below
(\`NavMenu\`, in \`CategoryDock.tsx\`). The page itself is still one tap away, as
the first tool listed under that menu's Practice section, and the \`Alt+4\`
shortcut still jumps straight there.

**Tools are not dock icons.** The tools catalog is reached from the sidebar
nav tree's Research / Practice / Coaching / Insights
sections, and the whole feature
catalog from the **Features** row in the Settings menu's Site Links submenu \u2014
next to a **Docs** row for the help site. Holding the dock to five
destinations is what lets it fit inside the sidebar column it is hosted in \u2014
see below.

## The sidebar button (mobile) [#the-sidebar-button-mobile]

The sidebar is \`md+\` only, so the mobile bottom dock starts with a **Sidebar**
button. It opens a left drawer (\`MobileSidebarDrawer\`) whose content follows
the view in the centre (\`mobileSidebarKind\`, \`lib/mobile-sidebar.ts\`):

| View | Drawer |
| --- | --- |
| Video library (\`/videos\`, \`/lectures\`, glossary, rankings, statistics) | The sidebar tree (Videos, tool sections) and footer |
| \`/research/cards\`, \`/reason-editor\` | Document panels above the sidebar tree |
| \`/debate\` | Its own flows/rounds sidebar \u2014 the button dispatches \`debate:open-sidebar\` and the workspace opens its own sheet |
| Everything else | The sidebar tree and footer |

The drawer closes on navigation.

## The desktop sidebar's footer [#the-desktop-sidebars-footer]

On \`md+\` the column has no brand row at the top \u2014 it opens straight onto the
dock. Its bottom row, pinned under the scrolling tree, is the account menu
(on every page, the video library's included) with the **hide button** beside
it \u2014 see [Hiding the sidebar](#hiding-the-sidebar). The row shows your avatar
and name only, never your email address, with a badge on the avatar counting
unread notifications. The account menu holds Settings, a **Notifications**
submenu (every unread notification: pick one to open its link and clear it, X
to clear it in place, **Clear all**, and a link to \`/notifications\`; clearing
is the page's mark-as-read), an **Organizations** submenu (switch between Personal
and your organizations, or create one \u2014 see
[Contacts](/docs/features/team-collaboration/contacts#organizations)), a **Theme** submenu
(Light / Dark / System and every colour theme, with swatches \u2014 the same picker
as the dock's Settings menu, and synced to the account the same way), a
**Site links** submenu (every \`FOOTER_LINKS\` entry: Docs, GitHub, Support,
Privacy, Reddit\u2026) and Sign out. Signed out, the row is a Sign in button with a
globe button beside it that lists the same site links.

**Docs** and **Settings** are always on screen just above the account row, on
every page, signed in or out and whatever is selected, so you never have to
open a menu to reach them. The phone drawer ends with the same two links.

The other site links used to be a row of links above the account row; they
live in the account menu now. The phone layouts below \`md\`, which have no
account row, keep their footer.

## Two menus, not one [#two-menus-not-one]

The dock carries two independent dropdowns, each with its own \`DropdownMenu\`
root \u2014 opening one does not affect the other, and either can be open at once:

- **The Practice vs AI icon opens the site-nav menu (\`NavMenu\`).** Command
  Palette at the top, then a submenu per sidebar section \u2014 **Videos,
  Research, Practice, Coaching, Insights** \u2014 derived from the data the sidebar itself
  renders rather than restated:

  | Menu submenu | Comes from |
  | --- | --- |
  | Videos | \`SIDEBAR_VIDEO_LINKS\` (\`components/category-gallery/sidebar-video-links.ts\`), minus the glossary and topic & video statistics, which are listed under Insights instead |
  | Research / Practice / Coaching / Insights | \`SIDEBAR_TOOL_SECTIONS\` |

  On a phone, where the sidebar column below is \`md+\` only, this menu is the
  only way to reach those links at all.

- **The gear icon opens \`SettingsMenu\`** \u2014 Settings, the light/dark toggle
  and Theme submenu, **Hide Dock** (see [Hiding the dock](#hiding-the-dock)),
  one Site Links submenu listing every footer link
  (site and debate-community links together, from \`FOOTER_LINKS\`),
  and the account block.

**There is no "Apps" submenu.** The site-nav menu used to restate the dock's
own five icons as text and then hang the whole feature catalog underneath,
one nested submenu per category \u2014 a second, deeper copy of \`/practice/features\`
hanging off the dock that was already showing those five icons. One
**Features** row reaches the catalog instead, and a **Docs** row the help
site; both are footer links, so the sidebar's link rows carry them too.

\`apps/debate-ai.com/lib/nav/dock-menu-sections.ts\` does the site-nav menu's
composition, and \`lib/nav/__tests__/dock-menu-sections.test.ts\` fails if a
sidebar destination is missing from it. That coupling is the point: the
Videos links and the glossary/rankings pair below the tree were in the
sidebar and in no mobile menu at all, because the menu was a hand-kept list.

Both menus scroll (\`max-h-[min(560px,80vh)]\`) \u2014 \`SettingsMenu\`'s theme/links
block above the account rows can still run past a phone viewport.

Wiring the Practice vs AI icon to a second \`DropdownMenu\` root, rather than
sharing the gear's, means it sits *inside* \`Dock\`'s children instead of
wrapping the whole dock \u2014 so \`Dock\`'s magnification props land on the
wrapper component instead of the \`DockItem\` two levels down.
\`PracticeVsAiTrigger\` forwards \`mousex\`/\`magnification\`/\`distance\`/\`iconSize\`
by hand so that icon still resizes and tracks the cursor like its siblings.

\`/videos\` additionally prints the tree inline in its own \`md:hidden\` block,
under the quick-link tiles: the tiles are the Videos section only, so
\`ToolNavTree\` follows them with \`defaultExpanded={false}\` (its sections start
collapsed there \u2014 expanded, forty rows would push the video grid off the
screen).

## Hiding the dock [#hiding-the-dock]

Choose **Hide Dock** in the gear menu and the row of app icons folds away to a
small arrow tab where it sat: hanging down from the top-left corner or the top
of the sidebar, or rising from the bottom of the screen on a phone. Hover the
tab (or Tab to it from the keyboard, or tap it on a touch screen) and the full
dock slides back over it; move away and it folds up again. It stays out while
one of its menus is open, so the same menu's **Show Dock** row puts it back
for good. The choice holds on every page and is remembered in this browser
(\`app-dock-hidden\` in localStorage, broadcast by
\`packages/debate-webview/src/lib/nav/dock-hidden.ts\` so every dock instance
agrees).

\`CollapsibleDock\` in \`CategoryDock.tsx\` does the folding. Shown, it renders
the dock untouched. Hidden, it keeps the dock mounted inside an absolutely
positioned, transparent panel over the tab, and reveals it with CSS alone:
\`group-hover\`, keyboard focus inside (\`:focus-visible\`, so a mouse click that
leaves focus on an icon does not pin it open), a tap on the tab, or a dock
menu trigger with \`data-state=open\`.

## Where it renders [#where-it-renders]

The dock has two forms, and which one a route gets is decided by
\`hasEmbeddedDock\`:

**Sidebar-hosted (\`<CategoryDock embedded />\`).** On \`/videos\` (whose own
\`<aside>\` takes it through \`LecturesVideoGridView\`'s \`dockSlot\`) and on every
route the tool-nav tree links to (where \`AppSidebarShell\` wraps the page in
the generic sidebar), the dock sits at the top of that column (300px wide until you
drag it \u2014 see [Resizing the sidebar](#resizing-the-sidebar)).

\`/doc\` is the exception: the Docs button opens the research agent, which draws
its own full-height workspace. Its sidebar \u2014 the files tree and the "Open Tabs"
list \u2014 is the research agent's own, not the generic tool sidebar, and the dock
sits at the top of that column (\`OWN_SIDEBAR_DOCK_HREFS\`, in
\`packages/debate-videos/src/components/category-gallery/sidebar-routes.ts\`).
The research agent's own app dock is never mounted here (it is the host's to
draw), and on a phone the dock's **Sidebar** button opens the agent's sidebar
(the \`OPEN_OWN_SIDEBAR_EVENT\` window event, the same one \`/debate\` listens for).
Choosing **Settings** in the dock's menu from \`/doc\` opens \`/settings\` on the
research agent's first tab (\`?category=research-account\`); from anywhere else it
opens \`/settings\` on its first tab. Either way the agent's sections and the app's
own share one sidebar.

The Research button was called **Docs** and lived at \`/doc\` until October
2026. Old \`/doc\` and \`/doc/<document>\` links answer with a permanent (308)
redirect to \`/research/docs\` and \`/research/docs/<document>\`, from the same
table as the other category moves
(\`packages/debate-data-sync/src/routes/category-paths.ts\`). It sits under
\`/research/docs\` rather than \`/research\` because \`/research\` is the Research
Workspace hub.

That now includes \`/practice/rankings\` and \`/practice/glossary\`. Both are rows
in the sidebar's own tree, and both used to answer with a bare page \u2014 no
sidebar, and no fixed dock either, since every \`/videos\` path counts as
already carrying a sidebar-hosted one. \`LecturesSidebarShell\` wraps them in
the same column (dock, nav tree, footer), so clicking either link leaves the
nav exactly where it was.

The sidebar is \`md+\` only, though, and the same rule that hides the fixed dock
hides its mobile bottom bar. So on a phone those two pages still answered with
nothing to navigate by. \`LecturesSidebarShell\` now also renders the \`md:hidden\`
block the grid renders \u2014 the quick-link tiles, the tool tree (collapsed) and
the footer \u2014 so the pair has a way out of it at every width.

**Fixed fallback.** Everywhere else \u2014 the home page, \`/login\`, \`/legal/*\` \u2014
it renders fixed in the top-left corner on desktop and as a bottom bar on
mobile. The two never show at once.

Route matching is by path *prefix*, so a nested route under a tree entry
(\`/research/cards/awards\` under \`/research/cards\`, a document route under \`/research/docs\`) keeps the
sidebar rather than dropping to the fixed dock. The trailing \`/\` in the
comparison keeps \`/cardsy\` from matching \`/cards\`.

## Search floats over the results [#search-floats-over-the-results]

The search box, the season and style filters, the sort and the grid/rows
toggle used to sit in the sidebar on a desktop and in a bar above the results
on a phone \u2014 two copies, which is why a half-typed query seemed to disappear
when a window was resized across the breakpoint.

There is one now, and it is not in the sidebar: a small magnifier in the
top-right corner of the results, which follows them as you scroll. Hover it on
a desktop, tap it on a phone, or Tab to it, and the whole control opens over
the results. It stays open while you are typing in it or while a search is
active, and closes on Escape or a click outside. Whatever you typed is still
there the next time you open it.

That is also what lets the sidebar stay the same on \`/practice/glossary\` and
\`/practice/rankings\`, which have nothing to search: the column is now the same
column everywhere in the library.

## Results open as rows [#results-open-as-rows]

\`/videos\` opens as the dense row list rather than the thumbnail grid \u2014 about
four times as many results per screen. The grid is one toggle away inside the
search panel. The choice is not remembered between page loads.

## One sidebar everywhere [#one-sidebar-everywhere]

Every view draws the same sidebar: the one the video pages always had \u2014 the
dock, then **Videos** and the Research / Practice /
Coaching / Insights sections, then the footer links. The tool and
research pages, \`/admin\`, the legal pages and the help docs used to get a
different column (shadcn's \`sidebar-07\`, tool sections only), and \`/docs\`
showed Fumadocs' own sidebar beside that one. Now:

- **Off the video pages** \`AppSidebarShell\` wraps the page in the same
  \`ResizableSidebarLayout\` the video pages use, and \`LibrarySidebarTree\`
  mounts the same \`VideoSidebarTree\`, reading the library's counts itself
  (\`useVideoMeta\`).
- **Page-specific panels are sections of it.** The REASON document panels
  sit above the tree on \`/reason-editor\` and are the whole column on
  \`/research/cards\`, as before.
- **On \`/docs\` the docs' page tree is a section of it.** \`debate-help-docs\`'
  layouts portal the page tree (\`app-sidebar-docs-tree.tsx\`) into a slot the
  column leaves for it (\`DOCS_SIDEBAR_SLOT_ID\`), at the bottom of the column
  below the Insights section, and \`styles/docs.css\` hides
  Fumadocs' desktop sidebar and closes its grid column. Below \`md\` Fumadocs'
  drawer is still the docs' navigation. Only the folders on the path to
  the current page start expanded, and the current page is scrolled into
  view when the docs open and after each navigation.
- **Off \`/docs\`** the tree is not drawn; the Docs and Settings links
  pinned above the account row (\`SidebarPinnedLinks\`) reach it from every
  page.
- **The mobile drawer** shows the same tree (\`MobileSidebarDrawer\`).

\`/debate\` and \`/research/docs\` keep their own workspace sidebars
(\`ownsItsLayout\`) \u2014 see Known gaps.

## Resizing the sidebar [#resizing-the-sidebar]

On every page with the sidebar, drag the thin line on the sidebar's right edge to make the column
wider or narrower (between 220px and 640px). The width you choose is remembered
in this browser and every page opens the sidebar at that same width, so the
column keeps its shape as you move between them. Double-click the
line to put it back to its default 300px. The line also takes keyboard focus,
and the arrow keys resize it.

## Hiding the sidebar [#hiding-the-sidebar]

Hide the sidebar with the panel button at its bottom-right, by pressing
**Ctrl+B** (**\u2318B** on a Mac), or by dragging its edge past half its minimum
width. It collapses to nothing and the page takes the full width. A small tab
on the left edge of the window brings it back, as do the same shortcut and
dragging the edge back out. The choice holds on every page and is remembered
in this browser (\`app-sidebar-collapsed\` in localStorage; \`sidebar-collapse.ts\`
broadcasts it, so the column and the dock always agree).

**Peeking.** While the sidebar is hidden, move the pointer to the very left
edge of the window (within 8px) and it slides out *over* the page \u2014 slightly
translucent, at your usual width \u2014 without pushing the page aside. Move away
from it and it slides back after a moment (or press Esc); it stays hidden
until you pin it with the panel button at its foot, which reads **Keep
sidebar open** while peeking. A menu opened from it (the account menu) keeps
it out until the menu closes. Each time it comes or goes it plays one of ten
animations at random (slide, elastic, wiggle, zoom, flip, bounce, swing, drop,
blur or jelly), and none if your system asks for reduced motion.
(\`ResizableSidebarLayout\`: a \`pointermove\`
listener while collapsed restyles the same \`<aside>\` as a fixed overlay, so
the content panel never resizes.)

**Pages with their own sidebar.** The flow workspace (\`/debate\`) and the
research docs (\`/research/docs\`) draw a sidebar of their own, so there the app
sidebar starts hidden and theirs is the only one on screen. It still peeks
from the left edge, and pinning it keeps it open until you leave the page; it
doesn't change whether the sidebar is hidden anywhere else.

**Icons that move.** This is on by default; turn off **Animate sidebar
icons** in Settings \u2192 Preferences to stop it. Hovering a row in the sidebar, or
tabbing to it (the icon or its label), makes its icon wiggle, bounce, pulse,
spin, shake, flip, jelly or tada, a different one from the last time, for
either half a second or a full second, and tints it a random color while it
plays. Each icon plays at most once every three seconds. The research docs' own
sidebar does the same. If your system asks for reduced motion, the icon only
changes color.

While the sidebar is hidden the dock it carried floats at the top-left
instead (\`CategoryDock\` lifts its suppression while \`useSidebarCollapsed()\`
is true), so the five destinations stay one click away.

While a text editor has the keyboard (CardMirror, the REASON editor, any text
field), Ctrl/\u2318+B stays **bold** and does not toggle the sidebar.

Each tree section (Videos, Research, Practice, Coaching,
Insights) opens and closes on its own; see
[The nav tree's headings](#the-nav-trees-headings). The Docs, Github, Support,
Privacy and Reddit links sit on one compact line after the last section and
scroll with the list rather than staying pinned. Docs and Settings are pinned at the
bottom above the account menu, which links to
Settings, Notifications and Contacts and signs you out. Signed out, that row
is a **Sign in** button that opens the sign-in dialog without leaving the
page.

On a phone nothing changes: the sidebar is not drawn below the \`md\`
breakpoint, and the dock's **Sidebar** button still opens the drawer described
above.

## Staying inside the sidebar [#staying-inside-the-sidebar]

A dock sized to its own contents (\`w-max\`, the default \`fluid: false\` form)
is wider than the sidebar at its default 300px. Hosted there it
either forced the sidebar to scroll sideways or reached over its border onto
the page beside it \u2014 which on \`/reason-editor\` and \`/research/docs\` is a CardMirror
editor.

The sidebar-hosted form passes \`fluid\` to \`Dock\`, which:

- takes its width from the column (\`w-full max-w-full min-w-0\`) instead of
  from the item count, and
- wraps an overflowing row onto a second line (\`flex-wrap\`) instead of
  growing past the column, so a future sixth or seventh destination still
  cannot escape it.

\`CategoryDock\` also shrinks the icons for that form: \`EMBEDDED_ICON_SIZE\`
(34px) at rest and \`EMBEDDED_MAGNIFICATION\` (46px) hovered. Six items at 34px
with \`gap-1.5\` and \`p-2\` come to 250px against 276px of usable column width,
and a magnified icon adds 12px more \u2014 so the row fits without wrapping at
every breakpoint, and the wrapping above is the backstop rather than the
normal case.

The dock stays \`overflow-visible\` so a magnified icon isn't clipped at the
dock's edge; the sidebar column is the clipping boundary.

## The nav tree's headings [#the-nav-trees-headings]

Below the dock, the same column carries the nav tree
(\`VideoSidebarTree\` on \`/videos\`, its \`ToolNavTree\` tail everywhere else).
It is three levels deep:

| Level | Element | What it is |
| --- | --- | --- |
| 1 | \`h1\` | A top-level section: Videos, Coaching, Research, Practice |
| 2 | \`h2\` | A subgroup inside one \u2014 College Policy, Favorites, Lectures |
| 3 | \`span\` | A leaf link: a tool, a debate format |

Two rules hold for every h1:

- **It is not a link.** The row renders without an \`href\`, so clicking it
  does nothing but toggle the section. Each section's flagship tool is the
  first link *inside* it (\`/coaching\` under Coaching), so nothing became
  unreachable \u2014 a click on the heading no longer navigates away from the page
  you are on just because you wanted to see what else is in the group.
- **One section is open at a time, and it follows the route.** The tree is an
  accordion: opening a section closes the one that was open, and a closed
  section renders none of its links. Which one is open comes from the current
  path (\`sidebar-active-section.ts\`), so clicking an app dock button loads
  that destination's section into the sidebar and nothing else. The state is
  per-mount, and opening another section by hand still works.

  It used to render every section's links up front. That put around fifty
  \`next/link\`s in the sidebar on \`/videos\`, and the router prefetched an RSC
  payload for each one the moment the page mounted \u2014 a burst of requests
  racing the video feed and its thumbnails on the page that already felt
  slowest. The tree links now also pass \`prefetch={false}\`, so the ones that
  *are* rendered are fetched on click rather than on sight.

  Resolution is longest-match over the links the tree actually renders:
  \`/research/cards/library\` opens Research, which lists it, and \`/practice/versus-ai\` opens
  Practice ("Debate Versus AI"). A dock destination in no tool section \u2014
  \`/research/cards\`, \`/debate\`, \`/reason-editor\` \u2014 matches nothing and opens
  nothing. The dock's Research button (\`/research/docs\`) opens Research, by
  prefix on the Research Workspace link. \`/research/docs\` and \`/reason-editor\`
  used to sit in Research as "Debate Docs" and "Reason Editor"; they are the
  dock's own Research button and a top-level editor, so the rows only restated
  what the icons above them already said. Both routes keep their sidebars \u2014
  \`/research/docs\` through the dock link list, \`/reason-editor\` through
  \`EXTRA_SIDEBAR_HREFS\`, which is what
  gives the editor its file-navigation panels.

\`SidebarToolSection.href\` outlives the heading link: \`sidebar-routes.ts\`
still folds it into the set of paths that get the tool sidebar.

Indentation follows *nesting*, not \`level\` \u2014 each expanded node pads its own
child list \u2014 so a leaf under College Policy sits a step deeper than one
hanging straight off Coaching, wherever in the tree it is.

### Every tool has an icon [#every-tool-has-an-icon]

Each tool in Coaching, Research and Practice shows a small icon of its own
next to its name \u2014 a magnifying glass on Research Workspace, a gavel on Judge
Profiles, swords on Debate Versus AI \u2014 so a long section can be scanned by
shape rather than read line by line.

They are all drawn in the same muted grey as the section headings above them,
at the same 16px, on purpose: the icons are there to tell the rows apart, not
to compete with them or with the page you are reading beside the column. The
Glossary and Rankings links at the end of Practice used to be the exception \u2014
full-color artwork sitting among the grey glyphs \u2014 and now match the rest.

## Tests [#tests]

- \`packages/debate-videos/test/video-sidebar-render.test.tsx\` \u2014 the heading
  structure above: College Policy under a Videos \`h1\`, no \`h1\` inside an
  anchor, every section a toggle button, and only the section holding the
  current route open (with the closed ones rendering none of their links).
- \`packages/debate-videos/test/sidebar-active-section.test.ts\` \u2014 the
  route-to-section mapping itself, including the longest-match and
  dock-wins-a-tie rules above.
- \`apps/debate-ai.com/lib/ui/__tests__/dock.test.tsx\` \u2014 the \`fluid\` variant's classes,
  host-set icon sizing, and that magnification never shrinks an icon below
  its resting size.
- \`packages/debate-videos/test/sidebar-routes.test.ts\` \u2014 that \`/tools\` is no
  longer a dock destination but is still a sidebar one, and the prefix
  matching (including \`/cardsy\` not matching \`/cards\`).
- \`packages/debate-videos/test/sidebar-video-links.test.tsx\` \u2014 that the tree
  renders every \`SIDEBAR_VIDEO_LINKS\` entry and the mobile quick-link tiles
  render all but the glossary/statistics pair, which has no tile and is
  reached from the Practice section.
- \`packages/debate-videos/test/lectures-sidebar-docs-slot.test.tsx\` \u2014 that
  \`/videos\`' \`md:hidden\` block carries the tool sections, collapsed.
- \`packages/debate-videos/test/lectures-sidebar-shell.test.tsx\` \u2014 that the
  rankings and glossary branches render the dock, the nav tree and the
  footer rather than a bare page, on a phone as well as a desktop.
- \`apps/debate-ai.com/lib/nav/__tests__/dock-menu-sections.test.ts\` \u2014 that
  every sidebar destination (videos, tool sections, footer links) is
  reachable from the Settings menu, which is the whole nav below \`md\`, that
  there is no Apps section, and that \`/practice/features\` and \`/docs\` are reachable.
- \`packages/debate-videos/test/unified-sidebar.test.tsx\` \u2014 that the tree
  mounted off the video pages carries the video sections and every tool
  section, that the column has a resize handle, a hide button and the footer
  it is handed, renders shown on the server, and that the hide/show choice
  is stored and broadcast.
- \`packages/debate-webview/test/lib/layout/frame-navigation.test.ts\` \u2014 which
  clicks are left to the browser, and which links out of \`/docs\` become a
  full page load.
- \`packages/debate-webview/test/lib/nav/dock-hidden.test.ts\` \u2014 that the dock
  starts shown, the Hide Dock choice is stored, broadcast and cleared, and
  still applies to the page when storage is blocked.
- \`packages/debate-webview/test/lib/nav/dock-idle-prefetch.test.ts\` \u2014 which
  destinations are warmed in idle time, and that data saver turns it off.

## All Videos is the home page [#all-videos-is-the-home-page]

**All Videos** (\`/videos\`) is the first row under **Videos** and lists every
round and lecture in the library. It is where \`/\` lands. The lecture library
on its own is **Lectures** (\`/lectures\`), a single row at the end of the same
section. The lecture categories are not in the sidebar: the lectures page
shows them as a bar of cards at its top (see
[Lecture categories](/docs/features/video-library/video-library#lecture-categories)).

## One collection highlighted at a time [#one-collection-highlighted-at-a-time]

The sidebar's collections (All Videos, Lectures, College Policy, HS Policy, HS Policy 1v1 (LD),
Public Forum, Greatest of All-Time, My Favorites, Watch History) are one list, and
only the open one is highlighted. **Lectures** lights up on every lecture page,
category pages included (\`browsingLectures\`), and never alongside a round
collection. \`packages/debate-videos/test/sidebar-single-highlight.test.tsx\`
pins it.


**Team Rankings stays highlighted on a team or school page.** \`/teams/<team>\`
and \`/schools/<school>\` are opened from the **Team Rankings** row (\`/coaching/rankings\`)
rather than nested under it, so a plain path match never lit that row while
reading a profile \u2014 \`ToolNavTree\`'s \`isToolActive\` treats both prefixes as
still-on-Team-Rankings, the same relationship \`EXTRA_SIDEBAR_HREFS\` already
uses to keep the sidebar itself mounted on those pages (see
[Where it renders](#where-it-renders) and \`sidebar-routes.ts\`).

## The highlighted row scrolls into view [#the-highlighted-row-scrolls-into-view]

\`TreeItem\` scrolls its own row into view (\`scrollIntoView({ block: "nearest"
})\`) whenever it becomes the highlighted one \u2014 on mount, and on navigating to
a route that lights up a different row. \`"nearest"\` moves the sidebar's own
scroll only as far as needed to bring the row on screen, and not at all if it
is already visible, so following a link inside the currently-visible part of
a long section (Practice runs to fifteen-plus rows) never jumps the column.

## The feature catalog opens inside the app [#the-feature-catalog-opens-inside-the-app]

\`/practice/features\` \u2014 the catalog of every surface in the app \u2014 is reached from the
footer under the sidebar and from the dock's **Site Links** menu. Following
either used to reload the whole tab into a bare page: the sidebar and the dock
were gone, the persistent player stopped mid-lecture, and the page's only way
back was a "Back" pill of its own.

It is now an ordinary page of the app. It renders in the same sidebar as every
surface it catalogues, the footer and the menu reach it through the router
rather than by loading a new document, and the "Back" pill is gone \u2014 the
sidebar is how you leave it.

One link is deliberately still a full page load: \`/docs\` is a separately built
help site served as static files, not a route this app knows, so it is
followed the old way. Outside sites still open in a new tab.

## Switching pages is a React render, not a frame load [#switching-pages-is-a-react-render-not-a-frame-load]

Every dock destination is an ordinary route rendered as React in the one app
document. Nothing loads in an \`<iframe>\`: the dock, the sidebar and the
player stay mounted, and a sidebar link on \`/videos\` routes the same document
like any other link.

To make a switch a render from cache, the dock fetches each destination's
code ahead of the click. Hovering or focusing an icon prefetches that route,
and once the current page has loaded the dock prefetches the others one at a
time in idle time (\`lib/nav/dock-idle-prefetch.ts\`), so touch screens and
quick clicks get the same head start. The idle pass skips the two heavy
routes, \`/research/docs\` and \`/practice/versus-ai\` (the whole practice stack:
the AI opponent, the round and matchup simulators, coach mode, the drill
generator and the judge); hovering their icons still warms them. Each route is
warmed at most once per page load, even when the sidebar's embedded dock
remounts and restarts the pass. It also does nothing on a data-saver or 2G
connection.

Only the app shell's dock runs the app-wide notifications and contacts polls;
the sidebar's embedded copy doesn't, and every other mounted copy of those
hooks (the account menu's badge, the contacts page) reuses the request one
copy already made in the same 30-second tick.

## A bar across the top shows a page switch in progress [#a-bar-across-the-top-shows-a-page-switch-in-progress]

Every page transition, from a dock icon, any in-app link, or back and
forward, shows a slim bar across the top of the window in the theme's primary
colour, like YouTube's. It creeps forward while the next page loads, fills
when the new page has painted, and fades out. Switches that land within
150 ms never show it, and with reduced motion turned on it moves without
animating.

- **Bar:** \`packages/debate-webview/src/components/ui/RouteProgressBar.tsx\`
- **Pacing and state:** \`packages/debate-webview/src/lib/ui/route-progress.ts\`
- **Start and finish signals:** \`packages/debate-webview/src/lib/ui/use-route-loading.ts\`

The full-screen loading orb no longer shows for page transitions; it is left
for code that asks for it with \`beginLoading\`.

## Known gaps [#known-gaps]

- \`/debate\` (the flow workspace) and \`/research/docs\` (the research agent)
  still draw their own full-height workspace sidebars instead of the shared
  one, so they have no resize handle or hide button of their own design and
  their contents are not yet sections of the shared column.
- A hidden dock's tab does not reveal it on a pen or a touch screen that
  reports hover; it opens on a tap there too, and a tap elsewhere does not fold
  it again until the next navigation or a second tap on the tab.
- On \`/docs\` the docs' search box sits in Fumadocs' header, not in the shared
  column, and with the sidebar hidden the docs have no dock (the docs don't
  mount the floating one).
`,i={contents:[{heading:`app-nav-dock-and-tool-sidebar`,content:`The macOS-style icon dock that carries the app's top-level destinations, and
the sidebar column that hosts it on every tool route.`},{heading:`app-nav-dock-and-tool-sidebar`,content:"**Component:** `apps/debate-ai.com/components/layout/CategoryDock.tsx`"},{heading:`app-nav-dock-and-tool-sidebar`,content:"**Sidebar shell:** `packages/debate-webview/src/components/layout/AppSidebarShell.tsx`"},{heading:`app-nav-dock-and-tool-sidebar`,content:"**The one sidebar column:** `packages/debate-videos/src/ui/layout/ResizableSidebarLayout.tsx`\n(hide/show state in `sidebar-collapse.ts` beside it), filled by\n`packages/debate-webview/src/components/layout/app-sidebar/` off the video pages"},{heading:`app-nav-dock-and-tool-sidebar`,content:"**The tree in it:** `VideoSidebarTree`, mounted off the video pages through\n`LibrarySidebarTree` (`packages/debate-videos/src/components/category-gallery/`)"},{heading:`app-nav-dock-and-tool-sidebar`,content:"**Route predicates:** `packages/debate-videos/src/components/category-gallery/sidebar-routes.ts`\n(re-exported for app code as `apps/debate-ai.com/lib/sidebar-routes.ts`)"},{heading:`app-nav-dock-and-tool-sidebar`,content:"**Dock primitive:** `apps/debate-ai.com/lib/ui/layout/dock.tsx`"},{heading:`what-it-shows`,content:"Five destinations \u2014 Videos, Shared, Debate, Practice vs AI, Research \u2014 plus a\ngear-icon Settings menu, with `Alt+1`\u2026`Alt+5` shortcuts in dock order. The\nicons carry no hover labels \u2014 in the sidebar-hosted dock the tooltips crowded\ntogether over the nav tree \u2014 so each item's name lives in its `aria-label`\n(read by screen readers) and in the icon art itself."},{heading:`what-it-shows`,content:"**Practice vs AI opens a menu instead of navigating.** A plain click on that\nicon does not go to `/practice/versus-ai` \u2014 it opens the site-nav menu described below\n(`NavMenu`, in `CategoryDock.tsx`). The page itself is still one tap away, as\nthe first tool listed under that menu's Practice section, and the `Alt+4`\nshortcut still jumps straight there."},{heading:`what-it-shows`,content:`**Tools are not dock icons.** The tools catalog is reached from the sidebar
nav tree's Research / Practice / Coaching / Insights
sections, and the whole feature
catalog from the **Features** row in the Settings menu's Site Links submenu \u2014
next to a **Docs** row for the help site. Holding the dock to five
destinations is what lets it fit inside the sidebar column it is hosted in \u2014
see below.`},{heading:`the-sidebar-button-mobile`,content:"The sidebar is `md+` only, so the mobile bottom dock starts with a **Sidebar**\nbutton. It opens a left drawer (`MobileSidebarDrawer`) whose content follows\nthe view in the centre (`mobileSidebarKind`, `lib/mobile-sidebar.ts`):"},{heading:`the-sidebar-button-mobile`,content:"| View                                                                   | Drawer                                              |\n| ---------------------------------------------------------------------- | --------------------------------------------------- |\n| Video library (`/videos`, `/lectures`, glossary, rankings, statistics) | The sidebar tree (Videos, tool sections) and footer |",table:`table-0`},{heading:`the-sidebar-button-mobile`,content:"| View                                | Drawer                                 |\n| ----------------------------------- | -------------------------------------- |\n| `/research/cards`, `/reason-editor` | Document panels above the sidebar tree |",table:`table-0`},{heading:`the-sidebar-button-mobile`,content:"| View      | Drawer                                                                                                           |\n| --------- | ---------------------------------------------------------------------------------------------------------------- |\n| `/debate` | Its own flows/rounds sidebar \u2014 the button dispatches `debate:open-sidebar` and the workspace opens its own sheet |",table:`table-0`},{heading:`the-sidebar-button-mobile`,content:`| View            | Drawer                      |
| --------------- | --------------------------- |
| Everything else | The sidebar tree and footer |`,table:`table-0`},{heading:`the-sidebar-button-mobile`,content:`The drawer closes on navigation.`},{heading:`the-desktop-sidebars-footer`,content:`On \`md+\` the column has no brand row at the top \u2014 it opens straight onto the
dock. Its bottom row, pinned under the scrolling tree, is the account menu
(on every page, the video library's included) with the **hide button** beside
it \u2014 see Hiding the sidebar. The row shows your avatar
and name only, never your email address, with a badge on the avatar counting
unread notifications. The account menu holds Settings, a **Notifications**
submenu (every unread notification: pick one to open its link and clear it, X
to clear it in place, **Clear all**, and a link to \`/notifications\`; clearing
is the page's mark-as-read), an **Organizations** submenu (switch between Personal
and your organizations, or create one \u2014 see
Contacts), a **Theme** submenu
(Light / Dark / System and every colour theme, with swatches \u2014 the same picker
as the dock's Settings menu, and synced to the account the same way), a
**Site links** submenu (every \`FOOTER_LINKS\` entry: Docs, GitHub, Support,
Privacy, Reddit\u2026) and Sign out. Signed out, the row is a Sign in button with a
globe button beside it that lists the same site links.`},{heading:`the-desktop-sidebars-footer`,content:`**Docs** and **Settings** are always on screen just above the account row, on
every page, signed in or out and whatever is selected, so you never have to
open a menu to reach them. The phone drawer ends with the same two links.`},{heading:`the-desktop-sidebars-footer`,content:`The other site links used to be a row of links above the account row; they
live in the account menu now. The phone layouts below \`md\`, which have no
account row, keep their footer.`},{heading:`two-menus-not-one`,content:"The dock carries two independent dropdowns, each with its own `DropdownMenu`\nroot \u2014 opening one does not affect the other, and either can be open at once:"},{heading:`two-menus-not-one`,content:`**The Practice vs AI icon opens the site-nav menu (\`NavMenu\`).** Command
Palette at the top, then a submenu per sidebar section \u2014 **Videos,
Research, Practice, Coaching, Insights** \u2014 derived from the data the sidebar itself
renders rather than restated:`},{heading:`two-menus-not-one`,content:"| Menu submenu | Comes from                                                                                                                                                             |\n| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| Videos       | `SIDEBAR_VIDEO_LINKS` (`components/category-gallery/sidebar-video-links.ts`), minus the glossary and topic & video statistics, which are listed under Insights instead |",table:`table-1`},{heading:`two-menus-not-one`,content:`| Menu submenu                              | Comes from              |
| ----------------------------------------- | ----------------------- |
| Research / Practice / Coaching / Insights | \`SIDEBAR_TOOL_SECTIONS\` |`,table:`table-1`},{heading:`two-menus-not-one`,content:"On a phone, where the sidebar column below is `md+` only, this menu is the\nonly way to reach those links at all."},{heading:`two-menus-not-one`,content:`**The gear icon opens \`SettingsMenu\`** \u2014 Settings, the light/dark toggle
and Theme submenu, **Hide Dock** (see Hiding the dock),
one Site Links submenu listing every footer link
(site and debate-community links together, from \`FOOTER_LINKS\`),
and the account block.`},{heading:`two-menus-not-one`,content:`**There is no "Apps" submenu.** The site-nav menu used to restate the dock's
own five icons as text and then hang the whole feature catalog underneath,
one nested submenu per category \u2014 a second, deeper copy of \`/practice/features\`
hanging off the dock that was already showing those five icons. One
**Features** row reaches the catalog instead, and a **Docs** row the help
site; both are footer links, so the sidebar's link rows carry them too.`},{heading:`two-menus-not-one`,content:`\`apps/debate-ai.com/lib/nav/dock-menu-sections.ts\` does the site-nav menu's
composition, and \`lib/nav/__tests__/dock-menu-sections.test.ts\` fails if a
sidebar destination is missing from it. That coupling is the point: the
Videos links and the glossary/rankings pair below the tree were in the
sidebar and in no mobile menu at all, because the menu was a hand-kept list.`},{heading:`two-menus-not-one`,content:"Both menus scroll (`max-h-[min(560px,80vh)]`) \u2014 `SettingsMenu`'s theme/links\nblock above the account rows can still run past a phone viewport."},{heading:`two-menus-not-one`,content:"Wiring the Practice vs AI icon to a second `DropdownMenu` root, rather than\nsharing the gear's, means it sits *inside* `Dock`'s children instead of\nwrapping the whole dock \u2014 so `Dock`'s magnification props land on the\nwrapper component instead of the `DockItem` two levels down.\n`PracticeVsAiTrigger` forwards `mousex`/`magnification`/`distance`/`iconSize`\nby hand so that icon still resizes and tracks the cursor like its siblings."},{heading:`two-menus-not-one`,content:"`/videos` additionally prints the tree inline in its own `md:hidden` block,\nunder the quick-link tiles: the tiles are the Videos section only, so\n`ToolNavTree` follows them with `defaultExpanded={false}` (its sections start\ncollapsed there \u2014 expanded, forty rows would push the video grid off the\nscreen)."},{heading:`hiding-the-dock`,content:`Choose **Hide Dock** in the gear menu and the row of app icons folds away to a
small arrow tab where it sat: hanging down from the top-left corner or the top
of the sidebar, or rising from the bottom of the screen on a phone. Hover the
tab (or Tab to it from the keyboard, or tap it on a touch screen) and the full
dock slides back over it; move away and it folds up again. It stays out while
one of its menus is open, so the same menu's **Show Dock** row puts it back
for good. The choice holds on every page and is remembered in this browser
(\`app-dock-hidden\` in localStorage, broadcast by
\`packages/debate-webview/src/lib/nav/dock-hidden.ts\` so every dock instance
agrees).`},{heading:`hiding-the-dock`,content:"`CollapsibleDock` in `CategoryDock.tsx` does the folding. Shown, it renders\nthe dock untouched. Hidden, it keeps the dock mounted inside an absolutely\npositioned, transparent panel over the tab, and reveals it with CSS alone:\n`group-hover`, keyboard focus inside (`:focus-visible`, so a mouse click that\nleaves focus on an icon does not pin it open), a tap on the tab, or a dock\nmenu trigger with `data-state=open`."},{heading:`where-it-renders`,content:"The dock has two forms, and which one a route gets is decided by\n`hasEmbeddedDock`:"},{heading:`where-it-renders`,content:"**Sidebar-hosted (`<CategoryDock embedded />`).** On `/videos` (whose own\n`<aside>` takes it through `LecturesVideoGridView`'s `dockSlot`) and on every\nroute the tool-nav tree links to (where `AppSidebarShell` wraps the page in\nthe generic sidebar), the dock sits at the top of that column (300px wide until you\ndrag it \u2014 see Resizing the sidebar)."},{heading:`where-it-renders`,content:"`/doc` is the exception: the Docs button opens the research agent, which draws\nits own full-height workspace. Its sidebar \u2014 the files tree and the \"Open Tabs\"\nlist \u2014 is the research agent's own, not the generic tool sidebar, and the dock\nsits at the top of that column (`OWN_SIDEBAR_DOCK_HREFS`, in\n`packages/debate-videos/src/components/category-gallery/sidebar-routes.ts`).\nThe research agent's own app dock is never mounted here (it is the host's to\ndraw), and on a phone the dock's **Sidebar** button opens the agent's sidebar\n(the `OPEN_OWN_SIDEBAR_EVENT` window event, the same one `/debate` listens for).\nChoosing **Settings** in the dock's menu from `/doc` opens `/settings` on the\nresearch agent's first tab (`?category=research-account`); from anywhere else it\nopens `/settings` on its first tab. Either way the agent's sections and the app's\nown share one sidebar."},{heading:`where-it-renders`,content:"The Research button was called **Docs** and lived at `/doc` until October\n2026. Old `/doc` and `/doc/<document>` links answer with a permanent (308)\nredirect to `/research/docs` and `/research/docs/<document>`, from the same\ntable as the other category moves\n(`packages/debate-data-sync/src/routes/category-paths.ts`). It sits under\n`/research/docs` rather than `/research` because `/research` is the Research\nWorkspace hub."},{heading:`where-it-renders`,content:"That now includes `/practice/rankings` and `/practice/glossary`. Both are rows\nin the sidebar's own tree, and both used to answer with a bare page \u2014 no\nsidebar, and no fixed dock either, since every `/videos` path counts as\nalready carrying a sidebar-hosted one. `LecturesSidebarShell` wraps them in\nthe same column (dock, nav tree, footer), so clicking either link leaves the\nnav exactly where it was."},{heading:`where-it-renders`,content:"The sidebar is `md+` only, though, and the same rule that hides the fixed dock\nhides its mobile bottom bar. So on a phone those two pages still answered with\nnothing to navigate by. `LecturesSidebarShell` now also renders the `md:hidden`\nblock the grid renders \u2014 the quick-link tiles, the tool tree (collapsed) and\nthe footer \u2014 so the pair has a way out of it at every width."},{heading:`where-it-renders`,content:"**Fixed fallback.** Everywhere else \u2014 the home page, `/login`, `/legal/*` \u2014\nit renders fixed in the top-left corner on desktop and as a bottom bar on\nmobile. The two never show at once."},{heading:`where-it-renders`,content:"Route matching is by path *prefix*, so a nested route under a tree entry\n(`/research/cards/awards` under `/research/cards`, a document route under `/research/docs`) keeps the\nsidebar rather than dropping to the fixed dock. The trailing `/` in the\ncomparison keeps `/cardsy` from matching `/cards`."},{heading:`search-floats-over-the-results`,content:`The search box, the season and style filters, the sort and the grid/rows
toggle used to sit in the sidebar on a desktop and in a bar above the results
on a phone \u2014 two copies, which is why a half-typed query seemed to disappear
when a window was resized across the breakpoint.`},{heading:`search-floats-over-the-results`,content:`There is one now, and it is not in the sidebar: a small magnifier in the
top-right corner of the results, which follows them as you scroll. Hover it on
a desktop, tap it on a phone, or Tab to it, and the whole control opens over
the results. It stays open while you are typing in it or while a search is
active, and closes on Escape or a click outside. Whatever you typed is still
there the next time you open it.`},{heading:`search-floats-over-the-results`,content:"That is also what lets the sidebar stay the same on `/practice/glossary` and\n`/practice/rankings`, which have nothing to search: the column is now the same\ncolumn everywhere in the library."},{heading:`results-open-as-rows`,content:`\`/videos\` opens as the dense row list rather than the thumbnail grid \u2014 about
four times as many results per screen. The grid is one toggle away inside the
search panel. The choice is not remembered between page loads.`},{heading:`one-sidebar-everywhere`,content:"Every view draws the same sidebar: the one the video pages always had \u2014 the\ndock, then **Videos** and the Research / Practice /\nCoaching / Insights sections, then the footer links. The tool and\nresearch pages, `/admin`, the legal pages and the help docs used to get a\ndifferent column (shadcn's `sidebar-07`, tool sections only), and `/docs`\nshowed Fumadocs' own sidebar beside that one. Now:"},{heading:`one-sidebar-everywhere`,content:"**Off the video pages** `AppSidebarShell` wraps the page in the same\n`ResizableSidebarLayout` the video pages use, and `LibrarySidebarTree`\nmounts the same `VideoSidebarTree`, reading the library's counts itself\n(`useVideoMeta`)."},{heading:`one-sidebar-everywhere`,content:"**Page-specific panels are sections of it.** The REASON document panels\nsit above the tree on `/reason-editor` and are the whole column on\n`/research/cards`, as before."},{heading:`one-sidebar-everywhere`,content:"**On `/docs` the docs' page tree is a section of it.** `debate-help-docs`'\nlayouts portal the page tree (`app-sidebar-docs-tree.tsx`) into a slot the\ncolumn leaves for it (`DOCS_SIDEBAR_SLOT_ID`), at the bottom of the column\nbelow the Insights section, and `styles/docs.css` hides\nFumadocs' desktop sidebar and closes its grid column. Below `md` Fumadocs'\ndrawer is still the docs' navigation. Only the folders on the path to\nthe current page start expanded, and the current page is scrolled into\nview when the docs open and after each navigation."},{heading:`one-sidebar-everywhere`,content:"**Off `/docs`** the tree is not drawn; the Docs and Settings links\npinned above the account row (`SidebarPinnedLinks`) reach it from every\npage."},{heading:`one-sidebar-everywhere`,content:"**The mobile drawer** shows the same tree (`MobileSidebarDrawer`)."},{heading:`one-sidebar-everywhere`,content:"`/debate` and `/research/docs` keep their own workspace sidebars\n(`ownsItsLayout`) \u2014 see Known gaps."},{heading:`resizing-the-sidebar`,content:`On every page with the sidebar, drag the thin line on the sidebar's right edge to make the column
wider or narrower (between 220px and 640px). The width you choose is remembered
in this browser and every page opens the sidebar at that same width, so the
column keeps its shape as you move between them. Double-click the
line to put it back to its default 300px. The line also takes keyboard focus,
and the arrow keys resize it.`},{heading:`hiding-the-sidebar`,content:`Hide the sidebar with the panel button at its bottom-right, by pressing
**Ctrl+B** (**\u2318B** on a Mac), or by dragging its edge past half its minimum
width. It collapses to nothing and the page takes the full width. A small tab
on the left edge of the window brings it back, as do the same shortcut and
dragging the edge back out. The choice holds on every page and is remembered
in this browser (\`app-sidebar-collapsed\` in localStorage; \`sidebar-collapse.ts\`
broadcasts it, so the column and the dock always agree).`},{heading:`hiding-the-sidebar`,content:`**Peeking.** While the sidebar is hidden, move the pointer to the very left
edge of the window (within 8px) and it slides out *over* the page \u2014 slightly
translucent, at your usual width \u2014 without pushing the page aside. Move away
from it and it slides back after a moment (or press Esc); it stays hidden
until you pin it with the panel button at its foot, which reads **Keep
sidebar open** while peeking. A menu opened from it (the account menu) keeps
it out until the menu closes. Each time it comes or goes it plays one of ten
animations at random (slide, elastic, wiggle, zoom, flip, bounce, swing, drop,
blur or jelly), and none if your system asks for reduced motion.
(\`ResizableSidebarLayout\`: a \`pointermove\`
listener while collapsed restyles the same \`<aside>\` as a fixed overlay, so
the content panel never resizes.)`},{heading:`hiding-the-sidebar`,content:`**Pages with their own sidebar.** The flow workspace (\`/debate\`) and the
research docs (\`/research/docs\`) draw a sidebar of their own, so there the app
sidebar starts hidden and theirs is the only one on screen. It still peeks
from the left edge, and pinning it keeps it open until you leave the page; it
doesn't change whether the sidebar is hidden anywhere else.`},{heading:`hiding-the-sidebar`,content:`**Icons that move.** This is on by default; turn off **Animate sidebar
icons** in Settings \u2192 Preferences to stop it. Hovering a row in the sidebar, or
tabbing to it (the icon or its label), makes its icon wiggle, bounce, pulse,
spin, shake, flip, jelly or tada, a different one from the last time, for
either half a second or a full second, and tints it a random color while it
plays. Each icon plays at most once every three seconds. The research docs' own
sidebar does the same. If your system asks for reduced motion, the icon only
changes color.`},{heading:`hiding-the-sidebar`,content:"While the sidebar is hidden the dock it carried floats at the top-left\ninstead (`CategoryDock` lifts its suppression while `useSidebarCollapsed()`\nis true), so the five destinations stay one click away."},{heading:`hiding-the-sidebar`,content:`While a text editor has the keyboard (CardMirror, the REASON editor, any text
field), Ctrl/\u2318+B stays **bold** and does not toggle the sidebar.`},{heading:`hiding-the-sidebar`,content:`Each tree section (Videos, Research, Practice, Coaching,
Insights) opens and closes on its own; see
The nav tree's headings. The Docs, Github, Support,
Privacy and Reddit links sit on one compact line after the last section and
scroll with the list rather than staying pinned. Docs and Settings are pinned at the
bottom above the account menu, which links to
Settings, Notifications and Contacts and signs you out. Signed out, that row
is a **Sign in** button that opens the sign-in dialog without leaving the
page.`},{heading:`hiding-the-sidebar`,content:`On a phone nothing changes: the sidebar is not drawn below the \`md\`
breakpoint, and the dock's **Sidebar** button still opens the drawer described
above.`},{heading:`staying-inside-the-sidebar`,content:"A dock sized to its own contents (`w-max`, the default `fluid: false` form)\nis wider than the sidebar at its default 300px. Hosted there it\neither forced the sidebar to scroll sideways or reached over its border onto\nthe page beside it \u2014 which on `/reason-editor` and `/research/docs` is a CardMirror\neditor."},{heading:`staying-inside-the-sidebar`,content:"The sidebar-hosted form passes `fluid` to `Dock`, which:"},{heading:`staying-inside-the-sidebar`,content:"takes its width from the column (`w-full max-w-full min-w-0`) instead of\nfrom the item count, and"},{heading:`staying-inside-the-sidebar`,content:`wraps an overflowing row onto a second line (\`flex-wrap\`) instead of
growing past the column, so a future sixth or seventh destination still
cannot escape it.`},{heading:`staying-inside-the-sidebar`,content:"`CategoryDock` also shrinks the icons for that form: `EMBEDDED_ICON_SIZE`\n(34px) at rest and `EMBEDDED_MAGNIFICATION` (46px) hovered. Six items at 34px\nwith `gap-1.5` and `p-2` come to 250px against 276px of usable column width,\nand a magnified icon adds 12px more \u2014 so the row fits without wrapping at\nevery breakpoint, and the wrapping above is the backstop rather than the\nnormal case."},{heading:`staying-inside-the-sidebar`,content:"The dock stays `overflow-visible` so a magnified icon isn't clipped at the\ndock's edge; the sidebar column is the clipping boundary."},{heading:`the-nav-trees-headings`,content:"Below the dock, the same column carries the nav tree\n(`VideoSidebarTree` on `/videos`, its `ToolNavTree` tail everywhere else).\nIt is three levels deep:"},{heading:`the-nav-trees-headings`,content:`| Level | Element | What it is                                                |
| ----- | ------- | --------------------------------------------------------- |
| 1     | \`h1\`    | A top-level section: Videos, Coaching, Research, Practice |`,table:`table-2`},{heading:`the-nav-trees-headings`,content:`| Level | Element | What it is                                                  |
| ----- | ------- | ----------------------------------------------------------- |
| 2     | \`h2\`    | A subgroup inside one \u2014 College Policy, Favorites, Lectures |`,table:`table-2`},{heading:`the-nav-trees-headings`,content:`| Level | Element | What it is                           |
| ----- | ------- | ------------------------------------ |
| 3     | \`span\`  | A leaf link: a tool, a debate format |`,table:`table-2`},{heading:`the-nav-trees-headings`,content:`Two rules hold for every h1:`},{heading:`the-nav-trees-headings`,content:`**It is not a link.** The row renders without an \`href\`, so clicking it
does nothing but toggle the section. Each section's flagship tool is the
first link *inside* it (\`/coaching\` under Coaching), so nothing became
unreachable \u2014 a click on the heading no longer navigates away from the page
you are on just because you wanted to see what else is in the group.`},{heading:`the-nav-trees-headings`,content:`**One section is open at a time, and it follows the route.** The tree is an
accordion: opening a section closes the one that was open, and a closed
section renders none of its links. Which one is open comes from the current
path (\`sidebar-active-section.ts\`), so clicking an app dock button loads
that destination's section into the sidebar and nothing else. The state is
per-mount, and opening another section by hand still works.`},{heading:`the-nav-trees-headings`,content:"It used to render every section's links up front. That put around fifty\n`next/link`s in the sidebar on `/videos`, and the router prefetched an RSC\npayload for each one the moment the page mounted \u2014 a burst of requests\nracing the video feed and its thumbnails on the page that already felt\nslowest. The tree links now also pass `prefetch={false}`, so the ones that\n*are* rendered are fetched on click rather than on sight."},{heading:`the-nav-trees-headings`,content:'Resolution is longest-match over the links the tree actually renders:\n`/research/cards/library` opens Research, which lists it, and `/practice/versus-ai` opens\nPractice ("Debate Versus AI"). A dock destination in no tool section \u2014\n`/research/cards`, `/debate`, `/reason-editor` \u2014 matches nothing and opens\nnothing. The dock\'s Research button (`/research/docs`) opens Research, by\nprefix on the Research Workspace link. `/research/docs` and `/reason-editor`\nused to sit in Research as "Debate Docs" and "Reason Editor"; they are the\ndock\'s own Research button and a top-level editor, so the rows only restated\nwhat the icons above them already said. Both routes keep their sidebars \u2014\n`/research/docs` through the dock link list, `/reason-editor` through\n`EXTRA_SIDEBAR_HREFS`, which is what\ngives the editor its file-navigation panels.'},{heading:`the-nav-trees-headings`,content:"`SidebarToolSection.href` outlives the heading link: `sidebar-routes.ts`\nstill folds it into the set of paths that get the tool sidebar."},{heading:`the-nav-trees-headings`,content:`Indentation follows *nesting*, not \`level\` \u2014 each expanded node pads its own
child list \u2014 so a leaf under College Policy sits a step deeper than one
hanging straight off Coaching, wherever in the tree it is.`},{heading:`every-tool-has-an-icon`,content:`Each tool in Coaching, Research and Practice shows a small icon of its own
next to its name \u2014 a magnifying glass on Research Workspace, a gavel on Judge
Profiles, swords on Debate Versus AI \u2014 so a long section can be scanned by
shape rather than read line by line.`},{heading:`every-tool-has-an-icon`,content:`They are all drawn in the same muted grey as the section headings above them,
at the same 16px, on purpose: the icons are there to tell the rows apart, not
to compete with them or with the page you are reading beside the column. The
Glossary and Rankings links at the end of Practice used to be the exception \u2014
full-color artwork sitting among the grey glyphs \u2014 and now match the rest.`},{heading:`tests`,content:"`packages/debate-videos/test/video-sidebar-render.test.tsx` \u2014 the heading\nstructure above: College Policy under a Videos `h1`, no `h1` inside an\nanchor, every section a toggle button, and only the section holding the\ncurrent route open (with the closed ones rendering none of their links)."},{heading:`tests`,content:`\`packages/debate-videos/test/sidebar-active-section.test.ts\` \u2014 the
route-to-section mapping itself, including the longest-match and
dock-wins-a-tie rules above.`},{heading:`tests`,content:"`apps/debate-ai.com/lib/ui/__tests__/dock.test.tsx` \u2014 the `fluid` variant's classes,\nhost-set icon sizing, and that magnification never shrinks an icon below\nits resting size."},{heading:`tests`,content:"`packages/debate-videos/test/sidebar-routes.test.ts` \u2014 that `/tools` is no\nlonger a dock destination but is still a sidebar one, and the prefix\nmatching (including `/cardsy` not matching `/cards`)."},{heading:`tests`,content:"`packages/debate-videos/test/sidebar-video-links.test.tsx` \u2014 that the tree\nrenders every `SIDEBAR_VIDEO_LINKS` entry and the mobile quick-link tiles\nrender all but the glossary/statistics pair, which has no tile and is\nreached from the Practice section."},{heading:`tests`,content:"`packages/debate-videos/test/lectures-sidebar-docs-slot.test.tsx` \u2014 that\n`/videos`' `md:hidden` block carries the tool sections, collapsed."},{heading:`tests`,content:`\`packages/debate-videos/test/lectures-sidebar-shell.test.tsx\` \u2014 that the
rankings and glossary branches render the dock, the nav tree and the
footer rather than a bare page, on a phone as well as a desktop.`},{heading:`tests`,content:"`apps/debate-ai.com/lib/nav/__tests__/dock-menu-sections.test.ts` \u2014 that\nevery sidebar destination (videos, tool sections, footer links) is\nreachable from the Settings menu, which is the whole nav below `md`, that\nthere is no Apps section, and that `/practice/features` and `/docs` are reachable."},{heading:`tests`,content:`\`packages/debate-videos/test/unified-sidebar.test.tsx\` \u2014 that the tree
mounted off the video pages carries the video sections and every tool
section, that the column has a resize handle, a hide button and the footer
it is handed, renders shown on the server, and that the hide/show choice
is stored and broadcast.`},{heading:`tests`,content:"`packages/debate-webview/test/lib/layout/frame-navigation.test.ts` \u2014 which\nclicks are left to the browser, and which links out of `/docs` become a\nfull page load."},{heading:`tests`,content:`\`packages/debate-webview/test/lib/nav/dock-hidden.test.ts\` \u2014 that the dock
starts shown, the Hide Dock choice is stored, broadcast and cleared, and
still applies to the page when storage is blocked.`},{heading:`tests`,content:"`packages/debate-webview/test/lib/nav/dock-idle-prefetch.test.ts` \u2014 which\ndestinations are warmed in idle time, and that data saver turns it off."},{heading:`all-videos-is-the-home-page`,content:"**All Videos** (`/videos`) is the first row under **Videos** and lists every\nround and lecture in the library. It is where `/` lands. The lecture library\non its own is **Lectures** (`/lectures`), a single row at the end of the same\nsection. The lecture categories are not in the sidebar: the lectures page\nshows them as a bar of cards at its top (see\nLecture categories)."},{heading:`one-collection-highlighted-at-a-time`,content:`The sidebar's collections (All Videos, Lectures, College Policy, HS Policy, HS Policy 1v1 (LD),
Public Forum, Greatest of All-Time, My Favorites, Watch History) are one list, and
only the open one is highlighted. **Lectures** lights up on every lecture page,
category pages included (\`browsingLectures\`), and never alongside a round
collection. \`packages/debate-videos/test/sidebar-single-highlight.test.tsx\`
pins it.`},{heading:`one-collection-highlighted-at-a-time`,content:"**Team Rankings stays highlighted on a team or school page.** `/teams/<team>`\nand `/schools/<school>` are opened from the **Team Rankings** row (`/coaching/rankings`)\nrather than nested under it, so a plain path match never lit that row while\nreading a profile \u2014 `ToolNavTree`'s `isToolActive` treats both prefixes as\nstill-on-Team-Rankings, the same relationship `EXTRA_SIDEBAR_HREFS` already\nuses to keep the sidebar itself mounted on those pages (see\nWhere it renders and `sidebar-routes.ts`)."},{heading:`the-highlighted-row-scrolls-into-view`,content:`\`TreeItem\` scrolls its own row into view (\`scrollIntoView({ block: "nearest"
})\`) whenever it becomes the highlighted one \u2014 on mount, and on navigating to
a route that lights up a different row. \`"nearest"\` moves the sidebar's own
scroll only as far as needed to bring the row on screen, and not at all if it
is already visible, so following a link inside the currently-visible part of
a long section (Practice runs to fifteen-plus rows) never jumps the column.`},{heading:`the-feature-catalog-opens-inside-the-app`,content:`\`/practice/features\` \u2014 the catalog of every surface in the app \u2014 is reached from the
footer under the sidebar and from the dock's **Site Links** menu. Following
either used to reload the whole tab into a bare page: the sidebar and the dock
were gone, the persistent player stopped mid-lecture, and the page's only way
back was a "Back" pill of its own.`},{heading:`the-feature-catalog-opens-inside-the-app`,content:`It is now an ordinary page of the app. It renders in the same sidebar as every
surface it catalogues, the footer and the menu reach it through the router
rather than by loading a new document, and the "Back" pill is gone \u2014 the
sidebar is how you leave it.`},{heading:`the-feature-catalog-opens-inside-the-app`,content:`One link is deliberately still a full page load: \`/docs\` is a separately built
help site served as static files, not a route this app knows, so it is
followed the old way. Outside sites still open in a new tab.`},{heading:`switching-pages-is-a-react-render-not-a-frame-load`,content:"Every dock destination is an ordinary route rendered as React in the one app\ndocument. Nothing loads in an `<iframe>`: the dock, the sidebar and the\nplayer stay mounted, and a sidebar link on `/videos` routes the same document\nlike any other link."},{heading:`switching-pages-is-a-react-render-not-a-frame-load`,content:`To make a switch a render from cache, the dock fetches each destination's
code ahead of the click. Hovering or focusing an icon prefetches that route,
and once the current page has loaded the dock prefetches the others one at a
time in idle time (\`lib/nav/dock-idle-prefetch.ts\`), so touch screens and
quick clicks get the same head start. The idle pass skips the two heavy
routes, \`/research/docs\` and \`/practice/versus-ai\` (the whole practice stack:
the AI opponent, the round and matchup simulators, coach mode, the drill
generator and the judge); hovering their icons still warms them. Each route is
warmed at most once per page load, even when the sidebar's embedded dock
remounts and restarts the pass. It also does nothing on a data-saver or 2G
connection.`},{heading:`switching-pages-is-a-react-render-not-a-frame-load`,content:`Only the app shell's dock runs the app-wide notifications and contacts polls;
the sidebar's embedded copy doesn't, and every other mounted copy of those
hooks (the account menu's badge, the contacts page) reuses the request one
copy already made in the same 30-second tick.`},{heading:`a-bar-across-the-top-shows-a-page-switch-in-progress`,content:`Every page transition, from a dock icon, any in-app link, or back and
forward, shows a slim bar across the top of the window in the theme's primary
colour, like YouTube's. It creeps forward while the next page loads, fills
when the new page has painted, and fades out. Switches that land within
150 ms never show it, and with reduced motion turned on it moves without
animating.`},{heading:`a-bar-across-the-top-shows-a-page-switch-in-progress`,content:"**Bar:** `packages/debate-webview/src/components/ui/RouteProgressBar.tsx`"},{heading:`a-bar-across-the-top-shows-a-page-switch-in-progress`,content:"**Pacing and state:** `packages/debate-webview/src/lib/ui/route-progress.ts`"},{heading:`a-bar-across-the-top-shows-a-page-switch-in-progress`,content:"**Start and finish signals:** `packages/debate-webview/src/lib/ui/use-route-loading.ts`"},{heading:`a-bar-across-the-top-shows-a-page-switch-in-progress`,content:"The full-screen loading orb no longer shows for page transitions; it is left\nfor code that asks for it with `beginLoading`."},{heading:`known-gaps`,content:"`/debate` (the flow workspace) and `/research/docs` (the research agent)\nstill draw their own full-height workspace sidebars instead of the shared\none, so they have no resize handle or hide button of their own design and\ntheir contents are not yet sections of the shared column."},{heading:`known-gaps`,content:`A hidden dock's tab does not reveal it on a pen or a touch screen that
reports hover; it opens on a tap there too, and a tap elsewhere does not fold
it again until the next navigation or a second tap on the tab.`},{heading:`known-gaps`,content:`On \`/docs\` the docs' search box sits in Fumadocs' header, not in the shared
column, and with the sidebar hidden the docs have no dock (the docs don't
mount the floating one).`}],headings:[{id:`app-nav-dock-and-tool-sidebar`,content:`App nav dock and tool sidebar`},{id:`what-it-shows`,content:`What it shows`},{id:`the-sidebar-button-mobile`,content:`The sidebar button (mobile)`},{id:`the-desktop-sidebars-footer`,content:`The desktop sidebar's footer`},{id:`two-menus-not-one`,content:`Two menus, not one`},{id:`hiding-the-dock`,content:`Hiding the dock`},{id:`where-it-renders`,content:`Where it renders`},{id:`search-floats-over-the-results`,content:`Search floats over the results`},{id:`results-open-as-rows`,content:`Results open as rows`},{id:`one-sidebar-everywhere`,content:`One sidebar everywhere`},{id:`resizing-the-sidebar`,content:`Resizing the sidebar`},{id:`hiding-the-sidebar`,content:`Hiding the sidebar`},{id:`staying-inside-the-sidebar`,content:`Staying inside the sidebar`},{id:`the-nav-trees-headings`,content:`The nav tree's headings`},{id:`every-tool-has-an-icon`,content:`Every tool has an icon`},{id:`tests`,content:`Tests`},{id:`all-videos-is-the-home-page`,content:`All Videos is the home page`},{id:`one-collection-highlighted-at-a-time`,content:`One collection highlighted at a time`},{id:`the-highlighted-row-scrolls-into-view`,content:`The highlighted row scrolls into view`},{id:`the-feature-catalog-opens-inside-the-app`,content:`The feature catalog opens inside the app`},{id:`switching-pages-is-a-react-render-not-a-frame-load`,content:`Switching pages is a React render, not a frame load`},{id:`a-bar-across-the-top-shows-a-page-switch-in-progress`,content:`A bar across the top shows a page switch in progress`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#app-nav-dock-and-tool-sidebar`,title:(0,t.jsx)(t.Fragment,{children:`App nav dock and tool sidebar`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#the-sidebar-button-mobile`,title:(0,t.jsx)(t.Fragment,{children:`The sidebar button (mobile)`})},{depth:2,url:`#the-desktop-sidebars-footer`,title:(0,t.jsx)(t.Fragment,{children:`The desktop sidebar's footer`})},{depth:2,url:`#two-menus-not-one`,title:(0,t.jsx)(t.Fragment,{children:`Two menus, not one`})},{depth:2,url:`#hiding-the-dock`,title:(0,t.jsx)(t.Fragment,{children:`Hiding the dock`})},{depth:2,url:`#where-it-renders`,title:(0,t.jsx)(t.Fragment,{children:`Where it renders`})},{depth:2,url:`#search-floats-over-the-results`,title:(0,t.jsx)(t.Fragment,{children:`Search floats over the results`})},{depth:2,url:`#results-open-as-rows`,title:(0,t.jsx)(t.Fragment,{children:`Results open as rows`})},{depth:2,url:`#one-sidebar-everywhere`,title:(0,t.jsx)(t.Fragment,{children:`One sidebar everywhere`})},{depth:2,url:`#resizing-the-sidebar`,title:(0,t.jsx)(t.Fragment,{children:`Resizing the sidebar`})},{depth:2,url:`#hiding-the-sidebar`,title:(0,t.jsx)(t.Fragment,{children:`Hiding the sidebar`})},{depth:2,url:`#staying-inside-the-sidebar`,title:(0,t.jsx)(t.Fragment,{children:`Staying inside the sidebar`})},{depth:2,url:`#the-nav-trees-headings`,title:(0,t.jsx)(t.Fragment,{children:`The nav tree's headings`})},{depth:3,url:`#every-tool-has-an-icon`,title:(0,t.jsx)(t.Fragment,{children:`Every tool has an icon`})},{depth:2,url:`#tests`,title:(0,t.jsx)(t.Fragment,{children:`Tests`})},{depth:2,url:`#all-videos-is-the-home-page`,title:(0,t.jsx)(t.Fragment,{children:`All Videos is the home page`})},{depth:2,url:`#one-collection-highlighted-at-a-time`,title:(0,t.jsx)(t.Fragment,{children:`One collection highlighted at a time`})},{depth:2,url:`#the-highlighted-row-scrolls-into-view`,title:(0,t.jsx)(t.Fragment,{children:`The highlighted row scrolls into view`})},{depth:2,url:`#the-feature-catalog-opens-inside-the-app`,title:(0,t.jsx)(t.Fragment,{children:`The feature catalog opens inside the app`})},{depth:2,url:`#switching-pages-is-a-react-render-not-a-frame-load`,title:(0,t.jsx)(t.Fragment,{children:`Switching pages is a React render, not a frame load`})},{depth:2,url:`#a-bar-across-the-top-shows-a-page-switch-in-progress`,title:(0,t.jsx)(t.Fragment,{children:`A bar across the top shows a page switch in progress`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`app-nav-dock-and-tool-sidebar`,children:`App nav dock and tool sidebar`}),`
`,(0,t.jsx)(n.p,{children:`The macOS-style icon dock that carries the app's top-level destinations, and
the sidebar column that hosts it on every tool route.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Component:`}),` `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/components/layout/CategoryDock.tsx`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Sidebar shell:`}),` `,(0,t.jsx)(n.code,{children:`packages/debate-webview/src/components/layout/AppSidebarShell.tsx`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`The one sidebar column:`}),` `,(0,t.jsx)(n.code,{children:`packages/debate-videos/src/ui/layout/ResizableSidebarLayout.tsx`}),`
(hide/show state in `,(0,t.jsx)(n.code,{children:`sidebar-collapse.ts`}),` beside it), filled by
`,(0,t.jsx)(n.code,{children:`packages/debate-webview/src/components/layout/app-sidebar/`}),` off the video pages`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`The tree in it:`}),` `,(0,t.jsx)(n.code,{children:`VideoSidebarTree`}),`, mounted off the video pages through
`,(0,t.jsx)(n.code,{children:`LibrarySidebarTree`}),` (`,(0,t.jsx)(n.code,{children:`packages/debate-videos/src/components/category-gallery/`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route predicates:`}),` `,(0,t.jsx)(n.code,{children:`packages/debate-videos/src/components/category-gallery/sidebar-routes.ts`}),`
(re-exported for app code as `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/sidebar-routes.ts`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Dock primitive:`}),` `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/ui/layout/dock.tsx`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Five destinations \u2014 Videos, Shared, Debate, Practice vs AI, Research \u2014 plus a
gear-icon Settings menu, with `,(0,t.jsx)(n.code,{children:`Alt+1`}),`\u2026`,(0,t.jsx)(n.code,{children:`Alt+5`}),` shortcuts in dock order. The
icons carry no hover labels \u2014 in the sidebar-hosted dock the tooltips crowded
together over the nav tree \u2014 so each item's name lives in its `,(0,t.jsx)(n.code,{children:`aria-label`}),`
(read by screen readers) and in the icon art itself.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Practice vs AI opens a menu instead of navigating.`}),` A plain click on that
icon does not go to `,(0,t.jsx)(n.code,{children:`/practice/versus-ai`}),` \u2014 it opens the site-nav menu described below
(`,(0,t.jsx)(n.code,{children:`NavMenu`}),`, in `,(0,t.jsx)(n.code,{children:`CategoryDock.tsx`}),`). The page itself is still one tap away, as
the first tool listed under that menu's Practice section, and the `,(0,t.jsx)(n.code,{children:`Alt+4`}),`
shortcut still jumps straight there.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Tools are not dock icons.`}),` The tools catalog is reached from the sidebar
nav tree's Research / Practice / Coaching / Insights
sections, and the whole feature
catalog from the `,(0,t.jsx)(n.strong,{children:`Features`}),` row in the Settings menu's Site Links submenu \u2014
next to a `,(0,t.jsx)(n.strong,{children:`Docs`}),` row for the help site. Holding the dock to five
destinations is what lets it fit inside the sidebar column it is hosted in \u2014
see below.`]}),`
`,(0,t.jsx)(n.h2,{id:`the-sidebar-button-mobile`,children:`The sidebar button (mobile)`}),`
`,(0,t.jsxs)(n.p,{children:[`The sidebar is `,(0,t.jsx)(n.code,{children:`md+`}),` only, so the mobile bottom dock starts with a `,(0,t.jsx)(n.strong,{children:`Sidebar`}),`
button. It opens a left drawer (`,(0,t.jsx)(n.code,{children:`MobileSidebarDrawer`}),`) whose content follows
the view in the centre (`,(0,t.jsx)(n.code,{children:`mobileSidebarKind`}),`, `,(0,t.jsx)(n.code,{children:`lib/mobile-sidebar.ts`}),`):`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`View`}),(0,t.jsx)(n.th,{children:`Drawer`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsxs)(n.td,{children:[`Video library (`,(0,t.jsx)(n.code,{children:`/videos`}),`, `,(0,t.jsx)(n.code,{children:`/lectures`}),`, glossary, rankings, statistics)`]}),(0,t.jsx)(n.td,{children:`The sidebar tree (Videos, tool sections) and footer`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`/research/cards`}),`, `,(0,t.jsx)(n.code,{children:`/reason-editor`})]}),(0,t.jsx)(n.td,{children:`Document panels above the sidebar tree`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/debate`})}),(0,t.jsxs)(n.td,{children:[`Its own flows/rounds sidebar \u2014 the button dispatches `,(0,t.jsx)(n.code,{children:`debate:open-sidebar`}),` and the workspace opens its own sheet`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Everything else`}),(0,t.jsx)(n.td,{children:`The sidebar tree and footer`})]})]})]}),`
`,(0,t.jsx)(n.p,{children:`The drawer closes on navigation.`}),`
`,(0,t.jsx)(n.h2,{id:`the-desktop-sidebars-footer`,children:`The desktop sidebar's footer`}),`
`,(0,t.jsxs)(n.p,{children:[`On `,(0,t.jsx)(n.code,{children:`md+`}),` the column has no brand row at the top \u2014 it opens straight onto the
dock. Its bottom row, pinned under the scrolling tree, is the account menu
(on every page, the video library's included) with the `,(0,t.jsx)(n.strong,{children:`hide button`}),` beside
it \u2014 see `,(0,t.jsx)(n.a,{href:`#hiding-the-sidebar`,children:`Hiding the sidebar`}),`. The row shows your avatar
and name only, never your email address, with a badge on the avatar counting
unread notifications. The account menu holds Settings, a `,(0,t.jsx)(n.strong,{children:`Notifications`}),`
submenu (every unread notification: pick one to open its link and clear it, X
to clear it in place, `,(0,t.jsx)(n.strong,{children:`Clear all`}),`, and a link to `,(0,t.jsx)(n.code,{children:`/notifications`}),`; clearing
is the page's mark-as-read), an `,(0,t.jsx)(n.strong,{children:`Organizations`}),` submenu (switch between Personal
and your organizations, or create one \u2014 see
`,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/contacts#organizations`,children:`Contacts`}),`), a `,(0,t.jsx)(n.strong,{children:`Theme`}),` submenu
(Light / Dark / System and every colour theme, with swatches \u2014 the same picker
as the dock's Settings menu, and synced to the account the same way), a
`,(0,t.jsx)(n.strong,{children:`Site links`}),` submenu (every `,(0,t.jsx)(n.code,{children:`FOOTER_LINKS`}),` entry: Docs, GitHub, Support,
Privacy, Reddit\u2026) and Sign out. Signed out, the row is a Sign in button with a
globe button beside it that lists the same site links.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Docs`}),` and `,(0,t.jsx)(n.strong,{children:`Settings`}),` are always on screen just above the account row, on
every page, signed in or out and whatever is selected, so you never have to
open a menu to reach them. The phone drawer ends with the same two links.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The other site links used to be a row of links above the account row; they
live in the account menu now. The phone layouts below `,(0,t.jsx)(n.code,{children:`md`}),`, which have no
account row, keep their footer.`]}),`
`,(0,t.jsx)(n.h2,{id:`two-menus-not-one`,children:`Two menus, not one`}),`
`,(0,t.jsxs)(n.p,{children:[`The dock carries two independent dropdowns, each with its own `,(0,t.jsx)(n.code,{children:`DropdownMenu`}),`
root \u2014 opening one does not affect the other, and either can be open at once:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsxs)(n.strong,{children:[`The Practice vs AI icon opens the site-nav menu (`,(0,t.jsx)(n.code,{children:`NavMenu`}),`).`]}),` Command
Palette at the top, then a submenu per sidebar section \u2014 `,(0,t.jsx)(n.strong,{children:`Videos,
Research, Practice, Coaching, Insights`}),` \u2014 derived from the data the sidebar itself
renders rather than restated:`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Menu submenu`}),(0,t.jsx)(n.th,{children:`Comes from`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Videos`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`SIDEBAR_VIDEO_LINKS`}),` (`,(0,t.jsx)(n.code,{children:`components/category-gallery/sidebar-video-links.ts`}),`), minus the glossary and topic & video statistics, which are listed under Insights instead`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Research / Practice / Coaching / Insights`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`SIDEBAR_TOOL_SECTIONS`})})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`On a phone, where the sidebar column below is `,(0,t.jsx)(n.code,{children:`md+`}),` only, this menu is the
only way to reach those links at all.`]}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsxs)(n.strong,{children:[`The gear icon opens `,(0,t.jsx)(n.code,{children:`SettingsMenu`})]}),` \u2014 Settings, the light/dark toggle
and Theme submenu, `,(0,t.jsx)(n.strong,{children:`Hide Dock`}),` (see `,(0,t.jsx)(n.a,{href:`#hiding-the-dock`,children:`Hiding the dock`}),`),
one Site Links submenu listing every footer link
(site and debate-community links together, from `,(0,t.jsx)(n.code,{children:`FOOTER_LINKS`}),`),
and the account block.`]}),`
`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`There is no "Apps" submenu.`}),` The site-nav menu used to restate the dock's
own five icons as text and then hang the whole feature catalog underneath,
one nested submenu per category \u2014 a second, deeper copy of `,(0,t.jsx)(n.code,{children:`/practice/features`}),`
hanging off the dock that was already showing those five icons. One
`,(0,t.jsx)(n.strong,{children:`Features`}),` row reaches the catalog instead, and a `,(0,t.jsx)(n.strong,{children:`Docs`}),` row the help
site; both are footer links, so the sidebar's link rows carry them too.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/nav/dock-menu-sections.ts`}),` does the site-nav menu's
composition, and `,(0,t.jsx)(n.code,{children:`lib/nav/__tests__/dock-menu-sections.test.ts`}),` fails if a
sidebar destination is missing from it. That coupling is the point: the
Videos links and the glossary/rankings pair below the tree were in the
sidebar and in no mobile menu at all, because the menu was a hand-kept list.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Both menus scroll (`,(0,t.jsx)(n.code,{children:`max-h-[min(560px,80vh)]`}),`) \u2014 `,(0,t.jsx)(n.code,{children:`SettingsMenu`}),`'s theme/links
block above the account rows can still run past a phone viewport.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Wiring the Practice vs AI icon to a second `,(0,t.jsx)(n.code,{children:`DropdownMenu`}),` root, rather than
sharing the gear's, means it sits `,(0,t.jsx)(n.em,{children:`inside`}),` `,(0,t.jsx)(n.code,{children:`Dock`}),`'s children instead of
wrapping the whole dock \u2014 so `,(0,t.jsx)(n.code,{children:`Dock`}),`'s magnification props land on the
wrapper component instead of the `,(0,t.jsx)(n.code,{children:`DockItem`}),` two levels down.
`,(0,t.jsx)(n.code,{children:`PracticeVsAiTrigger`}),` forwards `,(0,t.jsx)(n.code,{children:`mousex`}),`/`,(0,t.jsx)(n.code,{children:`magnification`}),`/`,(0,t.jsx)(n.code,{children:`distance`}),`/`,(0,t.jsx)(n.code,{children:`iconSize`}),`
by hand so that icon still resizes and tracks the cursor like its siblings.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/videos`}),` additionally prints the tree inline in its own `,(0,t.jsx)(n.code,{children:`md:hidden`}),` block,
under the quick-link tiles: the tiles are the Videos section only, so
`,(0,t.jsx)(n.code,{children:`ToolNavTree`}),` follows them with `,(0,t.jsx)(n.code,{children:`defaultExpanded={false}`}),` (its sections start
collapsed there \u2014 expanded, forty rows would push the video grid off the
screen).`]}),`
`,(0,t.jsx)(n.h2,{id:`hiding-the-dock`,children:`Hiding the dock`}),`
`,(0,t.jsxs)(n.p,{children:[`Choose `,(0,t.jsx)(n.strong,{children:`Hide Dock`}),` in the gear menu and the row of app icons folds away to a
small arrow tab where it sat: hanging down from the top-left corner or the top
of the sidebar, or rising from the bottom of the screen on a phone. Hover the
tab (or Tab to it from the keyboard, or tap it on a touch screen) and the full
dock slides back over it; move away and it folds up again. It stays out while
one of its menus is open, so the same menu's `,(0,t.jsx)(n.strong,{children:`Show Dock`}),` row puts it back
for good. The choice holds on every page and is remembered in this browser
(`,(0,t.jsx)(n.code,{children:`app-dock-hidden`}),` in localStorage, broadcast by
`,(0,t.jsx)(n.code,{children:`packages/debate-webview/src/lib/nav/dock-hidden.ts`}),` so every dock instance
agrees).`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`CollapsibleDock`}),` in `,(0,t.jsx)(n.code,{children:`CategoryDock.tsx`}),` does the folding. Shown, it renders
the dock untouched. Hidden, it keeps the dock mounted inside an absolutely
positioned, transparent panel over the tab, and reveals it with CSS alone:
`,(0,t.jsx)(n.code,{children:`group-hover`}),`, keyboard focus inside (`,(0,t.jsx)(n.code,{children:`:focus-visible`}),`, so a mouse click that
leaves focus on an icon does not pin it open), a tap on the tab, or a dock
menu trigger with `,(0,t.jsx)(n.code,{children:`data-state=open`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`where-it-renders`,children:`Where it renders`}),`
`,(0,t.jsxs)(n.p,{children:[`The dock has two forms, and which one a route gets is decided by
`,(0,t.jsx)(n.code,{children:`hasEmbeddedDock`}),`:`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsxs)(n.strong,{children:[`Sidebar-hosted (`,(0,t.jsx)(n.code,{children:`<CategoryDock embedded />`}),`).`]}),` On `,(0,t.jsx)(n.code,{children:`/videos`}),` (whose own
`,(0,t.jsx)(n.code,{children:`<aside>`}),` takes it through `,(0,t.jsx)(n.code,{children:`LecturesVideoGridView`}),`'s `,(0,t.jsx)(n.code,{children:`dockSlot`}),`) and on every
route the tool-nav tree links to (where `,(0,t.jsx)(n.code,{children:`AppSidebarShell`}),` wraps the page in
the generic sidebar), the dock sits at the top of that column (300px wide until you
drag it \u2014 see `,(0,t.jsx)(n.a,{href:`#resizing-the-sidebar`,children:`Resizing the sidebar`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/doc`}),` is the exception: the Docs button opens the research agent, which draws
its own full-height workspace. Its sidebar \u2014 the files tree and the "Open Tabs"
list \u2014 is the research agent's own, not the generic tool sidebar, and the dock
sits at the top of that column (`,(0,t.jsx)(n.code,{children:`OWN_SIDEBAR_DOCK_HREFS`}),`, in
`,(0,t.jsx)(n.code,{children:`packages/debate-videos/src/components/category-gallery/sidebar-routes.ts`}),`).
The research agent's own app dock is never mounted here (it is the host's to
draw), and on a phone the dock's `,(0,t.jsx)(n.strong,{children:`Sidebar`}),` button opens the agent's sidebar
(the `,(0,t.jsx)(n.code,{children:`OPEN_OWN_SIDEBAR_EVENT`}),` window event, the same one `,(0,t.jsx)(n.code,{children:`/debate`}),` listens for).
Choosing `,(0,t.jsx)(n.strong,{children:`Settings`}),` in the dock's menu from `,(0,t.jsx)(n.code,{children:`/doc`}),` opens `,(0,t.jsx)(n.code,{children:`/settings`}),` on the
research agent's first tab (`,(0,t.jsx)(n.code,{children:`?category=research-account`}),`); from anywhere else it
opens `,(0,t.jsx)(n.code,{children:`/settings`}),` on its first tab. Either way the agent's sections and the app's
own share one sidebar.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The Research button was called `,(0,t.jsx)(n.strong,{children:`Docs`}),` and lived at `,(0,t.jsx)(n.code,{children:`/doc`}),` until October
2026. Old `,(0,t.jsx)(n.code,{children:`/doc`}),` and `,(0,t.jsx)(n.code,{children:`/doc/<document>`}),` links answer with a permanent (308)
redirect to `,(0,t.jsx)(n.code,{children:`/research/docs`}),` and `,(0,t.jsx)(n.code,{children:`/research/docs/<document>`}),`, from the same
table as the other category moves
(`,(0,t.jsx)(n.code,{children:`packages/debate-data-sync/src/routes/category-paths.ts`}),`). It sits under
`,(0,t.jsx)(n.code,{children:`/research/docs`}),` rather than `,(0,t.jsx)(n.code,{children:`/research`}),` because `,(0,t.jsx)(n.code,{children:`/research`}),` is the Research
Workspace hub.`]}),`
`,(0,t.jsxs)(n.p,{children:[`That now includes `,(0,t.jsx)(n.code,{children:`/practice/rankings`}),` and `,(0,t.jsx)(n.code,{children:`/practice/glossary`}),`. Both are rows
in the sidebar's own tree, and both used to answer with a bare page \u2014 no
sidebar, and no fixed dock either, since every `,(0,t.jsx)(n.code,{children:`/videos`}),` path counts as
already carrying a sidebar-hosted one. `,(0,t.jsx)(n.code,{children:`LecturesSidebarShell`}),` wraps them in
the same column (dock, nav tree, footer), so clicking either link leaves the
nav exactly where it was.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The sidebar is `,(0,t.jsx)(n.code,{children:`md+`}),` only, though, and the same rule that hides the fixed dock
hides its mobile bottom bar. So on a phone those two pages still answered with
nothing to navigate by. `,(0,t.jsx)(n.code,{children:`LecturesSidebarShell`}),` now also renders the `,(0,t.jsx)(n.code,{children:`md:hidden`}),`
block the grid renders \u2014 the quick-link tiles, the tool tree (collapsed) and
the footer \u2014 so the pair has a way out of it at every width.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Fixed fallback.`}),` Everywhere else \u2014 the home page, `,(0,t.jsx)(n.code,{children:`/login`}),`, `,(0,t.jsx)(n.code,{children:`/legal/*`}),` \u2014
it renders fixed in the top-left corner on desktop and as a bottom bar on
mobile. The two never show at once.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Route matching is by path `,(0,t.jsx)(n.em,{children:`prefix`}),`, so a nested route under a tree entry
(`,(0,t.jsx)(n.code,{children:`/research/cards/awards`}),` under `,(0,t.jsx)(n.code,{children:`/research/cards`}),`, a document route under `,(0,t.jsx)(n.code,{children:`/research/docs`}),`) keeps the
sidebar rather than dropping to the fixed dock. The trailing `,(0,t.jsx)(n.code,{children:`/`}),` in the
comparison keeps `,(0,t.jsx)(n.code,{children:`/cardsy`}),` from matching `,(0,t.jsx)(n.code,{children:`/cards`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`search-floats-over-the-results`,children:`Search floats over the results`}),`
`,(0,t.jsx)(n.p,{children:`The search box, the season and style filters, the sort and the grid/rows
toggle used to sit in the sidebar on a desktop and in a bar above the results
on a phone \u2014 two copies, which is why a half-typed query seemed to disappear
when a window was resized across the breakpoint.`}),`
`,(0,t.jsx)(n.p,{children:`There is one now, and it is not in the sidebar: a small magnifier in the
top-right corner of the results, which follows them as you scroll. Hover it on
a desktop, tap it on a phone, or Tab to it, and the whole control opens over
the results. It stays open while you are typing in it or while a search is
active, and closes on Escape or a click outside. Whatever you typed is still
there the next time you open it.`}),`
`,(0,t.jsxs)(n.p,{children:[`That is also what lets the sidebar stay the same on `,(0,t.jsx)(n.code,{children:`/practice/glossary`}),` and
`,(0,t.jsx)(n.code,{children:`/practice/rankings`}),`, which have nothing to search: the column is now the same
column everywhere in the library.`]}),`
`,(0,t.jsx)(n.h2,{id:`results-open-as-rows`,children:`Results open as rows`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/videos`}),` opens as the dense row list rather than the thumbnail grid \u2014 about
four times as many results per screen. The grid is one toggle away inside the
search panel. The choice is not remembered between page loads.`]}),`
`,(0,t.jsx)(n.h2,{id:`one-sidebar-everywhere`,children:`One sidebar everywhere`}),`
`,(0,t.jsxs)(n.p,{children:[`Every view draws the same sidebar: the one the video pages always had \u2014 the
dock, then `,(0,t.jsx)(n.strong,{children:`Videos`}),` and the Research / Practice /
Coaching / Insights sections, then the footer links. The tool and
research pages, `,(0,t.jsx)(n.code,{children:`/admin`}),`, the legal pages and the help docs used to get a
different column (shadcn's `,(0,t.jsx)(n.code,{children:`sidebar-07`}),`, tool sections only), and `,(0,t.jsx)(n.code,{children:`/docs`}),`
showed Fumadocs' own sidebar beside that one. Now:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Off the video pages`}),` `,(0,t.jsx)(n.code,{children:`AppSidebarShell`}),` wraps the page in the same
`,(0,t.jsx)(n.code,{children:`ResizableSidebarLayout`}),` the video pages use, and `,(0,t.jsx)(n.code,{children:`LibrarySidebarTree`}),`
mounts the same `,(0,t.jsx)(n.code,{children:`VideoSidebarTree`}),`, reading the library's counts itself
(`,(0,t.jsx)(n.code,{children:`useVideoMeta`}),`).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Page-specific panels are sections of it.`}),` The REASON document panels
sit above the tree on `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` and are the whole column on
`,(0,t.jsx)(n.code,{children:`/research/cards`}),`, as before.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsxs)(n.strong,{children:[`On `,(0,t.jsx)(n.code,{children:`/docs`}),` the docs' page tree is a section of it.`]}),` `,(0,t.jsx)(n.code,{children:`debate-help-docs`}),`'
layouts portal the page tree (`,(0,t.jsx)(n.code,{children:`app-sidebar-docs-tree.tsx`}),`) into a slot the
column leaves for it (`,(0,t.jsx)(n.code,{children:`DOCS_SIDEBAR_SLOT_ID`}),`), at the bottom of the column
below the Insights section, and `,(0,t.jsx)(n.code,{children:`styles/docs.css`}),` hides
Fumadocs' desktop sidebar and closes its grid column. Below `,(0,t.jsx)(n.code,{children:`md`}),` Fumadocs'
drawer is still the docs' navigation. Only the folders on the path to
the current page start expanded, and the current page is scrolled into
view when the docs open and after each navigation.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsxs)(n.strong,{children:[`Off `,(0,t.jsx)(n.code,{children:`/docs`})]}),` the tree is not drawn; the Docs and Settings links
pinned above the account row (`,(0,t.jsx)(n.code,{children:`SidebarPinnedLinks`}),`) reach it from every
page.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`The mobile drawer`}),` shows the same tree (`,(0,t.jsx)(n.code,{children:`MobileSidebarDrawer`}),`).`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/debate`}),` and `,(0,t.jsx)(n.code,{children:`/research/docs`}),` keep their own workspace sidebars
(`,(0,t.jsx)(n.code,{children:`ownsItsLayout`}),`) \u2014 see Known gaps.`]}),`
`,(0,t.jsx)(n.h2,{id:`resizing-the-sidebar`,children:`Resizing the sidebar`}),`
`,(0,t.jsx)(n.p,{children:`On every page with the sidebar, drag the thin line on the sidebar's right edge to make the column
wider or narrower (between 220px and 640px). The width you choose is remembered
in this browser and every page opens the sidebar at that same width, so the
column keeps its shape as you move between them. Double-click the
line to put it back to its default 300px. The line also takes keyboard focus,
and the arrow keys resize it.`}),`
`,(0,t.jsx)(n.h2,{id:`hiding-the-sidebar`,children:`Hiding the sidebar`}),`
`,(0,t.jsxs)(n.p,{children:[`Hide the sidebar with the panel button at its bottom-right, by pressing
`,(0,t.jsx)(n.strong,{children:`Ctrl+B`}),` (`,(0,t.jsx)(n.strong,{children:`\u2318B`}),` on a Mac), or by dragging its edge past half its minimum
width. It collapses to nothing and the page takes the full width. A small tab
on the left edge of the window brings it back, as do the same shortcut and
dragging the edge back out. The choice holds on every page and is remembered
in this browser (`,(0,t.jsx)(n.code,{children:`app-sidebar-collapsed`}),` in localStorage; `,(0,t.jsx)(n.code,{children:`sidebar-collapse.ts`}),`
broadcasts it, so the column and the dock always agree).`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Peeking.`}),` While the sidebar is hidden, move the pointer to the very left
edge of the window (within 8px) and it slides out `,(0,t.jsx)(n.em,{children:`over`}),` the page \u2014 slightly
translucent, at your usual width \u2014 without pushing the page aside. Move away
from it and it slides back after a moment (or press Esc); it stays hidden
until you pin it with the panel button at its foot, which reads `,(0,t.jsx)(n.strong,{children:`Keep
sidebar open`}),` while peeking. A menu opened from it (the account menu) keeps
it out until the menu closes. Each time it comes or goes it plays one of ten
animations at random (slide, elastic, wiggle, zoom, flip, bounce, swing, drop,
blur or jelly), and none if your system asks for reduced motion.
(`,(0,t.jsx)(n.code,{children:`ResizableSidebarLayout`}),`: a `,(0,t.jsx)(n.code,{children:`pointermove`}),`
listener while collapsed restyles the same `,(0,t.jsx)(n.code,{children:`<aside>`}),` as a fixed overlay, so
the content panel never resizes.)`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Pages with their own sidebar.`}),` The flow workspace (`,(0,t.jsx)(n.code,{children:`/debate`}),`) and the
research docs (`,(0,t.jsx)(n.code,{children:`/research/docs`}),`) draw a sidebar of their own, so there the app
sidebar starts hidden and theirs is the only one on screen. It still peeks
from the left edge, and pinning it keeps it open until you leave the page; it
doesn't change whether the sidebar is hidden anywhere else.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Icons that move.`}),` This is on by default; turn off `,(0,t.jsx)(n.strong,{children:`Animate sidebar
icons`}),` in Settings \u2192 Preferences to stop it. Hovering a row in the sidebar, or
tabbing to it (the icon or its label), makes its icon wiggle, bounce, pulse,
spin, shake, flip, jelly or tada, a different one from the last time, for
either half a second or a full second, and tints it a random color while it
plays. Each icon plays at most once every three seconds. The research docs' own
sidebar does the same. If your system asks for reduced motion, the icon only
changes color.`]}),`
`,(0,t.jsxs)(n.p,{children:[`While the sidebar is hidden the dock it carried floats at the top-left
instead (`,(0,t.jsx)(n.code,{children:`CategoryDock`}),` lifts its suppression while `,(0,t.jsx)(n.code,{children:`useSidebarCollapsed()`}),`
is true), so the five destinations stay one click away.`]}),`
`,(0,t.jsxs)(n.p,{children:[`While a text editor has the keyboard (CardMirror, the REASON editor, any text
field), Ctrl/\u2318+B stays `,(0,t.jsx)(n.strong,{children:`bold`}),` and does not toggle the sidebar.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Each tree section (Videos, Research, Practice, Coaching,
Insights) opens and closes on its own; see
`,(0,t.jsx)(n.a,{href:`#the-nav-trees-headings`,children:`The nav tree's headings`}),`. The Docs, Github, Support,
Privacy and Reddit links sit on one compact line after the last section and
scroll with the list rather than staying pinned. Docs and Settings are pinned at the
bottom above the account menu, which links to
Settings, Notifications and Contacts and signs you out. Signed out, that row
is a `,(0,t.jsx)(n.strong,{children:`Sign in`}),` button that opens the sign-in dialog without leaving the
page.`]}),`
`,(0,t.jsxs)(n.p,{children:[`On a phone nothing changes: the sidebar is not drawn below the `,(0,t.jsx)(n.code,{children:`md`}),`
breakpoint, and the dock's `,(0,t.jsx)(n.strong,{children:`Sidebar`}),` button still opens the drawer described
above.`]}),`
`,(0,t.jsx)(n.h2,{id:`staying-inside-the-sidebar`,children:`Staying inside the sidebar`}),`
`,(0,t.jsxs)(n.p,{children:[`A dock sized to its own contents (`,(0,t.jsx)(n.code,{children:`w-max`}),`, the default `,(0,t.jsx)(n.code,{children:`fluid: false`}),` form)
is wider than the sidebar at its default 300px. Hosted there it
either forced the sidebar to scroll sideways or reached over its border onto
the page beside it \u2014 which on `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` and `,(0,t.jsx)(n.code,{children:`/research/docs`}),` is a CardMirror
editor.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The sidebar-hosted form passes `,(0,t.jsx)(n.code,{children:`fluid`}),` to `,(0,t.jsx)(n.code,{children:`Dock`}),`, which:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`takes its width from the column (`,(0,t.jsx)(n.code,{children:`w-full max-w-full min-w-0`}),`) instead of
from the item count, and`]}),`
`,(0,t.jsxs)(n.li,{children:[`wraps an overflowing row onto a second line (`,(0,t.jsx)(n.code,{children:`flex-wrap`}),`) instead of
growing past the column, so a future sixth or seventh destination still
cannot escape it.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`CategoryDock`}),` also shrinks the icons for that form: `,(0,t.jsx)(n.code,{children:`EMBEDDED_ICON_SIZE`}),`
(34px) at rest and `,(0,t.jsx)(n.code,{children:`EMBEDDED_MAGNIFICATION`}),` (46px) hovered. Six items at 34px
with `,(0,t.jsx)(n.code,{children:`gap-1.5`}),` and `,(0,t.jsx)(n.code,{children:`p-2`}),` come to 250px against 276px of usable column width,
and a magnified icon adds 12px more \u2014 so the row fits without wrapping at
every breakpoint, and the wrapping above is the backstop rather than the
normal case.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The dock stays `,(0,t.jsx)(n.code,{children:`overflow-visible`}),` so a magnified icon isn't clipped at the
dock's edge; the sidebar column is the clipping boundary.`]}),`
`,(0,t.jsx)(n.h2,{id:`the-nav-trees-headings`,children:`The nav tree's headings`}),`
`,(0,t.jsxs)(n.p,{children:[`Below the dock, the same column carries the nav tree
(`,(0,t.jsx)(n.code,{children:`VideoSidebarTree`}),` on `,(0,t.jsx)(n.code,{children:`/videos`}),`, its `,(0,t.jsx)(n.code,{children:`ToolNavTree`}),` tail everywhere else).
It is three levels deep:`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Level`}),(0,t.jsx)(n.th,{children:`Element`}),(0,t.jsx)(n.th,{children:`What it is`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`1`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`h1`})}),(0,t.jsx)(n.td,{children:`A top-level section: Videos, Coaching, Research, Practice`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`2`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`h2`})}),(0,t.jsx)(n.td,{children:`A subgroup inside one \u2014 College Policy, Favorites, Lectures`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`3`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`span`})}),(0,t.jsx)(n.td,{children:`A leaf link: a tool, a debate format`})]})]})]}),`
`,(0,t.jsx)(n.p,{children:`Two rules hold for every h1:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`It is not a link.`}),` The row renders without an `,(0,t.jsx)(n.code,{children:`href`}),`, so clicking it
does nothing but toggle the section. Each section's flagship tool is the
first link `,(0,t.jsx)(n.em,{children:`inside`}),` it (`,(0,t.jsx)(n.code,{children:`/coaching`}),` under Coaching), so nothing became
unreachable \u2014 a click on the heading no longer navigates away from the page
you are on just because you wanted to see what else is in the group.`]}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`One section is open at a time, and it follows the route.`}),` The tree is an
accordion: opening a section closes the one that was open, and a closed
section renders none of its links. Which one is open comes from the current
path (`,(0,t.jsx)(n.code,{children:`sidebar-active-section.ts`}),`), so clicking an app dock button loads
that destination's section into the sidebar and nothing else. The state is
per-mount, and opening another section by hand still works.`]}),`
`,(0,t.jsxs)(n.p,{children:[`It used to render every section's links up front. That put around fifty
`,(0,t.jsx)(n.code,{children:`next/link`}),`s in the sidebar on `,(0,t.jsx)(n.code,{children:`/videos`}),`, and the router prefetched an RSC
payload for each one the moment the page mounted \u2014 a burst of requests
racing the video feed and its thumbnails on the page that already felt
slowest. The tree links now also pass `,(0,t.jsx)(n.code,{children:`prefetch={false}`}),`, so the ones that
`,(0,t.jsx)(n.em,{children:`are`}),` rendered are fetched on click rather than on sight.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Resolution is longest-match over the links the tree actually renders:
`,(0,t.jsx)(n.code,{children:`/research/cards/library`}),` opens Research, which lists it, and `,(0,t.jsx)(n.code,{children:`/practice/versus-ai`}),` opens
Practice ("Debate Versus AI"). A dock destination in no tool section \u2014
`,(0,t.jsx)(n.code,{children:`/research/cards`}),`, `,(0,t.jsx)(n.code,{children:`/debate`}),`, `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` \u2014 matches nothing and opens
nothing. The dock's Research button (`,(0,t.jsx)(n.code,{children:`/research/docs`}),`) opens Research, by
prefix on the Research Workspace link. `,(0,t.jsx)(n.code,{children:`/research/docs`}),` and `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`
used to sit in Research as "Debate Docs" and "Reason Editor"; they are the
dock's own Research button and a top-level editor, so the rows only restated
what the icons above them already said. Both routes keep their sidebars \u2014
`,(0,t.jsx)(n.code,{children:`/research/docs`}),` through the dock link list, `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` through
`,(0,t.jsx)(n.code,{children:`EXTRA_SIDEBAR_HREFS`}),`, which is what
gives the editor its file-navigation panels.`]}),`
`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`SidebarToolSection.href`}),` outlives the heading link: `,(0,t.jsx)(n.code,{children:`sidebar-routes.ts`}),`
still folds it into the set of paths that get the tool sidebar.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Indentation follows `,(0,t.jsx)(n.em,{children:`nesting`}),`, not `,(0,t.jsx)(n.code,{children:`level`}),` \u2014 each expanded node pads its own
child list \u2014 so a leaf under College Policy sits a step deeper than one
hanging straight off Coaching, wherever in the tree it is.`]}),`
`,(0,t.jsx)(n.h3,{id:`every-tool-has-an-icon`,children:`Every tool has an icon`}),`
`,(0,t.jsx)(n.p,{children:`Each tool in Coaching, Research and Practice shows a small icon of its own
next to its name \u2014 a magnifying glass on Research Workspace, a gavel on Judge
Profiles, swords on Debate Versus AI \u2014 so a long section can be scanned by
shape rather than read line by line.`}),`
`,(0,t.jsx)(n.p,{children:`They are all drawn in the same muted grey as the section headings above them,
at the same 16px, on purpose: the icons are there to tell the rows apart, not
to compete with them or with the page you are reading beside the column. The
Glossary and Rankings links at the end of Practice used to be the exception \u2014
full-color artwork sitting among the grey glyphs \u2014 and now match the rest.`}),`
`,(0,t.jsx)(n.h2,{id:`tests`,children:`Tests`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-videos/test/video-sidebar-render.test.tsx`}),` \u2014 the heading
structure above: College Policy under a Videos `,(0,t.jsx)(n.code,{children:`h1`}),`, no `,(0,t.jsx)(n.code,{children:`h1`}),` inside an
anchor, every section a toggle button, and only the section holding the
current route open (with the closed ones rendering none of their links).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-videos/test/sidebar-active-section.test.ts`}),` \u2014 the
route-to-section mapping itself, including the longest-match and
dock-wins-a-tie rules above.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/ui/__tests__/dock.test.tsx`}),` \u2014 the `,(0,t.jsx)(n.code,{children:`fluid`}),` variant's classes,
host-set icon sizing, and that magnification never shrinks an icon below
its resting size.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-videos/test/sidebar-routes.test.ts`}),` \u2014 that `,(0,t.jsx)(n.code,{children:`/tools`}),` is no
longer a dock destination but is still a sidebar one, and the prefix
matching (including `,(0,t.jsx)(n.code,{children:`/cardsy`}),` not matching `,(0,t.jsx)(n.code,{children:`/cards`}),`).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-videos/test/sidebar-video-links.test.tsx`}),` \u2014 that the tree
renders every `,(0,t.jsx)(n.code,{children:`SIDEBAR_VIDEO_LINKS`}),` entry and the mobile quick-link tiles
render all but the glossary/statistics pair, which has no tile and is
reached from the Practice section.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-videos/test/lectures-sidebar-docs-slot.test.tsx`}),` \u2014 that
`,(0,t.jsx)(n.code,{children:`/videos`}),`' `,(0,t.jsx)(n.code,{children:`md:hidden`}),` block carries the tool sections, collapsed.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-videos/test/lectures-sidebar-shell.test.tsx`}),` \u2014 that the
rankings and glossary branches render the dock, the nav tree and the
footer rather than a bare page, on a phone as well as a desktop.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/nav/__tests__/dock-menu-sections.test.ts`}),` \u2014 that
every sidebar destination (videos, tool sections, footer links) is
reachable from the Settings menu, which is the whole nav below `,(0,t.jsx)(n.code,{children:`md`}),`, that
there is no Apps section, and that `,(0,t.jsx)(n.code,{children:`/practice/features`}),` and `,(0,t.jsx)(n.code,{children:`/docs`}),` are reachable.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-videos/test/unified-sidebar.test.tsx`}),` \u2014 that the tree
mounted off the video pages carries the video sections and every tool
section, that the column has a resize handle, a hide button and the footer
it is handed, renders shown on the server, and that the hide/show choice
is stored and broadcast.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-webview/test/lib/layout/frame-navigation.test.ts`}),` \u2014 which
clicks are left to the browser, and which links out of `,(0,t.jsx)(n.code,{children:`/docs`}),` become a
full page load.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-webview/test/lib/nav/dock-hidden.test.ts`}),` \u2014 that the dock
starts shown, the Hide Dock choice is stored, broadcast and cleared, and
still applies to the page when storage is blocked.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-webview/test/lib/nav/dock-idle-prefetch.test.ts`}),` \u2014 which
destinations are warmed in idle time, and that data saver turns it off.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`all-videos-is-the-home-page`,children:`All Videos is the home page`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`All Videos`}),` (`,(0,t.jsx)(n.code,{children:`/videos`}),`) is the first row under `,(0,t.jsx)(n.strong,{children:`Videos`}),` and lists every
round and lecture in the library. It is where `,(0,t.jsx)(n.code,{children:`/`}),` lands. The lecture library
on its own is `,(0,t.jsx)(n.strong,{children:`Lectures`}),` (`,(0,t.jsx)(n.code,{children:`/lectures`}),`), a single row at the end of the same
section. The lecture categories are not in the sidebar: the lectures page
shows them as a bar of cards at its top (see
`,(0,t.jsx)(n.a,{href:`/docs/features/video-library/video-library#lecture-categories`,children:`Lecture categories`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`one-collection-highlighted-at-a-time`,children:`One collection highlighted at a time`}),`
`,(0,t.jsxs)(n.p,{children:[`The sidebar's collections (All Videos, Lectures, College Policy, HS Policy, HS Policy 1v1 (LD),
Public Forum, Greatest of All-Time, My Favorites, Watch History) are one list, and
only the open one is highlighted. `,(0,t.jsx)(n.strong,{children:`Lectures`}),` lights up on every lecture page,
category pages included (`,(0,t.jsx)(n.code,{children:`browsingLectures`}),`), and never alongside a round
collection. `,(0,t.jsx)(n.code,{children:`packages/debate-videos/test/sidebar-single-highlight.test.tsx`}),`
pins it.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Team Rankings stays highlighted on a team or school page.`}),` `,(0,t.jsx)(n.code,{children:`/teams/<team>`}),`
and `,(0,t.jsx)(n.code,{children:`/schools/<school>`}),` are opened from the `,(0,t.jsx)(n.strong,{children:`Team Rankings`}),` row (`,(0,t.jsx)(n.code,{children:`/coaching/rankings`}),`)
rather than nested under it, so a plain path match never lit that row while
reading a profile \u2014 `,(0,t.jsx)(n.code,{children:`ToolNavTree`}),`'s `,(0,t.jsx)(n.code,{children:`isToolActive`}),` treats both prefixes as
still-on-Team-Rankings, the same relationship `,(0,t.jsx)(n.code,{children:`EXTRA_SIDEBAR_HREFS`}),` already
uses to keep the sidebar itself mounted on those pages (see
`,(0,t.jsx)(n.a,{href:`#where-it-renders`,children:`Where it renders`}),` and `,(0,t.jsx)(n.code,{children:`sidebar-routes.ts`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`the-highlighted-row-scrolls-into-view`,children:`The highlighted row scrolls into view`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`TreeItem`}),` scrolls its own row into view (`,(0,t.jsx)(n.code,{children:`scrollIntoView({ block: "nearest" })`}),`) whenever it becomes the highlighted one \u2014 on mount, and on navigating to
a route that lights up a different row. `,(0,t.jsx)(n.code,{children:`"nearest"`}),` moves the sidebar's own
scroll only as far as needed to bring the row on screen, and not at all if it
is already visible, so following a link inside the currently-visible part of
a long section (Practice runs to fifteen-plus rows) never jumps the column.`]}),`
`,(0,t.jsx)(n.h2,{id:`the-feature-catalog-opens-inside-the-app`,children:`The feature catalog opens inside the app`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/practice/features`}),` \u2014 the catalog of every surface in the app \u2014 is reached from the
footer under the sidebar and from the dock's `,(0,t.jsx)(n.strong,{children:`Site Links`}),` menu. Following
either used to reload the whole tab into a bare page: the sidebar and the dock
were gone, the persistent player stopped mid-lecture, and the page's only way
back was a "Back" pill of its own.`]}),`
`,(0,t.jsx)(n.p,{children:`It is now an ordinary page of the app. It renders in the same sidebar as every
surface it catalogues, the footer and the menu reach it through the router
rather than by loading a new document, and the "Back" pill is gone \u2014 the
sidebar is how you leave it.`}),`
`,(0,t.jsxs)(n.p,{children:[`One link is deliberately still a full page load: `,(0,t.jsx)(n.code,{children:`/docs`}),` is a separately built
help site served as static files, not a route this app knows, so it is
followed the old way. Outside sites still open in a new tab.`]}),`
`,(0,t.jsx)(n.h2,{id:`switching-pages-is-a-react-render-not-a-frame-load`,children:`Switching pages is a React render, not a frame load`}),`
`,(0,t.jsxs)(n.p,{children:[`Every dock destination is an ordinary route rendered as React in the one app
document. Nothing loads in an `,(0,t.jsx)(n.code,{children:`<iframe>`}),`: the dock, the sidebar and the
player stay mounted, and a sidebar link on `,(0,t.jsx)(n.code,{children:`/videos`}),` routes the same document
like any other link.`]}),`
`,(0,t.jsxs)(n.p,{children:[`To make a switch a render from cache, the dock fetches each destination's
code ahead of the click. Hovering or focusing an icon prefetches that route,
and once the current page has loaded the dock prefetches the others one at a
time in idle time (`,(0,t.jsx)(n.code,{children:`lib/nav/dock-idle-prefetch.ts`}),`), so touch screens and
quick clicks get the same head start. The idle pass skips the two heavy
routes, `,(0,t.jsx)(n.code,{children:`/research/docs`}),` and `,(0,t.jsx)(n.code,{children:`/practice/versus-ai`}),` (the whole practice stack:
the AI opponent, the round and matchup simulators, coach mode, the drill
generator and the judge); hovering their icons still warms them. Each route is
warmed at most once per page load, even when the sidebar's embedded dock
remounts and restarts the pass. It also does nothing on a data-saver or 2G
connection.`]}),`
`,(0,t.jsx)(n.p,{children:`Only the app shell's dock runs the app-wide notifications and contacts polls;
the sidebar's embedded copy doesn't, and every other mounted copy of those
hooks (the account menu's badge, the contacts page) reuses the request one
copy already made in the same 30-second tick.`}),`
`,(0,t.jsx)(n.h2,{id:`a-bar-across-the-top-shows-a-page-switch-in-progress`,children:`A bar across the top shows a page switch in progress`}),`
`,(0,t.jsx)(n.p,{children:`Every page transition, from a dock icon, any in-app link, or back and
forward, shows a slim bar across the top of the window in the theme's primary
colour, like YouTube's. It creeps forward while the next page loads, fills
when the new page has painted, and fades out. Switches that land within
150 ms never show it, and with reduced motion turned on it moves without
animating.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Bar:`}),` `,(0,t.jsx)(n.code,{children:`packages/debate-webview/src/components/ui/RouteProgressBar.tsx`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Pacing and state:`}),` `,(0,t.jsx)(n.code,{children:`packages/debate-webview/src/lib/ui/route-progress.ts`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Start and finish signals:`}),` `,(0,t.jsx)(n.code,{children:`packages/debate-webview/src/lib/ui/use-route-loading.ts`})]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`The full-screen loading orb no longer shows for page transitions; it is left
for code that asks for it with `,(0,t.jsx)(n.code,{children:`beginLoading`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`/debate`}),` (the flow workspace) and `,(0,t.jsx)(n.code,{children:`/research/docs`}),` (the research agent)
still draw their own full-height workspace sidebars instead of the shared
one, so they have no resize handle or hide button of their own design and
their contents are not yet sections of the shared column.`]}),`
`,(0,t.jsx)(n.li,{children:`A hidden dock's tab does not reveal it on a pen or a touch screen that
reports hover; it opens on a tap there too, and a tap elsewhere does not fold
it again until the next navigation or a second tap on the tab.`}),`
`,(0,t.jsxs)(n.li,{children:[`On `,(0,t.jsx)(n.code,{children:`/docs`}),` the docs' search box sits in Fumadocs' header, not in the shared
column, and with the sidebar hidden the docs have no dock (the docs don't
mount the floating one).`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};
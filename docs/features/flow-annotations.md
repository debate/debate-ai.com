# Flow-in-Speech Flow Annotations

Lets a viewer drop a timestamped note while watching a streamed or recorded
round in the `debate-videos` player, tie it to a specific flow argument, and
jump straight back to it later.

- **Route:** `/annotations`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t annotations` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to drop a new `FlowAnnotation`:

- **Flow ID**, **Speech** (e.g. `1AC`), and **Box path** (a comma-separated
  path, e.g. `0, 1`) address exactly which flowed argument the annotation is
  attached to, the same way `boxFromPath` already addresses a box elsewhere
  in the flow spreadsheet.
- **Timestamp** defaults to "Current position" — the persistent video
  player's live playback position, read from `debate-videos`'s
  `useVideoPlayerStore` — or a manual `m:ss`/`h:mm:ss` entry when nothing is
  playing.
- An optional **note**.

Below the form, every persisted annotation renders newest-first with its
formatted timestamp, flow/speech/box address, and note. Each has:

- **Jump to** — seeks that annotation's timestamp, via the shared
  `jumpToAnnotation` helper: if its recording is already loaded in the
  player, it seeks in place via `sendYouTubeCommand("seekTo", ...)`;
  otherwise it first switches the persistent player to that recording via
  `useVideoPlayerStore.setActiveVideo(videoId, videoId, undefined,
  startTimeSeconds)`, opening it already positioned at the annotation's
  timestamp (using the video's `&start=` URL param rather than a `seekTo`
  postMessage, since there's no "player ready" signal to gate on for a
  video that isn't loaded yet). Disabled only when the annotation has no
  `videoId` at all.
- **Clear** — deletes the annotation.

## Data flow

```
flow/flow-annotations.ts               — createFlowAnnotation, formatAnnotationTimestamp,
                                           parseAnnotationTimestamp, parseBoxPathInput
state/flowAnnotations.ts (localStorage: flowAnnotations)
  → buildFlowAnnotationsPanelView()     — every persisted FlowAnnotation, newest first
  → panels/FlowAnnotationsPanel.tsx     — renders the drop-annotation form + annotation list;
                                           reads debate-videos's useVideoPlayerStore for the
                                           live playback position and video id
  → apps/debate-ai.com/app/annotations/page.tsx  — mounts the panel as a route

Dropping an annotation at the live position:
panels/FlowAnnotationsPanel.tsx
  → createFlowAnnotation({ ..., videoId: activeVideoId, videoTitle: activeVideoTitle })
                                                            — flow/flow-annotations.ts
  → saveFlowAnnotation(...)                                — state/flowAnnotations.ts
  → panel re-reads buildFlowAnnotationsPanelView() to refresh

Jumping back to one:
panels/FlowAnnotationsPanel.tsx
  → jumpToAnnotation(annotation, deps)                     — flow/flow-annotations.ts
      same video already loaded:
        → sendYouTubeCommand("seekTo", [timestampMs / 1000, true])  — debate-videos
        → sendYouTubeCommand("playVideo")
      different (or no) video loaded:
        → setActiveVideo(videoId, videoTitle ?? videoId, undefined, timestampMs / 1000)
                                                            — debate-videos
```

Every annotation data model and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (a), "a video-player UI
(`debate-videos`) that lets a viewer drop an annotation at the current
playback position, persisted through `flowAnnotations.ts`, and jump back to
one," named under idea #15 ("Flow-in-Speech Flow Annotations") in
`TODO.md`. It adds:

- `flow/flow-annotations.ts`: an optional `FlowAnnotation.videoId`
  (additive — existing annotations without one are still valid), plus
  `getAnnotationsForVideo`, `formatAnnotationTimestamp`,
  `parseAnnotationTimestamp`, and `parseBoxPathInput`.
- `state/flowAnnotations.ts`: `listFlowAnnotationsForVideo` and
  `buildFlowAnnotationsPanelView`.
- `debate-videos`'s `sendYouTubeCommand` gains a `"seekTo"` command (the
  YouTube IFrame API's `seekTo(seconds, allowSeekAhead)`), alongside the
  already-existing `playVideo`/`pauseVideo`/`setPlaybackRate`.

Vitest-covered in `packages/debate-round/test/flow-annotations.test.ts` and
`packages/debate-round/test/flowAnnotations.test.ts`.

## FlowSpreadsheet affordance

Every cell in the live `FlowSpreadsheet` grid (`/debate`) whose box already
has one or more persisted `FlowAnnotation`s shows a small clock badge next
to its text. Hovering the badge lists each annotation's formatted timestamp
and note; clicking it jumps to the earliest one via the exact same
`jumpToAnnotation` helper as `FlowAnnotationsPanel`'s own **Jump to**
button, switching videos first when needed.

This closes follow-up (b), "a flow-grid affordance (`FlowSpreadsheet`) that
surfaces annotations on their box via `listFlowAnnotationsForBox` and links
back to the timestamp," named under idea #15 in `TODO.md`. It adds:

- `flow/annotation-cells.ts`: pure helpers — `boxPathForCell` (reconstructs
  a grid cell's `boxPath` from its row's `originalIndex` and column index,
  matching how `dataTransform.ts#buildRowData` flattens a box chain via
  `children[0]`), `columnIndexFromField` (parses an AG Grid `col_N` field
  name), and `pickJumpAnnotation` (the earliest annotation by timestamp).
- `flow/AnnotationBadge.tsx`: the clock badge, shared by both cell
  renderers below.
- `flow/AnnotationCellRenderer.tsx`: the cell renderer used on every column
  after the first.
- `flow/FirstColumnCellRenderer.tsx`: unchanged heading/indent behavior,
  now also rendering the same badge.
- `flow/useFlowGridConfig.ts` / `flow/FlowSpreadsheet.tsx`: wire a
  `handleJumpToAnnotation` callback (uses the same `jumpToAnnotation` helper
  as `FlowAnnotationsPanel.handleJump`) into both renderers'
  `cellRendererParams`.

Vitest-covered in `packages/debate-round/test/annotation-cells.test.ts`
(box-path derivation, field parsing, earliest-annotation selection) and
`packages/debate-round/test/AnnotationBadge.test.tsx` (empty vs. populated
render, singular/plural wording, tooltip content).

## Cross-recording "Jump to"

Closes the "Newly discovered small gaps" item logged by a previous run's
doc/tracker drift audit: "Jump to" used to disable itself instead of
switching videos when an annotation's recording wasn't the one loaded.

- `flow/flow-annotations.ts`: `jumpToAnnotation(annotation, deps)`, a pure,
  dependency-injected helper — same-video jumps still seek in place via
  `sendYouTubeCommand("seekTo", ...)`; a different (or no) video loaded
  instead calls `deps.setActiveVideo(videoId, videoId, undefined,
  timestampMs / 1000)`. Returns `false` (no-op) only when the annotation has
  no `videoId`.
- `debate-videos`'s `useVideoPlayerStore.setActiveVideo` gains an optional
  4th `startTimeSeconds` param that overrides the video's own saved-resume
  lookup, feeding the existing `&start=` YouTube-embed URL param — chosen
  over a `seekTo` postMessage immediately after switching because the
  iframe's new document isn't guaranteed to have loaded yet and this
  codebase has no "player ready" signal to gate on.
- `panels/FlowAnnotationsPanel.tsx` / `flow/FlowSpreadsheet.tsx`: both
  `handleJump`/`handleJumpToAnnotation` now call the shared helper; the
  panel's button is disabled only when the annotation has no `videoId`.

Vitest-covered (4 new cases in
`packages/debate-round/test/flow-annotations.test.ts`'s `jumpToAnnotation`
suite: same-video seek, cross-video switch, switch when nothing is loaded,
and the no-`videoId` no-op).

## Video title on a cross-recording jump

Closes the "falls back to the bare `videoId` as the player's displayed
title" Known gap below: `FlowAnnotation` now optionally carries the
recording's own display title, captured at the moment the annotation was
dropped (from `useVideoPlayerStore`'s `activeVideoTitle`, the same title
`VideoCardThumbnail.tsx` passes to `setActiveVideo` when a video is
started), so a later cross-recording "Jump to" can show it instead of the
bare id.

- `flow/flow-annotations.ts`: an optional `FlowAnnotation.videoTitle`
  (additive — existing annotations without one are unaffected), trimmed and
  omitted when blank, mirroring the existing `videoId` handling in
  `createFlowAnnotation`. `jumpToAnnotation` now calls
  `deps.setActiveVideo(videoId, annotation.videoTitle ?? annotation.videoId,
  ...)`, falling back to the bare id only when no title was captured.
- `panels/FlowAnnotationsPanel.tsx`: `handleAdd` passes the live
  `activeVideoTitle` through alongside `activeVideoId` when dropping an
  annotation at the current playback position.

This only threads through a title an annotation already had in scope at
creation time — there is still no standalone `videoId` → title catalog/
lookup service, so an annotation dropped before this change, or dropped
without the live player active, still falls back to the bare id.

Vitest-covered (2 new cases in
`packages/debate-round/test/flow-annotations.test.ts`: `createFlowAnnotation`
trims/omits `videoTitle` the same way it does `videoId`, and
`jumpToAnnotation` uses a recorded `videoTitle` over the bare `videoId` when
switching recordings).

## Search/filter by speech, speaker, or tag

Closes the "Search/filter annotations by speech, speaker, or tag" follow-up
named under idea #15 in `TODO.md`.

- `flow/flow-annotations.ts`: two new optional `FlowAnnotation` fields,
  `speaker` and `tag` (additive — existing annotations without either are
  still valid), trimmed and omitted when blank in `createFlowAnnotation`,
  mirroring the existing `videoId`/`videoTitle` handling. A new
  `AnnotationFilter` type (`speechId`/`speaker`/`tag`, every field optional
  and AND-combined — an unset field matches anything) plus
  `filterFlowAnnotations(annotations, filter)`, following the same
  "sequential guard clause per field" shape as `flow/argument-tree.ts`'s
  `ArgumentTreeFilter`/`filterArgumentTree` (idea #10's own filter). It
  preserves the input array's order rather than re-sorting, since the panel
  always hands it an already-ordered (newest-first) list.
- `panels/FlowAnnotationsPanel.tsx`: the drop-annotation form gains optional
  **Speaker** and **Tag** text inputs. Above the annotation list, three
  `Select` dropdowns — **Speech**, **Speaker**, **Tag** — each populated
  with the distinct values actually present across the current annotations
  (plus an "Any …" option), matching `ArgumentTreePanel.tsx`'s own
  dropdown-filter pattern. The filter lives in local component state (not
  persisted across visits, unlike idea #10's per-round saved filter
  selections) and is applied to the rendered list only — it never affects
  what's stored. A "Clear filters" button appears once any filter is set.
  Each rendered annotation now also shows its `speaker`/`tag` as small
  badges when set.

Vitest-covered with 9 new cases in
`packages/debate-round/test/flow-annotations.test.ts` (`createFlowAnnotation`
trims/omits `speaker` and `tag` the same way as `videoId`/`videoTitle`; and
`filterFlowAnnotations`'s empty-filter passthrough, single-field filtering
for each of `speechId`/`speaker`/`tag`, AND-combining multiple fields,
excluding annotations missing a required field, order preservation, and the
no-matches case).

## Bulk export

Closes the "Bulk-export a round's annotations into a Speech Document" follow-up
named under idea #15 in `TODO.md`. A `.docx` Speech Document export isn't
attempted, for the same reason idea #6's own "send to Speech Document"
follow-up and idea #10's outline export stayed plain-text: the only Speech
Document type in this repo lives in the `reason-editor` package, which
`debate-round` doesn't depend on. This closes the "bulk-export" half with a
downloadable plain-text snapshot of every annotation on one flow instead — a
debate round, in this data model, is scoped by `FlowAnnotation.flowId`, the
only round-identifying field an annotation carries.

- `flow/flow-annotations.ts`: `AnnotationFilter` gains an optional `flowId`
  field (an unset `flowId` still matches everything, so every existing
  filter call is unaffected), applied the same AND-combined way as
  `speechId`/`speaker`/`tag`.
- `flow/flow-annotations-export.ts`: `buildFlowAnnotationsExportText(annotations,
  flowId)` — a pure builder that narrows to one `flowId`, sorts by timestamp,
  and renders one line per annotation (`- [m:ss] <speech> box [<path>]`, with
  speaker/tag appended in parentheses and a note on its own indented line
  when set); `flowAnnotationsExportFilename(flowId)`, mirroring
  `round/pre-round-briefing.ts#preRoundBriefingFilename`'s exact
  sanitization rule.
- `panels/FlowAnnotationsPanel.tsx`: a new **Flow** filter dropdown (alongside
  the existing Speech/Speaker/Tag ones, populated from the distinct
  `flowId`s actually present) drives a "Download annotations" button that
  appears once a specific flow is selected, using the same anchor+Blob
  download pattern as `PreRoundBriefingsPanel.tsx#handleDownload`.

Vitest-covered: 2 new cases in `packages/debate-round/test/flow-annotations.test.ts`'s
`filterFlowAnnotations` suite (`flowId` filtering alone, and `flowId: 0`
treated as a real filter value rather than an unset one — a plain
truthiness check would have skipped it), and a new
`packages/debate-round/test/flow-annotations-export.test.ts` covering
`buildFlowAnnotationsExportText` (header, empty-flow message, cross-flow
exclusion, timestamp/speech/box-path rendering, speaker+tag suffix, note
line, timestamp ordering) and `flowAnnotationsExportFilename`.

## Known gaps

- ~~Switching videos for a cross-recording jump falls back to the bare
  `videoId` as the player's displayed title (e.g. "Now playing:
  `dQw4w9WgXcQ`") since no stored catalog maps a `videoId` to a title —
  `FlowAnnotation` itself doesn't carry one, only whatever created the
  annotation (e.g. `VideoCard.tsx`) ever knew it.~~ Closed: see "Video title
  on a cross-recording jump" above. An annotation dropped without the live
  player active (or before this change) still has no title to fall back on.
- ~~The `FlowSpreadsheet` badge reads annotations from `localStorage` at
  cell render time; it does not live-update if another tab drops a new
  annotation while the grid is open.~~ Closed: `FlowSpreadsheet` now listens
  for the browser's `storage` event (which fires only in *other* same-origin
  tabs, never the tab that wrote the change) via
  `flow/live-update.ts#isFlowLiveUpdateStorageEvent` and force-refreshes
  every grid cell when it fires for the `flowAnnotations`/`flowEdits`/
  `prepNotes` keys, so an annotation logged in one tab now shows up in this
  badge (and the `EditBadge`/`PrepNoteBadge`, see
  [`shared-flow-sync.md`](shared-flow-sync.md)) in every other open tab on
  the next `storage` event, not just after a manual reload.
- ~~The standalone Flow Annotations panel (`panels/FlowAnnotationsPanel.tsx`
  — the video-player annotation list itself, distinct from the
  `FlowSpreadsheet` grid badge above) reads `localStorage` on mount and
  after its own add/clear actions only; it did not live-update if another
  tab dropped or cleared an annotation while the panel was open.~~ Closed:
  the panel now listens for the browser's `storage` event too, via a new
  `flow/live-update.ts#isFlowAnnotationsPanelLiveUpdateStorageEvent`
  (scoped to the `flowAnnotations` key alone, since this panel doesn't
  render the `flowEdits`/`prepNotes` badges the grid's predicate also
  covers), and re-reads the annotation list when it fires. Vitest-covered
  in `packages/debate-round/test/live-update.test.ts`.
- No collaborative/live sync — annotations are local `localStorage` only,
  same as every other persisted record in this repo today.

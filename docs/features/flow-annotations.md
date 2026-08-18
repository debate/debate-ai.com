# Flow-in-Speech Flow Annotations

Lets a viewer drop a timestamped note while watching a streamed or recorded
round in the `debate-videos` player, tie it to a specific flow argument, and
jump straight back to it later.

- **Route:** `/annotations`
- **Nav:** the global dock's Settings menu → **Flow Annotations**
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

- **Jump to** — seeks the currently loaded video straight to that
  annotation's timestamp via `sendYouTubeCommand("seekTo", ...)`. Only
  enabled when the annotation's `videoId` matches the video currently
  loaded in the player (see **Known gaps**).
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
  → createFlowAnnotation({ ..., videoId: activeVideoId })  — flow/flow-annotations.ts
  → saveFlowAnnotation(...)                                — state/flowAnnotations.ts
  → panel re-reads buildFlowAnnotationsPanelView() to refresh

Jumping back to one:
panels/FlowAnnotationsPanel.tsx
  → sendYouTubeCommand("seekTo", [timestampMs / 1000, true])  — debate-videos
  → sendYouTubeCommand("playVideo")
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

## Known gaps

- **Jump to** only works once the annotation's own recording is already the
  one loaded in the player — there's no lookup from a `videoId` to "open
  this video," so an annotation dropped against a different recording than
  the one currently playing shows a disabled button instead.
- Follow-up (b) on the same idea, a `FlowSpreadsheet` affordance that
  surfaces a box's annotations via `listFlowAnnotationsForBox` and links
  back to the timestamp, remains open — not started.
- No collaborative/live sync — annotations are local `localStorage` only,
  same as every other persisted record in this repo today.

# CLAUDE.md — `debate-timer`

Public (`@debate/` scope). Speech and prep timers for live rounds, with per-format speech times
built in. Also the **in-round speech recorder**: mic selection, live waveform,
playback. Entry `src/index.ts`, tests in `test/`.

## Timers are used in real competition

- **Per-format speech times are rules, not defaults.** PF, LD and Policy each
  have fixed speech and prep lengths. Changing one is changing the rules of a
  debate — it needs a citation, not a judgement call.
- **Drift matters.** A timer implemented with accumulated `setInterval` ticks
  drifts over an 8-minute speech. Compute elapsed time from a timestamp.
- **The tab will be backgrounded**, the screen will sleep, and the user will not
  reload. Prep time must survive both.
- Prep time is *consumed* — it can't be silently restored by a remount.

## The circular timer face

`timers/circular/CircularTimerFace.tsx` is the browser extension's round dial,
moved here so the round sidebar (`debate-round` `RoundTimerPanel`) and the
extension (`apps/debate-browser-ext/src/components/TimerFace.tsx`, which wraps
it) share it. It is presentational only — callers own the timer state. Its
styles are `dt-ctimer`-scoped and imported by the component; it references its
own `css-module.d.ts` so every package that type-checks `@debate/timer` accepts
the CSS import. Import it by path (`@debate/timer/src/timers/circular/…`) from
the extension so the timer window doesn't bundle the recorder.

## The recorder

- **It captures a student's voice.** Recording is an explicit, visible action:
  never start capture implicitly, never keep the mic open after a speech ends,
  and never upload a recording anywhere this package's callers didn't ask for.
- Mic permission can be denied or revoked mid-round. Failing to get a mic must
  not stop the timer — timing is the primary function, recording is secondary.
- `@ricky0123/vad-web` is pinned via a root `overrides` entry; don't bump it
  casually.

## The joined round recording

- `RoundRecordingDialog` joins the per-speech recordings into one MP3 in the
  browser; the big blobs (MP3, captions, webcam clips) live in IndexedDB via
  `recorder/media-store.ts`, never localStorage.
- Uploading to R2 (`/api/round-recordings`) happens only on the dialog's
  "Save to cloud" button — keep it that way.
- `SpeechStartsEditor` is the one speech start/stop editor: `SpeechStartsDialog`
  (joined MP3, `debate-videos`' watch page) and `debate-round`'s
  `SpeechStartLabeler` (YouTube/MP3 clips, AI suggestions) both render it. It
  only takes a playhead, a seek callback and a length, so keep it
  media-agnostic; change rows there, not in the callers.

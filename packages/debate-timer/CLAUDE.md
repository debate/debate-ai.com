# CLAUDE.md — `debate-timer`

Private. Speech and prep timers for live rounds, with per-format speech times
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

## The recorder

- **It captures a student's voice.** Recording is an explicit, visible action:
  never start capture implicitly, never keep the mic open after a speech ends,
  and never upload a recording anywhere this package's callers didn't ask for.
- Mic permission can be denied or revoked mid-round. Failing to get a mic must
  not stop the timer — timing is the primary function, recording is secondary.
- `@ricky0123/vad-web` is pinned via a root `overrides` entry; don't bump it
  casually.

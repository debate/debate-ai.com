# Debate Timer

A debate-round timer (Constructive / Rebuttal / Cross-x + per-side prep clocks),
plus a round timeline you can export as a PNG.

Migrated from a hand-rolled jQuery + d3.v3 MV3 extension to **[WXT](https://wxt.dev)
MV3 + React + Tailwind/shadcn-ui**. The timer's behavior is intentionally
unchanged; only the implementation and the shell changed.

## Stack

- **WXT** — MV3 build, HMR dev, zipping
- **React 18** + TypeScript
- **Tailwind CSS v3** + **shadcn/ui** (new-york) — used for the chrome around the
  timer: format `Select`, `Tabs`, `Button`, `Tooltip`. The circular clock face,
  the Digital-7 font, the depleting SVG ring, per-speech colors and the ripple
  are ported CSS, not shadcn.

## Develop

```bash
npm install        # runs `wxt prepare`
npm run dev         # launches Chrome with the extension + HMR
npm run compile     # tsc --noEmit
npm run build       # production build -> .output/chrome-mv3
npm run zip         # -> .output/debate-timer-<version>-chrome.zip
```

Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** →
`.output/chrome-mv3`.

## Layout

```
entrypoints/
  background.ts          MV3 service worker (currently a no-op stub)
  popup/
    index.html main.tsx  popup mount
    App.tsx              Tabs (Timer | Timeline) + format Select
    style.css           Tailwind + shadcn tokens + ported timer/timeline CSS
src/
  timer/
    constants.ts        debate formats, speech tables, toTimeString/toNumber
    storage.ts          browser.storage.local: debatetype, savedTimes, timelog
    useTimer.ts         all timer state + behavior (was js/timer.js + init.js + buttons.js)
  components/
    TimerFace.tsx       circular clock face, speech/prep buttons, editable count
    Timeline.tsx        rebuilt in React/SVG (was js/timeline.js + d3-timeline + savesvg.js)
components/ui/           shadcn primitives
lib/utils.ts            cn()
public/
  icon/                 16/32/48/96/128
  res/                  Digital-7.woff, beep_final.mp3
legacy/                 the original extension, verbatim, for reference
```

## What changed from the original

| Area | Before | After |
| --- | --- | --- |
| Window | `background.js` opened a 350×370 `popup`-type window | standard `action.default_popup` |
| Timeline | `d3.v3` + vendored `d3-timeline` + `saveSvgAsPng` | React/SVG re-implementation; PNG via `<canvas>` |
| Final beep | beep + auto-advance + random artwork reveal + ring spin | beep + auto-advance only (artwork/spin dropped) |
| Session resume | restored the display but not the internal count (bug) | restores the actual remaining seconds |
| Undo (Ctrl+Z) | restored count/type, mangled the CSS class | restores count/type/active button cleanly; also Cmd+Z |

## Preserved behavior

- Six formats with the same speech/prep minute tables (HS Policy … Extemp).
- Speech buttons load that speech's full time; **prep buttons are running banks**
  per side that deplete as you use them and persist across speeches.
- 1-second countdown, circular meter depletes from the top, per-speech accent
  colors, click-the-face to play/pause, ripple.
- At `0:00`: beep + auto-advance (Constructive/Rebuttal→Cross-x, Cross-x→
  Constructive, Aff/Neg Prep→Rebuttal).
- Session autosaves every tick and resumes for 1 hour (`savedTimes`).
- Timeline logs every play/pause, keeps the last 2 hours, shows per-speech totals
  and a pause %, exports a PNG. 2-step Clear.
- Original extension `key` retained so the extension ID — and existing users'
  stored data — carry over.

Double-click a prep button to reset that side's bank.

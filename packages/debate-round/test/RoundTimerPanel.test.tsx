// @vitest-environment jsdom
/**
 * @fileoverview Tests for the round sidebar's Timer section: the play/pause
 * maths, which timer the dial shows, and the pop-out fallback.
 */

import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { buttonByText, cleanup, mount, run } from "./dom-helpers"
import {
  accentForSpeech,
  buildTimerRows,
  rankTimerRows,
  remainingMs,
  RoundTimerPanel,
  toggledEntry,
} from "../src/layout/RoundTimerPanel"
import type { SpeechTimerEntry } from "../src/hooks/useTimerState"
import type { DebateStyle, TimerState } from "@debate/timer/src/types"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("timer maths", () => {
  const paused: SpeechTimerEntry = { time: 60_000, resetTime: 120_000, state: { name: "paused" } }

  it("starts from where it was paused and pauses at the time left", () => {
    const running = toggledEntry(paused, 10_000)
    expect(running.state).toEqual({ name: "running", startTime: -50_000 })
    expect(remainingMs(running, 20_000)).toBe(50_000)
    expect(toggledEntry(running, 20_000)).toEqual({ time: 50_000, resetTime: 120_000, state: { name: "paused" } })
  })

  it("resets a finished timer", () => {
    expect(toggledEntry({ ...paused, time: 0, state: { name: "done" } }, 1)).toEqual({ ...paused, time: 120_000 })
    expect(remainingMs({ ...paused, state: { name: "done" } }, 1)).toBe(0)
  })

  it("colours cross-ex, rebuttals and constructives", () => {
    expect(accentForSpeech({ name: "CX", secondary: true })).toBe("crossx")
    expect(accentForSpeech({ name: "1AR", secondary: false })).toBe("rebuttal")
    expect(accentForSpeech({ name: "1AC", secondary: false })).toBe("constructive")
  })
})

const style = {
  timerSpeeches: [
    { name: "1AC", time: 8, secondary: false },
    { name: "CX", time: 3, secondary: true },
  ],
  prepTime: 8,
} as unknown as DebateStyle

function Harness() {
  const [speeches, setSpeeches] = useState<Record<string, SpeechTimerEntry>>({})
  const [prep, setPrep] = useState<TimerState | null>({ time: 480_000, resetTime: 480_000, state: { name: "paused" } })
  const [prep2, setPrep2] = useState<TimerState | null>({ time: 480_000, resetTime: 480_000, state: { name: "paused" } })
  const get = (name: string) => speeches[name] ?? { time: 480_000, resetTime: 480_000, state: { name: "paused" as const } }
  return (
    <>
      <output data-testid="state">{JSON.stringify({ speech: get("1AC").state.name, prep: prep?.state.name })}</output>
      <RoundTimerPanel
        debateStyle={style}
        selectedSpeech="1AC"
        getSpeechTimerState={get}
        setSpeechTimerState={(name, updates) => setSpeeches((prev) => ({ ...prev, [name]: { ...get(name), ...updates } }))}
        prepState={prep}
        setPrepState={setPrep}
        prepSecondaryState={prep2}
        setPrepSecondaryState={setPrep2}
      />
    </>
  )
}

const state = () => JSON.parse(document.querySelector("[data-testid=state]")!.textContent!)

describe("RoundTimerPanel", () => {
  it("plays the speech from the dial, and starting prep pauses it", async () => {
    await mount(<Harness />)
    expect(document.body.textContent).toContain("Timer")
    expect((document.querySelector(".dt-ctimer input") as HTMLInputElement).value).toBe("8:00")

    await run(() => (document.querySelector(".dt-ctimer") as HTMLElement).click())
    expect(state()).toEqual({ speech: "running", prep: "paused" })

    // Switch the dial to aff prep and start it.
    const affButton = Array.from(document.querySelectorAll(".dt-ctimer button")).find((b) => b.getAttribute("title") === "Aff prep")!
    await run(() => (affButton as HTMLElement).click())
    await run(() => (document.querySelector(".dt-ctimer") as HTMLElement).click())
    expect(state()).toEqual({ speech: "paused", prep: "running" })
  })

  it("collapses, and pops out to a floating dial without Picture-in-Picture", async () => {
    await mount(<Harness />)
    const header = document.querySelector("button[aria-expanded]") as HTMLButtonElement
    await run(() => header.click())
    expect(document.querySelector(".dt-ctimer")).toBeNull()
    await run(() => header.click())

    const popButton = document.querySelector('button[title="Pop out the timer"]') as HTMLButtonElement
    await run(() => popButton.click())
    expect(document.querySelector('[role="dialog"] .dt-ctimer')).not.toBeNull()
    expect(document.body.textContent).toContain("The timer is popped out.")

    await run(() => (document.querySelector('[role="dialog"] button[title="Close the pop-out timer"]') as HTMLElement).click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it("lists every timer and ranks them by time used", async () => {
    await mount(<Harness />)
    await run(() => (document.querySelector('button[title="Show all timers"]') as HTMLElement).click())
    const list = () => Array.from(document.querySelectorAll('[aria-label="All timers"] li')).map((li) => li.textContent)
    expect(list()).toHaveLength(4)
    expect(list()[0]).toContain("1AC")
    expect(list()[2]).toContain("Aff prep")

    const neg = Array.from(document.querySelectorAll('[aria-label="All timers"] li button')).find((b) =>
      b.textContent?.includes("Neg prep"),
    )!
    await run(() => (neg as HTMLElement).click())
    expect(document.querySelector('.dt-ctimer [aria-label="Neg prep time remaining"]')).not.toBeNull()

    await run(() => buttonByText("Most used")!.click())
    expect(buttonByText("Most used")!.getAttribute("aria-pressed")).toBe("true")

    await run(() => (document.querySelector('button[title="Hide all timers"]') as HTMLElement).click())
    expect(document.querySelector('[aria-label="All timers"]')).toBeNull()
  })
})

describe("timer rows", () => {
  it("reports time used and left, and ranks by most used", () => {
    const entries: Record<string, SpeechTimerEntry> = {
      "1AC": { time: 60_000, resetTime: 480_000, state: { name: "paused" } },
      CX: { time: 0, resetTime: 180_000, state: { name: "done" } },
    }
    const prep: TimerState = { time: 300_000, resetTime: 480_000, state: { name: "paused" } }
    const rows = buildTimerRows(style, (n) => entries[n], prep, null, 0)
    expect(rows.map((r) => [r.label, r.usedMs, r.leftMs])).toEqual([
      ["1AC", 420_000, 60_000],
      ["CX", 180_000, 0],
      ["Aff prep", 180_000, 300_000],
    ])
    expect(rankTimerRows(rows).map((r) => r.label)).toEqual(["1AC", "CX", "Aff prep"])
    expect(rankTimerRows([rows[2], rows[0]]).map((r) => r.label)).toEqual(["1AC", "Aff prep"])
  })
})

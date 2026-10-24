// @vitest-environment jsdom
/**
 * @fileoverview Tests for the round sidebar's Timer section: the play/pause
 * maths, which timer the dial shows, and the pop-out fallback.
 */

import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, mount, run } from "./dom-helpers"
import {
  accentForSpeech,
  remainingMs,
  RoundTimerPanel,
  toggledEntry,
} from "../src/layout/RoundTimerPanel"
import type { SpeechTimerEntry } from "../src/hooks/useTimerState"
import type { DebateStyle, TimerState } from "@debate-ai/timer/src/types"

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
})

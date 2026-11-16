/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → General → Coaching styles: lists every picker that
 * remembers a style with its stored choice, links each to its tool, follows
 * an account merge (`storage` event), and **Reset all to Standard** saves
 * Standard for every surface rather than removing the records.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { COACH_PERSONA_PREFERENCES_STORAGE_KEY, listCoachPersonaPreferences } from "@debate-ai/speech-writer"
import {
  COACHING_STYLE_SURFACES,
  CoachingStylesSection,
} from "../../../src/components/settings/sections/CoachingStylesSection"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ""
  localStorage.clear()
})

async function mount() {
  const host = document.createElement("div")
  document.body.appendChild(host)
  await act(async () => createRoot(host).render(<CoachingStylesSection />))
  return host
}

function styleOf(host: HTMLElement, surface: string): string {
  return host.querySelector(`#settings-coaching-style-${surface}`)?.textContent ?? ""
}

function resetButton(host: HTMLElement): HTMLButtonElement {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === "Reset all to Standard")
  if (!button) throw new Error("no reset button")
  return button as HTMLButtonElement
}

function store(records: unknown[]) {
  localStorage.setItem(COACH_PERSONA_PREFERENCES_STORAGE_KEY, JSON.stringify(records))
}

describe("CoachingStylesSection", () => {
  it("lists every surface at Standard, with reset disabled, when nothing is saved", async () => {
    const host = await mount()
    for (const { surface } of COACHING_STYLE_SURFACES) {
      expect(styleOf(host, surface)).toContain("Standard")
    }
    expect(resetButton(host).disabled).toBe(true)
    expect(host.textContent).toContain("Saved to your account when you're signed in")
  })

  it("links each row to the tool that owns the picker", async () => {
    const host = await mount()
    const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"))
    expect(hrefs).toEqual(["/coaching/ai-coach", "/coaching/materials", "/practice/versus-ai", "/practice/versus-ai"])
  })

  it("shows each surface's stored style and ignores unusable records", async () => {
    store([
      { id: "team-coach", personaId: "socratic", updatedAt: 1 },
      { id: "practice-vs-ai-judge", personaId: "fact-checker", updatedAt: 2 },
      { id: "ai-coach-feedback", personaId: "not-a-persona", updatedAt: 3 },
    ])
    const host = await mount()
    expect(styleOf(host, "team-coach")).toContain("Socratic")
    expect(styleOf(host, "practice-vs-ai-judge")).toContain("Fact-Checker")
    expect(styleOf(host, "ai-coach-feedback")).toContain("Standard")
    expect(styleOf(host, "practice-vs-ai")).toContain("Standard")
    expect(resetButton(host).disabled).toBe(false)
  })

  it("starts on Standard without throwing when the stored value is corrupt", async () => {
    localStorage.setItem(COACH_PERSONA_PREFERENCES_STORAGE_KEY, "{not json")
    const host = await mount()
    expect(styleOf(host, "team-coach")).toContain("Standard")
  })

  it("follows an account merge written by the tool-record sync", async () => {
    const host = await mount()
    store([{ id: "ai-coach-feedback", personaId: "devils-advocate", updatedAt: 5 }])
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: COACH_PERSONA_PREFERENCES_STORAGE_KEY }))
    })
    expect(styleOf(host, "ai-coach-feedback")).toContain("Devil's Advocate")
  })

  it("ignores storage events for other keys", async () => {
    const host = await mount()
    store([{ id: "ai-coach-feedback", personaId: "socratic", updatedAt: 5 }])
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "somethingElse" }))
    })
    expect(styleOf(host, "ai-coach-feedback")).toContain("Standard")
  })

  it("resets every surface by saving Standard, keeping one record per surface", async () => {
    store([
      { id: "team-coach", personaId: "socratic", updatedAt: 1 },
      { id: "practice-vs-ai", personaId: "fact-checker", updatedAt: 2 },
    ])
    const host = await mount()
    await act(async () => resetButton(host).click())

    for (const { surface } of COACHING_STYLE_SURFACES) {
      expect(styleOf(host, surface)).toContain("Standard")
    }
    const saved = listCoachPersonaPreferences()
    expect(saved.map((p) => p.id).sort()).toEqual(["practice-vs-ai", "team-coach"])
    expect(saved.every((p) => p.personaId === "standard")).toBe(true)
    expect(resetButton(host).disabled).toBe(true)
  })
})

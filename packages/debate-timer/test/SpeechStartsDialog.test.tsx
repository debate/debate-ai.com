// @vitest-environment jsdom
/**
 * @fileoverview The speech-start modal shared by the joined round MP3 and the
 * YouTube watch page: set a start to the playhead, type one, nudge it, clear it.
 * The rows are `SpeechStartsEditor`, which the YouTube/MP3 labeler also uses
 * with stop times.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { SpeechStartsDialog } from "../src/recorder/SpeechStartsDialog"
import { SpeechStartsEditor } from "../src/recorder/SpeechStartsEditor"
import { blur, click, mount, type, type Mounted } from "./helpers/mount"

let view: Mounted | undefined
afterEach(async () => {
  await view?.unmount()
  view = undefined
})

const ITEMS = [
  { key: "1AC", label: "1AC" },
  { key: "1NC", label: "1NC" },
]

async function open(onChange = vi.fn(), onSeek = vi.fn()) {
  view = await mount(
    <SpeechStartsDialog
      open
      onOpenChange={() => {}}
      items={ITEMS}
      starts={{ "1AC": 10 }}
      durationSeconds={600}
      currentTime={125}
      onSeek={onSeek}
      onChange={onChange}
    />,
  )
  return { onChange, onSeek }
}

const byLabel = (label: string) => document.querySelector(`[aria-label="${label}"]`) as HTMLElement

describe("SpeechStartsDialog", () => {
  it("sets a start to the playhead", async () => {
    const { onChange } = await open()
    await click(byLabel("1NC starts at the playhead"))
    expect(onChange).toHaveBeenCalledWith("1NC", 125)
  })

  it("nudges, plays and clears an existing start", async () => {
    const { onChange, onSeek } = await open()
    await click(byLabel("1AC start 5 seconds later"))
    expect(onChange).toHaveBeenLastCalledWith("1AC", 15)
    await click(byLabel("1AC start 5 seconds earlier"))
    expect(onChange).toHaveBeenLastCalledWith("1AC", 5)
    await click(byLabel("Play 1AC"))
    expect(onSeek).toHaveBeenCalledWith(10)
    await click(byLabel("Clear 1AC start"))
    expect(onChange).toHaveBeenLastCalledWith("1AC", null)
  })

  it("takes a typed m:ss start", async () => {
    const { onChange } = await open()
    const inputs = document.querySelectorAll<HTMLInputElement>('input[aria-label="Start time"]')
    expect(inputs[0].value).toBe("0:10")
    await type(inputs[1], "8:30")
    await blur(inputs[1])
    expect(onChange).toHaveBeenLastCalledWith("1NC", 510)
  })

  it("offers Detect speeches when given a detection control", async () => {
    const onDetect = vi.fn()
    const onClear = vi.fn()
    view = await mount(
      <SpeechStartsDialog
        open
        onOpenChange={() => {}}
        items={ITEMS}
        starts={{}}
        durationSeconds={600}
        currentTime={0}
        onSeek={() => {}}
        onChange={() => {}}
        detection={{
          onDetect,
          onClear,
          running: false,
          available: true,
          result: "Policy · 11 speeches found",
        }}
      />,
    )
    expect(document.body.textContent).toContain("Detect again")
    await click(byLabel("Detect again"))
    expect(onDetect).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain("Clear")
    await click(byLabel("Clear detection"))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("shows Detect speeches before any result", async () => {
    view = await mount(
      <SpeechStartsDialog
        open
        onOpenChange={() => {}}
        items={ITEMS}
        starts={{}}
        durationSeconds={600}
        currentTime={0}
        onSeek={() => {}}
        onChange={() => {}}
        detection={{
          onDetect: vi.fn(),
          running: false,
          available: true,
        }}
      />,
    )
    expect(document.body.textContent).toContain("Detect speeches")
    expect(document.querySelector('button[aria-label="Detect speeches"]')).not.toBeNull()
  })

  it("shows Detect again and the result after a detection", async () => {
    view = await mount(
      <SpeechStartsDialog
        open
        onOpenChange={() => {}}
        items={ITEMS}
        starts={{}}
        durationSeconds={600}
        currentTime={0}
        onSeek={() => {}}
        onChange={() => {}}
        detection={{
          onDetect: vi.fn(),
          running: false,
          available: true,
          result: "Lincoln-Douglas · 7 speeches found",
        }}
      />,
    )
    expect(document.body.textContent).toContain("Detect again")
    expect(document.body.textContent).toContain("Lincoln-Douglas · 7 speeches found")
  })

  it("shows Detecting… while running and disables the button", async () => {
    view = await mount(
      <SpeechStartsDialog
        open
        onOpenChange={() => {}}
        items={ITEMS}
        starts={{}}
        durationSeconds={600}
        currentTime={0}
        onSeek={() => {}}
        onChange={() => {}}
        detection={{
          onDetect: vi.fn(),
          running: true,
          available: true,
        }}
      />,
    )
    expect(document.body.textContent).toContain("Detecting speeches…")
    expect(document.querySelector('button[aria-label="Detect speeches"]')).toBeNull()
  })

  it("has no Detect control without detection", async () => {
    await open()
    expect(document.querySelector('button[aria-label="Detect speeches"]')).toBeNull()
    expect(document.querySelector('button[aria-label="Detecting speeches…"]')).toBeNull()
  })
})

describe("SpeechStartsEditor", () => {
  it("edits stops when asked to, and warns when a stop is before its start", async () => {
    const onChange = vi.fn()
    const onEndChange = vi.fn()
    view = await mount(
      <SpeechStartsEditor
        items={ITEMS}
        starts={{ "1AC": 10, "1NC": 300 }}
        onChange={onChange}
        ends={{ "1NC": 200 }}
        onEndChange={onEndChange}
        durationSeconds={600}
        currentTime={700}
        onSeek={() => {}}
        highlightKey="1nc"
      />,
    )
    // The playhead past the end is clamped to the media's length.
    await click(byLabel("1AC stops at the playhead"))
    expect(onEndChange).toHaveBeenLastCalledWith("1AC", 600)
    await click(byLabel("1NC stop 5 seconds later"))
    expect(onEndChange).toHaveBeenLastCalledWith("1NC", 205)
    await click(byLabel("Clear 1NC stop"))
    expect(onEndChange).toHaveBeenLastCalledWith("1NC", null)
    expect(onChange).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain("Stops before it starts.")
  })

  it("has no stop controls without onEndChange", async () => {
    view = await mount(
      <SpeechStartsEditor items={ITEMS} starts={{}} onChange={() => {}} durationSeconds={0} currentTime={0} onSeek={() => {}} />,
    )
    expect(document.querySelector('input[aria-label="Stop time"]')).toBeNull()
    expect(document.querySelectorAll('input[aria-label="Start time"]')).toHaveLength(2)
  })
})

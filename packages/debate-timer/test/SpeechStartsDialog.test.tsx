// @vitest-environment jsdom
/**
 * @fileoverview The speech-start modal shared by the joined round MP3 and the
 * YouTube watch page: set a start to the playhead, type one, nudge it, clear it.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { SpeechStartsDialog } from "../src/recorder/SpeechStartsDialog"
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
    await click(byLabel("1AC 5 seconds later"))
    expect(onChange).toHaveBeenLastCalledWith("1AC", 15)
    await click(byLabel("1AC 5 seconds earlier"))
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
})

/**
 * @fileoverview Pins how the Synergy Slayer "Voice" button gets its audio
 * (`packages/debate-help-docs/components/guides/voice-read-queue.ts`): Kokoro
 * and Cloudflare race per paragraph, every paragraph is read, and text no
 * engine could voice comes back for the browser's speech.
 */
import { describe, expect, it } from "vitest"
import { VoiceQueue, type VoiceClip } from "../../../../packages/debate-help-docs/components/guides/voice-read-queue"

const blob = (label: string) => new Blob([label], { type: "audio/wav" })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const words = (text: string) => text.split(" ")

async function readAll(queue: VoiceQueue, signal: AbortSignal) {
  const out: { clips: VoiceClip[]; missing: string[] }[] = []
  queue.start()
  for (let i = 0; i < queue.units.length; i++) {
    queue.playing(i)
    const clips: VoiceClip[] = []
    for await (const clip of queue.units[i]!.read(signal)) clips.push(clip)
    out.push({ clips, missing: [...queue.units[i]!.missing] })
  }
  return out
}

describe("VoiceQueue", () => {
  it("reads every paragraph with Kokoro, piece by piece, when Cloudflare gives nothing", async () => {
    const signal = new AbortController().signal
    const queue = new VoiceQueue(
      ["one two three", "four five"],
      { kokoro: async (t) => blob(t), kokoroChunks: words, cloud: async () => null },
      signal,
    )
    const out = await readAll(queue, signal)
    expect(out.map((u) => u.clips.map((c) => c.text))).toEqual([["one", "two", "three"], ["four", "five"]])
    expect(out.every((u) => u.clips.every((c) => c.source === "kokoro"))).toBe(true)
  })

  it("plays Cloudflare for a paragraph when it answers before Kokoro", async () => {
    const signal = new AbortController().signal
    const queue = new VoiceQueue(
      ["slow paragraph", "next"],
      {
        kokoro: async (t) => {
          await sleep(30)
          return blob(t)
        },
        kokoroChunks: words,
        cloud: async (t) => blob(`cf:${t}`),
      },
      signal,
    )
    const out = await readAll(queue, signal)
    expect(out[0]!.clips).toHaveLength(1)
    expect(out[0]!.clips[0]!.source).toBe("cloudflare")
    expect(out[0]!.clips[0]!.text).toBe("slow paragraph")
    expect(out[1]!.clips.map((c) => c.text).join(" ")).toBe("next")
  })

  it("keeps Kokoro for a paragraph it started, and aborts Cloudflare's request", async () => {
    const signal = new AbortController().signal
    let cloudAborted = false
    const queue = new VoiceQueue(
      ["a b c"],
      {
        kokoro: async (t) => blob(t),
        kokoroChunks: words,
        cloud: (_t, s) =>
          new Promise((resolve) => {
            s.addEventListener("abort", () => {
              cloudAborted = true
              resolve(null)
            })
          }),
      },
      signal,
    )
    const out = await readAll(queue, signal)
    expect(out[0]!.clips.map((c) => [c.source, c.text])).toEqual([
      ["kokoro", "a"],
      ["kokoro", "b"],
      ["kokoro", "c"],
    ])
    expect(cloudAborted).toBe(true)
  })

  it("hands back text neither engine voiced, so nothing is skipped", async () => {
    const signal = new AbortController().signal
    let calls = 0
    const queue = new VoiceQueue(
      ["a b", "c d", "e"],
      {
        kokoro: async (t) => {
          if (++calls === 2) throw new Error("worker died")
          return blob(t)
        },
        kokoroChunks: words,
        cloud: async () => null,
      },
      signal,
    )
    const out = await readAll(queue, signal)
    expect(out[0]!.clips.map((c) => c.text)).toEqual(["a"])
    expect(out[0]!.missing).toEqual(["b"])
    expect(out[1]!.missing).toEqual(["c d"])
    expect(out[2]!.missing).toEqual(["e"])
  })

  it("reads with Cloudflare alone when Kokoro can't run here", async () => {
    const signal = new AbortController().signal
    const queue = new VoiceQueue(["x", "y", "z", "w", "v"], { kokoro: null, kokoroChunks: words, cloud: async (t) => blob(t) }, signal)
    const out = await readAll(queue, signal)
    expect(out.map((u) => u.clips[0]?.text)).toEqual(["x", "y", "z", "w", "v"])
  })

  it("stops waiting once the reading is stopped", async () => {
    const ctrl = new AbortController()
    const queue = new VoiceQueue(["a"], { kokoro: () => new Promise<Blob>(() => {}), kokoroChunks: words, cloud: null }, ctrl.signal)
    queue.start()
    setTimeout(() => ctrl.abort(), 10)
    const clips: VoiceClip[] = []
    for await (const clip of queue.units[0]!.read(ctrl.signal)) clips.push(clip)
    expect(clips).toEqual([])
  })
})

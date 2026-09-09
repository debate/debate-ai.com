/**
 * @fileoverview REASON docs cloud-save queue.
 *
 * The contract these pin is "an edit that was made reaches D1" — the half of
 * the editor a user only notices when it fails. Each case here is a way the
 * previous single-shared-timer implementation lost work outright: a second
 * document's edit cancelling the first's pending write, a title edit
 * cancelling a body edit, a tab closing inside the debounce, a failed request
 * disappearing with no retry and no sign anything went wrong.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import { DocumentSaveQueue, type DocumentPatch } from "../save-queue"

interface Sent {
  id: number
  patch: DocumentPatch
  init: RequestInit
}

function makeQueue(opts: { fail?: (n: number) => boolean } = {}) {
  const sent: Sent[] = []
  let attempt = 0
  const queue = new DocumentSaveQueue({
    delayMs: 100,
    retryDelayMs: 50,
    send: async (id, patch, init) => {
      attempt += 1
      sent.push({ id, patch: { ...patch }, init })
      return { ok: !opts.fail?.(attempt) }
    },
  })
  return { queue, sent }
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe("DocumentSaveQueue", () => {
  it("debounces repeated edits to one document into a single write", async () => {
    const { queue, sent } = makeQueue()

    queue.queue(1, { content: "a" })
    queue.queue(1, { content: "ab" })
    queue.queue(1, { content: "abc" })
    await vi.advanceTimersByTimeAsync(100)

    expect(sent).toEqual([{ id: 1, patch: { content: "abc" }, init: {} }])
  })

  it("does not let one document's edit cancel another's pending write", async () => {
    const { queue, sent } = makeQueue()

    queue.queue(1, { content: "first doc" })
    // Inside doc 1's debounce window — the old shared timer dropped doc 1's
    // write entirely at this point, and the edit never reached the server.
    await vi.advanceTimersByTimeAsync(50)
    queue.queue(2, { content: "second doc" })
    await vi.advanceTimersByTimeAsync(200)

    expect(sent.map((s) => [s.id, s.patch])).toEqual([
      [1, { content: "first doc" }],
      [2, { content: "second doc" }],
    ])
  })

  it("merges a title edit and a body edit on the same document", async () => {
    const { queue, sent } = makeQueue()

    queue.queue(1, { content: "body" })
    queue.queue(1, { title: "Renamed" })
    await vi.advanceTimersByTimeAsync(100)

    expect(sent).toHaveLength(1)
    expect(sent[0]!.patch).toEqual({ content: "body", title: "Renamed" })
  })

  it("retries a re-parent (parentId patch) the same way as a title or body edit", async () => {
    const { queue, sent } = makeQueue({ fail: (n) => n === 1 })

    // A move to a folder, then a move to the root — the second should win.
    queue.queue(1, { parentId: 5 })
    await vi.advanceTimersByTimeAsync(100)
    expect(sent[0]!.patch).toEqual({ parentId: 5 })
    expect(queue.state().failedIds).toEqual([1])

    queue.queue(1, { parentId: null })
    await vi.advanceTimersByTimeAsync(100)

    expect(sent[1]!.patch).toEqual({ parentId: null })
    expect(queue.state().pendingIds).toEqual([])
  })

  it("flushes everything still queued when the page goes away", async () => {
    const { queue, sent } = makeQueue()

    queue.queue(1, { content: "mid-sentence" })
    queue.queue(2, { title: "Renamed" })
    await queue.flushAll({ keepalive: true })

    expect(sent).toHaveLength(2)
    expect(sent.every((s) => s.init.keepalive === true)).toBe(true)
    expect(queue.state().pendingIds).toEqual([])
  })

  it("retries a failed write and reports the failure while it is failing", async () => {
    const states: string[] = []
    const sent: Sent[] = []
    let attempt = 0
    const queue = new DocumentSaveQueue({
      delayMs: 100,
      retryDelayMs: 50,
      send: async (id, patch, init) => {
        attempt += 1
        sent.push({ id, patch: { ...patch }, init })
        return { ok: attempt > 1 }
      },
      onStateChange: (s) => states.push(`${s.pendingIds.length}/${s.failedIds.length}`),
    })

    queue.queue(1, { content: "keep me" })
    await vi.advanceTimersByTimeAsync(100)
    expect(sent).toHaveLength(1)
    expect(queue.state().failedIds).toEqual([1])

    await vi.advanceTimersByTimeAsync(50)
    expect(sent).toHaveLength(2)
    expect(sent[1]!.patch).toEqual({ content: "keep me" })
    expect(queue.state()).toEqual({ pendingIds: [], saving: false, failedIds: [] })
    // The failure was visible to the UI, not swallowed.
    expect(states.some((s) => s.endsWith("/1"))).toBe(true)
  })

  it("retries with the newest text, not the text that failed", async () => {
    const { queue, sent } = makeQueue({ fail: (n) => n === 1 })

    queue.queue(1, { content: "old" })
    await vi.advanceTimersByTimeAsync(100)
    expect(sent[0]!.patch).toEqual({ content: "old" })

    queue.queue(1, { content: "new" })
    await vi.advanceTimersByTimeAsync(100)

    expect(sent[1]!.patch).toEqual({ content: "new" })
    expect(queue.state().pendingIds).toEqual([])
  })

  it("gives up after maxAttempts rather than retrying forever", async () => {
    const sent: Sent[] = []
    const queue = new DocumentSaveQueue({
      delayMs: 100,
      retryDelayMs: 50,
      maxAttempts: 3,
      send: async (id, patch, init) => {
        sent.push({ id, patch: { ...patch }, init })
        return { ok: false }
      },
    })

    queue.queue(1, { content: "doomed" })
    await vi.advanceTimersByTimeAsync(5000)

    expect(sent).toHaveLength(3)
    // Still queued: the next edit or flush gets another go, and the UI keeps
    // showing the document as unsaved rather than pretending it landed.
    expect(queue.state().pendingIds).toEqual([1])
  })

  it("drops queued writes for a deleted document", async () => {
    const { queue, sent } = makeQueue()

    queue.queue(1, { content: "about to be deleted" })
    queue.cancel(1)
    await vi.advanceTimersByTimeAsync(200)

    expect(sent).toEqual([])
    expect(queue.state().pendingIds).toEqual([])
  })

  it("keeps an edit made while a write was in flight", async () => {
    let resolveSend: (() => void) | null = null
    const sent: Sent[] = []
    const queue = new DocumentSaveQueue({
      delayMs: 100,
      send: async (id, patch, init) => {
        sent.push({ id, patch: { ...patch }, init })
        await new Promise<void>((resolve) => {
          resolveSend = resolve
        })
        return { ok: true }
      },
    })

    queue.queue(1, { content: "first" })
    await vi.advanceTimersByTimeAsync(100)
    expect(sent).toHaveLength(1)

    // Typed while the first PUT was still open.
    queue.queue(1, { content: "second" })
    resolveSend!()
    await vi.advanceTimersByTimeAsync(100)

    expect(sent).toHaveLength(2)
    expect(sent[1]!.patch).toEqual({ content: "second" })
  })
})

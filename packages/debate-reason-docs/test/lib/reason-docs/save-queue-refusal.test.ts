/**
 * @fileoverview REASON docs save queue: refusals.
 *
 * A 400 / 403 / 404 from `PUT /api/doc/documents/:id` answers the same way
 * on every retry, so the queue drops what was refused at once and reports it
 * (`onRejected`) instead of retrying it up to `maxAttempts` — while a body or
 * title edit that rode along with a refused move is still saved.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DocumentSaveQueue,
  isRefusal,
  type DocumentPatch,
  type SaveRejection,
  type SendResult,
} from "../../../src/lib/reason-docs/save-queue"

function makeQueue(answer: (patch: DocumentPatch, n: number) => SendResult) {
  const sent: DocumentPatch[] = []
  const rejections: SaveRejection[] = []
  const saved: Array<[number, DocumentPatch]> = []
  const queue = new DocumentSaveQueue({
    delayMs: 100,
    retryDelayMs: 50,
    send: async (_id, patch) => {
      sent.push({ ...patch })
      return answer(patch, sent.length)
    },
    onRejected: (r) => rejections.push(r),
    onSaved: (id, patch) => saved.push([id, { ...patch }]),
  })
  return { queue, sent, rejections, saved }
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe("isRefusal", () => {
  it("is true only for statuses a retry can't change", () => {
    expect([400, 403, 404].every(isRefusal)).toBe(true)
    expect([undefined, 200, 401, 408, 409, 413, 429, 500, 503].some(isRefusal)).toBe(false)
  })
})

describe("DocumentSaveQueue refusals", () => {
  it("does not retry a refused move, and reports it with the server's reason", async () => {
    const { queue, sent, rejections } = makeQueue(() => ({ ok: false, status: 400, error: "That folder no longer exists." }))

    queue.queue(1, { parentId: 9 })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(sent).toEqual([{ parentId: 9 }])
    expect(rejections).toEqual([{ id: 1, patch: { parentId: 9 }, status: 400, error: "That folder no longer exists." }])
    expect(queue.state()).toEqual({ pendingIds: [], saving: false, failedIds: [] })
  })

  it("still saves a body edit that rode along with a refused move", async () => {
    const { queue, sent, rejections, saved } = makeQueue((patch) =>
      "parentId" in patch ? { ok: false, status: 400 } : { ok: true, status: 200 },
    )

    queue.queue(1, { parentId: 9 })
    queue.queue(1, { content: "keep me" })
    await vi.advanceTimersByTimeAsync(100)

    expect(sent).toEqual([{ parentId: 9, content: "keep me" }, { content: "keep me" }])
    expect(rejections).toEqual([{ id: 1, patch: { parentId: 9 }, status: 400 }])
    expect(saved).toEqual([[1, { content: "keep me" }]])
    expect(queue.state().pendingIds).toEqual([])
  })

  it("drops every field on a 404 — the row is gone", async () => {
    const { queue, sent, rejections } = makeQueue(() => ({ ok: false, status: 404 }))

    queue.queue(1, { title: "T", content: "C" })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(sent).toHaveLength(1)
    expect(rejections).toEqual([{ id: 1, patch: { title: "T", content: "C" }, status: 404 }])
    expect(queue.state().pendingIds).toEqual([])
  })

  it("keeps a move made while the refused one was in flight, and reports nothing to undo", async () => {
    let release: (r: SendResult) => void = () => {}
    const sent: DocumentPatch[] = []
    const rejections: SaveRejection[] = []
    const queue = new DocumentSaveQueue({
      delayMs: 100,
      send: (_id, patch) => {
        sent.push({ ...patch })
        return sent.length === 1 ? new Promise<SendResult>((resolve) => (release = resolve)) : Promise.resolve({ ok: true })
      },
      onRejected: (r) => rejections.push(r),
    })

    queue.queue(1, { parentId: 9 })
    await vi.advanceTimersByTimeAsync(100)
    queue.queue(1, { parentId: 3 })
    release({ ok: false, status: 400 })
    await vi.advanceTimersByTimeAsync(100)

    expect(rejections).toEqual([])
    expect(sent).toEqual([{ parentId: 9 }, { parentId: 3 }])
    expect(queue.state().pendingIds).toEqual([])
  })

  it("still retries a 5xx, a 401 and a network error", async () => {
    for (const result of [{ ok: false, status: 503 }, { ok: false, status: 401 }, { ok: false }] as SendResult[]) {
      const { queue, sent, rejections } = makeQueue((_p, n) => (n === 1 ? result : { ok: true, status: 200 }))
      queue.queue(1, { content: "x" })
      await vi.advanceTimersByTimeAsync(150)
      expect(sent).toHaveLength(2)
      expect(rejections).toEqual([])
      expect(queue.state().pendingIds).toEqual([])
    }
  })

  it("reads the refusal reason from the default PUT", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "A folder can't be moved into itself." }), { status: 400 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const rejections: SaveRejection[] = []
    try {
      const queue = new DocumentSaveQueue({ delayMs: 10, onRejected: (r) => rejections.push(r) })
      queue.queue(4, { parentId: 4 })
      await vi.advanceTimersByTimeAsync(10)
      await vi.waitFor(() => expect(rejections).toHaveLength(1))
    } finally {
      vi.unstubAllGlobals()
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(rejections[0]).toEqual({ id: 4, patch: { parentId: 4 }, status: 400, error: "A folder can't be moved into itself." })
  })
})

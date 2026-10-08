/** @vitest-environment jsdom */
/**
 * @fileoverview `useSpeechSendLogSync`: the once-per-page-load merge between
 * the local speech-send log and the account, pushing new local entries as the
 * store changes, and the two mutators that also delete from the account.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flush, renderHook, type RenderedHook } from "../../helpers/render-hook"

type Entry = { id: string; title: string }

const store = vi.hoisted(() => {
  let entries: Entry[] = []
  const listeners = new Set<(entries: Entry[]) => void>()
  const emit = () => {
    for (const listener of listeners) listener(entries)
  }
  return {
    reset(next: Entry[] = []) {
      entries = next
      listeners.clear()
    },
    emit,
    speechSendLogStore: {
      init: vi.fn(async () => {}),
      list: () => entries,
      mergeRemote: vi.fn(async (incoming: Entry[]) => {
        entries = [...entries, ...incoming]
      }),
      remove: vi.fn(async (id: string) => {
        entries = entries.filter((entry) => entry.id !== id)
      }),
      clear: vi.fn(async () => {
        entries = []
      }),
      subscribe: (listener: (entries: Entry[]) => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      add(entry: Entry) {
        entries = [...entries, entry]
        emit()
      },
    },
  }
})
vi.mock("@debate/editor/engine", () => ({ speechSendLogStore: store.speechSendLogStore }))

const client = vi.hoisted(() => ({
  listSavedSpeechSendLog: vi.fn<() => Promise<Entry[] | null>>(),
  saveSpeechSendLogEntryToAccount: vi.fn<(entry: Entry) => Promise<void>>(),
  deleteSavedSpeechSendLogEntryFromAccount: vi.fn<(id: string) => Promise<void>>(),
}))
vi.mock("../../../src/lib/speech-send-log-client", () => client)

type Hook = typeof import("../../../src/lib/hooks/useSpeechSendLogSync")
let hookModule: Hook
let rendered: RenderedHook<ReturnType<Hook["useSpeechSendLogSync"]>, undefined> | null = null

beforeEach(async () => {
  vi.clearAllMocks()
  store.reset()
  client.saveSpeechSendLogEntryToAccount.mockResolvedValue(undefined)
  client.deleteSavedSpeechSendLogEntryFromAccount.mockResolvedValue(undefined)
  // The merge and the "known synced" set are module-level.
  vi.resetModules()
  hookModule = await import("../../../src/lib/hooks/useSpeechSendLogSync")
})

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

async function render() {
  rendered = await renderHook(() => hookModule.useSpeechSendLogSync())
  for (let i = 0; i < 3; i++) await flush()
  return rendered.result
}

describe("useSpeechSendLogSync signed out", () => {
  it("stays local-only and never calls the account", async () => {
    client.listSavedSpeechSendLog.mockResolvedValue(null)
    store.reset([{ id: "a", title: "1AC" }])
    const result = await render()
    expect(result.current.synced).toBe(false)

    await flush(() => store.speechSendLogStore.add({ id: "b", title: "2AC" }))
    await flush(() => result.current.removeEntry("a"))
    await flush(() => result.current.clearAll())
    expect(store.speechSendLogStore.list()).toEqual([])
    expect(client.saveSpeechSendLogEntryToAccount).not.toHaveBeenCalled()
    expect(client.deleteSavedSpeechSendLogEntryFromAccount).not.toHaveBeenCalled()
  })
})

describe("useSpeechSendLogSync signed in", () => {
  it("adopts remote-only entries and pushes local-only ones", async () => {
    store.reset([
      { id: "local", title: "1NC" },
      { id: "both", title: "1AC" },
    ])
    client.listSavedSpeechSendLog.mockResolvedValue([
      { id: "both", title: "1AC" },
      { id: "remote", title: "2NC" },
    ])
    const result = await render()

    expect(result.current.synced).toBe(true)
    expect(store.speechSendLogStore.init).toHaveBeenCalled()
    expect(store.speechSendLogStore.mergeRemote).toHaveBeenCalledWith([{ id: "remote", title: "2NC" }])
    expect(client.saveSpeechSendLogEntryToAccount.mock.calls.map(([entry]) => entry.id)).toEqual(["local"])
  })

  it("pushes each new entry once as the store changes", async () => {
    client.listSavedSpeechSendLog.mockResolvedValue([])
    await render()
    await flush(() => store.speechSendLogStore.add({ id: "new", title: "1AR" }))
    await flush(() => store.emit())
    expect(client.saveSpeechSendLogEntryToAccount.mock.calls.map(([entry]) => entry.id)).toEqual(["new"])
  })

  it("deletes removed and cleared entries from the account", async () => {
    client.listSavedSpeechSendLog.mockResolvedValue([
      { id: "a", title: "1AC" },
      { id: "b", title: "1NC" },
    ])
    const result = await render()

    await flush(() => result.current.removeEntry("a"))
    expect(client.deleteSavedSpeechSendLogEntryFromAccount).toHaveBeenCalledWith("a")

    await flush(() => result.current.clearAll())
    expect(client.deleteSavedSpeechSendLogEntryFromAccount.mock.calls.map(([id]) => id)).toEqual(["a", "b"])
    expect(store.speechSendLogStore.clear).toHaveBeenCalled()
  })
})

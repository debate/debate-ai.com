/** @vitest-environment jsdom */
/**
 * @fileoverview `useEditorPreferencesSync`: the account's editor preferences
 * hydrate the local settings store before the rows render, and only the
 * rendered, account-syncable keys are pushed back — debounced, only when
 * signed in, and only the keys whose value differs from what the account holds.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flush, renderHook, type RenderedHook } from "../../helpers/render-hook"

const store = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  const listeners = new Set<() => void>()
  return {
    values,
    listeners,
    settings: {
      get: (key: string) => values.get(key),
      set: (key: string, value: unknown) => {
        values.set(key, value)
        for (const listener of listeners) listener()
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
  }
})
vi.mock("@debate-ai/editor/settings", () => ({ settings: store.settings }))
vi.mock("../../../src/lib/editor-preferences", () => ({
  EDITOR_PREFERENCE_KEYS: new Set(["fontSize", "autocorrect"]),
}))

import { changedEditorPreferences, useEditorPreferencesSync } from "../../../src/lib/hooks/useEditorPreferencesSync"

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()
let rendered: RenderedHook<ReturnType<typeof useEditorPreferencesSync>, undefined> | null = null

beforeEach(() => {
  store.values.clear()
  store.listeners.clear()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function render() {
  rendered = await renderHook(() => useEditorPreferencesSync())
  // The settings module is imported dynamically, then the account is read.
  for (let i = 0; i < 5; i++) await flush()
  return rendered.result
}

const signedIn = (editorPreferences: Record<string, unknown> = {}) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ editorPreferences }), { status: 200 }))

describe("useEditorPreferencesSync", () => {
  it("hydrates the local store from the account before reporting ready", async () => {
    signedIn({ fontSize: 14 })
    const result = await render()
    expect(result.current.ready).toBe(true)
    expect(store.values.get("fontSize")).toBe(14)
    expect(fetchMock).toHaveBeenCalledWith("/api/settings")
  })

  it("is ready with local values when signed out or offline", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }))
    expect((await render()).current.ready).toBe(true)
    await rendered!.unmount()

    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    expect((await render()).current.ready).toBe(true)
    expect(store.values.size).toBe(0)
  })

  it("pushes only rendered, syncable keys, debounced into one PUT", async () => {
    signedIn()
    const result = await render()
    vi.useFakeTimers()
    result.current.noteRenderedKeys(["fontSize", "notSyncable"])
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))

    store.settings.set("fontSize", 16)
    store.settings.set("fontSize", 18)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(600)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("/api/settings")
    expect(init?.method).toBe("PUT")
    expect(JSON.parse(String(init?.body))).toEqual({ editorPreferences: { fontSize: 18 } })
  })

  it("sends nothing when no syncable row has rendered", async () => {
    signedIn()
    await render()
    vi.useFakeTimers()
    store.settings.set("fontSize", 16)
    await vi.advanceTimersByTimeAsync(600)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("never pushes while signed out", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }))
    const result = await render()
    vi.useFakeTimers()
    result.current.noteRenderedKeys(["fontSize"])
    store.settings.set("fontSize", 16)
    await vi.advanceTimersByTimeAsync(600)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.listeners.size).toBe(0)
  })

  it("pushes only the keys that changed, not a stale copy of every other key", async () => {
    // Another tab already saved autocorrect=false; this tab hydrated before
    // that, so it still holds the account's older value — but it only changes fontSize.
    signedIn({ fontSize: 14, autocorrect: true })
    const result = await render()
    vi.useFakeTimers()
    result.current.noteRenderedKeys(["fontSize", "autocorrect"])
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))

    store.settings.set("fontSize", 16)
    await vi.advanceTimersByTimeAsync(600)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({ editorPreferences: { fontSize: 16 } })
  })

  it("sends a key the account doesn't hold yet once, then only what changes", async () => {
    signedIn({ fontSize: 14 })
    store.values.set("autocorrect", true)
    const result = await render()
    vi.useFakeTimers()
    result.current.noteRenderedKeys(["fontSize", "autocorrect"])
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))

    store.settings.set("fontSize", 16)
    await vi.advanceTimersByTimeAsync(600)
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      editorPreferences: { fontSize: 16, autocorrect: true },
    })

    store.settings.set("fontSize", 18)
    await vi.advanceTimersByTimeAsync(600)
    expect(JSON.parse(String(fetchMock.mock.calls[2]![1]?.body))).toEqual({ editorPreferences: { fontSize: 18 } })
  })

  it("retries a change whose PUT failed or was refused with the next push", async () => {
    signedIn({ fontSize: 14, autocorrect: true })
    const result = await render()
    vi.useFakeTimers()
    result.current.noteRenderedKeys(["fontSize", "autocorrect"])

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }))
    store.settings.set("fontSize", 16)
    await vi.advanceTimersByTimeAsync(600)

    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    store.settings.set("autocorrect", false)
    await vi.advanceTimersByTimeAsync(600)

    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))
    store.settings.set("autocorrect", false)
    await vi.advanceTimersByTimeAsync(600)

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(JSON.parse(String(fetchMock.mock.calls[3]![1]?.body))).toEqual({
      editorPreferences: { fontSize: 16, autocorrect: false },
    })
  })

  it("sends nothing when a change is set back to the account's value", async () => {
    signedIn({ fontSize: 14 })
    const result = await render()
    vi.useFakeTimers()
    result.current.noteRenderedKeys(["fontSize"])
    store.settings.set("fontSize", 16)
    store.settings.set("fontSize", 14)
    await vi.advanceTimersByTimeAsync(600)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("changedEditorPreferences", () => {
  it("keeps keys that differ from or are missing in the baseline, compared as JSON", () => {
    const baseline = new Map([
      ["fontSize", "14"],
      ["fonts", JSON.stringify(["Calibri"])],
      ["autocorrect", "true"],
    ])
    expect(
      changedEditorPreferences(baseline, { fontSize: 16, fonts: ["Calibri"], autocorrect: true, newKey: "x" }),
    ).toEqual({ fontSize: 16, newKey: "x" })
    expect(changedEditorPreferences(new Map(), {})).toEqual({})
  })
})

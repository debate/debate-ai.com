/** @vitest-environment jsdom */
/**
 * @fileoverview `useChatTabs`: the open chat-tab list persisted beside the
 * active chat, the active chat's title following its first message, and the
 * open/new/close helpers re-arming empty chats instead of fetching them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flush, renderHook, type RenderedHook } from "../../helpers/render-hook"

type Turn = { content: string }
const chat = vi.hoisted(() => ({
  current: {
    chatId: null as string | null,
    chatTurns: [] as Turn[],
    startNewChat: vi.fn(),
    switchToChat: vi.fn(),
  },
}))
vi.mock("research-agent-ui", () => ({ useChat: () => chat.current }))

import { useChatTabs } from "../../../src/components/qwksearch/useChatTabs"

const STORAGE_KEY = "qwksearch-open-chat-tabs"
let rendered: RenderedHook<ReturnType<typeof useChatTabs>, undefined> | null = null

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  chat.current = { ...chat.current, chatId: null, chatTurns: [] }
})

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

async function render() {
  rendered = await renderHook(() => useChatTabs())
  return rendered
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")

describe("useChatTabs", () => {
  it("adds the active chat as a tab and titles it from its first message", async () => {
    chat.current = { ...chat.current, chatId: "c1" }
    const hook = await render()
    expect(hook.result.current.chatTabs).toEqual([{ id: "c1", title: "New Chat", hasMessages: false }])
    expect(hook.result.current.activeChatId).toBe("c1")

    chat.current = { ...chat.current, chatTurns: [{ content: "x".repeat(80) }] }
    await hook.rerender(undefined)
    expect(hook.result.current.chatTabs).toEqual([{ id: "c1", title: "x".repeat(50), hasMessages: true }])
    expect(stored()).toEqual(hook.result.current.chatTabs)
  })

  it("restores tabs saved earlier, and ignores corrupt storage", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "old", title: "Old chat", hasMessages: true }]))
    expect((await render()).result.current.chatTabs).toEqual([{ id: "old", title: "Old chat", hasMessages: true }])
    await rendered!.unmount()
    rendered = null

    localStorage.setItem(STORAGE_KEY, "{bad")
    expect((await render()).result.current.chatTabs).toEqual([])
  })

  it("opens a chat with messages by fetching it, and an empty one by re-arming it", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "full", title: "Full", hasMessages: true },
        { id: "empty", title: "New Chat" },
      ]),
    )
    const { result } = await render()
    result.current.openChat("full")
    result.current.openChat("empty")
    expect(chat.current.switchToChat).toHaveBeenCalledWith("full")
    expect(chat.current.startNewChat).toHaveBeenCalledWith("empty")
  })

  it("creates a new chat tab and starts it", async () => {
    const { result } = await render()
    let id = ""
    await flush(() => {
      id = result.current.newChat()
    })
    expect(chat.current.startNewChat).toHaveBeenCalledWith(id)
    expect(result.current.chatTabs).toEqual([{ id, title: "New Chat" }])
  })

  it("closes the active chat onto its left neighbour", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "a", title: "A", hasMessages: true },
        { id: "b", title: "B", hasMessages: true },
        { id: "c", title: "C", hasMessages: true },
      ]),
    )
    chat.current = { ...chat.current, chatId: "b", chatTurns: [{ content: "B" }] }
    const { result } = await render()
    let outcome: ReturnType<typeof result.current.closeChat> | undefined
    await flush(() => {
      outcome = result.current.closeChat("b")
    })
    expect(outcome).toEqual({ closedWasActive: true, nextActiveId: "a" })
    expect(chat.current.switchToChat).toHaveBeenCalledWith("a")
    expect(result.current.chatTabs.map((tab) => tab.id)).toEqual(["a", "c"])
  })

  it("closing an inactive tab leaves the active chat, and closing the last tab says so", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "a", title: "A", hasMessages: true }]))
    chat.current = { ...chat.current, chatId: "a", chatTurns: [{ content: "A" }] }
    const { result } = await render()
    let other: unknown
    await flush(() => {
      other = result.current.closeChat("not-open")
    })
    expect(other).toEqual({ closedWasActive: false, nextActiveId: null })

    let last: unknown
    await flush(() => {
      last = result.current.closeChat("a")
    })
    expect(last).toEqual({ closedWasActive: true, nextActiveId: null })
    expect(chat.current.switchToChat).not.toHaveBeenCalled()
  })
})

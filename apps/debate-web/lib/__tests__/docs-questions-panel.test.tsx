// @vitest-environment jsdom
/**
 * The docs' "Ask about this page" panel
 * (`packages/debate-help-docs/components/guides/suggest-questions.tsx`):
 * questions earlier readers asked are listed with their saved answers, folded
 * under the question; opening one shows the answer as rendered Markdown and
 * never calls the AI; a new answer is asked once and saved for everyone.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionsPanel } from "../../../../packages/debate-help-docs/components/guides/suggest-questions"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PAGE = "/docs/learn/critiques/heidegger"
let calls: Array<{ url: string; method: string; body?: string }> = []
let container: HTMLDivElement
let root: Root

function reply(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
}

beforeEach(() => {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined })
      if (url.startsWith("/api/docs-answers?")) {
        return reply({ answers: [{ question: "What does doing nothing mean?", answer: "## Not withdrawal\n\n- **restraint**" }] })
      }
      if (url === "/api/docs-answers") return reply({ stored: true })
      // The AI: suggestions, then answers.
      const prompt = JSON.parse(String(init?.body)).prompt as string
      return reply({ text: /suggest|question/i.test(prompt) && !prompt.includes("Is debate") ? "1. Is debate calculative?" : "### Yes\n\nIt *can* be." })
    }),
  )
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })
const rows = () => [...container.querySelectorAll<HTMLButtonElement>("li > button[aria-expanded]")]
const row = (text: string) => rows().find((button) => button.textContent?.includes(text))!

describe("QuestionsPanel", () => {
  it("lists saved answers folded, opens them as Markdown without the AI, and saves new answers", async () => {
    await act(async () => {
      root.render(<QuestionsPanel getText={() => "Heidegger on technology."} savedAnswersKey={PAGE} />)
    })
    await flush()

    const saved = row("What does doing nothing mean?")
    expect(saved.getAttribute("aria-expanded")).toBe("false")
    expect(container.textContent).not.toContain("Not withdrawal")

    const aiCallsBefore = calls.filter((call) => call.url === "/api/reason-ai").length
    await act(async () => saved.click())
    await flush()
    expect(row("What does doing nothing mean?").getAttribute("aria-expanded")).toBe("true")
    expect(container.querySelector("li h2")?.textContent).toBe("Not withdrawal")
    expect(container.querySelector("li strong")?.textContent).toBe("restraint")
    expect(calls.filter((call) => call.url === "/api/reason-ai").length).toBe(aiCallsBefore)

    // Folding it away again.
    await act(async () => row("What does doing nothing mean?").click())
    expect(container.querySelector("li h2")).toBeNull()

    // A suggested question nobody has answered goes to the AI once, then is saved.
    await act(async () => row("Is debate calculative?").click())
    await flush()
    expect(container.querySelector("li h3")?.textContent).toBe("Yes")
    const save = calls.find((call) => call.url === "/api/docs-answers" && call.method === "POST")
    expect(JSON.parse(save!.body!)).toMatchObject({ page: PAGE, question: "Is debate calculative?", answer: "### Yes\n\nIt *can* be." })
  })
})

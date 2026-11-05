"use client"
/**
 * @file suggest-questions.tsx
 * @description "Suggest questions" on the Synergy Slayer pages: a toggle
 * beside Voice and the questions panel it shows at the end of the page.
 *
 * With it on, the AI reads the page and suggests questions about it; clicking
 * one (or typing your own) answers it from the page's text. It is the same
 * Ask / Suggest flow as the browser extension's reading mode, using the same
 * prompts (`@debate-ai/reading-mode`), and reading mode
 * (`reading-mode.tsx`) shows the same panel beside a whole section.
 *
 * Off by default on a page, so pages don't spend AI requests nobody asked
 * for; the choice is kept in this browser (`SUGGEST_QUESTIONS_KEY`). Reading
 * mode has its own toggle, on by default.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react"
import { Loader2, MessageCircleQuestion, RefreshCw, Send } from "lucide-react"
import {
  askQuestion,
  splitQuestions,
  suggestQuestions,
  type ChatTurn,
} from "@debate-ai/reading-mode/questions"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { generateWithSite, readableText } from "./docs-ai"

/** Where the page toggle is kept, in this browser. */
export const SUGGEST_QUESTIONS_KEY = "debate-docs-suggest-questions"
/** Fired on `window` when the page toggle changes, so every copy of it agrees. */
const CHANGE_EVENT = "debate-docs-suggest-questions-change"
/** The page content questions are about (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const PAGE_CONTENT_SELECTOR = ".synergy-slayer-doc"

function readSetting(): boolean {
  try {
    return localStorage.getItem(SUGGEST_QUESTIONS_KEY) === "on"
  } catch {
    return false
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** The page toggle's value and setter (off on the server and by default). */
export function useSuggestQuestionsSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, readSetting, () => false)
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(SUGGEST_QUESTIONS_KEY, next ? "on" : "off")
    } catch {
      // Private mode or blocked storage: nothing to keep.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])
  return [on, set]
}

/** An on/off toggle button in the style of the Underlining and Voice buttons. */
export function QuestionsToggleButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Stop suggesting questions about this text" : "Have the AI suggest questions about this text, and answer them"}
      className={cn(
        buttonVariants({ size: "sm", className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground" }),
        on && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
      )}
      onClick={onToggle}
    >
      <MessageCircleQuestion />
      Suggest questions {on ? "on" : "off"}
    </button>
  )
}

/** The page's "Suggest questions" toggle, beside Voice. */
export function SuggestQuestionsToggle() {
  const [on, setOn] = useSuggestQuestionsSetting()
  return (
    <QuestionsToggleButton
      on={on}
      onToggle={() => {
        const next = !on
        setOn(next)
        // Turning it on shows the questions; bring them into view.
        if (next) {
          requestAnimationFrame(() =>
            document.getElementById("suggested-questions")?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
          )
        }
      }}
    />
  )
}

interface Answer {
  question: string
  answer?: string
  error?: string
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong."
}

/**
 * Suggested questions about a text, an Ask box, and the answers.
 * `getText` is read when a request starts, so it always sees the latest text
 * (and any passages the reader marked).
 */
export function QuestionsPanel({
  getText,
  maxChars,
  className,
  heading = "Ask about this page",
}: {
  getText: () => string
  maxChars?: number
  className?: string
  heading?: string
}) {
  const [questions, setQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState<Answer[]>([])
  const [input, setInput] = useState("")
  const controller = useRef<AbortController | null>(null)
  const history = useRef<ChatTurn[]>([])

  useEffect(() => () => controller.current?.abort(), [])

  const suggest = useCallback(async () => {
    const text = getText()
    if (!text) return
    setLoading(true)
    setError("")
    try {
      const signal = (controller.current ??= new AbortController()).signal
      setQuestions(
        splitQuestions(await suggestQuestions(generateWithSite, { article: text, chatHistory: history.current, maxChars, signal })),
      )
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [getText, maxChars])

  // Suggest as soon as the panel shows.
  useEffect(() => {
    void suggest()
  }, [suggest])

  const ask = async (question: string) => {
    const text = getText()
    if (!question.trim() || !text) return
    const index = answers.length
    setAnswers((list) => [...list, { question }])
    try {
      const signal = (controller.current ??= new AbortController()).signal
      const answer = await askQuestion(generateWithSite, {
        article: text,
        question,
        chatHistory: history.current,
        maxChars,
        signal,
      })
      history.current = [...history.current, { role: "user", content: question }, { role: "assistant", content: answer }]
      setAnswers((list) => list.map((item, i) => (i === index ? { ...item, answer } : item)))
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      setAnswers((list) => list.map((item, i) => (i === index ? { ...item, error: describeError(err) } : item)))
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const question = input
    setInput("")
    void ask(question)
  }

  return (
    <section
      aria-label={heading}
      className={cn("not-prose space-y-3 rounded-lg border bg-fd-card p-4 text-sm text-fd-card-foreground", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <MessageCircleQuestion className="size-4 text-fd-primary" aria-hidden />
          {heading}
        </h3>
        <button
          type="button"
          disabled={loading}
          title="Suggest different questions"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fd-muted-foreground hover:bg-fd-accent disabled:opacity-50"
          onClick={() => void suggest()}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Suggest
        </button>
      </div>

      {loading && questions.length === 0 && (
        <p role="status" className="text-fd-muted-foreground">
          Reading and suggesting questions…
        </p>
      )}
      {error && <p className="rounded-md bg-red-500/10 p-2 text-red-600 dark:text-red-400">{error}</p>}

      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((question, index) => (
            <button
              key={`${index}-${question.slice(0, 40)}`}
              type="button"
              className="w-full rounded-md border bg-fd-background p-2.5 text-left font-medium shadow-sm transition-colors hover:border-fd-primary hover:bg-fd-primary/10"
              onClick={() => void ask(question)}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {answers.length > 0 && (
        <ol className="space-y-3">
          {answers.map((item, index) => (
            <li key={index} className="space-y-1.5 border-t pt-3">
              <p className="font-semibold">{item.question}</p>
              {item.answer != null ? (
                <p className="whitespace-pre-wrap leading-relaxed text-fd-muted-foreground">{item.answer}</p>
              ) : item.error ? (
                <p className="text-red-600 dark:text-red-400">{item.error}</p>
              ) : (
                <p className="flex items-center gap-2 text-fd-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Answering…
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask your own question…"
          aria-label="Ask a question"
          className="min-w-0 flex-1 rounded-md border bg-fd-background px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-fd-primary/40"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Ask"
          className="inline-flex items-center rounded-md bg-fd-primary px-2.5 text-fd-primary-foreground disabled:opacity-50"
        >
          <Send className="size-3.5" />
        </button>
      </form>
    </section>
  )
}

/** The questions panel at the end of a Synergy Slayer page, while the toggle is on. */
export function PageSuggestedQuestions() {
  const [on] = useSuggestQuestionsSetting()
  const getText = useCallback(() => readableText(document.querySelector(PAGE_CONTENT_SELECTOR)), [])
  if (!on) return null
  return (
    <div id="suggested-questions" className="mt-10">
      <QuestionsPanel getText={getText} />
    </div>
  )
}

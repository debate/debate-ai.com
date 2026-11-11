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
 * Each answer is rendered as Markdown and folds away under its question.
 * Answers are saved per page and question for every reader
 * (`saved-answers.ts`): a question someone already asked on a page opens the
 * saved answer instead of calling the AI again. A page that already has
 * saved questions shows those and doesn't ask the AI for a new set; the
 * Suggest button still does.
 *
 * Off by default on a page, so pages don't spend AI requests nobody asked
 * for; the choice is kept in this browser (`SUGGEST_QUESTIONS_KEY`). Reading
 * mode has its own toggle, on by default.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react"
import { Check, ChevronRight, Loader2, MessageCircleQuestion, RefreshCw, Send } from "lucide-react"
import {
  askQuestion,
  splitQuestions,
  suggestQuestions,
  type ChatTurn,
} from "@debate-ai/reading-mode/questions"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { renderAnswerMarkdown } from "./answer-markdown"
import { generateWithSite, readableText } from "./docs-ai"
import {
  loadSavedAnswers,
  normalizeQuestion,
  saveAnswer,
  savedAnswersPageKey,
  type SavedAnswer,
} from "./saved-answers"

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

/** A question in the panel: suggested, saved by an earlier reader, or asked here. */
interface QuestionItem {
  /** `normalizeQuestion(question)`, shared by every asking of the same question. */
  key: string
  question: string
  answer?: string
  error?: string
  pending?: boolean
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong."
}

/**
 * Prose styles for a rendered answer. The panel is `not-prose` (and the
 * typography plugin can't be switched back on inside it), so the few
 * elements an answer uses are styled here.
 */
const ANSWER_MARKDOWN_CLASSES = cn(
  "space-y-2 leading-relaxed text-fd-foreground/90",
  "[&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_h4]:font-semibold",
  "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
  "[&_strong]:font-semibold [&_a]:text-fd-primary [&_a]:underline",
  "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_code]:rounded [&_code]:bg-fd-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_hr]:my-3",
  "[&_table]:w-full [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:px-2 [&_td]:py-1",
  "[&>*:first-child]:mt-0",
)

/** An answer's Markdown, rendered and sanitized. */
function AnswerMarkdown({ markdown }: { markdown: string }) {
  const html = useMemo(() => renderAnswerMarkdown(markdown), [markdown])
  return <div className={ANSWER_MARKDOWN_CLASSES} dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Suggested questions about a text, an Ask box, and the answers, each one
 * collapsible under its question.
 * `getText` is read when a request starts, so it always sees the latest text
 * (and any passages the reader marked).
 *
 * With `savedAnswersKey` (a page key, see `savedAnswersPageKey`), answers are
 * shared through the database: the questions earlier readers asked here are
 * listed with their answers, a question already answered opens its saved
 * answer instead of asking the AI again, and a new answer is saved for
 * everyone, signed-out readers' answers included.
 */
export function QuestionsPanel({
  getText,
  maxChars,
  className,
  heading = "Ask about this page",
  savedAnswersKey,
}: {
  getText: () => string
  maxChars?: number
  className?: string
  heading?: string
  savedAnswersKey?: string
}) {
  const [items, setItems] = useState<QuestionItem[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [input, setInput] = useState("")
  const controller = useRef<AbortController | null>(null)
  const history = useRef<ChatTurn[]>([])
  const itemsRef = useRef<QuestionItem[]>([])
  itemsRef.current = items
  /** The saved answers for this page, once loaded (`[]` without a key). */
  const saved = useRef<Promise<SavedAnswer[]>>(Promise.resolve([]))

  useEffect(() => () => controller.current?.abort(), [])

  const signal = () => (controller.current ??= new AbortController()).signal

  /** Applies `patch` to the item with `key`, adding it (at the end) when it isn't listed. */
  const upsert = useCallback((key: string, question: string, patch: Partial<QuestionItem>) => {
    setItems((list) =>
      list.some((item) => item.key === key)
        ? list.map((item) => (item.key === key ? { ...item, ...patch } : item))
        : [...list, { key, question, ...patch }],
    )
  }, [])

  // List what earlier readers asked here, with their answers, collapsed.
  useEffect(() => {
    if (!savedAnswersKey) {
      saved.current = Promise.resolve([])
      return
    }
    const load = loadSavedAnswers(savedAnswersKey, signal())
    saved.current = load
    void load.then((answers) => {
      setItems((list) => {
        const next = [...list]
        for (const { question, answer } of answers) {
          const key = normalizeQuestion(question)
          const index = next.findIndex((item) => item.key === key)
          if (index === -1) next.push({ key, question, answer })
          else if (next[index]!.answer == null) next[index] = { ...next[index]!, answer, pending: false, error: undefined }
        }
        return next
      })
    })
  }, [savedAnswersKey])

  const suggest = useCallback(async () => {
    const text = getText()
    if (!text) return
    setLoading(true)
    setError("")
    try {
      const questions = splitQuestions(
        await suggestQuestions(generateWithSite, { article: text, chatHistory: history.current, maxChars, signal: signal() }),
      )
      // New suggestions lead; questions already answered (or being answered) stay.
      setItems((list) => {
        const kept = list.filter((item) => item.answer != null || item.pending)
        const keptKeys = new Set(kept.map((item) => item.key))
        const fresh: QuestionItem[] = []
        for (const question of questions) {
          const key = normalizeQuestion(question)
          if (!key || keptKeys.has(key) || fresh.some((item) => item.key === key)) continue
          fresh.push({ key, question })
        }
        return [...fresh, ...kept]
      })
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [getText, maxChars])

  // Suggest as soon as the panel shows, unless this page already has
  // questions: when earlier readers' questions (and answers) are saved for
  // it, those are the page's follow-up questions and no new set is made.
  // The Suggest button still asks for more.
  useEffect(() => {
    let cancelled = false
    void saved.current.then((answers) => {
      if (!cancelled && answers.length === 0) void suggest()
    })
    return () => {
      cancelled = true
    }
  }, [suggest])

  /** Opens `question` and answers it: from what is listed, then the saved answers, then the AI. */
  const ask = async (question: string) => {
    const key = normalizeQuestion(question)
    if (!key) return
    setOpen((state) => ({ ...state, [key]: true }))
    const existing = itemsRef.current.find((item) => item.key === key)
    if (existing?.answer != null || existing?.pending) return
    upsert(key, existing?.question ?? question.trim(), { pending: true, error: undefined })
    const remember = (answer: string) => {
      history.current = [...history.current, { role: "user", content: question }, { role: "assistant", content: answer }]
    }

    // Never ask the AI a question this page already has an answer to: check
    // what was loaded with the panel, then ask the site again in case another
    // reader answered it since.
    const match = (list: SavedAnswer[]) => list.find((item) => normalizeQuestion(item.question) === key)
    let savedAnswer = match(await saved.current)
    if (!savedAnswer && savedAnswersKey) savedAnswer = match(await loadSavedAnswers(savedAnswersKey, signal()))
    if (savedAnswer) {
      remember(savedAnswer.answer)
      upsert(key, question, { answer: savedAnswer.answer, pending: false })
      return
    }

    const text = getText()
    if (!text) {
      upsert(key, question, { pending: false, error: "There is no text on this page to answer from." })
      return
    }
    try {
      const answer = await askQuestion(generateWithSite, {
        article: text,
        question,
        chatHistory: history.current,
        maxChars,
        signal: signal(),
      })
      remember(answer)
      upsert(key, question, { answer, pending: false })
      if (savedAnswersKey && answer.trim()) void saveAnswer(savedAnswersKey, question, answer)
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      upsert(key, question, { pending: false, error: describeError(err) })
    }
  }

  const toggle = (item: QuestionItem) => {
    if (open[item.key]) setOpen((state) => ({ ...state, [item.key]: false }))
    else void ask(item.question)
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

      {loading && items.length === 0 && (
        <p role="status" className="text-fd-muted-foreground">
          Reading and suggesting questions…
        </p>
      )}
      {error && <p className="rounded-md bg-red-500/10 p-2 text-red-600 dark:text-red-400">{error}</p>}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const isOpen = Boolean(open[item.key])
            const bodyId = `answer-${item.key.slice(0, 40).replace(/[^a-z0-9]+/g, "-")}-${items.indexOf(item)}`
            return (
              <li key={item.key} className="overflow-hidden rounded-md border bg-fd-background shadow-sm">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  className={cn(
                    "flex w-full items-start gap-2 p-2.5 text-left font-medium transition-colors hover:bg-fd-primary/10",
                    isOpen && "bg-fd-primary/5",
                  )}
                  onClick={() => toggle(item)}
                >
                  <ChevronRight
                    aria-hidden
                    className={cn("mt-0.5 size-4 shrink-0 text-fd-muted-foreground transition-transform", isOpen && "rotate-90")}
                  />
                  <span className="flex-1">{item.question}</span>
                  {item.answer != null && !isOpen && (
                    <span title="Answered — opens without asking the AI again">
                      <Check aria-label="Answered" className="mt-0.5 size-3.5 shrink-0 text-fd-primary" />
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div id={bodyId} className="border-t px-3 py-2.5">
                    {item.answer != null ? (
                      <AnswerMarkdown markdown={item.answer} />
                    ) : item.error ? (
                      <p className="text-red-600 dark:text-red-400">{item.error}</p>
                    ) : (
                      <p className="flex items-center gap-2 text-fd-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Answering…
                      </p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
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
      <QuestionsPanel getText={getText} savedAnswersKey={savedAnswersPageKey(window.location.pathname)} />
    </div>
  )
}

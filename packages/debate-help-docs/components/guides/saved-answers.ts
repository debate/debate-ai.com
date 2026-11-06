/**
 * @file saved-answers.ts
 * @description Answers to the docs' suggested questions, saved once and
 * shared with every reader.
 *
 * An answer depends on the page and the question, not on who asked, so the
 * first good answer to a question on a page is saved on the hosting site
 * (`/api/docs-answers` on debate-ai.com) and every later reader of that page
 * gets it from there instead of a fresh AI request: a question is answered by
 * the AI once. Reading and saving are both open to signed-out readers (who
 * get AI answers too); the first answer saved is kept, so a later save can't
 * replace it. A site that mounts the docs without the endpoint simply
 * has nothing saved: every call here fails quietly.
 *
 * The validation is shared with the server route, so both agree on what a
 * page key and a question key are.
 */

/** The hosting site's saved-answers endpoint when nothing else is configured. */
export const DEFAULT_SAVED_ANSWERS_ENDPOINT = "/api/docs-answers"
/** A `<meta>` tag a hosting site can set to name its own endpoint. */
export const SAVED_ANSWERS_ENDPOINT_META = "docs-answers-endpoint"

/** Longest question that is saved. */
export const MAX_QUESTION_CHARS = 600
/** Longest answer that is saved. */
export const MAX_ANSWER_CHARS = 20_000
/** Longest page key. */
export const MAX_PAGE_CHARS = 300

/** A saved question and its answer. */
export interface SavedAnswer {
  question: string
  answer: string
}

/**
 * The key two askings of the same question share: case, spacing and the
 * closing punctuation don't make it a different question.
 */
export function normalizeQuestion(question: string): string {
  return question
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s?!.]+$/, "")
}

/**
 * Whether `page` names a docs page: its path under `/docs/`, plus an optional
 * `#scope` for a panel that is about more than the page (reading mode's
 * whole paper is `#paper`).
 */
export function isSavedAnswersPage(page: unknown): page is string {
  return (
    typeof page === "string" &&
    page.length <= MAX_PAGE_CHARS &&
    /^\/docs(\/[A-Za-z0-9._~%-]+)+(#[a-z-]+)?$/.test(page) &&
    !page.split("/").includes("..")
  )
}

/** The page key for the current page, or the page with a scope (`#paper`). */
export function savedAnswersPageKey(pathname: string, scope?: string): string {
  const path = pathname.replace(/\/+$/, "") || pathname
  return scope ? `${path}#${scope}` : path
}

export type SavedAnswerWrite = { page: string; question: string; answer: string }

/** Checks a save request's body. */
export function parseSavedAnswerWrite(
  body: unknown,
): { ok: true; value: SavedAnswerWrite } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Send { page, question, answer }." }
  const { page, question, answer } = body as Record<string, unknown>
  if (!isSavedAnswersPage(page)) return { ok: false, error: "`page` must be a /docs/ path." }
  if (typeof question !== "string" || !normalizeQuestion(question)) {
    return { ok: false, error: "`question` is required." }
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return { ok: false, error: `\`question\` is longer than ${MAX_QUESTION_CHARS} characters.` }
  }
  if (typeof answer !== "string" || !answer.trim()) return { ok: false, error: "`answer` is required." }
  if (answer.length > MAX_ANSWER_CHARS) {
    return { ok: false, error: `\`answer\` is longer than ${MAX_ANSWER_CHARS} characters.` }
  }
  return { ok: true, value: { page, question: question.trim(), answer: answer.trim() } }
}

let configuredEndpoint: string | null = null

/** Points saved answers at the hosting site's own endpoint. `null` restores the default. */
export function configureSavedAnswers(options: { endpoint: string | null }): void {
  configuredEndpoint = options.endpoint?.trim() || null
}

/** The endpoint requests go to: configured, then the page's meta tag, then the default. */
export function savedAnswersEndpoint(): string {
  if (configuredEndpoint) return configuredEndpoint
  if (typeof document !== "undefined") {
    const meta = document.querySelector<HTMLMetaElement>(`meta[name="${SAVED_ANSWERS_ENDPOINT_META}"]`)?.content?.trim()
    if (meta) return meta
  }
  return DEFAULT_SAVED_ANSWERS_ENDPOINT
}

function isSavedAnswer(value: unknown): value is SavedAnswer {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return typeof record.question === "string" && typeof record.answer === "string" && record.answer.length > 0
}

/** Every answer saved for `page`, oldest first; `[]` when none are, or the site doesn't save them. */
export async function loadSavedAnswers(page: string, signal?: AbortSignal): Promise<SavedAnswer[]> {
  if (!isSavedAnswersPage(page)) return []
  try {
    const response = await fetch(`${savedAnswersEndpoint()}?page=${encodeURIComponent(page)}`, {
      credentials: "same-origin",
      signal,
    })
    if (!response.ok) return []
    const payload = (await response.json()) as { answers?: unknown }
    return Array.isArray(payload.answers) ? payload.answers.filter(isSavedAnswer) : []
  } catch {
    return []
  }
}

/**
 * Offers an answer the reader just got for every later reader. Quiet when it
 * isn't saved (already saved, or no endpoint).
 */
export async function saveAnswer(page: string, question: string, answer: string): Promise<void> {
  if (!parseSavedAnswerWrite({ page, question, answer }).ok) return
  try {
    await fetch(savedAnswersEndpoint(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ page, question, answer }),
    })
  } catch {
    // Saving is a bonus for later readers; this reader already has the answer.
  }
}

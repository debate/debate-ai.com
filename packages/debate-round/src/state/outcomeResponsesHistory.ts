/**
 * @fileoverview The last AI Outcome Responses run for each speech of a round.
 *
 * The timer menu's **AI Outcome Responses** dialog (`dialogs/AiOutcomeResponsesDialog.tsx`)
 * used to throw its three candidate speeches away when it closed, so reopening
 * it re-ran (and re-paid for) the same simulation, and nothing followed the
 * user to another device. This store keeps the latest run per speech, scoped
 * like {@link speechDocLinkScope}: to the round when the flow belongs to one
 * (a round's flows share their speeches), else to the flow.
 *
 * Records are a JSON array under {@link OUTCOME_RESPONSES_KEY}, each keyed by
 * `id` = `${scope}:${SPEECH}`, which is the shape `debate-search-evidence`'s
 * `aiOutcomeResponses` tool-record collection syncs to a signed-in user's
 * `saved_tool_records` rows. Flow and round ids are the same client ids
 * `/api/flows` and `/api/rounds` key by, so a run resolves on any device once
 * its round has synced. Each write fires {@link OUTCOME_RESPONSES_EVENT}; a sync
 * hydration fires a `storage` event for the key instead.
 *
 * @module state/outcomeResponsesHistory
 */

import {
  parseSpeechOutcomeResponsesResponse,
  type SpeechOutcomeResponsesResult,
} from "@debate-ai/speech-writer/src/prompts/speech-outcome-responses"

export const OUTCOME_RESPONSES_KEY = "aiOutcomeResponses"
export const OUTCOME_RESPONSES_EVENT = "ai-outcome-responses-changed"
/** Newest runs kept; older ones are dropped first so one account row set stays small. */
export const MAX_SAVED_OUTCOME_RESPONSES = 60
/** Longest focus note kept with a run. */
export const MAX_SAVED_FOCUS_CHARS = 500

/** What the dialog saves after a successful run. */
export interface OutcomeResponsesRunInput {
  speechName: string
  side: "aff" | "neg"
  /** The paradigm picker's value: `"auto"` or a judge-paradigm id. */
  paradigmId: string
  /** The judge the run was simulated against, e.g. `"Jane Doe (Tabula Rasa)"`. */
  judgeLabel: string
  focus: string
  result: SpeechOutcomeResponsesResult
}

/** One stored run. */
export interface SavedOutcomeResponses extends OutcomeResponsesRunInput {
  /** `${scope}:${SPEECH}` — the sync key. */
  id: string
  scope: string
  /** Epoch milliseconds. */
  savedAt: number
}

/** The id a scope + speech's run is stored under (speech names are case-insensitive). */
export function outcomeResponsesId(scope: string, speechName: string): string {
  return `${scope}:${speechName.trim().toUpperCase()}`
}

/**
 * Narrows one stored value to a run, re-validating its result with the same
 * parser the AI reply goes through, so a damaged or hand-edited row can't
 * crash the dialog. Returns `null` when it isn't one.
 */
export function parseSavedOutcomeResponses(value: unknown): SavedOutcomeResponses | null {
  if (typeof value !== "object" || value === null) return null
  const row = value as Partial<SavedOutcomeResponses>
  if (
    typeof row.id !== "string" ||
    !row.id ||
    typeof row.scope !== "string" ||
    !row.scope ||
    typeof row.speechName !== "string" ||
    !row.speechName.trim() ||
    row.id !== outcomeResponsesId(row.scope, row.speechName) ||
    (row.side !== "aff" && row.side !== "neg") ||
    typeof row.savedAt !== "number" ||
    !Number.isFinite(row.savedAt)
  ) {
    return null
  }
  let result: SpeechOutcomeResponsesResult | null = null
  try {
    result = parseSpeechOutcomeResponsesResponse(JSON.stringify(row.result ?? null))
  } catch {
    result = null
  }
  if (!result) return null
  return {
    id: row.id,
    scope: row.scope,
    speechName: row.speechName,
    side: row.side,
    paradigmId: typeof row.paradigmId === "string" && row.paradigmId ? row.paradigmId : "auto",
    judgeLabel: typeof row.judgeLabel === "string" ? row.judgeLabel : "",
    focus: typeof row.focus === "string" ? row.focus.slice(0, MAX_SAVED_FOCUS_CHARS) : "",
    result,
    savedAt: row.savedAt,
  }
}

function readAll(): SavedOutcomeResponses[] {
  try {
    const raw = localStorage.getItem(OUTCOME_RESPONSES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseSavedOutcomeResponses).filter((run): run is SavedOutcomeResponses => run !== null)
  } catch {
    return []
  }
}

function writeAll(runs: SavedOutcomeResponses[]): boolean {
  let ok = true
  try {
    localStorage.setItem(OUTCOME_RESPONSES_KEY, JSON.stringify(runs))
  } catch {
    ok = false
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTCOME_RESPONSES_EVENT))
  return ok
}

/** The saved run for one speech of a round / flow, or `null`. */
export function getSavedOutcomeResponses(scope: string | null, speechName: string): SavedOutcomeResponses | null {
  if (!scope || !speechName.trim()) return null
  const id = outcomeResponsesId(scope, speechName)
  return readAll().find((run) => run.id === id) ?? null
}

/**
 * Saves a run as the speech's latest, replacing any earlier one, and keeps
 * the newest {@link MAX_SAVED_OUTCOME_RESPONSES}. Returns the stored record,
 * or `null` when the input is unusable or storage is blocked.
 */
export function saveOutcomeResponses(
  scope: string | null,
  run: OutcomeResponsesRunInput,
  now: number = Date.now(),
): SavedOutcomeResponses | null {
  if (!scope || !run.speechName.trim()) return null
  const record = parseSavedOutcomeResponses({
    ...run,
    focus: run.focus.trim(),
    id: outcomeResponsesId(scope, run.speechName),
    scope,
    savedAt: now,
  })
  if (!record) return null
  const rest = readAll().filter((other) => other.id !== record.id)
  const runs = [record, ...rest].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_SAVED_OUTCOME_RESPONSES)
  return writeAll(runs) ? record : null
}

/** Removes one speech's saved run. */
export function clearSavedOutcomeResponses(scope: string | null, speechName: string): void {
  if (!scope) return
  const id = outcomeResponsesId(scope, speechName)
  const runs = readAll()
  if (runs.some((run) => run.id === id)) writeAll(runs.filter((run) => run.id !== id))
}

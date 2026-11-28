/**
 * The cloud-save queue behind the REASON docs provider.
 *
 * Every edit in Debate Editor's embed — title or body, on `/reason-editor` or
 * any sidebar route — reaches D1 through here (`PUT /api/doc/documents/:id`).
 * Which makes "did it actually get there?" this module's whole job, and the
 * reason the debounce isn't just a `setTimeout` in the provider anymore:
 *
 *  - **One timer per document, not one for the app.** A single shared timer
 *    meant the next `queue()` call cancelled whatever was still waiting —
 *    so renaming a file and then typing in another one silently dropped the
 *    rename, and switching documents inside the debounce window dropped the
 *    edits to the one you left. Each document now waits on its own timer and
 *    its own merged patch.
 *  - **Nothing is dropped on the way out.** `flushAll` (wired to `pagehide`
 *    and to the tab going hidden) sends what is still waiting with
 *    `keepalive`, so closing the tab mid-sentence doesn't lose the sentence.
 *  - **A failed write stays queued.** Network blips and 5xx retry with
 *    backoff instead of vanishing; the patch is merged back in front of any
 *    newer edit, so a retry never resurrects stale content over fresh.
 *  - **Failure is visible.** `onStateChange` reports what is unsaved and
 *    what is failing, so the editor can say so rather than showing a
 *    "Saving…" that never resolves.
 *  - **A refusal is not retried.** A 400 (a move into a folder that isn't
 *    yours, or into the file's own sub-folder), 403 (not your file) or 404
 *    (the row is gone) will answer the same way every time, so the queue
 *    drops the refused fields at once and tells `onRejected` instead of
 *    burning its attempts on it. A refused patch that also carried a title
 *    or body edit loses only its `parentId`: the server validates the move
 *    first and writes nothing on a 400, so the rest is sent again on its own
 *    rather than being thrown away with the move.
 *
 * Injectable `send`/timer hooks keep it unit-testable without a DOM or a
 * server (see `__tests__/save-queue.test.ts`).
 */

export interface DocumentPatch {
  title?: string
  content?: string
  parentId?: number | null
}

export interface SaveQueueState {
  /** Document ids with edits not yet acknowledged by the server. */
  pendingIds: number[]
  /** True while at least one write is in flight. */
  saving: boolean
  /** Document ids whose last write attempt failed and is being retried. */
  failedIds: number[]
}

/** What one write's response says. `status` is the HTTP status when there
 *  was a response; `error` the server's `{ error }` message, if any. */
export interface SendResult {
  ok: boolean
  status?: number
  error?: string
}

/** A write the server refused for good (see `isRefusal`). */
export interface SaveRejection {
  id: number
  /** The fields dropped from the queue because of the refusal. */
  patch: DocumentPatch
  status: number
  error?: string
}

/** HTTP statuses a retry can't change: a bad request, someone else's
 *  document, or one that no longer exists. A 401 is not one — signing in
 *  again makes the same write succeed — and neither is a 408, 429 or 5xx. */
export function isRefusal(status: number | undefined): status is number {
  return status === 400 || status === 403 || status === 404
}

export interface SaveQueueOptions {
  /** Debounce before a document's merged patch is sent. */
  delayMs?: number
  /** Attempts per patch before it is left queued for the next edit/flush. */
  maxAttempts?: number
  /** Base delay for retry backoff (doubled per attempt). */
  retryDelayMs?: number
  /** Performs one write. Defaults to `PUT /api/doc/documents/:id`. */
  send?: (id: number, patch: DocumentPatch, init: RequestInit) => Promise<SendResult>
  /** Notified whenever the pending/saving/failed picture changes. */
  onStateChange?: (state: SaveQueueState) => void
  /** Notified when the server refuses a write for good, with the fields the
   *  queue dropped — so the caller can undo an optimistic change. */
  onRejected?: (rejection: SaveRejection) => void
  /** Notified after a write succeeds, with the fields it saved. */
  onSaved?: (id: number, patch: DocumentPatch) => void
}

const DEFAULT_DELAY_MS = 800
const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_RETRY_DELAY_MS = 1000

async function defaultSend(
  id: number,
  patch: DocumentPatch,
  init: RequestInit,
): Promise<SendResult> {
  const res = await fetch(`/api/doc/documents/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
    ...init,
  })
  if (res.ok || !isRefusal(res.status)) return { ok: res.ok, status: res.status }
  let error: string | undefined
  try {
    const data = (await res.json()) as { error?: unknown }
    if (typeof data?.error === "string" && data.error.trim()) error = data.error.trim()
  } catch {
    // No JSON body: the status alone says enough.
  }
  return { ok: false, status: res.status, error }
}

interface Entry {
  patch: DocumentPatch
  timer: ReturnType<typeof setTimeout> | null
  inFlight: boolean
  attempts: number
}

export class DocumentSaveQueue {
  private readonly entries = new Map<number, Entry>()
  private readonly delayMs: number
  private readonly maxAttempts: number
  private readonly retryDelayMs: number
  private readonly send: NonNullable<SaveQueueOptions["send"]>
  private readonly onStateChange: SaveQueueOptions["onStateChange"]
  private readonly onRejected: SaveQueueOptions["onRejected"]
  private readonly onSaved: SaveQueueOptions["onSaved"]

  constructor(options: SaveQueueOptions = {}) {
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    this.send = options.send ?? defaultSend
    this.onStateChange = options.onStateChange
    this.onRejected = options.onRejected
    this.onSaved = options.onSaved
  }

  /** Queue a patch for `id`, merging it into anything already waiting, and
   *  (re)start that document's debounce. Fields not in `patch` are left as
   *  whatever the queue already held — a title edit never clears a pending
   *  body edit. */
  queue(id: number, patch: DocumentPatch): void {
    const entry = this.entryFor(id)
    entry.patch = { ...entry.patch, ...patch }
    // A fresh edit supersedes the failure that was being retried.
    entry.attempts = 0
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      entry.timer = null
      void this.write(id)
    }, this.delayMs)
    this.publish()
  }

  /** Send `id`'s pending patch now, skipping the rest of its debounce. */
  flush(id: number, init: RequestInit = {}): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry) return Promise.resolve()
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    return this.write(id, init)
  }

  /** Send everything still waiting. Called when the page is going away, with
   *  `keepalive` so the browser finishes the request after the tab is gone. */
  flushAll(init: RequestInit = {}): Promise<void> {
    const ids = [...this.entries.keys()]
    return Promise.all(ids.map((id) => this.flush(id, init))).then(() => undefined)
  }

  /** Drop `id`'s queued work — for a document being deleted, whose PUT would
   *  either 404 or resurrect a row the user just removed. */
  cancel(id: number): void {
    const entry = this.entries.get(id)
    if (!entry) return
    if (entry.timer) clearTimeout(entry.timer)
    this.entries.delete(id)
    this.publish()
  }

  /** Stop every timer (component unmount). Anything queued stays queued — a
   *  caller that wants it saved calls `flushAll` first. */
  dispose(): void {
    for (const entry of this.entries.values()) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = null
    }
  }

  state(): SaveQueueState {
    const pendingIds: number[] = []
    const failedIds: number[] = []
    let saving = false
    for (const [id, entry] of this.entries) {
      pendingIds.push(id)
      if (entry.inFlight) saving = true
      if (entry.attempts > 0) failedIds.push(id)
    }
    return { pendingIds, saving, failedIds }
  }

  private entryFor(id: number): Entry {
    let entry = this.entries.get(id)
    if (!entry) {
      entry = { patch: {}, timer: null, inFlight: false, attempts: 0 }
      this.entries.set(id, entry)
    }
    return entry
  }

  /**
   * Drops what the server refused instead of retrying it. Only fields still
   * holding the refused value are dropped — an edit made while the write was
   * in flight is newer and stays queued. A 400 on a patch with a `parentId`
   * blames the move alone (it is the only field the server checks against
   * other rows) and the rest goes out again straight away; anything else
   * drops every field that was sent.
   */
  private reject(id: number, entry: Entry, sent: DocumentPatch, status: number, error?: string): void {
    const blameMoveOnly = status === 400 && "parentId" in sent && Object.keys(sent).length > 1
    const fields = (blameMoveOnly ? ["parentId"] : Object.keys(sent)) as (keyof DocumentPatch)[]
    const dropped: DocumentPatch = {}
    for (const field of fields) {
      if (entry.patch[field] === sent[field]) {
        delete entry.patch[field]
        ;(dropped as Record<string, unknown>)[field] = sent[field]
      }
    }
    entry.attempts = 0
    const empty = Object.keys(entry.patch).length === 0
    if (empty && !entry.timer) this.entries.delete(id)
    this.publish()
    // Nothing dropped means every refused field was edited again mid-flight;
    // the newer edit stands, so there is nothing to undo or report.
    if (Object.keys(dropped).length > 0) {
      this.onRejected?.({ id, patch: dropped, status, ...(error ? { error } : {}) })
    }
    // The fields the refusal didn't blame still need saving; send them now
    // rather than waiting for the next edit. A pending debounce sends them
    // anyway, so leave that one be.
    if (!empty && !entry.timer && this.entries.get(id) === entry) void this.write(id)
  }

  private publish(): void {
    this.onStateChange?.(this.state())
  }

  private async write(id: number, init: RequestInit = {}): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry || entry.inFlight) return
    // A copy: acknowledging or refusing it deletes fields from `entry.patch`,
    // and the fields that were sent are still needed after that.
    const patch = { ...entry.patch }
    if (Object.keys(patch).length === 0) {
      this.entries.delete(id)
      this.publish()
      return
    }
    entry.inFlight = true
    this.publish()
    let result: SendResult = { ok: false }
    try {
      result = await this.send(id, patch, init)
    } catch {
      result = { ok: false }
    }
    const ok = result.ok
    entry.inFlight = false

    const current = this.entries.get(id)
    // A `cancel()` (delete) landed while this was in flight — the row is
    // gone, so there is nothing left to retry or acknowledge.
    if (current !== entry) return

    if (ok) {
      // Only the fields we just sent are acknowledged: an edit that arrived
      // mid-flight is still pending and keeps its own timer.
      for (const field of Object.keys(patch) as (keyof DocumentPatch)[]) {
        if (entry.patch[field] === patch[field]) delete entry.patch[field]
      }
      entry.attempts = 0
      if (Object.keys(entry.patch).length === 0 && !entry.timer) this.entries.delete(id)
      this.publish()
      this.onSaved?.(id, patch)
      return
    }

    if (isRefusal(result.status)) {
      this.reject(id, entry, patch, result.status, result.error)
      return
    }

    entry.attempts += 1
    this.publish()
    if (entry.attempts >= this.maxAttempts || entry.timer) return
    // Retry with backoff. The patch stays in `entry.patch`, so an edit made
    // in the meantime is merged over it and the retry sends the newer text.
    const backoff = this.retryDelayMs * 2 ** (entry.attempts - 1)
    entry.timer = setTimeout(() => {
      entry.timer = null
      void this.write(id)
    }, backoff)
  }
}

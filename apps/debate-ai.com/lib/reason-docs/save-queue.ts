/**
 * The cloud-save queue behind the REASON docs provider.
 *
 * Every edit in CardMirror's embed — title or body, on `/reason-editor` or
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

export interface SaveQueueOptions {
  /** Debounce before a document's merged patch is sent. */
  delayMs?: number
  /** Attempts per patch before it is left queued for the next edit/flush. */
  maxAttempts?: number
  /** Base delay for retry backoff (doubled per attempt). */
  retryDelayMs?: number
  /** Performs one write. Defaults to `PUT /api/doc/documents/:id`. */
  send?: (id: number, patch: DocumentPatch, init: RequestInit) => Promise<{ ok: boolean }>
  /** Notified whenever the pending/saving/failed picture changes. */
  onStateChange?: (state: SaveQueueState) => void
}

const DEFAULT_DELAY_MS = 800
const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_RETRY_DELAY_MS = 1000

async function defaultSend(
  id: number,
  patch: DocumentPatch,
  init: RequestInit,
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/doc/documents/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
    ...init,
  })
  return { ok: res.ok }
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

  constructor(options: SaveQueueOptions = {}) {
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    this.send = options.send ?? defaultSend
    this.onStateChange = options.onStateChange
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

  private publish(): void {
    this.onStateChange?.(this.state())
  }

  private async write(id: number, init: RequestInit = {}): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry || entry.inFlight) return
    const patch = entry.patch
    if (Object.keys(patch).length === 0) {
      this.entries.delete(id)
      this.publish()
      return
    }
    entry.inFlight = true
    this.publish()
    let ok = false
    try {
      ok = (await this.send(id, patch, init)).ok
    } catch {
      ok = false
    }
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

/**
 * @fileoverview The Debate Editor's collaboration relay, served by this app
 * and authorized by the signed-in account — what card sharing (the Send /
 * Receive pills) and real-time co-editing talk to instead of the Debate
 * Decoded relay. Mounted at `/api/collab-relay` by
 * `app/api/collab-relay/[...path]/route.ts`; the editor reaches it through
 * `WEB_DEFAULT_RELAY_URL` and `overlay/editor/collab/account-sync.ts` in
 * `packages/debate-editor`.
 *
 * It speaks the wire protocol the editor's clients already use
 * (`room-client.ts` for rooms, `pairing/web-mailbox.ts` for cards), so the
 * editor's sessions, chunking, catch-up and retry logic run unchanged:
 *
 *   GET    /account                         who the relay sees (401 signed out)
 *   POST   /rooms                           open a co-editing room → { roomId, guestPass }
 *   GET    /rooms/:id/guest-pass            re-read the room's guest pass (owner)
 *   POST   /rooms/:id/updates               append an encrypted update → { seq }
 *   GET    /rooms/:id/updates?after=&haveSnap=   one catch-up page
 *   POST   /rooms/:id/snapshot              compact the log { blob, coversThroughSeq }
 *   POST   /rooms/:id/presence?from=        a cursor frame, forwarded live
 *   GET    /rooms/:id/stream?sid=           SSE: hello, `u` updates, `p` presence, `end`
 *   DELETE /rooms/:id                       end the session (owner)
 *   POST   /messages                        drop a sealed card in a mailbox
 *   GET    /messages?recipient=             a mailbox's waiting cards (ETag / 304)
 *   GET    /stream?recipient=               SSE: cards as they arrive
 *   DELETE /messages/:msgId                 clear a delivered card
 *
 * Who may call what: a signed-in account may do everything (a room's data
 * endpoints, opening rooms, cards). Someone who isn't signed in can still
 * join a room they were invited to, with the room's guest pass as the bearer
 * token — the same account-less join the editor's invite links already
 * carry — but cannot open rooms or send and receive cards. Ending a room and
 * re-reading its guest pass are the owner's alone.
 *
 * Every payload is end-to-end encrypted by the editor; the relay stores and
 * forwards ciphertext and never holds a room key or a pairing key.
 *
 * The live streams poll D1 (one batched query per tick) rather than holding a
 * Durable Object, and close after {@link STREAM_MS}; the editor's stream
 * client reconnects and catches up on its own. A Worker invocation may spend
 * 1,000 D1 queries, which bounds a stream's length.
 *
 * @module lib/collab-relay/handler
 */

import {
  MAX_BLOB_CHARS,
  appendUpdate,
  claimMailbox,
  createRoom,
  deleteMessage,
  endRoom,
  fetchUpdatesPage,
  getRoom,
  latestMessageId,
  latestPresenceId,
  listMessages,
  pollRoom,
  postMessage,
  postPresence,
  roomLastSeq,
  storeSnapshot,
  type RelayDb,
  type RoomRow,
} from "./store"

/** How often a live stream checks for new data, and how long one stream lasts. */
export const POLL_MS = 1_000
export const STREAM_MS = 4 * 60 * 1000
/** Mailbox streams can be lazier: a card arriving a second later is fine. */
export const MAILBOX_POLL_MS = 2_500
/** A comment line at least this often, so the editor's 70 s stall watchdog never trips. */
const HEARTBEAT_MS = 20_000

/** The bearer the editor sends when the signed-in account is the credential
 *  (`ACCOUNT_SYNC_TOKEN` in the editor's `account-sync.ts`). The session
 *  cookie is what authorizes; this only marks the request as account-backed. */
export const ACCOUNT_BEARER = "account-session"

export interface RelayContext {
  db: RelayDb
  /** The signed-in user, or null. */
  user: { id: string; email: string; name: string } | null
  now?: () => number
  /** Test hooks: poll interval and stream length for the SSE endpoints. */
  pollMs?: number
  streamMs?: number
  sleep?: (ms: number) => Promise<void>
}

const ROOM_ID = /^[0-9a-f]{32}$/
const RECIPIENT = /^[A-Za-z0-9_.:-]{8,200}$/
const MSG_ID = /^[A-Za-z0-9_-]{8,80}$/

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  })
}

/** Error bodies are JSON objects with `detail`, which is how the editor tells
 *  a refusal from the relay apart from a captive portal's HTML page. */
const fail = (status: number, detail: string) => json({ detail }, status)

function randomHex(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("")
}

function randomToken(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  let bin = ""
  for (const b of buf) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

function bearer(req: Request): string {
  const auth = req.headers.get("authorization") ?? ""
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
}

/** Reads a body as base64, refusing anything over the cap (413 — the
 *  editor re-chunks an update the relay calls too large). */
async function readBinary(req: Request): Promise<string | Response> {
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.length === 0) return fail(400, "empty body")
  if (Math.ceil(bytes.length / 3) * 4 > MAX_BLOB_CHARS) return fail(413, "update too large")
  return bytesToBase64(bytes)
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// ─── SSE ─────────────────────────────────────────────────────────────

interface SseWriter {
  event(name: string, data: unknown): void
  data(data: unknown): void
  comment(text: string): void
}

/**
 * A server-sent-event response driven by `run`, which writes frames until it
 * returns. Closing the response (client gone, or the run finishing) stops the
 * loop at its next tick.
 */
function sseResponse(signal: AbortSignal | undefined, run: (out: SseWriter, alive: () => boolean) => Promise<void>): Response {
  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          closed = true
        }
      }
      const out: SseWriter = {
        event: (name, data) => write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`),
        data: (data) => write(`data: ${JSON.stringify(data)}\n\n`),
        comment: (text) => write(`: ${text}\n\n`),
      }
      signal?.addEventListener("abort", () => {
        closed = true
      })
      void run(out, () => !closed && !signal?.aborted)
        .catch((error) => console.error("collab relay stream failed", error))
        .finally(() => {
          if (closed) return
          closed = true
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        })
    },
    cancel() {
      closed = true
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ─── Rooms ───────────────────────────────────────────────────────────

type RoomAccess = { room: RoomRow; isOwner: boolean } | Response

/** Loads a room the caller may use: signed in, or holding its guest pass. */
async function roomFor(req: Request, ctx: RelayContext, roomId: string, opts: { ownerOnly?: boolean } = {}): Promise<RoomAccess> {
  if (!ROOM_ID.test(roomId)) return fail(404, "no such room")
  const room = await getRoom(ctx.db, roomId)
  if (!room) return fail(404, "no such room")
  const isOwner = !!ctx.user && ctx.user.id === room.ownerId
  if (opts.ownerOnly) {
    if (!ctx.user) return fail(401, "sign in to manage this session")
    if (!isOwner) return fail(403, "only the person who started this session can do that")
  } else if (!ctx.user && bearer(req) !== room.guestPass) {
    return fail(401, "sign in, or open the invite link again")
  }
  if (room.endedAt != null) return fail(410, "this session has ended")
  return { room, isOwner }
}

async function handleRooms(req: Request, ctx: RelayContext, rest: string[]): Promise<Response> {
  const now = (ctx.now ?? Date.now)()
  const method = req.method.toUpperCase()

  if (rest.length === 0) {
    if (method !== "POST") return fail(405, "method not allowed")
    if (!ctx.user) return fail(401, "sign in to start a co-editing session")
    const roomId = randomHex(16)
    const guestPass = `gp1.${randomToken(24)}`
    await createRoom(ctx.db, { roomId, ownerId: ctx.user.id, guestPass }, now)
    return json({ roomId, guestPass })
  }

  const [roomId, action, ...extra] = rest
  if (extra.length > 0) return fail(404, "not found")

  if (!action) {
    if (method !== "DELETE") return fail(405, "method not allowed")
    const access = await roomFor(req, ctx, roomId, { ownerOnly: true })
    if (access instanceof Response) return access
    await endRoom(ctx.db, roomId, now)
    return json({ ok: true })
  }

  if (action === "guest-pass") {
    if (method !== "GET") return fail(405, "method not allowed")
    const access = await roomFor(req, ctx, roomId, { ownerOnly: true })
    if (access instanceof Response) return access
    return json({ guestPass: access.room.guestPass })
  }

  const access = await roomFor(req, ctx, roomId)
  if (access instanceof Response) return access
  const { room } = access
  const url = new URL(req.url)

  if (action === "updates") {
    if (method === "POST") {
      const data = await readBinary(req)
      if (data instanceof Response) return data
      const seq = await appendUpdate(ctx.db, roomId, data, now)
      return json({ seq })
    }
    if (method !== "GET") return fail(405, "method not allowed")
    const after = Math.max(0, Math.floor(Number(url.searchParams.get("after") ?? 0)) || 0)
    const haveSnapRaw = url.searchParams.get("haveSnap")
    const haveSnap = haveSnapRaw === null ? undefined : Number(haveSnapRaw)
    const page = await fetchUpdatesPage(ctx.db, room, after, Number.isFinite(haveSnap) ? haveSnap : undefined)
    return json({
      ...(page.snapshot ? { snapshot: page.snapshot } : {}),
      snapshotUnchanged: page.snapshotUnchanged,
      snapCovers: page.snapCovers,
      updates: page.updates,
      lastSeq: page.lastSeq,
      more: page.more,
    })
  }

  if (action === "snapshot") {
    if (method !== "POST") return fail(405, "method not allowed")
    const body = await readJson(req)
    const blob = body?.blob
    const covers = Number(body?.coversThroughSeq)
    if (typeof blob !== "string" || !blob || !Number.isInteger(covers) || covers < 1) {
      return fail(400, "expected { blob, coversThroughSeq }")
    }
    if (blob.length > MAX_BLOB_CHARS) return fail(413, "snapshot too large")
    const lastSeq = await roomLastSeq(ctx.db, room)
    if (covers > lastSeq) return fail(400, "snapshot covers updates the room does not have")
    // An older (or the same) compaction is a no-op, not an error.
    if (covers > room.snapshotCovers) await storeSnapshot(ctx.db, room, blob, covers, now)
    return json({ ok: true })
  }

  if (action === "presence") {
    if (method !== "POST") return fail(405, "method not allowed")
    const data = await readBinary(req)
    if (data instanceof Response) return data
    if (data.length > 256 * 1024) return fail(413, "presence frame too large")
    const from = (url.searchParams.get("from") ?? "").slice(0, 128)
    await postPresence(ctx.db, roomId, from, data, now)
    return json({ ok: true })
  }

  if (action === "stream") {
    if (method !== "GET") return fail(405, "method not allowed")
    const sid = (url.searchParams.get("sid") ?? "").slice(0, 128)
    const startSeq = await roomLastSeq(ctx.db, room)
    let presenceId = await latestPresenceId(ctx.db, roomId)
    const pollMs = ctx.pollMs ?? POLL_MS
    const streamMs = ctx.streamMs ?? STREAM_MS
    const sleep = ctx.sleep ?? defaultSleep
    const clock = ctx.now ?? Date.now
    return sseResponse(req.signal, async (out, alive) => {
      let seq = startSeq
      out.event("hello", { lastSeq: seq })
      const started = clock()
      let lastWrite = started
      while (alive() && clock() - started < streamMs) {
        await sleep(pollMs)
        if (!alive()) return
        const tick = await pollRoom(ctx.db, roomId, { seq, presenceId, sid })
        if (tick.gone || tick.ended) {
          out.data({ t: "end" })
          return
        }
        for (const u of tick.updates) {
          out.data({ t: "u", seq: u.seq, blob: u.blob })
          seq = u.seq
        }
        for (const p of tick.presence) {
          out.data({ t: "p", blob: p.data })
          presenceId = p.id
        }
        if (tick.updates.length > 0 || tick.presence.length > 0) lastWrite = clock()
        else if (clock() - lastWrite >= HEARTBEAT_MS) {
          out.comment("hb")
          lastWrite = clock()
        }
      }
    })
  }

  return fail(404, "not found")
}

// ─── Card-sharing mailboxes ──────────────────────────────────────────

function mailboxMessage(row: { msgId: string; body: string }): Record<string, unknown> | null {
  try {
    const body = JSON.parse(row.body) as Record<string, unknown>
    return { ...body, msgId: row.msgId }
  } catch {
    return null
  }
}

async function handleMessages(req: Request, ctx: RelayContext, rest: string[]): Promise<Response> {
  const now = (ctx.now ?? Date.now)()
  const method = req.method.toUpperCase()
  if (!ctx.user) return fail(401, "sign in to send and receive cards")
  const user = ctx.user

  if (rest.length === 1) {
    if (method !== "DELETE") return fail(405, "method not allowed")
    const msgId = rest[0]
    if (!MSG_ID.test(msgId)) return fail(404, "no such card")
    await deleteMessage(ctx.db, msgId, user.id)
    return json({ ok: true })
  }
  if (rest.length > 1) return fail(404, "not found")

  if (method === "POST") {
    const body = await readJson(req)
    const recipient = body?.recipientCode
    if (typeof recipient !== "string" || !RECIPIENT.test(recipient)) return fail(400, "expected a recipientCode")
    for (const key of ["epk", "iv", "ct", "tag"]) {
      if (typeof body?.[key] !== "string" || !body[key]) return fail(400, `expected ${key}`)
    }
    const sealed = JSON.stringify({
      v: body!.v ?? 1,
      sentAt: typeof body!.sentAt === "number" ? body!.sentAt : now,
      epk: body!.epk,
      iv: body!.iv,
      ct: body!.ct,
      tag: body!.tag,
    })
    if (sealed.length > MAX_BLOB_CHARS) return fail(413, "card too large")
    const msgId = randomToken(18)
    await postMessage(ctx.db, { msgId, recipient, senderId: user.id, body: sealed }, now)
    return json({ msgId })
  }

  if (method !== "GET") return fail(405, "method not allowed")
  const recipient = new URL(req.url).searchParams.get("recipient") ?? ""
  if (!RECIPIENT.test(recipient)) return fail(400, "expected a recipient")
  if (!(await claimMailbox(ctx.db, recipient, user.id, now))) {
    return fail(403, "this pairing code belongs to another account")
  }
  const rows = await listMessages(ctx.db, recipient, 0, now)
  const etag = `"m${rows.length}-${rows[rows.length - 1]?.id ?? 0}"`
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } })
  }
  const messages = rows.map(mailboxMessage).filter((m) => m !== null)
  return json({ messages }, 200, { ETag: etag })
}

async function handleMailboxStream(req: Request, ctx: RelayContext): Promise<Response> {
  if (req.method.toUpperCase() !== "GET") return fail(405, "method not allowed")
  if (!ctx.user) return fail(401, "sign in to receive cards")
  const now = (ctx.now ?? Date.now)()
  const recipient = new URL(req.url).searchParams.get("recipient") ?? ""
  if (!RECIPIENT.test(recipient)) return fail(400, "expected a recipient")
  if (!(await claimMailbox(ctx.db, recipient, ctx.user.id, now))) {
    return fail(403, "this pairing code belongs to another account")
  }
  // The editor polls once right after connecting, so the stream only needs
  // what arrives from here on.
  let cursor = await latestMessageId(ctx.db, recipient)
  const pollMs = ctx.pollMs ?? MAILBOX_POLL_MS
  const streamMs = ctx.streamMs ?? STREAM_MS
  const sleep = ctx.sleep ?? defaultSleep
  const clock = ctx.now ?? Date.now
  return sseResponse(req.signal, async (out, alive) => {
    out.comment("hello")
    const started = clock()
    let lastWrite = started
    while (alive() && clock() - started < streamMs) {
      await sleep(pollMs)
      if (!alive()) return
      const rows = await listMessages(ctx.db, recipient, cursor, clock(), 20)
      for (const row of rows) {
        const message = mailboxMessage(row)
        if (message) out.data(message)
        cursor = row.id
      }
      if (rows.length > 0) lastWrite = clock()
      else if (clock() - lastWrite >= HEARTBEAT_MS) {
        out.comment("hb")
        lastWrite = clock()
      }
    }
  })
}

/**
 * Routes one relay request. `path` is everything after `/api/collab-relay`.
 * Failures the relay can't attribute answer 500 with a JSON `detail`, so the
 * editor retries instead of treating it as a refusal.
 */
export async function handleCollabRelay(req: Request, path: string[], ctx: RelayContext): Promise<Response> {
  try {
    const [head, ...rest] = path
    if (head === "account" && rest.length === 0) {
      if (!ctx.user) return json({ signedIn: false }, 401)
      return json({ signedIn: true, userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name })
    }
    if (head === "rooms") return await handleRooms(req, ctx, rest)
    if (head === "messages") return await handleMessages(req, ctx, rest)
    if (head === "stream" && rest.length === 0) return await handleMailboxStream(req, ctx)
    return fail(404, "not found")
  } catch (error) {
    console.error("collab relay request failed", error)
    return fail(500, "relay error")
  }
}

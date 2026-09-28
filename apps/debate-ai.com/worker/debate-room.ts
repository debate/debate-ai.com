/**
 * Signalling for the round webcam rooms (packages/debate-round/src/webcam).
 *
 * One Durable Object per room id. It authenticates nothing itself — the Worker
 * only forwards a WebSocket upgrade here after checking the app session, and
 * passes the signed-in user's display name in `x-room-name` — and it never
 * sees media: it relays simple-peer's offer/answer/ICE messages to the one
 * peer they are addressed to, and small room events (mute/camera state) to
 * everyone else. Audio and video flow browser-to-browser.
 *
 * Sockets use the hibernation API (`ctx.acceptWebSocket`), so an idle room
 * costs nothing while its participants stay connected; each socket's
 * participant record rides in its attachment, and its id is its tag, so a
 * relay is one `getWebSockets(id)` lookup even after the object wakes.
 */

import {
  MAX_ROOM_CAMERAS,
  normalizeRole,
  parseClientMessage,
  type RoomPeer,
  type ServerMessage,
} from "debate-round/src/webcam/room-protocol"

interface HibernatableWebSocket extends WebSocket {
  accept(): void
  serializeAttachment(value: unknown): void
  deserializeAttachment(): unknown
}

interface DurableObjectStateLike {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void
  getWebSockets(tag?: string): HibernatableWebSocket[]
}

declare const WebSocketPair: { new (): { 0: WebSocket; 1: HibernatableWebSocket } }

const send = (ws: WebSocket, message: ServerMessage) => {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // Socket already closing.
  }
}

const peerOf = (ws: HibernatableWebSocket) => ws.deserializeAttachment() as RoomPeer | null

export class DebateRoomSignal {
  constructor(private readonly ctx: DurableObjectStateLike, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 })
    }
    const url = new URL(request.url)
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const present = this.ctx.getWebSockets().filter((ws) => peerOf(ws))

    if (present.length >= MAX_ROOM_CAMERAS) {
      // Not hibernated: only lives long enough to say why it is refused.
      server.accept()
      send(server, {
        type: "error",
        code: "room-full",
        message: `This room already has ${MAX_ROOM_CAMERAS} cameras — the most a peer-to-peer room supports.`,
      })
      server.close(4009, "Room is full")
      return new Response(null, { status: 101, webSocket: client } as ResponseInit)
    }

    const self: RoomPeer = {
      id: crypto.randomUUID(),
      name: (request.headers.get("x-room-name") || "Guest").slice(0, 80),
      role: normalizeRole(url.searchParams.get("role")),
    }
    this.ctx.acceptWebSocket(server, [self.id])
    server.serializeAttachment(self)

    const peers = present.map(peerOf).filter((p): p is RoomPeer => Boolean(p))
    send(server, { type: "welcome", self, peers })
    for (const ws of present) send(ws, { type: "peer-joined", peer: self })

    return new Response(null, { status: 101, webSocket: client } as ResponseInit)
  }

  async webSocketMessage(ws: HibernatableWebSocket, raw: string | ArrayBuffer): Promise<void> {
    const me = peerOf(ws)
    if (!me) return
    const msg = parseClientMessage(raw)
    if (!msg) {
      send(ws, { type: "error", code: "bad-message", message: "Malformed room message." })
      return
    }
    if (msg.type === "signal") {
      const [target] = this.ctx.getWebSockets(msg.to)
      if (!target || msg.to === me.id) {
        send(ws, { type: "error", code: "unknown-peer", message: "That participant has left the room." })
        return
      }
      send(target, { type: "signal", from: me.id, payload: msg.payload })
      return
    }
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws) send(other, { type: "room-event", from: me.id, event: msg.event, payload: msg.payload })
    }
  }

  async webSocketClose(ws: HibernatableWebSocket, code: number, reason: string): Promise<void> {
    this.leave(ws)
    try {
      ws.close(code === 1005 ? 1000 : code, reason)
    } catch {
      // Already closed.
    }
  }

  async webSocketError(ws: HibernatableWebSocket): Promise<void> {
    this.leave(ws)
  }

  private leave(ws: HibernatableWebSocket) {
    const me = peerOf(ws)
    if (!me) return
    ws.serializeAttachment(null)
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws) send(other, { type: "peer-left", id: me.id })
    }
  }
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(request: Request): Promise<Response> }
}

const ROOM_SOCKET_PATH = /^\/api\/rooms\/([^/]+)\/ws$/

/**
 * Routes `/api/rooms/:roomId/ws` upgrades to the room's Durable Object once
 * `getUserName` confirms a signed-in user; null for every other request.
 */
export async function handleRoomSocket(
  request: Request,
  rooms: DurableObjectNamespaceLike | undefined,
  getUserName: (request: Request) => Promise<string | null>,
  normalizeRoomId: (raw: string) => string | null,
): Promise<Response | null> {
  const match = ROOM_SOCKET_PATH.exec(new URL(request.url).pathname)
  if (!match) return null
  if (!rooms) return new Response("Webcam rooms are not configured", { status: 503 })
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected a WebSocket upgrade", { status: 426 })
  }
  const roomId = normalizeRoomId(decodeURIComponent(match[1]))
  if (!roomId) return new Response("Invalid room id", { status: 400 })
  const name = await getUserName(request)
  if (name === null) return new Response("Sign in to join a webcam room", { status: 401 })

  const forwarded = new Request(request)
  forwarded.headers.set("x-room-name", name)
  return rooms.get(rooms.idFromName(roomId)).fetch(forwarded)
}

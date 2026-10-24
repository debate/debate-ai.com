import { beforeEach, describe, expect, it } from "vitest"
import { DebateRoomSignal, handleRoomSocket } from "../debate-room"
import { MAX_ROOM_CAMERAS, normalizeRoomId } from "@debate-ai/round/src/webcam/room-protocol"

/** A server-side socket as the hibernation API hands it to the object. */
class FakeSocket {
  sent: any[] = []
  closed: { code: number; reason: string } | null = null
  attachment: unknown = null
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close(code: number, reason: string) {
    this.closed = { code, reason }
  }
  accept() {}
  serializeAttachment(v: unknown) {
    this.attachment = v
  }
  deserializeAttachment() {
    return this.attachment
  }
}

class FakeState {
  sockets: Array<{ ws: FakeSocket; tags: string[] }> = []
  acceptWebSocket(ws: FakeSocket, tags: string[] = []) {
    this.sockets.push({ ws, tags })
  }
  getWebSockets(tag?: string) {
    return this.sockets.filter((s) => !tag || s.tags.includes(tag)).map((s) => s.ws)
  }
}

let lastServer: FakeSocket
;(globalThis as any).WebSocketPair = class {
  0 = {}
  1 = (lastServer = new FakeSocket())
}
// Node's Response rejects status 101; the Workers runtime allows it.
const RealResponse = globalThis.Response
;(globalThis as any).Response = class extends RealResponse {
  constructor(body: BodyInit | null, init?: ResponseInit & { webSocket?: unknown }) {
    super(body, init?.status === 101 ? { ...init, status: 200 } : init)
  }
}

const upgrade = (role = "speaker", name = "Alex", mode?: "data") =>
  new Request(`https://x/api/rooms/r1/ws?role=${role}${mode ? `&mode=${mode}` : ""}`, {
    headers: { upgrade: "websocket", "x-room-name": name },
  })

describe("DebateRoomSignal", () => {
  let state: FakeState
  let room: DebateRoomSignal

  beforeEach(() => {
    state = new FakeState()
    room = new DebateRoomSignal(state as any, {})
  })

  async function join(name: string, role = "speaker", mode?: "data") {
    await room.fetch(upgrade(role, name, mode))
    return lastServer
  }

  it("welcomes a newcomer with the peers already present and announces it", async () => {
    const a = await join("Alex")
    const b = await join("Blair", "judge")
    expect(a.sent[0]).toMatchObject({ type: "welcome", self: { name: "Alex" }, peers: [] })
    expect(b.sent[0]).toMatchObject({ type: "welcome", self: { name: "Blair", role: "judge" }, peers: [{ name: "Alex" }] })
    expect(a.sent[1]).toMatchObject({ type: "peer-joined", peer: { name: "Blair" } })
  })

  it("relays a signal only to its addressee, stamped with the sender", async () => {
    const a = await join("Alex")
    const b = await join("Blair")
    const c = await join("Casey")
    const bId = (b.attachment as any).id
    await room.webSocketMessage(a as any, JSON.stringify({ type: "signal", to: bId, payload: { type: "offer" } }))
    expect(b.sent.at(-1)).toEqual({ type: "signal", from: (a.attachment as any).id, payload: { type: "offer" } })
    expect(c.sent.some((m) => m.type === "signal")).toBe(false)
  })

  it("broadcasts room events and departures to the others", async () => {
    const a = await join("Alex")
    const b = await join("Blair")
    await room.webSocketMessage(a as any, JSON.stringify({ type: "room-event", event: "mute-state", payload: { muted: true } }))
    expect(b.sent.at(-1)).toMatchObject({ type: "room-event", event: "mute-state", payload: { muted: true } })
    await room.webSocketClose(a as any, 1000, "bye")
    expect(b.sent.at(-1)).toEqual({ type: "peer-left", id: expect.any(String) })
  })

  it("rejects malformed messages and signals to unknown peers", async () => {
    const a = await join("Alex")
    await room.webSocketMessage(a as any, "{bad")
    expect(a.sent.at(-1)).toMatchObject({ type: "error", code: "bad-message" })
    await room.webSocketMessage(a as any, JSON.stringify({ type: "signal", to: "ghost", payload: {} }))
    expect(a.sent.at(-1)).toMatchObject({ type: "error", code: "unknown-peer" })
  })

  it("refuses cameras beyond the mesh cap", async () => {
    for (let i = 0; i < MAX_ROOM_CAMERAS; i++) await join(`P${i}`)
    const extra = await join("Late")
    expect(extra.sent[0]).toMatchObject({ type: "error", code: "room-full" })
    expect(extra.closed?.code).toBe(4009)
    expect(state.sockets).toHaveLength(MAX_ROOM_CAMERAS)
  })

  it("keeps data-only sockets out of the camera cap and hidden from camera sockets", async () => {
    const cams = []
    for (let i = 0; i < MAX_ROOM_CAMERAS; i++) cams.push(await join(`P${i}`))
    const d1 = await join("Timer A", "speaker", "data")
    const d2 = await join("Timer B", "judge", "data")
    expect(d1.sent[0]).toMatchObject({ type: "welcome", self: { name: "Timer A", data: true } })
    // The data socket learns every peer's name; cameras hear nothing about it.
    expect(d2.sent[0].peers).toHaveLength(MAX_ROOM_CAMERAS + 1)
    expect(cams[0].sent.some((m) => m.type === "peer-joined" && m.peer.data)).toBe(false)
    expect(d1.sent.at(-1)).toMatchObject({ type: "peer-joined", peer: { name: "Timer B" } })

    // Room events still reach everyone.
    await room.webSocketMessage(d1 as any, JSON.stringify({ type: "room-event", event: "timer-sync", payload: { speechName: "1AC" } }))
    expect(cams[0].sent.at(-1)).toMatchObject({ type: "room-event", event: "timer-sync" })
    expect(d2.sent.at(-1)).toMatchObject({ type: "room-event", event: "timer-sync" })

    // Departures follow the same visibility.
    const before = cams[0].sent.length
    const d1Id = (d1.attachment as any).id
    await room.webSocketClose(d1 as any, 1000, "bye")
    expect(cams[0].sent).toHaveLength(before)
    expect(d2.sent.at(-1)).toEqual({ type: "peer-left", id: d1Id })
  })
})

describe("handleRoomSocket", () => {
  const rooms = {
    names: [] as string[],
    idFromName(name: string) {
      this.names.push(name)
      return name
    },
    get() {
      return { fetch: async (req: Request) => new Response(req.headers.get("x-room-name")) }
    },
  }
  const ws = (path: string) => new Request(`https://x${path}`, { headers: { upgrade: "websocket" } })

  it("ignores other paths", async () => {
    expect(await handleRoomSocket(ws("/api/videos"), rooms, async () => "A", normalizeRoomId)).toBeNull()
  })

  it("requires a session and a valid room, then forwards with the user's name", async () => {
    expect((await handleRoomSocket(ws("/api/rooms/room1/ws"), rooms, async () => null, normalizeRoomId))!.status).toBe(401)
    expect((await handleRoomSocket(ws("/api/rooms/x/ws"), rooms, async () => "A", normalizeRoomId))!.status).toBe(400)
    const res = await handleRoomSocket(ws("/api/rooms/Round%207/ws"), rooms, async () => "Alex", normalizeRoomId)
    expect(await res!.text()).toBe("Alex")
    expect(rooms.names.at(-1)).toBe("round-7")
  })

  it("503s when the binding is missing", async () => {
    expect((await handleRoomSocket(ws("/api/rooms/room1/ws"), undefined, async () => "A", normalizeRoomId))!.status).toBe(503)
  })
})

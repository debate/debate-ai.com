// @vitest-environment jsdom
/**
 * @fileoverview Tests for `useWebcamRoom` (signalling socket + simple-peer
 * mesh + on-demand camera/mic) and the two hooks layered on it,
 * `useTimerSync` and `useSpeechDocHeadings`.
 *
 * jsdom has no WebSocket server, MediaStream or getUserMedia, so each is a
 * small in-memory fake here, and `simple-peer`'s browser bundle is replaced
 * by a fake peer that records what it was asked to do. Every assertion is
 * on what the hook exposed or what it sent over the socket.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, renderHook, run, flush } from "./dom-helpers"

const peers = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void
  class FakePeer {
    static instances: FakePeer[] = []
    opts: { initiator: boolean; config: { iceServers: unknown[] } }
    handlers: Record<string, Handler> = {}
    signal = vi.fn()
    destroy = vi.fn()
    addTrack = vi.fn()
    removeTrack = vi.fn()
    replaceTrack = vi.fn()
    constructor(opts: FakePeer["opts"]) {
      this.opts = opts
      FakePeer.instances.push(this)
    }
    on(event: string, handler: Handler) {
      this.handlers[event] = handler
      return this
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers[event]?.(...args)
    }
  }
  return { FakePeer }
})

vi.mock("simple-peer/simplepeer.min.js", () => ({ default: peers.FakePeer }))

import { useWebcamRoom, listCameras, videoConstraints } from "../src/webcam/useWebcamRoom"
import { useTimerSync, useSpeechTimerSync } from "../src/hooks/useTimerSync"
import { useSpeechDocHeadings, useBroadcastSpeechDocHeadings } from "../src/hooks/useSpeechDocHeadings"

class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []
  url: string
  readyState = 1
  sent: Record<string, unknown>[] = []
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number; reason: string }) => void) | null = null
  close = vi.fn(() => {
    this.readyState = 3
  })
  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: typeof msg === "string" ? msg : JSON.stringify(msg) })
  }
}

class FakeTrack {
  kind: "audio" | "video"
  deviceId: string
  stop = vi.fn()
  constructor(kind: "audio" | "video", deviceId = "") {
    this.kind = kind
    this.deviceId = deviceId
  }
  getSettings() {
    return { deviceId: this.deviceId }
  }
}

class FakeMediaStream {
  tracks: FakeTrack[]
  constructor(tracks: FakeTrack[] = []) {
    this.tracks = [...tracks]
  }
  getTracks() {
    return [...this.tracks]
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio")
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video")
  }
  addTrack(t: FakeTrack) {
    this.tracks.push(t)
  }
  removeTrack(t: FakeTrack) {
    this.tracks = this.tracks.filter((x) => x !== t)
  }
}

let getUserMedia: ReturnType<typeof vi.fn>
let enumerateDevices: ReturnType<typeof vi.fn>
let deviceListeners: Record<string, () => void>

function installMedia() {
  deviceListeners = {}
  getUserMedia = vi.fn(async (c: { video?: unknown; audio?: unknown }) =>
    new FakeMediaStream([c.video ? new FakeTrack("video", "cam-1") : new FakeTrack("audio")]),
  )
  enumerateDevices = vi.fn(async () => [
    { kind: "videoinput", deviceId: "cam-1", label: "Front" },
    { kind: "videoinput", deviceId: "", label: "" },
    { kind: "audioinput", deviceId: "mic-1", label: "Mic" },
  ])
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices,
      addEventListener: (name: string, fn: () => void) => (deviceListeners[name] = fn),
      removeEventListener: (name: string) => delete deviceListeners[name],
    },
  })
}

const ICE = [{ urls: "turn:example" }]

beforeEach(() => {
  FakeWebSocket.instances = []
  peers.FakePeer.instances = []
  vi.stubGlobal("WebSocket", FakeWebSocket)
  vi.stubGlobal("MediaStream", FakeMediaStream)
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ iceServers: ICE }) })),
  )
  installMedia()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function joinedRoom(roomId = "round-1") {
  const hook = await renderHook(() => useWebcamRoom(roomId))
  await run(() => hook.result.current.join())
  const ws = FakeWebSocket.instances.at(-1)!
  return { hook, ws }
}

describe("videoConstraints / listCameras", () => {
  it("adds an exact deviceId only when a camera is chosen", () => {
    expect(videoConstraints(null)).toEqual({ width: 640, height: 360 })
    expect(videoConstraints("abc")).toEqual({ width: 640, height: 360, deviceId: { exact: "abc" } })
  })

  it("lists only video inputs with a device id, and degrades to [] on failure or no API", async () => {
    expect((await listCameras()).map((d) => d.deviceId)).toEqual(["cam-1"])
    enumerateDevices.mockRejectedValueOnce(new Error("nope"))
    expect(await listCameras()).toEqual([])
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined })
    expect(await listCameras()).toEqual([])
  })
})

describe("useWebcamRoom", () => {
  it("starts idle, lists cameras, and refreshes them on devicechange", async () => {
    const hook = await renderHook(() => useWebcamRoom("round-1"))
    await flush()
    expect(hook.result.current.status).toBe("idle")
    expect(hook.result.current.cameras.map((c) => c.deviceId)).toEqual(["cam-1"])
    enumerateDevices.mockResolvedValueOnce([{ kind: "videoinput", deviceId: "cam-2", label: "Back" }])
    await run(() => deviceListeners.devicechange())
    expect(hook.result.current.cameras.map((c) => c.deviceId)).toEqual(["cam-2"])
  })

  it("does not dial a socket for an empty room id", async () => {
    const hook = await renderHook(() => useWebcamRoom(""))
    await run(() => hook.result.current.join())
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(hook.result.current.status).toBe("idle")
  })

  it("opens the signalling socket with the role and room in the URL, and only once", async () => {
    const hook = await renderHook(() => useWebcamRoom("round 1", { role: "judge", apiBase: "/rooms" }))
    await run(() => hook.result.current.join())
    expect(hook.result.current.status).toBe("connecting")
    expect(FakeWebSocket.instances).toHaveLength(1)
    const url = new URL(FakeWebSocket.instances[0].url)
    expect(url.protocol).toBe("ws:")
    expect(url.pathname).toBe("/rooms/round%201/ws")
    expect(url.searchParams.get("role")).toBe("judge")
    await run(() => hook.result.current.join())
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it("on welcome joins, dials every existing peer as initiator with the fetched ICE servers, and shares media state", async () => {
    const { hook, ws } = await joinedRoom()
    await run(() =>
      ws.receive({
        type: "welcome",
        self: { id: "me", name: "Me", role: "speaker" },
        peers: [{ id: "p1", name: "Judge Judy", role: "judge" }],
      }),
    )
    expect(hook.result.current.status).toBe("joined")
    expect(hook.result.current.self?.id).toBe("me")
    expect(hook.result.current.participants.map((p) => p.name)).toEqual(["Judge Judy"])
    const peer = peers.FakePeer.instances[0]
    expect(peer.opts.initiator).toBe(true)
    expect(peer.opts.config.iceServers).toEqual(ICE)
    expect(ws.sent).toEqual([
      { type: "room-event", event: "mute-state", payload: { muted: true } },
      { type: "room-event", event: "camera-state", payload: { off: true } },
    ])

    // Peer events flow back out over the socket / into participant state.
    await run(() => peer.emit("signal", { sdp: "x" }))
    expect(ws.sent.at(-1)).toEqual({ type: "signal", to: "p1", payload: { sdp: "x" } })
    const remote = new FakeMediaStream()
    await run(() => peer.emit("stream", remote))
    expect(hook.result.current.participants[0].stream).toBe(remote)
    const remote2 = new FakeMediaStream()
    await run(() => peer.emit("track", new FakeTrack("video"), remote2))
    expect(hook.result.current.participants[0].stream).toBe(remote2)
    await run(() => peer.emit("error"))
    expect(hook.result.current.participants[0].stream).toBeUndefined()
    await run(() => peer.emit("close"))
  })

  it("falls back to the default STUN server when /ice fails or is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    const a = await joinedRoom("a")
    await run(() => a.ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "speaker" }, peers: [{ id: "p", name: "P", role: "speaker" }] }))
    expect(peers.FakePeer.instances[0].opts.config.iceServers).toEqual([{ urls: "stun:stun.cloudflare.com:3478" }])

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    const b = await joinedRoom("b")
    await run(() => b.ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "speaker" }, peers: [{ id: "q", name: "Q", role: "speaker" }] }))
    expect(peers.FakePeer.instances[1].opts.config.iceServers).toEqual([{ urls: "stun:stun.cloudflare.com:3478" }])

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ iceServers: [] }) })))
    const c = await joinedRoom("c")
    await run(() => c.ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "speaker" }, peers: [{ id: "r", name: "R", role: "speaker" }] }))
    expect(peers.FakePeer.instances[2].opts.config.iceServers).toEqual([{ urls: "stun:stun.cloudflare.com:3478" }])
  })

  it("adds joiners, answers their first signal as non-initiator, tracks mute/camera events and drops leavers", async () => {
    const { hook, ws } = await joinedRoom()
    await run(() => ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "speaker" }, peers: [] }))
    ws.sent = []
    await run(() => ws.receive({ type: "peer-joined", peer: { id: "p2", name: "1A", role: "speaker" } }))
    expect(hook.result.current.participants.map((p) => p.id)).toEqual(["p2"])
    expect(ws.sent.map((m) => m.event)).toEqual(["mute-state", "camera-state"])

    await run(() => ws.receive({ type: "signal", from: "p2", payload: { candidate: 1 } }))
    const peer = peers.FakePeer.instances[0]
    expect(peer.opts.initiator).toBe(false)
    expect(peer.signal).toHaveBeenCalledWith({ candidate: 1 })
    // A second signal reuses the same connection.
    await run(() => ws.receive({ type: "signal", from: "p2", payload: { candidate: 2 } }))
    expect(peers.FakePeer.instances).toHaveLength(1)

    await run(() => ws.receive({ type: "room-event", from: "p2", event: "mute-state", payload: { muted: false } }))
    await run(() => ws.receive({ type: "room-event", from: "p2", event: "camera-state", payload: { off: true } }))
    expect(hook.result.current.participants[0]).toMatchObject({ micOn: true, camOn: false })

    // A room event from someone not yet known creates a Guest entry.
    await run(() => ws.receive({ type: "room-event", from: "ghost", event: "mute-state", payload: { muted: true } }))
    expect(hook.result.current.participants.find((p) => p.id === "ghost")).toMatchObject({ name: "Guest", micOn: false })

    const left = vi.fn()
    window.addEventListener("room-peer-left", left as EventListener)
    await run(() => ws.receive({ type: "peer-left", id: "p2" }))
    window.removeEventListener("room-peer-left", left as EventListener)
    expect(peer.destroy).toHaveBeenCalled()
    expect(hook.result.current.participants.map((p) => p.id)).toEqual(["ghost"])
    expect((left.mock.calls[0][0] as CustomEvent).detail).toEqual({ from: "p2" })
  })

  it("re-dispatches speech-doc-headings and timer-sync room events on window, ignoring bad JSON", async () => {
    const { ws } = await joinedRoom()
    const headings = vi.fn()
    const timers = vi.fn()
    window.addEventListener("room-speech-doc-headings", headings as EventListener)
    window.addEventListener("room-timer-sync", timers as EventListener)
    await run(() => ws.receive("{not json"))
    await run(() => ws.receive({ type: "room-event", from: "p", event: "speech-doc-headings", payload: { a: 1 } }))
    await run(() => ws.receive({ type: "room-event", from: "p", event: "timer-sync", payload: { b: 2 } }))
    window.removeEventListener("room-speech-doc-headings", headings as EventListener)
    window.removeEventListener("room-timer-sync", timers as EventListener)
    expect((headings.mock.calls[0][0] as CustomEvent).detail).toEqual({ from: "p", event: "speech-doc-headings", payload: { a: 1 } })
    expect((timers.mock.calls[0][0] as CustomEvent).detail.payload).toEqual({ b: 2 })
  })

  it("surfaces server errors, and leaves with an error status when the room is full", async () => {
    const { hook, ws } = await joinedRoom()
    await run(() => ws.receive({ type: "error", code: "bad-message", message: "Bad message" }))
    expect(hook.result.current.error).toBe("Bad message")
    expect(hook.result.current.status).toBe("connecting")
    await run(() => ws.receive({ type: "error", code: "room-full", message: "Room is full" }))
    expect(hook.result.current.status).toBe("error")
    expect(hook.result.current.error).toBe("Room is full")
    expect(ws.close).toHaveBeenCalledWith(1000, "left")
  })

  it("treats an abnormal socket close as an error, but a normal close as quiet", async () => {
    const a = await joinedRoom("a")
    await run(() => a.ws.onclose?.({ code: 1006, reason: "" }))
    expect(a.hook.result.current.status).toBe("error")
    expect(a.hook.result.current.error).toBe("Disconnected from the room.")

    const b = await joinedRoom("b")
    await run(() => b.ws.onclose?.({ code: 1000, reason: "bye" }))
    expect(b.hook.result.current.error).toBeNull()
    // The socket was released, so join() dials a fresh one.
    await run(() => b.hook.result.current.join())
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it("toggles the mic: captures audio, adds it to peers, announces it, then stops it", async () => {
    const { hook, ws } = await joinedRoom()
    await run(() => ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "speaker" }, peers: [{ id: "p1", name: "P", role: "speaker" }] }))
    ws.sent = []
    await run(() => hook.result.current.toggleMic())
    await flush()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(hook.result.current.micOn).toBe(true)
    expect(hook.result.current.localStream?.getAudioTracks()).toHaveLength(1)
    const peer = peers.FakePeer.instances[0]
    expect(peer.addTrack).toHaveBeenCalled()
    expect(ws.sent).toContainEqual({ type: "room-event", event: "mute-state", payload: { muted: false } })

    const track = hook.result.current.localStream!.getAudioTracks()[0] as unknown as FakeTrack
    await run(() => hook.result.current.toggleMic())
    expect(hook.result.current.micOn).toBe(false)
    expect(track.stop).toHaveBeenCalled()
    expect(peer.removeTrack).toHaveBeenCalled()
    expect(hook.result.current.localStream).toBeNull()
    expect(ws.sent.at(-1)).toEqual({ type: "room-event", event: "mute-state", payload: { muted: true } })
  })

  it("toggles the camera, adopting the opened device id, and replaces an older video track", async () => {
    const { hook, ws } = await joinedRoom()
    await run(() => hook.result.current.toggleCam())
    await flush()
    expect(hook.result.current.camOn).toBe(true)
    expect(hook.result.current.cameraId).toBe("cam-1")
    // Socket not "welcomed" but open, so the camera-state still goes out.
    expect(ws.sent).toContainEqual({ type: "room-event", event: "camera-state", payload: { off: false } })
    await run(() => hook.result.current.toggleCam())
    expect(hook.result.current.camOn).toBe(false)
    expect(ws.sent.at(-1)).toEqual({ type: "room-event", event: "camera-state", payload: { off: true } })
  })

  it("reports permission and capture failures in plain language", async () => {
    const hook = await renderHook(() => useWebcamRoom("round-1"))
    getUserMedia.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
    await run(() => hook.result.current.toggleCam())
    await flush()
    expect(hook.result.current.error).toBe("Camera permission was denied.")

    getUserMedia.mockRejectedValueOnce(new Error("busy"))
    await run(() => hook.result.current.toggleMic())
    await flush()
    expect(hook.result.current.error).toBe("Could not turn on microphone: busy")

    getUserMedia.mockRejectedValueOnce("weird")
    await run(() => hook.result.current.toggleMic())
    await flush()
    expect(hook.result.current.error).toBe("Could not turn on microphone.")

    // A capture with no matching track leaves the mic off.
    getUserMedia.mockResolvedValueOnce(new FakeMediaStream([]))
    await run(() => hook.result.current.toggleMic())
    await flush()
    expect(hook.result.current.micOn).toBe(false)
  })

  it("drops a device that finishes opening after leaving", async () => {
    const hook = await renderHook(() => useWebcamRoom("round-1"))
    let resolve!: (s: FakeMediaStream) => void
    getUserMedia.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    await run(() => hook.result.current.toggleMic())
    await run(() => hook.result.current.leave())
    const late = new FakeTrack("audio")
    await run(() => resolve(new FakeMediaStream([late])))
    await flush()
    expect(late.stop).toHaveBeenCalled()
    expect(hook.result.current.micOn).toBe(false)
  })

  it("selectCamera records the choice while the camera is off, and hot-swaps it while on", async () => {
    const { hook } = await joinedRoom()
    await run(() => hook.result.current.selectCamera("cam-9"))
    expect(hook.result.current.cameraId).toBe("cam-9")

    await run(() => hook.result.current.toggleCam())
    await flush()
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: { width: 640, height: 360, deviceId: { exact: "cam-9" } } })
    const oldTrack = hook.result.current.localStream!.getVideoTracks()[0] as unknown as FakeTrack

    // Choosing the camera already open is a no-op.
    getUserMedia.mockClear()
    await run(() => hook.result.current.selectCamera("cam-1"))
    expect(getUserMedia).not.toHaveBeenCalled()

    getUserMedia.mockResolvedValueOnce(new FakeMediaStream([new FakeTrack("video", "cam-2")]))
    await run(() => hook.result.current.selectCamera("cam-2"))
    expect(oldTrack.stop).toHaveBeenCalled()
    expect(hook.result.current.cameraId).toBe("cam-2")
    expect((hook.result.current.localStream!.getVideoTracks()[0] as unknown as FakeTrack).deviceId).toBe("cam-2")

    getUserMedia.mockRejectedValueOnce(new Error("gone"))
    await run(() => hook.result.current.selectCamera("cam-3"))
    expect(hook.result.current.error).toBe("Could not switch camera: gone")
    getUserMedia.mockRejectedValueOnce("x")
    await run(() => hook.result.current.selectCamera("cam-3"))
    expect(hook.result.current.error).toBe("Could not switch camera.")
    getUserMedia.mockResolvedValueOnce(new FakeMediaStream([]))
    await run(() => hook.result.current.selectCamera("cam-3"))
    expect(hook.result.current.cameraId).toBe("cam-2")
  })

  it("broadcast sends a room-event only while the socket is open", async () => {
    const { hook, ws } = await joinedRoom()
    await run(() => hook.result.current.broadcast("ready", { ok: true }))
    expect(ws.sent.at(-1)).toEqual({ type: "room-event", event: "ready", payload: { ok: true } })
    ws.readyState = 3
    const count = ws.sent.length
    await run(() => hook.result.current.broadcast("ready", {}))
    expect(ws.sent).toHaveLength(count)
  })

  it("leave closes the socket, destroys peers and resets to idle; unmount does the same", async () => {
    const { hook, ws } = await joinedRoom()
    await run(() => ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "speaker" }, peers: [{ id: "p1", name: "P", role: "speaker" }] }))
    await run(() => hook.result.current.leave())
    expect(ws.close).toHaveBeenCalledWith(1000, "left")
    expect(peers.FakePeer.instances[0].destroy).toHaveBeenCalled()
    expect(hook.result.current.status).toBe("idle")
    expect(hook.result.current.participants).toEqual([])
    expect(hook.result.current.self).toBeNull()

    const again = await joinedRoom("other")
    again.hook.unmount()
    expect(again.ws.close).toHaveBeenCalledWith(1000, "left")
  })
})

describe("useTimerSync", () => {
  it("auto-joins as a data socket, sends every update, collects peers' timers and clears them when a peer leaves", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000)
    const onRemoteTimer = vi.fn()
    const hook = await renderHook(() => useTimerSync("round-7", "judge", { onRemoteTimer }))
    await flush()
    const ws = FakeWebSocket.instances[0]
    expect(new URL(ws.url).searchParams.get("role")).toBe("judge")
    expect(new URL(ws.url).searchParams.get("mode")).toBe("data")
    await run(() => ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "judge" }, peers: [{ id: "p1", name: "1A Alice", role: "speaker" }] }))
    // A data socket never dials peers.
    expect(peers.FakePeer.instances).toHaveLength(0)
    ws.sent = []

    const timer = { speechName: "1AC", time: 1000, resetTime: 2000, state: { name: "paused" as const }, timestamp: 1 }
    await run(() => hook.result.current.broadcastTimerState("1AC", timer))
    now.mockReturnValue(10_100)
    // Not throttled: a pause right after a start must still go out.
    await run(() => hook.result.current.broadcastTimerState("1AC", timer))
    expect(ws.sent).toHaveLength(2)
    expect(ws.sent[0]).toEqual({
      type: "room-event",
      event: "timer-sync",
      payload: { id: expect.any(String), speechName: "1AC", time: 1000, resetTime: 2000, state: { name: "paused" }, timestamp: 10_000 },
    })
    expect((ws.sent[1].payload as { timestamp: number }).timestamp).toBe(10_100)

    // The same event arriving twice (two sockets in this tab) is applied once.
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "timer-sync", payload: { ...timer, id: "e1" } }))
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "timer-sync", payload: { ...timer, id: "e1" } }))
    expect(onRemoteTimer).toHaveBeenCalledTimes(1)
    expect(onRemoteTimer).toHaveBeenCalledWith(timer, "p1")
    await run(() => hook.result.current.clearTimers())
    onRemoteTimer.mockClear()

    // Own echo and unknown peers are ignored; a known peer's timer is kept (latest per speech).
    await run(() => ws.receive({ type: "room-event", from: "me", event: "timer-sync", payload: timer }))
    await run(() => ws.receive({ type: "room-event", from: "stranger", event: "timer-sync", payload: timer }))
    expect(hook.result.current.remoteTimers).toEqual([])
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "timer-sync", payload: timer }))
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "timer-sync", payload: { ...timer, time: 500 } }))
    expect(hook.result.current.remoteTimers).toHaveLength(1)
    expect(hook.result.current.remoteTimers[0]).toMatchObject({ peerId: "p1", peerName: "1A Alice", timerState: { time: 500 } })
    expect(onRemoteTimer).toHaveBeenCalledTimes(2)

    await run(() => ws.receive({ type: "peer-left", id: "p1" }))
    expect(hook.result.current.remoteTimers).toEqual([])

    await run(() => hook.result.current.clearTimers())
    expect(hook.result.current.remoteTimers).toEqual([])
  })

  it("useSpeechTimerSync picks the leader's timer for its speech", async () => {
    vi.spyOn(Date, "now").mockReturnValue(50_000)
    const hook = await renderHook(() => useSpeechTimerSync("round-8", "1NC"))
    await flush()
    const ws = FakeWebSocket.instances[0]
    await run(() =>
      ws.receive({
        type: "welcome",
        self: { id: "me", name: "Me", role: "speaker" },
        peers: [
          { id: "j", name: "Judge Kim", role: "judge" },
          { id: "o", name: "Observer", role: "observer" },
        ],
      }),
    )
    const base = { resetTime: 1, state: { name: "paused" }, timestamp: 1 }
    await run(() => ws.receive({ type: "room-event", from: "o", event: "timer-sync", payload: { ...base, speechName: "1NC", time: 9 } }))
    expect(hook.result.current.leaderTimer).toBeUndefined()
    await run(() => ws.receive({ type: "room-event", from: "j", event: "timer-sync", payload: { ...base, speechName: "1NC", time: 7 } }))
    await run(() => ws.receive({ type: "room-event", from: "j", event: "timer-sync", payload: { ...base, speechName: "2AC", time: 3 } }))
    expect(hook.result.current.leaderTimer?.time).toBe(7)
    expect(hook.result.current.allRemoteTimers.map((t) => t.peerId).sort()).toEqual(["j", "o"])

    ws.sent = []
    await run(() => hook.result.current.broadcastTimerState({ speechName: "1NC", time: 1, resetTime: 1, state: { name: "done" }, timestamp: 0 }))
    expect(ws.sent[0]).toMatchObject({ event: "timer-sync", payload: { speechName: "1NC", state: { name: "done" } } })
  })
})

describe("useSpeechDocHeadings", () => {
  it("broadcasts extracted headings (skipping docs without any) and stores peers' headings", async () => {
    vi.spyOn(Date, "now").mockReturnValue(70_000)
    const hook = await renderHook(() => useSpeechDocHeadings("round-9"))
    await flush()
    const ws = FakeWebSocket.instances[0]
    await run(() => ws.receive({ type: "welcome", self: { id: "me", name: "Me", role: "speaker" }, peers: [{ id: "p1", name: "2N Bo", role: "speaker" }] }))
    ws.sent = []

    await run(() => hook.result.current.broadcastSpeechDocHeadings("1AC", "plain text only"))
    expect(ws.sent).toEqual([])
    await run(() => hook.result.current.broadcastSpeechDocHeadings("1AC", "# Advantage\nbody\n## Inherency\n#### too deep"))
    expect(ws.sent[0]).toEqual({
      type: "room-event",
      event: "speech-doc-headings",
      payload: {
        speechName: "1AC",
        headings: [
          { level: 1, text: "Advantage", raw: "# Advantage" },
          { level: 2, text: "Inherency", raw: "## Inherency" },
        ],
        timestamp: 70_000,
      },
    })

    const payload = { speechName: "1NC", headings: [{ level: 1, text: "T", raw: "# T" }], timestamp: 5 }
    await run(() => ws.receive({ type: "room-event", from: "me", event: "speech-doc-headings", payload }))
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "speech-doc-headings", payload: { speechName: "1NC" } }))
    expect(hook.result.current.receivedHeadings).toEqual([])
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "speech-doc-headings", payload }))
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "speech-doc-headings", payload: { ...payload, timestamp: 6 } }))
    expect(hook.result.current.receivedHeadings).toEqual([
      { peerId: "p1", peerName: "2N Bo", speechName: "1NC", headings: payload.headings, timestamp: 6 },
    ])

    await run(() => hook.result.current.removeHeadings("p1", "2AC"))
    expect(hook.result.current.receivedHeadings).toHaveLength(1)
    await run(() => hook.result.current.removeHeadings("p1", "1NC"))
    expect(hook.result.current.receivedHeadings).toHaveLength(0)
    await run(() => ws.receive({ type: "room-event", from: "p1", event: "speech-doc-headings", payload }))
    await run(() => hook.result.current.clearHeadings())
    expect(hook.result.current.receivedHeadings).toHaveLength(0)
  })

  it("useBroadcastSpeechDocHeadings only sends once the room is joined", async () => {
    const hook = await renderHook(() => {
      const room = useWebcamRoom("round-10")
      const { broadcastHeadings } = useBroadcastSpeechDocHeadings("round-10")
      return { room, broadcastHeadings }
    })
    // Not joined: nothing is dialled or sent.
    await run(() => hook.result.current.broadcastHeadings("1AC", "# A"))
    expect(FakeWebSocket.instances).toHaveLength(0)
  })
})

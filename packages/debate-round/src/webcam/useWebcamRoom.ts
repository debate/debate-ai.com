/// <reference path="./simple-peer-module.d.ts" />
/**
 * @fileoverview Joins a round's webcam room: local camera/mic capture, the
 * signalling WebSocket to the room's Durable Object, and one simple-peer
 * connection per other participant (a small P2P mesh — see
 * `room-protocol.ts` for why it is capped).
 *
 * The newcomer initiates a connection to everyone already in the room (from
 * the `welcome` message); existing members answer the first signal they get
 * from a peer, so exactly one side of each pair makes the offer.
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type SimplePeer from "simple-peer"
import type { RoomEventName, RoomPeer, RoomRole, ServerMessage } from "./room-protocol"

export type WebcamRoomStatus = "idle" | "connecting" | "joined" | "error"

export interface RemoteParticipant extends RoomPeer {
  stream?: MediaStream
  micOn?: boolean
  camOn?: boolean
}

export interface WebcamRoomOptions {
  /** Base path of the room endpoints (default `/api/rooms`). */
  apiBase?: string
  role?: RoomRole
}

/** Capture size for every camera; the mesh sends it to each peer. */
const VIDEO_SIZE = { width: 640, height: 360 }

export function videoConstraints(cameraId: string | null): MediaTrackConstraints {
  return cameraId ? { ...VIDEO_SIZE, deviceId: { exact: cameraId } } : VIDEO_SIZE
}

/** The browser's cameras. Labels stay empty until camera permission is granted. */
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.deviceId)
  } catch {
    return []
  }
}

const DEFAULT_ICE: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }]

async function loadIceServers(apiBase: string): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${apiBase}/ice`)
    if (!res.ok) return DEFAULT_ICE
    const body = (await res.json()) as { iceServers?: RTCIceServer[] }
    return body.iceServers?.length ? body.iceServers : DEFAULT_ICE
  } catch {
    return DEFAULT_ICE
  }
}

function socketUrl(apiBase: string, roomId: string, role: RoomRole): string {
  const url = new URL(`${apiBase}/${encodeURIComponent(roomId)}/ws`, window.location.href)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.searchParams.set("role", role)
  return url.toString()
}

export function useWebcamRoom(roomId: string, { apiBase = "/api/rooms", role = "speaker" }: WebcamRoomOptions = {}) {
  const [status, setStatus] = useState<WebcamRoomStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [self, setSelf] = useState<RoomPeer | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [participants, setParticipants] = useState<Record<string, RemoteParticipant>>({})
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  /** The chosen camera, or null for the browser's default. */
  const [cameraId, setCameraId] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const peersRef = useRef(new Map<string, SimplePeer.Instance>())
  const streamRef = useRef<MediaStream | null>(null)
  const camOnRef = useRef(camOn)
  camOnRef.current = camOn

  const refreshCameras = useCallback(async () => setCameras(await listCameras()), [])

  useEffect(() => {
    void refreshCameras()
    const devices = navigator.mediaDevices
    if (!devices?.addEventListener) return
    const onChange = () => void refreshCameras()
    devices.addEventListener("devicechange", onChange)
    return () => devices.removeEventListener("devicechange", onChange)
  }, [refreshCameras])

  const upsert = useCallback((id: string, patch: Partial<RemoteParticipant>) => {
    setParticipants((prev) => {
      const base: RemoteParticipant = prev[id] ?? { id, name: "Guest", role: "speaker" }
      return { ...prev, [id]: { ...base, ...patch } }
    })
  }, [])

  const drop = useCallback((id: string) => {
    peersRef.current.get(id)?.destroy()
    peersRef.current.delete(id)
    setParticipants((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const leave = useCallback(() => {
    for (const peer of peersRef.current.values()) peer.destroy()
    peersRef.current.clear()
    socketRef.current?.close(1000, "left")
    socketRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLocalStream(null)
    setParticipants({})
    setSelf(null)
    setStatus("idle")
  }, [])

  const send = (message: object) => {
    const ws = socketRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }

  const join = useCallback(async () => {
    if (socketRef.current) return
    setError(null)
    setStatus("connecting")
    try {
      const [stream, iceServers, { default: Peer }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: videoConstraints(cameraId), audio: true }),
        loadIceServers(apiBase),
        import("simple-peer/simplepeer.min.js"),
      ])
      streamRef.current = stream
      setLocalStream(stream)
      setMicOn(true)
      setCamOn(true)
      // Now that permission is granted the list carries real labels, and the
      // picker should show whichever camera the browser actually opened.
      const opened = stream.getVideoTracks()[0]?.getSettings().deviceId
      if (opened) setCameraId(opened)
      void refreshCameras()

      const connect = (peerId: string, initiator: boolean) => {
        const existing = peersRef.current.get(peerId)
        if (existing) return existing
        const peer = new Peer({ initiator, trickle: true, stream, config: { iceServers } })
        peer.on("signal", (payload) => send({ type: "signal", to: peerId, payload }))
        peer.on("stream", (remote: MediaStream) => upsert(peerId, { stream: remote }))
        peer.on("close", () => peersRef.current.delete(peerId))
        peer.on("error", () => {
          peersRef.current.delete(peerId)
          upsert(peerId, { stream: undefined })
        })
        peersRef.current.set(peerId, peer)
        return peer
      }

      const ws = new WebSocket(socketUrl(apiBase, roomId, role))
      socketRef.current = ws
      ws.onmessage = (event) => {
        let msg: ServerMessage
        try {
          msg = JSON.parse(String(event.data))
        } catch {
          return
        }
        switch (msg.type) {
          case "welcome":
            setSelf(msg.self)
            setStatus("joined")
            for (const peer of msg.peers) {
              upsert(peer.id, peer)
              connect(peer.id, true)
            }
            break
          case "peer-joined":
            upsert(msg.peer.id, msg.peer)
            break
          case "peer-left":
            drop(msg.id)
            // Emit custom event for other hooks to listen
            window.dispatchEvent(
              new CustomEvent("room-peer-left", { detail: { from: msg.id } })
            )
            break
          case "signal":
            connect(msg.from, false).signal(msg.payload as SimplePeer.SignalData)
            break
          case "room-event":
            if (msg.event === "mute-state") upsert(msg.from, { micOn: !(msg.payload as { muted?: boolean })?.muted })
            if (msg.event === "camera-state") upsert(msg.from, { camOn: !(msg.payload as { off?: boolean })?.off })
            // Emit custom event for speech-doc-headings and timer-sync so other hooks can listen
            if (msg.event === "speech-doc-headings" || msg.event === "timer-sync") {
              window.dispatchEvent(
                new CustomEvent(`room-${msg.event}`, {
                  detail: { from: msg.from, event: msg.event, payload: msg.payload },
                })
              )
            }
            break
          case "error":
            setError(msg.message)
            if (msg.code === "room-full") {
              leave()
              setStatus("error")
            }
            break
        }
      }
      ws.onclose = (event) => {
        if (socketRef.current !== ws) return
        socketRef.current = null
        if (event.code !== 1000) {
          setError(event.reason || "Disconnected from the room.")
          leave()
          setStatus("error")
        }
      }
    } catch (e) {
      leave()
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera/microphone permission was denied."
          : e instanceof Error
            ? e.message
            : "Could not join the room.",
      )
      setStatus("error")
    }
    // `send` only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, roomId, role, cameraId, upsert, drop, leave, refreshCameras])

  /**
   * Pick a camera. Before joining it just records the choice; in the room it
   * opens the new camera and swaps its track into the local preview and
   * every peer connection, so nobody has to reconnect.
   */
  const selectCamera = useCallback(async (id: string) => {
    const stream = streamRef.current
    if (!stream) {
      setCameraId(id)
      return
    }
    const oldTrack = stream.getVideoTracks()[0]
    if (oldTrack?.getSettings().deviceId === id) return
    let newTrack: MediaStreamTrack | undefined
    try {
      const captured = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(id) })
      newTrack = captured.getVideoTracks()[0]
    } catch (e) {
      setError(e instanceof Error ? `Could not switch camera: ${e.message}` : "Could not switch camera.")
      return
    }
    if (!newTrack) return
    // Left the room while the camera was opening.
    if (streamRef.current !== stream) {
      newTrack.stop()
      return
    }
    newTrack.enabled = camOnRef.current
    if (oldTrack) {
      for (const peer of peersRef.current.values()) {
        try {
          peer.replaceTrack(oldTrack, newTrack, stream)
        } catch {
          // A peer still negotiating picks the track up from `stream` below.
        }
      }
      stream.removeTrack(oldTrack)
      oldTrack.stop()
    }
    stream.addTrack(newTrack)
    // A fresh stream object so the preview tile re-binds to the new track.
    setLocalStream(new MediaStream(stream.getTracks()))
    setCameraId(id)
    setError(null)
  }, [])

  const broadcast = (event: RoomEventName, payload: unknown) => send({ type: "room-event", event, payload })

  const toggleMic = () => {
    const next = !micOn
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next))
    setMicOn(next)
    broadcast("mute-state", { muted: !next })
  }

  const toggleCam = () => {
    const next = !camOn
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next))
    setCamOn(next)
    broadcast("camera-state", { off: !next })
  }

  // Leave when the room changes or the panel unmounts.
  useEffect(() => leave, [roomId, leave])

  return {
    status,
    error,
    self,
    localStream,
    participants: Object.values(participants),
    micOn,
    camOn,
    join,
    leave,
    toggleMic,
    toggleCam,
    cameras,
    cameraId,
    selectCamera,
    broadcast,
  }
}

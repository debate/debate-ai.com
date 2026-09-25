/**
 * @fileoverview "Cameras" section of the round sidebar: brings the debaters'
 * (and judge's) webcams into the round as a small peer-to-peer video room.
 *
 * Everyone who opens the same room code joins the same room; the default code
 * is derived from the round, and can be copied to (or pasted from) the other
 * side. Media flows browser-to-browser via simple-peer; the app Worker's
 * Durable Object only relays connection setup (see room-protocol.ts).
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, ChevronDown, ChevronRight, Copy, Mic, MicOff, PhoneOff, Video } from "lucide-react"
import { cn } from "../ui/lib/utils"
import { MAX_ROOM_CAMERAS, normalizeRoomId, roomIdForRound } from "./room-protocol"
import { useWebcamRoom } from "./useWebcamRoom"
import type { Round } from "../types/flow"

function VideoTile({
  stream,
  label,
  muted = false,
  micOff,
  camOff,
}: {
  stream?: MediaStream | null
  label: string
  muted?: boolean
  micOff?: boolean
  camOff?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== (stream ?? null)) ref.current.srcObject = stream ?? null
  }, [stream])
  return (
    <figure className="relative aspect-video overflow-hidden rounded-[var(--border-radius)] bg-black">
      {stream && !camOff ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-white/60">
          {stream ? "Camera off" : "Connecting…"}
        </div>
      )}
      <figcaption className="absolute bottom-0.5 left-1 flex items-center gap-1 rounded bg-black/60 px-1 text-[10px] text-white">
        {micOff && <MicOff className="h-2.5 w-2.5" aria-label="muted" />}
        <span className="max-w-[8rem] truncate">{label}</span>
      </figcaption>
    </figure>
  )
}

export function WebcamRoomPanel({ round, apiBase }: { round: Round; apiBase?: string }) {
  const [open, setOpen] = useState(true)
  const defaultRoom = roomIdForRound(round)
  const [roomInput, setRoomInput] = useState(defaultRoom)
  const roomId = normalizeRoomId(roomInput) ?? defaultRoom
  const room = useWebcamRoom(roomId, { apiBase })
  const [copied, setCopied] = useState(false)

  useEffect(() => setRoomInput(defaultRoom), [defaultRoom])

  const joined = room.status === "joined" || room.status === "connecting"
  const btn =
    "inline-flex h-7 items-center justify-center gap-1 rounded-[var(--border-radius)] border border-border px-2 text-xs hover:bg-[var(--background-indent)] disabled:opacity-50"

  return (
    <div className="pb-[var(--padding)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-[var(--border-radius)] p-[var(--padding)] text-left hover:bg-[var(--background-indent)]"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <Video className={cn("h-3.5 w-3.5 shrink-0", room.status === "joined" ? "text-green-600" : "text-muted-foreground")} />
        <span className="flex-1 truncate text-sm font-bold">Cameras</span>
        {room.status === "joined" && (
          <span className="text-[10px] text-muted-foreground">{room.participants.length + 1} in room</span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-2 pl-2">
          <div className="flex items-center gap-1">
            <input
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              disabled={joined}
              aria-label="Room code"
              className="h-7 min-w-0 flex-1 rounded-[var(--border-radius)] border border-border bg-transparent px-2 text-xs"
            />
            <button
              type="button"
              className={btn}
              title="Copy room code"
              onClick={() => {
                void navigator.clipboard?.writeText(roomId)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              <Copy className="h-3 w-3" />
              {copied ? "Copied" : ""}
            </button>
          </div>

          {joined ? (
            <>
              <div className="grid grid-cols-2 gap-1">
                <VideoTile stream={room.localStream} label={`${room.self?.name ?? "You"} (you)`} muted micOff={!room.micOn} camOff={!room.camOn} />
                {room.participants.map((p) => (
                  <VideoTile key={p.id} stream={p.stream} label={p.name} micOff={p.micOn === false} camOff={p.camOn === false} />
                ))}
              </div>
              <div className="flex gap-1">
                <button type="button" className={btn} onClick={room.toggleMic} aria-pressed={!room.micOn} title={room.micOn ? "Mute" : "Unmute"}>
                  {room.micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                </button>
                <button type="button" className={btn} onClick={room.toggleCam} aria-pressed={!room.camOn} title={room.camOn ? "Camera off" : "Camera on"}>
                  {room.camOn ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
                </button>
                <button type="button" className={cn(btn, "flex-1 text-red-600")} onClick={room.leave}>
                  <PhoneOff className="h-3 w-3" /> Leave
                </button>
              </div>
            </>
          ) : (
            <button type="button" className={cn(btn, "w-full")} onClick={() => void room.join()}>
              <Video className="h-3 w-3" /> Join with camera
            </button>
          )}

          {room.error && <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">{room.error}</p>}
          {!joined && (
            <p className="text-[10px] leading-snug text-muted-foreground">
              Share the room code with your opponent or judge. Video goes directly between browsers; up to{" "}
              {MAX_ROOM_CAMERAS} cameras per room.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

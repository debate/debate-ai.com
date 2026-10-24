/**
 * @fileoverview "Cameras" section of the round sidebar: brings the debaters'
 * (and judge's) webcams into the round as a small peer-to-peer video room.
 *
 * Everyone in the same round joins the same room — its id is derived from the
 * round, so there is nothing to share or type. Media flows browser-to-browser
 * via simple-peer; the app Worker's Durable Object only relays connection
 * setup (see room-protocol.ts). A camera picker chooses which of the
 * browser's cameras to send, before joining or mid-round.
 *
 * The camera and microphone stay off — not even opened — until their toggle
 * buttons next to the camera picker are switched on.
 *
 * Nobody picks how they join: the viewer's seat is inferred from the round's
 * invite list by matching their signed-in email (or name) — 1A / 2A / 1N / 2N
 * for the debaters, 1J / 2J… for the judges (see room-seat.ts). Anyone not on
 * the invite joins as an unlabeled spectator. Each tile is labeled with its
 * participant's seat, and remote participants are marked "Virtual", so a
 * judge can sit in the round virtually.
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, CameraOff, ChevronDown, ChevronRight, Mic, MicOff, PhoneOff, SwitchCamera, Video } from "lucide-react"
import { cn } from "../ui/lib/utils"
import { roomIdForRound, type RoomRole, type RoomSeat } from "./room-protocol"
import { useWebcamRoom } from "./useWebcamRoom"
import { useRoomSpeechRecorder } from "./useRoomSpeechRecorder"
import { roomBadgeLabel, roomTileLabel } from "./room-labels"
import { inferRoomSeat } from "./room-seat"
import type { Round } from "../types/flow"

const ROLE_BADGE_CLASS: Record<RoomRole, string> = {
  speaker: "bg-blue-600/90",
  judge: "bg-amber-600/90",
  observer: "bg-zinc-600/90",
}

function VideoTile({
  stream,
  name,
  label,
  role,
  seat,
  virtual = false,
  muted = false,
  micOff,
  camOff,
  pending = false,
}: {
  stream?: MediaStream | null
  /** Shown in the caption. */
  name: string
  /** Full name · role · virtual description, for the tooltip and screen readers. */
  label: string
  role: RoomRole
  /** Seat code from the round invite ("1A", "2J"…); none for a spectator. */
  seat?: RoomSeat | null
  virtual?: boolean
  muted?: boolean
  micOff?: boolean
  camOff?: boolean
  /** A remote camera reported on but not yet received. */
  pending?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== (stream ?? null)) ref.current.srcObject = stream ?? null
  }, [stream])
  const badge = roomBadgeLabel({ role, seat })
  return (
    <figure className="relative aspect-video overflow-hidden rounded-[var(--border-radius)] bg-black" aria-label={label}>
      {stream && !camOff ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-white/60">
          {pending ? "Connecting…" : "Camera off"}
        </div>
      )}
      <div className="absolute left-1 top-1 flex gap-0.5">
        {badge && (
          <span className={cn("rounded px-1 text-[9px] font-semibold uppercase tracking-wide text-white", ROLE_BADGE_CLASS[role])}>
            {badge}
          </span>
        )}
        {virtual && (
          <span className="rounded bg-purple-600/90 px-1 text-[9px] font-semibold uppercase tracking-wide text-white">
            Virtual
          </span>
        )}
      </div>
      <figcaption
        className="absolute bottom-0.5 left-1 flex items-center gap-1 rounded bg-black/60 px-1 text-[10px] text-white"
        title={label}
      >
        {micOff && <MicOff className="h-2.5 w-2.5" aria-label="muted" />}
        <span className="max-w-[8rem] truncate">{name}</span>
      </figcaption>
    </figure>
  )
}

/**
 * Which of the browser's cameras to send. Until camera permission is granted
 * the browser hides device names, so the list may only offer the default.
 */
function CameraPicker({
  cameras,
  cameraId,
  onSelect,
}: {
  cameras: MediaDeviceInfo[]
  cameraId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1" title="Choose camera">
      <SwitchCamera className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">Camera</span>
      <select
        value={cameraId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="h-7 min-w-0 flex-1 rounded-[var(--border-radius)] border border-border bg-transparent px-1 text-xs"
      >
        {(cameraId === null || cameras.length === 0) && <option value="">Default camera</option>}
        {cameras.map((c, i) => (
          <option key={c.deviceId} value={c.deviceId}>
            {c.label || `Camera ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  )
}

export function WebcamRoomPanel({
  round,
  apiBase,
  viewerEmails = [],
  viewerName,
}: {
  round: Round
  apiBase?: string
  /** The viewer's email(s), matched against the round invite to find their seat. */
  viewerEmails?: readonly (string | null | undefined)[]
  /** The viewer's display name, matched against invite entries that aren't emails. */
  viewerName?: string | null
}) {
  const [open, setOpen] = useState(true)
  const roomId = roomIdForRound(round)
  const emailsKey = viewerEmails.join("\n")
  const { role: joinRole, seat: joinSeat } = useMemo(
    () => inferRoomSeat(round, viewerEmails, viewerName),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emailsKey stands in for the array
    [round, emailsKey, viewerName],
  )
  const room = useWebcamRoom(roomId, { apiBase, role: joinRole, seat: joinSeat })
  useRoomSpeechRecorder(room.participants)

  const joined = room.status === "joined" || room.status === "connecting"
  const btn =
    "inline-flex h-7 items-center justify-center gap-1 rounded-[var(--border-radius)] border border-border px-2 text-xs hover:bg-[var(--background-indent)] disabled:opacity-50"
  const toggleOn = "border-green-600 bg-green-600/15 text-green-700 dark:text-green-400"

  const selfTile = (
    <VideoTile
      stream={room.localStream}
      name={`${room.self?.name ?? "You"} (you)`}
      label={roomTileLabel(room.self?.name ?? "You", room.self?.role ?? joinRole, { self: true, seat: room.self?.seat ?? joinSeat })}
      role={room.self?.role ?? joinRole}
      seat={room.self?.seat ?? joinSeat}
      muted
      micOff={!room.micOn}
      camOff={!room.camOn}
    />
  )

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
            <button
              type="button"
              className={cn(btn, room.camOn && toggleOn)}
              onClick={room.toggleCam}
              aria-pressed={room.camOn}
              title={room.camOn ? "Turn camera off" : "Turn camera on"}
            >
              {room.camOn ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
              <span className="sr-only">Camera</span>
            </button>
            <button
              type="button"
              className={cn(btn, room.micOn && toggleOn)}
              onClick={room.toggleMic}
              aria-pressed={room.micOn}
              title={room.micOn ? "Turn microphone off" : "Turn microphone on"}
            >
              {room.micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              <span className="sr-only">Microphone</span>
            </button>
            <CameraPicker cameras={room.cameras} cameraId={room.cameraId} onSelect={(id) => void room.selectCamera(id)} />
          </div>

          {joined ? (
            <>
              <div className="grid grid-cols-2 gap-1">
                {selfTile}
                {room.participants.map((p) => (
                  <VideoTile
                    key={p.id}
                    stream={p.stream}
                    name={p.name}
                    label={roomTileLabel(p.name, p.role, { seat: p.seat })}
                    role={p.role}
                    seat={p.seat}
                    virtual
                    micOff={p.micOn !== true}
                    camOff={p.camOn !== true || !p.stream}
                    pending={p.camOn === true && !p.stream}
                  />
                ))}
              </div>
              <button type="button" className={cn(btn, "w-full text-red-600")} onClick={room.leave}>
                <PhoneOff className="h-3 w-3" /> Leave
              </button>
            </>
          ) : (
            <>
              {room.localStream && <div className="grid grid-cols-2 gap-1">{selfTile}</div>}
              <button type="button" className={cn(btn, "w-full")} onClick={() => void room.join()}>
                <Video className="h-3 w-3" /> Join as {joinSeat ?? "spectator"}
              </button>
              {!joinSeat && (
                <p className="text-[10px] text-muted-foreground">
                  Your email isn&apos;t on this round&apos;s invite, so you&apos;ll join unlabeled.
                </p>
              )}
            </>
          )}

          {room.error && <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">{room.error}</p>}
        </div>
      )}
    </div>
  )
}

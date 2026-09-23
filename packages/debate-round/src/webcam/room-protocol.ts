/**
 * @fileoverview Wire protocol for round webcam rooms.
 *
 * Browsers exchange WebRTC offers/answers/ICE candidates (simple-peer's
 * `signal` payloads) through a room WebSocket served by the app Worker's
 * `DebateRoomSignal` Durable Object. The Durable Object only relays these
 * short messages — audio and video flow browser-to-browser over the peer
 * connections (or through TURN when a network requires it), never through
 * the Worker.
 *
 * Rooms are a peer-to-peer mesh, so they are capped at
 * {@link MAX_ROOM_CAMERAS}: every participant uploads one stream per peer.
 * Larger rooms (audiences, panels, recordings) belong on an SFU such as
 * Cloudflare Realtime; the protocol keeps signalling separate from room
 * events so the transport can be swapped later.
 *
 * Shared by the client hook (`useWebcamRoom`) and the Durable Object, so both
 * sides validate messages the same way.
 */

/** Mesh cap: each browser uploads (n - 1) streams, so keep n small. */
export const MAX_ROOM_CAMERAS = 4;

/** Largest message the room relays (SDP offers are a few KB). */
export const MAX_MESSAGE_BYTES = 64 * 1024;

export type RoomRole = "speaker" | "judge" | "observer";

export interface RoomPeer {
  id: string;
  name: string;
  role: RoomRole;
}

/** Browser → room. */
export type ClientMessage =
  | { type: "signal"; to: string; payload: unknown }
  | { type: "room-event"; event: RoomEventName; payload?: unknown };

/** Room → browser. */
export type ServerMessage =
  | { type: "welcome"; self: RoomPeer; peers: RoomPeer[] }
  | { type: "peer-joined"; peer: RoomPeer }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; payload: unknown }
  | { type: "room-event"; from: string; event: RoomEventName; payload?: unknown }
  | { type: "error"; code: "room-full" | "bad-message" | "unknown-peer"; message: string };

export const ROOM_EVENTS = ["ready", "mute-state", "camera-state"] as const;
export type RoomEventName = (typeof ROOM_EVENTS)[number];

const ROLES: readonly RoomRole[] = ["speaker", "judge", "observer"];

/** Room ids: short, URL-safe, case-insensitive. */
export function normalizeRoomId(raw: string): string | null {
  const id = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return id.length >= 3 && id.length <= 64 ? id : null;
}

export function normalizeRole(raw: string | null | undefined): RoomRole {
  return ROLES.includes(raw as RoomRole) ? (raw as RoomRole) : "speaker";
}

/** Parses and validates a browser message; null for anything malformed. */
export function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  if (text.length > MAX_MESSAGE_BYTES) return null;
  let msg: unknown;
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;
  if (m.type === "signal" && typeof m.to === "string" && m.to && m.payload !== undefined) {
    return { type: "signal", to: m.to, payload: m.payload };
  }
  if (m.type === "room-event" && ROOM_EVENTS.includes(m.event as RoomEventName)) {
    return { type: "room-event", event: m.event as RoomEventName, payload: m.payload };
  }
  return null;
}

/** The default room for a round, so both debaters of a shared round meet. */
export function roomIdForRound(round: { id: number | string; tournamentName?: string | null; roundLevel?: string | null }): string {
  const label = [round.tournamentName, round.roundLevel].filter(Boolean).join("-");
  return normalizeRoomId(`round-${round.id}${label ? `-${label}` : ""}`.slice(0, 64)) ?? `round-${round.id}`;
}

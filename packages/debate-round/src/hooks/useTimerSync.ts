"use client";

/**
 * @fileoverview Hook for syncing timer state across room participants
 * @module components/debate/flow/hooks/useTimerSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomEventName } from "../webcam/room-protocol";
import { useWebcamRoom } from "../webcam/useWebcamRoom";

export interface TimerSyncState {
  speechName: string;
  time: number;
  resetTime: number;
  state: { name: "paused" } | { name: "running"; startTime: number } | { name: "done" };
  timestamp: number;
}

function randomEventId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface RemoteTimerState {
  peerId: string;
  peerName: string;
  timerState: TimerSyncState;
}

export interface TimerSyncOptions {
  /** Called once per timer update from another device (deduplicated across sockets). */
  onRemoteTimer?: (timerState: TimerSyncState, from: string) => void
}

/** How many recent event ids to remember for deduplication. */
const SEEN_EVENT_LIMIT = 200

/**
 * Hook to sync timer state across all room participants.
 * - Broadcasts local timer changes to the room (callers decide when; see
 *   `useRoomTimerSync`, which sends only real changes such as play/pause)
 * - Receives timer state from other participants and hands each update to
 *   `onRemoteTimer` so it can be applied locally
 *
 * It joins as a data-only socket, so it never counts against the room's
 * camera cap.
 */
export function useTimerSync(
  roomId: string,
  role: "speaker" | "judge" | "observer" = "speaker",
  { onRemoteTimer }: TimerSyncOptions = {},
) {
  const [remoteTimers, setRemoteTimers] = useState<RemoteTimerState[]>([]);
  const { join, broadcast, status, participants, self } = useWebcamRoom(roomId, { role, dataOnly: true });
  const onRemoteTimerRef = useRef(onRemoteTimer);
  onRemoteTimerRef.current = onRemoteTimer;
  // Every socket in this tab on the same room re-dispatches an event as a
  // window event, so the same update can arrive more than once.
  const seenRef = useRef<string[]>([]);

  // Join the room on mount
  useEffect(() => {
    if (status === "idle") {
      join();
    }
  }, [join, status]);

  /**
   * Broadcast timer state to all room participants. Not throttled: a
   * dropped pause would leave every other device running.
   */
  const broadcastTimerState = useCallback(
    (speechName: string, timerState: TimerSyncState) => {
      broadcast("timer-sync" as RoomEventName, {
        id: randomEventId(),
        speechName,
        time: timerState.time,
        resetTime: timerState.resetTime,
        state: timerState.state,
        timestamp: Date.now(),
      });
    },
    [broadcast]
  );

  // Listen for incoming timer-sync events
  useEffect(() => {
    const handleTimerSync = (event: CustomEvent) => {
      const { from, payload } = event.detail;
      if (from === self?.id) return; // Ignore our own messages

      if (typeof payload?.id === "string") {
        if (seenRef.current.includes(payload.id)) return;
        seenRef.current = [...seenRef.current.slice(-(SEEN_EVENT_LIMIT - 1)), payload.id];
      }

      const peer = participants.find((p) => p.id === from);
      if (peer && payload?.speechName) {
        const timerState: TimerSyncState = {
          speechName: payload.speechName,
          time: payload.time,
          resetTime: payload.resetTime,
          state: payload.state,
          timestamp: payload.timestamp,
        };
        setRemoteTimers((prev) => [
          ...prev.filter((t) => !(t.peerId === from && t.timerState.speechName === payload.speechName)),
          { peerId: from, peerName: peer.name, timerState },
        ]);
        onRemoteTimerRef.current?.(timerState, from);
      }
    };

    window.addEventListener("room-timer-sync", handleTimerSync as EventListener);
    return () => window.removeEventListener("room-timer-sync", handleTimerSync as EventListener);
  }, [participants, self?.id]);

  // Clear timer when a peer leaves
  useEffect(() => {
    const handlePeerLeft = (event: CustomEvent) => {
      const { from } = event.detail;
      setRemoteTimers((prev) => prev.filter((t) => t.peerId !== from));
    };

    window.addEventListener("room-peer-left", handlePeerLeft as EventListener);
    return () => window.removeEventListener("room-peer-left", handlePeerLeft as EventListener);
  }, []);

  /** Asks whoever gives `speechName` to be more clear (see `round/clarity-request.ts`). */
  const sendClarityRequest = useCallback(
    (speechName: string) => {
      broadcast("clarity-request", { speechName, sentAt: Date.now() });
    },
    [broadcast]
  );

  return {
    remoteTimers,
    participants,
    broadcastTimerState,
    sendClarityRequest,
    clearTimers: () => setRemoteTimers([]),
  };
}

/**
 * Hook for a specific speech's timer sync.
 * Provides the latest timer state from a designated "leader" (e.g., the judge or first speaker).
 */
export function useSpeechTimerSync(roomId: string, speechName: string, role: "speaker" | "judge" | "observer" = "speaker") {
  const { remoteTimers, broadcastTimerState } = useTimerSync(roomId, role);

  // Get the timer state from the first speaker (or judge) in the room
  const leaderTimer = remoteTimers.find(
    (t) => t.timerState.speechName === speechName && (t.peerName.includes("Judge") || t.peerName.includes("1A") || t.peerName.includes("1N"))
  );

  return {
    leaderTimer: leaderTimer?.timerState,
    broadcastTimerState: (state: TimerSyncState) => broadcastTimerState(speechName, state),
    allRemoteTimers: remoteTimers.filter((t) => t.timerState.speechName === speechName),
  };
}
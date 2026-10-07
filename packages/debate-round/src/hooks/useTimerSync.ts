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

export interface RemoteTimerState {
  peerId: string;
  peerName: string;
  timerState: TimerSyncState;
}

/**
 * Hook to sync timer state across all room participants.
 * - Broadcasts local timer changes to the room
 * - Receives and can apply timer state from other participants (e.g., the judge or lead debater)
 */
export function useTimerSync(roomId: string, role: "speaker" | "judge" | "observer" = "speaker") {
  const [remoteTimers, setRemoteTimers] = useState<RemoteTimerState[]>([]);
  const { join, broadcast, status, participants, self } = useWebcamRoom(roomId, { role });
  const lastBroadcastRef = useRef<Record<string, number>>({});

  // Join the room on mount
  useEffect(() => {
    if (status === "idle") {
      join();
    }
  }, [join, status]);

  /**
   * Broadcast timer state to all room participants.
   * Throttled to avoid flooding the room.
   */
  const broadcastTimerState = useCallback(
    (speechName: string, timerState: TimerSyncState) => {
      const now = Date.now();
      const key = speechName;
      const lastBroadcast = lastBroadcastRef.current[key] ?? 0;

      // Throttle: only broadcast once per 500ms per speech
      if (now - lastBroadcast < 500) return;
      lastBroadcastRef.current[key] = now;

      broadcast("timer-sync" as RoomEventName, {
        speechName,
        time: timerState.time,
        resetTime: timerState.resetTime,
        state: timerState.state,
        timestamp: now,
      });
    },
    [broadcast]
  );

  // Listen for incoming timer-sync events
  useEffect(() => {
    const handleTimerSync = (event: CustomEvent) => {
      const { from, payload } = event.detail;
      if (from === self?.id) return; // Ignore our own messages

      const peer = participants.find((p) => p.id === from);
      if (peer && payload?.speechName) {
        setRemoteTimers((prev) => [
          ...prev.filter((t) => !(t.peerId === from && t.timerState.speechName === payload.speechName)),
          {
            peerId: from,
            peerName: peer.name,
            timerState: {
              speechName: payload.speechName,
              time: payload.time,
              resetTime: payload.resetTime,
              state: payload.state,
              timestamp: payload.timestamp,
            },
          },
        ]);
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
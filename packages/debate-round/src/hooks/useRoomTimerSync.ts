"use client";

/**
 * @fileoverview Keeps every device in a round room on the same timers.
 *
 * When anyone starts, pauses, resets or edits a speech or prep timer, the
 * change goes out over the room's `timer-sync` event and every other device
 * applies it to its own timer, so the whole room sees the same clock running
 * or stopped. Only changes are sent, never the 100 ms ticks of a running
 * timer: a running timer travels as how long it has been running, and each
 * device counts down from there on its own clock (so clock skew between
 * devices doesn't matter).
 *
 * @module hooks/useRoomTimerSync
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type React from "react";
import type { TimerState } from "@debate/timer/src/types";
import type { SpeechTimerEntry } from "./useTimerState";
import { useTimerSync, type TimerSyncState } from "./useTimerSync";

/** Room keys for the two prep clocks (speech timers use the speech's name). */
export const PREP_AFF_TIMER = "Prep (Aff)";
export const PREP_NEG_TIMER = "Prep (Neg)";

/**
 * What identifies a timer change worth sending. A running timer's `time`
 * moves on every tick, so it is left out — only when it started counts.
 */
export function timerSignature(entry: SpeechTimerEntry): string {
  return entry.state.name === "running"
    ? `running:${entry.state.startTime}:${entry.resetTime}`
    : `${entry.state.name}:${entry.time}:${entry.resetTime}`;
}

/**
 * Turns a received update into local timer state. A running timer's start
 * time is rebased onto this device's clock from how long it had been running
 * when it was sent, since the two clocks can disagree.
 */
export function fromWireState(remote: TimerSyncState, now: number): SpeechTimerEntry {
  if (remote.state.name === "running") {
    const elapsed = Math.max(0, remote.timestamp - remote.state.startTime);
    return { time: remote.time, resetTime: remote.resetTime, state: { name: "running", startTime: now - elapsed } };
  }
  return { time: remote.time, resetTime: remote.resetTime, state: remote.state };
}

/** The timer state `useRoomTimerSync` reads and writes (from `useTimerState`). */
export interface RoomTimerSyncTimers {
  perSpeechTimerStates: Record<string, SpeechTimerEntry>;
  prepState: TimerState | null;
  prepSecondaryState: TimerState | null;
  setSpeechTimerState: (speechName: string, updates: Partial<SpeechTimerEntry>) => void;
  setPrepState: React.Dispatch<React.SetStateAction<TimerState | null>>;
  setPrepSecondaryState: React.Dispatch<React.SetStateAction<TimerState | null>>;
}

/**
 * Broadcasts this device's timer changes to the round room and applies
 * everyone else's. Pass `null` for `roomId` when the flow has no round.
 */
export function useRoomTimerSync(roomId: string | null, timers: RoomTimerSyncTimers) {
  const { perSpeechTimerStates, prepState, prepSecondaryState, setSpeechTimerState, setPrepState, setPrepSecondaryState } =
    timers;

  /** Last signature sent or applied per timer, so applied updates aren't echoed back. */
  const knownRef = useRef(new Map<string, string>());
  /** Timers the room has heard about, which a newcomer gets caught up on. */
  const touchedRef = useRef(new Set<string>());
  const seededRef = useRef(false);

  const current = useMemo(() => {
    const all: Record<string, SpeechTimerEntry> = { ...perSpeechTimerStates };
    if (prepState) all[PREP_AFF_TIMER] = prepState;
    if (prepSecondaryState) all[PREP_NEG_TIMER] = prepSecondaryState;
    return all;
  }, [perSpeechTimerStates, prepState, prepSecondaryState]);
  const currentRef = useRef(current);
  currentRef.current = current;

  const applyRemote = useCallback(
    (remote: TimerSyncState) => {
      const entry = fromWireState(remote, Date.now());
      knownRef.current.set(remote.speechName, timerSignature(entry));
      touchedRef.current.add(remote.speechName);
      if (remote.speechName === PREP_AFF_TIMER) setPrepState((prev) => prev && { ...prev, ...entry });
      else if (remote.speechName === PREP_NEG_TIMER) setPrepSecondaryState((prev) => prev && { ...prev, ...entry });
      else setSpeechTimerState(remote.speechName, entry);
    },
    [setPrepState, setPrepSecondaryState, setSpeechTimerState],
  );

  const sync = useTimerSync(roomId ?? "", "speaker", { onRemoteTimer: applyRemote });
  const broadcastRef = useRef(sync.broadcastTimerState);
  broadcastRef.current = sync.broadcastTimerState;

  const send = useCallback((name: string, entry: SpeechTimerEntry) => {
    broadcastRef.current(name, { speechName: name, ...entry, timestamp: Date.now() });
  }, []);

  // Send each real change. The first pass only records where every timer
  // starts, so opening a round never resets anyone else's clock.
  useEffect(() => {
    const seeding = !seededRef.current;
    seededRef.current = true;
    for (const [name, entry] of Object.entries(current)) {
      const sig = timerSignature(entry);
      if (knownRef.current.get(name) === sig) continue;
      knownRef.current.set(name, sig);
      if (seeding || !roomId) continue;
      touchedRef.current.add(name);
      send(name, entry);
    }
  }, [current, roomId, send]);

  // Catch up whoever just joined on the timers the room has already used.
  const peerKey = sync.participants
    .map((p) => p.id)
    .sort()
    .join(",");
  const peersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(peerKey ? peerKey.split(",") : []);
    const newcomer = [...ids].some((id) => !peersRef.current.has(id));
    peersRef.current = ids;
    if (!newcomer || !roomId) return;
    for (const name of touchedRef.current) {
      const entry = currentRef.current[name];
      if (entry) send(name, entry);
    }
  }, [peerKey, roomId, send]);

  return {
    remoteTimers: sync.remoteTimers,
    sendClarityRequest: sync.sendClarityRequest,
  };
}

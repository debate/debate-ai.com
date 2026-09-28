"use client";

/**
 * @fileoverview Hook for broadcasting and receiving speech document headings in a room
 * @module components/debate/flow/hooks/useSpeechDocHeadings
 */

import { useCallback, useEffect, useState } from "react";
import type { RoomEventName } from "../webcam/room-protocol";
import { useWebcamRoom } from "../webcam/useWebcamRoom";
import { extractSpeechDocHeadings, type SpeechDocHeading } from "../utils/speech-doc-headings";

export interface RemoteSpeechDocHeadings {
  peerId: string;
  peerName: string;
  speechName: string;
  headings: SpeechDocHeading[];
  timestamp: number;
}

/**
 * Hook to manage speech document headings sharing in a webcam room.
 * - Broadcasts headings when the local user shares their speech doc
 * - Receives and stores headings from other participants
 */
export function useSpeechDocHeadings(roomId: string, role: "speaker" | "judge" | "observer" = "speaker") {
  const [receivedHeadings, setReceivedHeadings] = useState<RemoteSpeechDocHeadings[]>([]);
  const { join, broadcast, status, participants, self } = useWebcamRoom(roomId, { role });

  // Join the room on mount
  useEffect(() => {
    if (status === "idle") {
      join();
    }
  }, [join, status]);

  /**
   * Broadcast the headings from a speech document to all room participants.
   * Called when a debater "aligns" / shares their speech doc.
   */
  const broadcastSpeechDocHeadings = useCallback(
    (speechName: string, markdownContent: string) => {
      const headings = extractSpeechDocHeadings(markdownContent);
      if (headings.length === 0) return;

      broadcast("speech-doc-headings" as RoomEventName, {
        speechName,
        headings,
        timestamp: Date.now(),
      });
    },
    [broadcast]
  );

  // Listen for incoming speech-doc-headings events
  useEffect(() => {
    // The useWebcamRoom hook handles room-event messages internally.
    // We need to extend it or add a listener here.
    // For now, we'll use a custom event approach.
    const handleHeadings = (event: CustomEvent) => {
      const { from, payload } = event.detail;
      if (from === self?.id) return; // Ignore our own messages

      const peer = participants.find((p) => p.id === from);
      if (peer && payload?.speechName && payload?.headings) {
        setReceivedHeadings((prev) => [
          ...prev.filter((h) => !(h.peerId === from && h.speechName === payload.speechName)),
          {
            peerId: from,
            peerName: peer.name,
            speechName: payload.speechName,
            headings: payload.headings,
            timestamp: payload.timestamp,
          },
        ]);
      }
    };

    window.addEventListener("room-speech-doc-headings", handleHeadings as EventListener);
    return () => window.removeEventListener("room-speech-doc-headings", handleHeadings as EventListener);
  }, [participants, self?.id]);

  // Clear headings when a peer leaves
  useEffect(() => {
    // This would need integration with the room's peer-left event
  }, [participants]);

  return {
    receivedHeadings,
    broadcastSpeechDocHeadings,
    clearHeadings: () => setReceivedHeadings([]),
    removeHeadings: (peerId: string, speechName: string) => {
      setReceivedHeadings((prev) => prev.filter((h) => !(h.peerId === peerId && h.speechName === speechName)));
    },
  };
}

/**
 * Hook to broadcast speech doc headings from a specific speech document.
 * Integrates with the speech doc editor's share flow.
 */
export function useBroadcastSpeechDocHeadings(roomId: string) {
  const { broadcast, status } = useWebcamRoom(roomId);

  const broadcastHeadings = useCallback(
    (speechName: string, markdownContent: string) => {
      if (status !== "joined") return;

      const headings = extractSpeechDocHeadings(markdownContent);
      if (headings.length === 0) return;

      broadcast("speech-doc-headings" as RoomEventName, {
        speechName,
        headings,
        timestamp: Date.now(),
      });
    },
    [broadcast, status]
  );

  return { broadcastHeadings };
}
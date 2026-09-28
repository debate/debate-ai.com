"use client";

/**
 * @fileoverview Component to display speech document headings from other room participants
 * @module components/debate/flow/layout/RemoteSpeechDocHeadings
 */

import { useMemo } from "react";
import { FileText, User, ChevronRight } from "lucide-react";
import { Button } from "../ui/primitives/button";
import type { RemoteSpeechDocHeadings } from "../hooks/useSpeechDocHeadings";

interface RemoteSpeechDocHeadingsProps {
  /** Array of received headings from other participants */
  headings: RemoteSpeechDocHeadings[];
  /** Callback when a heading is clicked (optional) */
  onHeadingClick?: (heading: RemoteSpeechDocHeadings, headingText: string) => void;
  /** Maximum number of headings to show per participant before collapsing */
  maxHeadingsPerParticipant?: number;
}

export function RemoteSpeechDocHeadings({
  headings,
  onHeadingClick,
  maxHeadingsPerParticipant = 5,
}: RemoteSpeechDocHeadingsProps) {
  const groupedByParticipant = useMemo(() => {
    const groups: Record<string, RemoteSpeechDocHeadings[]> = {};
    for (const h of headings) {
      if (!groups[h.peerId]) groups[h.peerId] = [];
      groups[h.peerId].push(h);
    }
    return groups;
  }, [headings]);

  if (headings.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <FileText className="mx-auto h-6 w-6 mb-2 opacity-50" />
        <p>No speech document headings shared yet</p>
        <p className="text-xs">When a debater shares their speech doc, headings will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(groupedByParticipant).map(([peerId, participantHeadings]) => {
        const first = participantHeadings[0];
        const allHeadings = participantHeadings.flatMap((h) => h.headings);
        const uniqueHeadings = allHeadings.filter(
          (h, i, arr) => arr.findIndex((x) => x.text === h.text) === i
        );
        const displayHeadings = uniqueHeadings.slice(0, maxHeadingsPerParticipant);
        const remaining = uniqueHeadings.length - displayHeadings.length;

        return (
          <div key={peerId} className="border border-border rounded-lg p-3 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{first.peerName}</span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                {first.speechName}
              </span>
            </div>
            <div className="space-y-1 ml-6">
              {displayHeadings.map((heading, index) => (
                <button
                  key={`${heading.text}-${index}`}
                  onClick={() => onHeadingClick?.(first, heading.text)}
                  className="w-full text-left flex items-center gap-2 text-sm hover:text-accent-foreground hover:bg-accent rounded px-2 py-1 transition-colors"
                >
                  <span className="text-muted-foreground font-mono text-xs">
                    {"#".repeat(heading.level)}
                  </span>
                  <span className="truncate">{heading.text}</span>
                </button>
              ))}
              {remaining > 0 && (
                <button className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1">
                  <ChevronRight className="inline h-3 w-3 mr-1" />
                  +{remaining} more heading{remaining > 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
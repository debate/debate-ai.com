"use client";

/**
 * @fileoverview The progress chart atop Rebuttal Playlists: one row per
 * playlist, with a bar for how many of its ten videos the viewer has redone
 * (on either side) and a darker inner bar for those redone on both sides.
 * Plain HTML bars, so it reflows to phone width and reads in both themes.
 *
 * @module debate-practice-rounds/rebuttal-playlists/ui/PlaylistProgressChart
 */

import { cn } from "@debate-ai/round/src/ui/lib/utils";
import type { PlaylistProgress } from "../progress";
import type { RebuttalPlaylist } from "../types";

export interface PlaylistProgressChartProps {
  playlists: readonly RebuttalPlaylist[];
  progress: readonly PlaylistProgress[];
  /** Opens a playlist when its row is clicked. */
  onOpen?: (playlistId: string) => void;
  className?: string;
}

export function PlaylistProgressChart({ playlists, progress, onOpen, className }: PlaylistProgressChartProps) {
  const byId = new Map(progress.map((entry) => [entry.playlistId, entry]));
  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-label="Progress by playlist">
      <ul className="flex flex-col gap-1.5">
        {playlists.map((playlist) => {
          const entry = byId.get(playlist.id);
          const total = entry?.total || playlist.videos.length || 1;
          const done = entry?.done ?? 0;
          const both = entry?.bothSides ?? 0;
          return (
            <li key={playlist.id}>
              <button
                type="button"
                onClick={() => onOpen?.(playlist.id)}
                className="grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs hover:bg-muted sm:grid-cols-[minmax(0,14rem)_1fr_auto]"
                aria-label={`${playlist.title}: ${done} of ${total} videos redone, ${both} on both sides`}
              >
                <span className="truncate text-muted-foreground">
                  <span aria-hidden="true">{playlist.emoji} </span>
                  {playlist.title}
                </span>
                <span className="relative h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-primary/40 transition-[width]"
                    style={{ width: `${(done / total) * 100}%` }}
                  />
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width]"
                    style={{ width: `${(both / total) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right tabular-nums font-medium">
                  {done}/{total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <figcaption className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-full bg-primary/40" aria-hidden="true" /> Redone on one side
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-full bg-primary" aria-hidden="true" /> Both Aff and Neg
        </span>
      </figcaption>
    </figure>
  );
}

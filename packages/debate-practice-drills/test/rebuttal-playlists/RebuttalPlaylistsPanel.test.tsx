// @vitest-environment jsdom
/**
 * @fileoverview Render tests for Rebuttal Playlists: the signed-out view, the
 * rank and progress chart, starting a drill from a playlist, and turning in a
 * rebuttal (which records Debater Level XP).
 */

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RebuttalPlaylistsPanel } from "../../src/rebuttal-playlists/ui/RebuttalPlaylistsPanel";
import type { RebuttalBoardResponse, RebuttalDrill } from "../../src/rebuttal-playlists/types";
import { button } from "../helpers/dom";
import { click, flush, mount, type, type Mounted } from "../helpers/mount";

const viewer = { id: "alice", name: "Alice", imageUrl: null };

function drill(extra: Partial<RebuttalDrill> = {}): RebuttalDrill {
  const seat = (side: "aff" | "neg") => ({ side, person: null, submitted: false, text: null, coachLeft: 3 });
  return {
    id: "d1",
    playlistId: "policy-finals",
    videoId: "HXGNNhOxrBw",
    format: "policy",
    topic: "2018 Barkley Forum Finals — Greenhill EG vs MBA BJ",
    status: "writing",
    vsAi: true,
    viewerSide: "aff",
    aff: { ...seat("aff"), person: viewer },
    neg: { ...seat("neg"), person: { id: "ai", name: "AI partner", imageUrl: null } },
    winnerSide: null,
    decision: "",
    moves: ["submit", "coach"],
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...extra,
  };
}

const board = (drills: RebuttalDrill[]): RebuttalBoardResponse => ({ viewer, drills, openSeats: [] });

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("RebuttalPlaylistsPanel", () => {
  it("shows the playlists and asks a signed-out reader to sign in", async () => {
    mounted = await mount(createElement(RebuttalPlaylistsPanel, { loadBoard: async () => null }));
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Sign in");
    expect(text).toContain("GOAT High School Policy Finals");
    expect(text).toContain("NDT Finals");
  });

  it("shows the rank and per-playlist progress", async () => {
    const done = drill({ aff: { side: "aff", person: viewer, submitted: true, text: "x", coachLeft: 3 } });
    mounted = await mount(createElement(RebuttalPlaylistsPanel, { loadBoard: async () => board([done]), recordActivity: vi.fn() }));
    expect(mounted.container.querySelector('[data-testid="rebuttal-rank"]')?.textContent).toBe("Novice");
    expect(mounted.container.querySelector('[aria-label^="GOAT High School Policy Finals: 1 of 10"]')).not.toBeNull();
  });

  it("starts a drill against the AI from a playlist", async () => {
    const startDrill = vi.fn(async () => ({ drill: drill(), joined: false }));
    mounted = await mount(
      createElement(RebuttalPlaylistsPanel, { loadBoard: async () => board([]), startDrill, recordActivity: vi.fn() }),
    );
    const card = Array.from(mounted.container.querySelectorAll("button")).find((el) => el.textContent?.includes("Prelim Fundamentals"));
    await click(card!);
    await click(mounted.container.querySelectorAll("ol button")[0] as HTMLButtonElement);
    await click(button(mounted.container, "Vs AI"));
    await flush(async () => {});
    expect(startDrill).toHaveBeenCalledWith({ playlistId: "prelim-fundamentals", videoId: "3dQJsOlRqXE", side: "aff", partner: "ai" });
    expect(mounted.container.textContent).toContain("Drill started against the AI");
  });

  it("turns in a rebuttal and records the redo as Debater Level XP", async () => {
    const recordActivity = vi.fn();
    const updateDrill = vi.fn(async () => ({ drill: drill({ aff: { side: "aff", person: viewer, submitted: true, text: "x", coachLeft: 3 } }) }));
    mounted = await mount(
      createElement(RebuttalPlaylistsPanel, { loadBoard: async () => board([drill()]), updateDrill, recordActivity }),
    );
    const textarea = mounted.container.querySelector('[data-testid="rebuttal-drill"] textarea') as HTMLTextAreaElement;
    await type(textarea, "Extend the link turn they dropped and weigh it on probability.");
    await click(button(mounted.container, "Turn in rebuttal"));
    await flush(async () => {});
    expect(updateDrill).toHaveBeenCalledWith("d1", { action: "submit", text: "Extend the link turn they dropped and weigh it on probability." });
    expect(recordActivity).toHaveBeenCalledWith("rebuttal_redo", 1);
  });
});

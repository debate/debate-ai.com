import { beforeEach, describe, expect, it } from "vitest";
import type { OpponentRoundRecord } from "debate-data-sync/src/rankings/opponent-team-profile";
import { buildOpponentTeamProfile } from "debate-data-sync/src/rankings/opponent-team-profile";
import { saveOpponentTeamProfile } from "debate-data-sync/src/state/opponentTeamProfiles";
import type { JudgeRoundRecord } from "debate-speech-writer/src/judge/judge-profile";
import { buildJudgeProfile } from "debate-speech-writer/src/judge/judge-profile";
import { saveJudgeProfile } from "debate-speech-writer/src/state/judgeProfiles";
import {
  appendPrepNoteToPreRoundBriefing,
  buildPreRoundBriefingRecordFromDraft,
  buildPreRoundBriefingsPanelView,
  deletePreRoundBriefing,
  getPreRoundBriefing,
  listPreRoundBriefings,
  savePreRoundBriefing,
  type PreRoundBriefingDraft,
  type PreRoundBriefingRecord,
} from "../src/state/preRoundBriefings";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const NOW = Date.UTC(2026, 0, 1);

const BRIEFING_A: PreRoundBriefingRecord = {
  roundId: "round-1",
  briefing: {
    event: {
      tournamentName: "Blake",
      division: "LD",
      roundLabel: "Round 4",
      side: "aff",
    },
    priorMeetings: { meetings: 1, wins: 1, losses: 0 },
    sections: [{ title: "Event", body: "Blake — LD, Round 4\nSide: aff" }],
  },
};
const BRIEFING_B: PreRoundBriefingRecord = {
  roundId: "round-2",
  briefing: {
    event: {
      tournamentName: "Greenhill",
      division: "PF",
      roundLabel: "Round 1",
      side: "neg",
    },
    priorMeetings: { meetings: 0, wins: 0, losses: 0 },
    sections: [{ title: "Event", body: "Greenhill — PF, Round 1\nSide: neg" }],
  },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listPreRoundBriefings", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPreRoundBriefings()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("preRoundBriefings", "{not json");
    expect(listPreRoundBriefings()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("preRoundBriefings", JSON.stringify({ not: "an array" }));
    expect(listPreRoundBriefings()).toEqual([]);
  });

  it("lists every saved briefing", () => {
    savePreRoundBriefing(BRIEFING_A, NOW);
    savePreRoundBriefing(BRIEFING_B, NOW);
    expect(listPreRoundBriefings()).toEqual([
      { ...BRIEFING_A, updatedAt: NOW },
      { ...BRIEFING_B, updatedAt: NOW },
    ]);
  });
});

describe("getPreRoundBriefing", () => {
  it("finds a saved briefing by roundId", () => {
    savePreRoundBriefing(BRIEFING_A, NOW);
    expect(getPreRoundBriefing("round-1")).toEqual({ ...BRIEFING_A, updatedAt: NOW });
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getPreRoundBriefing("missing")).toBeUndefined();
  });
});

describe("savePreRoundBriefing", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    savePreRoundBriefing(BRIEFING_A, NOW);
    const updated: PreRoundBriefingRecord = {
      ...BRIEFING_A,
      briefing: { ...BRIEFING_A.briefing, priorMeetings: { meetings: 2, wins: 1, losses: 1 } },
    };
    const laterNow = NOW + 60_000;
    savePreRoundBriefing(updated, laterNow);

    expect(listPreRoundBriefings()).toEqual([{ ...updated, updatedAt: laterNow }]);
    expect(getPreRoundBriefing("round-1")).toEqual({ ...updated, updatedAt: laterNow });
  });

  it("stamps updatedAt with the current time by default", () => {
    const before = Date.now();
    savePreRoundBriefing(BRIEFING_A);
    const after = Date.now();

    const stored = getPreRoundBriefing("round-1");
    expect(stored?.updatedAt).toBeGreaterThanOrEqual(before);
    expect(stored?.updatedAt).toBeLessThanOrEqual(after);
  });

  it("ignores any updatedAt already present on the passed-in record", () => {
    savePreRoundBriefing({ ...BRIEFING_A, updatedAt: 1 }, NOW);
    expect(getPreRoundBriefing("round-1")?.updatedAt).toBe(NOW);
  });
});

describe("deletePreRoundBriefing", () => {
  it("removes a stored briefing by roundId", () => {
    savePreRoundBriefing(BRIEFING_A, NOW);
    savePreRoundBriefing(BRIEFING_B, NOW);
    deletePreRoundBriefing("round-1");

    expect(listPreRoundBriefings()).toEqual([{ ...BRIEFING_B, updatedAt: NOW }]);
    expect(getPreRoundBriefing("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    savePreRoundBriefing(BRIEFING_B, NOW);
    deletePreRoundBriefing("missing");
    expect(listPreRoundBriefings()).toEqual([{ ...BRIEFING_B, updatedAt: NOW }]);
  });
});

describe("buildPreRoundBriefingsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildPreRoundBriefingsPanelView()).toEqual([]);
  });

  it("sorts every persisted briefing by roundId", () => {
    savePreRoundBriefing(BRIEFING_B, NOW);
    savePreRoundBriefing(BRIEFING_A, NOW);
    expect(buildPreRoundBriefingsPanelView()).toEqual([
      { ...BRIEFING_A, updatedAt: NOW },
      { ...BRIEFING_B, updatedAt: NOW },
    ]);
  });

  it("does not mutate the underlying stored order", () => {
    savePreRoundBriefing(BRIEFING_B, NOW);
    savePreRoundBriefing(BRIEFING_A, NOW);
    buildPreRoundBriefingsPanelView();
    expect(listPreRoundBriefings()).toEqual([
      { ...BRIEFING_B, updatedAt: NOW },
      { ...BRIEFING_A, updatedAt: NOW },
    ]);
  });
});

function judgeRecords(): JudgeRoundRecord[] {
  return [
    {
      judgeId: "J. Smith",
      tournamentName: "Blake",
      date: "2026-01-01",
      division: "LD",
      winningSide: "aff",
      affSpeakerPoints: 28,
      negSpeakerPoints: 27,
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
    },
  ];
}

const VALID_DRAFT: PreRoundBriefingDraft = {
  roundId: "round-9",
  tournamentName: "Blake",
  division: "LD",
  roundLabel: "Round 4",
  side: "aff",
};

describe("buildPreRoundBriefingRecordFromDraft", () => {
  it("composes a valid record from the minimal required fields", () => {
    const result = buildPreRoundBriefingRecordFromDraft(VALID_DRAFT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.record.roundId).toBe("round-9");
    expect(result.record.briefing.event).toEqual({
      tournamentName: "Blake",
      division: "LD",
      roundLabel: "Round 4",
      side: "aff",
    });
    expect(result.record.briefing.priorMeetings).toEqual({ meetings: 0, wins: 0, losses: 0 });
  });

  it("trims whitespace-only required fields and reports a validation error", () => {
    const result = buildPreRoundBriefingRecordFromDraft({ ...VALID_DRAFT, roundId: "   " });

    expect(result).toEqual({
      ok: false,
      error: "Round ID, tournament, division, and round label are all required.",
    });
  });

  it("reports a validation error when any required field is missing", () => {
    expect(buildPreRoundBriefingRecordFromDraft({ ...VALID_DRAFT, tournamentName: "" }).ok).toBe(
      false,
    );
    expect(buildPreRoundBriefingRecordFromDraft({ ...VALID_DRAFT, division: "" }).ok).toBe(false);
    expect(buildPreRoundBriefingRecordFromDraft({ ...VALID_DRAFT, roundLabel: "" }).ok).toBe(
      false,
    );
  });

  it("includes optional room, opponent label, and prep notes when supplied", () => {
    const result = buildPreRoundBriefingRecordFromDraft({
      ...VALID_DRAFT,
      room: "  Room 204  ",
      opponentLabel: "  Greenhill AB  ",
      teamPrepNotes: ["Read the K first", "Watch for theory"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.record.briefing.event).toEqual({
      tournamentName: "Blake",
      division: "LD",
      roundLabel: "Round 4",
      side: "aff",
      room: "Room 204",
      opponentLabel: "Greenhill AB",
    });
    const prepNotes = result.record.briefing.sections.find((s) => s.title === "Team prep notes");
    expect(prepNotes?.body).toBe("- Read the K first\n- Watch for theory");
  });

  it("resolves an opponent/judge profile from the persisted stores by id", () => {
    saveOpponentTeamProfile(
      buildOpponentTeamProfile("OpponentA", [
        {
          teamId: "OpponentA",
          tournamentName: "Blake",
          date: "2026-01-01",
          division: "LD",
          side: "neg",
          won: false,
          opponentTeamId: "MyTeam",
        },
      ]),
    );
    saveJudgeProfile(buildJudgeProfile("J. Smith", judgeRecords()));

    const result = buildPreRoundBriefingRecordFromDraft({
      ...VALID_DRAFT,
      opponentTeamId: "OpponentA",
      judgeId: "J. Smith",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    const byTitle = Object.fromEntries(
      result.record.briefing.sections.map((s) => [s.title, s.body]),
    );
    expect(byTitle["Opponent scouting"]).toContain("OpponentA");
    expect(byTitle["Judge tendencies"]).toContain("J. Smith");
  });

  it("falls back to 'no data on file' when an opponent/judge id doesn't resolve", () => {
    const result = buildPreRoundBriefingRecordFromDraft({
      ...VALID_DRAFT,
      opponentTeamId: "Unknown",
      judgeId: "Unknown",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    const byTitle = Object.fromEntries(
      result.record.briefing.sections.map((s) => [s.title, s.body]),
    );
    expect(byTitle["Opponent scouting"]).toBe("No opponent scouting data on file.");
    expect(byTitle["Judge tendencies"]).toBe("No judge tendency data on file.");
  });
});

describe("appendPrepNoteToPreRoundBriefing", () => {
  function prepNotesBody(record: PreRoundBriefingRecord | undefined): string | undefined {
    return record?.briefing.sections.find((s) => s.title === "Team prep notes")?.body;
  }

  it("returns an error when no briefing is saved for the round", () => {
    const result = appendPrepNoteToPreRoundBriefing("missing", "Read the K first", NOW);
    expect(result).toEqual({ ok: false, error: 'No saved briefing for round "missing" — create one first.' });
  });

  it("appends the note to the saved briefing's Team prep notes section and re-saves it", () => {
    const draftResult = buildPreRoundBriefingRecordFromDraft(VALID_DRAFT);
    if (!draftResult.ok) throw new Error("expected ok result");
    savePreRoundBriefing(draftResult.record, NOW);

    const laterNow = NOW + 60_000;
    const result = appendPrepNoteToPreRoundBriefing(VALID_DRAFT.roundId, "Watch for theory", laterNow);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(prepNotesBody(result.record)).toBe("- Watch for theory");
    expect(result.record.updatedAt).toBe(laterNow);

    const stored = getPreRoundBriefing(VALID_DRAFT.roundId);
    expect(prepNotesBody(stored)).toBe("- Watch for theory");
    expect(stored?.updatedAt).toBe(laterNow);
  });

  it("appends after existing prep notes rather than overwriting them", () => {
    const draftResult = buildPreRoundBriefingRecordFromDraft({
      ...VALID_DRAFT,
      teamPrepNotes: ["Read the K first"],
    });
    if (!draftResult.ok) throw new Error("expected ok result");
    savePreRoundBriefing(draftResult.record, NOW);

    appendPrepNoteToPreRoundBriefing(VALID_DRAFT.roundId, "Watch for theory", NOW + 1_000);

    expect(prepNotesBody(getPreRoundBriefing(VALID_DRAFT.roundId))).toBe(
      "- Read the K first\n- Watch for theory",
    );
  });

  it("leaves the rest of the briefing untouched", () => {
    const draftResult = buildPreRoundBriefingRecordFromDraft(VALID_DRAFT);
    if (!draftResult.ok) throw new Error("expected ok result");
    savePreRoundBriefing(draftResult.record, NOW);

    const result = appendPrepNoteToPreRoundBriefing(VALID_DRAFT.roundId, "Watch for theory", NOW + 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.record.briefing.event).toEqual(draftResult.record.briefing.event);
    expect(result.record.roundId).toBe(VALID_DRAFT.roundId);
  });

  it("defaults updatedAt to the current time when now isn't supplied", () => {
    const draftResult = buildPreRoundBriefingRecordFromDraft(VALID_DRAFT);
    if (!draftResult.ok) throw new Error("expected ok result");
    savePreRoundBriefing(draftResult.record, NOW);

    const before = Date.now();
    const result = appendPrepNoteToPreRoundBriefing(VALID_DRAFT.roundId, "Watch for theory");
    const after = Date.now();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.record.updatedAt).toBeGreaterThanOrEqual(before);
    expect(result.record.updatedAt).toBeLessThanOrEqual(after);
  });
});

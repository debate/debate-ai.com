import { beforeEach, describe, expect, it } from "vitest";
import type { OpponentRoundRecord } from "debate-data-sync/src/rankings/opponent-team-profile";
import { buildOpponentTeamProfile } from "debate-data-sync/src/rankings/opponent-team-profile";
import { saveOpponentTeamProfile } from "debate-data-sync/src/state/opponentTeamProfiles";
import type { JudgeRoundRecord } from "debate-speech-writer/src/judge/judge-profile";
import { buildJudgeProfile } from "debate-speech-writer/src/judge/judge-profile";
import { saveJudgeProfile } from "debate-speech-writer/src/state/judgeProfiles";
import {
  buildPreRoundBriefing,
  buildPreRoundBriefingFromStores,
  buildPreRoundBriefingText,
  summarizePriorMeetings,
  type RoundEventInfo,
} from "../src/round/pre-round-briefing";

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

const EVENT: RoundEventInfo = {
  tournamentName: "Blake",
  division: "LD",
  roundLabel: "Round 4",
  side: "aff",
};

/** OpponentA's own round history, as fed into `buildOpponentTeamProfile`. */
function opponentRecords(): OpponentRoundRecord[] {
  return [
    {
      teamId: "OpponentA",
      tournamentName: "Blake",
      date: "2026-01-01",
      division: "LD",
      side: "neg",
      won: false,
      argumentTags: ["kritik"],
      opponentTeamId: "MyTeam",
    },
  ];
}

/** "MyTeam"'s own round history, from `won`/`opponentTeamId` reflecting MyTeam's results. */
function myTeamRecords(): OpponentRoundRecord[] {
  return [
    {
      teamId: "MyTeam",
      tournamentName: "Blake",
      date: "2026-01-01",
      division: "LD",
      side: "aff",
      won: true,
      opponentTeamId: "OpponentA",
    },
    {
      teamId: "MyTeam",
      tournamentName: "Greenhill",
      date: "2026-02-01",
      division: "LD",
      side: "aff",
      won: false,
      opponentTeamId: "OpponentA",
    },
    {
      teamId: "MyTeam",
      tournamentName: "Blake",
      date: "2026-01-02",
      division: "LD",
      side: "neg",
      won: true,
      opponentTeamId: "SomeoneElse",
    },
  ];
}

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

describe("summarizePriorMeetings", () => {
  it("returns zeroed-out summary for an empty record list", () => {
    expect(summarizePriorMeetings([])).toEqual({ meetings: 0, wins: 0, losses: 0 });
  });

  it("counts wins/losses from the record owner's perspective", () => {
    const records = myTeamRecords().filter((r) => r.opponentTeamId === "OpponentA");
    expect(summarizePriorMeetings(records)).toEqual({ meetings: 2, wins: 1, losses: 1 });
  });
});

describe("buildPreRoundBriefing", () => {
  it("reports explicit 'no data on file' lines when every optional input is omitted", () => {
    const briefing = buildPreRoundBriefing({ event: EVENT });

    expect(briefing.priorMeetings).toEqual({ meetings: 0, wins: 0, losses: 0 });
    const byTitle = Object.fromEntries(briefing.sections.map((s) => [s.title, s.body]));
    expect(byTitle["Opponent scouting"]).toBe("No opponent scouting data on file.");
    expect(byTitle["Prior meetings"]).toBe("No recorded prior meetings against this opponent.");
    expect(byTitle["Judge tendencies"]).toBe("No judge tendency data on file.");
    expect(byTitle["Team prep notes"]).toBe("No team prep notes on file for this matchup.");
  });

  it("includes the event's opponent label and room when supplied", () => {
    const briefing = buildPreRoundBriefing({
      event: { ...EVENT, opponentLabel: "Opponent A", room: "Rm 204" },
    });
    const eventBody = briefing.sections.find((s) => s.title === "Event")!.body;
    expect(eventBody).toContain("Opponent: Opponent A");
    expect(eventBody).toContain("Room: Rm 204");
  });

  it("treats a missing ownRecords list as no prior meetings when opponentTeamId is set", () => {
    const briefing = buildPreRoundBriefing({ event: EVENT, opponentTeamId: "OpponentA" });
    expect(briefing.priorMeetings).toEqual({ meetings: 0, wins: 0, losses: 0 });
  });

  it("ignores ownRecords with no opponentTeamId set", () => {
    const records: OpponentRoundRecord[] = [
      {
        teamId: "MyTeam",
        tournamentName: "Blake",
        date: "2026-01-01",
        division: "LD",
        side: "aff",
        won: true,
        // no opponentTeamId tracked for this round
      },
    ];
    const briefing = buildPreRoundBriefing({
      event: EVENT,
      ownRecords: records,
      opponentTeamId: "OpponentA",
    });
    expect(briefing.priorMeetings).toEqual({ meetings: 0, wins: 0, losses: 0 });
  });

  it("derives prior-meeting record only from rounds tagged against the given opponentTeamId", () => {
    const briefing = buildPreRoundBriefing({
      event: EVENT,
      ownRecords: myTeamRecords(),
      opponentTeamId: "OpponentA",
    });

    // 2 rounds vs OpponentA (1 win, 1 loss); the SomeoneElse round is excluded.
    expect(briefing.priorMeetings).toEqual({ meetings: 2, wins: 1, losses: 1 });
    const body = briefing.sections.find((s) => s.title === "Prior meetings")!.body;
    expect(body).toBe("2 prior meeting(s): 1-1 record against this opponent.");
  });

  it("renders the opponent scouting and judge tendency summaries when profiles are supplied", () => {
    const opponentProfile = buildOpponentTeamProfile("OpponentA", opponentRecords());
    const judgeProfile = buildJudgeProfile("J. Smith", judgeRecords());

    const briefing = buildPreRoundBriefing({ event: EVENT, opponentProfile, judgeProfile });
    const byTitle = Object.fromEntries(briefing.sections.map((s) => [s.title, s.body]));

    expect(byTitle["Opponent scouting"]).toContain("OpponentA");
    expect(byTitle["Judge tendencies"]).toContain("J. Smith");
  });

  it("renders prep notes as a bullet list", () => {
    const briefing = buildPreRoundBriefing({
      event: EVENT,
      teamPrepNotes: ["Watch for the kritik on neg.", "They read fast — flow carefully."],
    });
    const body = briefing.sections.find((s) => s.title === "Team prep notes")!.body;
    expect(body).toBe("- Watch for the kritik on neg.\n- They read fast — flow carefully.");
  });
});

describe("buildPreRoundBriefingFromStores", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it("resolves opponent/judge profiles from the persisted stores by id", () => {
    saveOpponentTeamProfile(buildOpponentTeamProfile("OpponentA", opponentRecords()));
    saveJudgeProfile(buildJudgeProfile("J. Smith", judgeRecords()));

    const briefing = buildPreRoundBriefingFromStores({
      event: EVENT,
      opponentTeamId: "OpponentA",
      judgeId: "J. Smith",
    });
    const byTitle = Object.fromEntries(briefing.sections.map((s) => [s.title, s.body]));

    expect(byTitle["Opponent scouting"]).toContain("OpponentA");
    expect(byTitle["Judge tendencies"]).toContain("J. Smith");
  });

  it("falls back to 'no data on file' sections when nothing is persisted for the given ids", () => {
    const briefing = buildPreRoundBriefingFromStores({
      event: EVENT,
      opponentTeamId: "Unknown",
      judgeId: "Unknown",
    });
    const byTitle = Object.fromEntries(briefing.sections.map((s) => [s.title, s.body]));

    expect(byTitle["Opponent scouting"]).toBe("No opponent scouting data on file.");
    expect(byTitle["Judge tendencies"]).toBe("No judge tendency data on file.");
  });

  it("prefers an explicitly supplied profile over a store lookup", () => {
    saveOpponentTeamProfile(buildOpponentTeamProfile("OpponentA", opponentRecords()));
    const explicitProfile = buildOpponentTeamProfile("OpponentA (explicit)", opponentRecords());

    const briefing = buildPreRoundBriefingFromStores({
      event: EVENT,
      opponentTeamId: "OpponentA",
      opponentProfile: explicitProfile,
    });
    const body = briefing.sections.find((s) => s.title === "Opponent scouting")!.body;

    expect(body).toContain("OpponentA (explicit)");
  });

  it("behaves like buildPreRoundBriefing when no ids or profiles are supplied", () => {
    const briefing = buildPreRoundBriefingFromStores({ event: EVENT });
    expect(briefing).toEqual(buildPreRoundBriefing({ event: EVENT }));
  });
});

describe("buildPreRoundBriefingText", () => {
  it("joins every section under a markdown heading, in section order", () => {
    const briefing = buildPreRoundBriefing({ event: EVENT });
    const text = buildPreRoundBriefingText(briefing);

    const titles = briefing.sections.map((s) => s.title);
    expect(titles).toEqual([
      "Event",
      "Opponent scouting",
      "Prior meetings",
      "Judge tendencies",
      "Team prep notes",
    ]);
    for (const section of briefing.sections) {
      expect(text).toContain(`### ${section.title}\n${section.body}`);
    }
  });
});

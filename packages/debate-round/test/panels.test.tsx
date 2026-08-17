/**
 * Render tests for the round/coach panels.
 *
 * As in the other packages, the Vitest environment is `node`, so these render
 * through `react-dom/server` and assert on the markup: each panel is checked
 * against the output of the slice it presents, with the store-backed panels
 * exercised in their pre-hydration (empty) state.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Box, Flow } from "debate-core/src/types/flow";

import { AiVersusRoundPanel } from "../src/panels/AiVersusRoundPanel";
import { ArgumentTreePanel } from "../src/panels/ArgumentTreePanel";
import { CoachMaterialsPanel } from "../src/panels/CoachMaterialsPanel";
import { CoachModePanel } from "../src/panels/CoachModePanel";
import { CoachingProgramPanel } from "../src/panels/CoachingProgramPanel";
import { DrillGeneratorPanel } from "../src/panels/DrillGeneratorPanel";
import { FlowAnnotationsPanel } from "../src/panels/FlowAnnotationsPanel";
import { FlowSummaryPanel } from "../src/panels/FlowSummaryPanel";
import { JudgeParadigmPanel } from "../src/panels/JudgeParadigmPanel";
import { JudgeProfilePanel } from "../src/panels/JudgeProfilePanel";
import { NdcaStandingsPanel } from "../src/panels/NdcaStandingsPanel";
import { OpponentPersonaPanel } from "../src/panels/OpponentPersonaPanel";
import { OpponentScoutingPanel } from "../src/panels/OpponentScoutingPanel";
import { PracticeRoundPanel } from "../src/panels/PracticeRoundPanel";
import { PreRoundBriefingPanel } from "../src/panels/PreRoundBriefingPanel";
import { ResponseOutcomePanel } from "../src/panels/ResponseOutcomePanel";
import { ScoutToStrategyPanel } from "../src/panels/ScoutToStrategyPanel";
import { SharedFlowSyncPanel } from "../src/panels/SharedFlowSyncPanel";
import { StrategySyncNotesPanel } from "../src/panels/StrategySyncNotesPanel";
import { WordCountRoundPanel } from "../src/panels/WordCountRoundPanel";

import type { FlowAnnotation } from "../src/flow/flow-annotations";
import type { PrepNote } from "../src/flow/strategy-sync-notes";
import type { FlowEdit } from "../src/flow/shared-flow-sync";
import type { CaseOption } from "../src/round/scout-to-strategy";
import type { RoundEventInfo } from "../src/round/pre-round-briefing";
import type { CoachMaterial } from "debate-speech-writer/src/coach/team-coach-materials";
import type { JudgeRoundRecord } from "debate-speech-writer/src/judge/judge-profile";
import type { OpponentRoundRecord } from "debate-data-sync/src/rankings/opponent-team-profile";
import type { TournamentResult } from "debate-data-sync/src/rankings/ndca-standings";

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return { ...(box as Box), ...overrides };
}

const flow: Flow = {
  content: "",
  level: 0,
  columns: COLUMNS,
  invert: false,
  focus: false,
  index: 0,
  lastFocus: [],
  id: 7,
  roundId: 7,
  children: [
    rowFromContents(["Warming advantage", "", "", ""], { isHeading: true }),
    rowFromContents(["Emissions cause extinction", "No warming impact", "Extend warming", ""]),
    rowFromContents(["Adaptation solves", "", "", ""]),
  ],
};

const emptyFlow: Flow = { ...flow, children: [], columns: [] };

describe("ArgumentTreePanel", () => {
  it("renders the heading-grouped tree with its filters", () => {
    const html = renderToStaticMarkup(<ArgumentTreePanel flow={flow} />);
    expect(html).toContain("Argument Tree");
    expect(html).toContain("Warming advantage");
    expect(html).toContain("1AC");
    expect(html).toContain("only unanswered");
  });

  it("renders an empty state for an empty flow", () => {
    const html = renderToStaticMarkup(<ArgumentTreePanel flow={emptyFlow} />);
    expect(html).toContain("Nothing matches");
  });
});

describe("FlowSummaryPanel", () => {
  it("summarises each row and flags the unanswered ones", () => {
    const html = renderToStaticMarkup(<FlowSummaryPanel flow={flow} roundId="7" />);
    expect(html).toContain("Flow Summary");
    expect(html).toContain("Emissions cause extinction");
    expect(html).toContain("unanswered");
  });
});

describe("ResponseOutcomePanel", () => {
  it("charts vulnerability and summarises each side", () => {
    const html = renderToStaticMarkup(<ResponseOutcomePanel flow={flow} />);
    expect(html).toContain("Response Outcomes");
    expect(html).toContain("Argument vulnerability chart");
    expect(html).toContain("Adaptation solves");
  });

  it("says there is nothing to chart for an empty flow", () => {
    const html = renderToStaticMarkup(<ResponseOutcomePanel flow={emptyFlow} />);
    expect(html).toContain("Nothing to chart");
  });
});

describe("CoachModePanel", () => {
  it("renders coaching prompts for a side", () => {
    const html = renderToStaticMarkup(<CoachModePanel flow={flow} sideKey="A" roundId="7" />);
    expect(html).toContain("Coach Mode");
    expect(html).toContain("Extend");
    expect(html).toContain("Weigh");
  });
});

describe("DrillGeneratorPanel", () => {
  it("renders a drill set for a side", () => {
    const html = renderToStaticMarkup(<DrillGeneratorPanel flow={flow} sideKey="N" roundId="7" />);
    expect(html).toContain("Drill Generator");
    expect(html).toContain("Drills");
  });
});

describe("FlowAnnotationsPanel", () => {
  const annotations: FlowAnnotation[] = [
    {
      id: "a1",
      flowId: 7,
      boxPath: [1],
      speechId: "1AC",
      timestampMs: 65_000,
      note: "Check the card date",
      createdAt: 1,
    },
  ];

  it("lists annotations at their timestamps", () => {
    const html = renderToStaticMarkup(
      <FlowAnnotationsPanel
        flow={flow}
        speechId="1AC"
        annotations={annotations}
        playbackMs={65_000}
      />,
    );
    expect(html).toContain("Flow Annotations");
    expect(html).toContain("1:05");
    expect(html).toContain("Check the card date");
  });
});

describe("StrategySyncNotesPanel", () => {
  const notes: PrepNote[] = [
    {
      id: "n1",
      flowId: 7,
      boxPath: [1],
      authorId: "alice",
      text: "Frontline the adaptation turn",
      status: "needs-follow-up",
      createdAt: 1,
      updatedAt: 1,
    },
  ];

  it("shows box-addressed notes and their status", () => {
    const html = renderToStaticMarkup(<StrategySyncNotesPanel flow={flow} notes={notes} />);
    expect(html).toContain("Strategy Sync Notes");
    expect(html).toContain("Frontline the adaptation turn");
    expect(html).toContain("needs-follow-up");
  });
});

describe("SharedFlowSyncPanel", () => {
  const edits: FlowEdit[] = [
    { id: "e1", flowId: 7, boxPath: [1], authorId: "alice", content: "New tag", timestampMs: 1_000 },
    { id: "e2", flowId: 7, boxPath: [1], authorId: "bob", content: "Other tag", timestampMs: 1_200 },
  ];

  it("shows the merge result and flags the conflicting box", () => {
    const html = renderToStaticMarkup(<SharedFlowSyncPanel flow={flow} edits={edits} />);
    expect(html).toContain("Shared Flow Sync");
    expect(html).toContain("Conflicts");
    expect(html).toContain("alice");
  });
});

describe("AiVersusRoundPanel", () => {
  it("renders the speech order and whose turn it is", () => {
    const html = renderToStaticMarkup(<AiVersusRoundPanel roundId="7" styleKey="policy" />);
    expect(html).toContain("Debate vs AI");
    expect(html).toContain("1AC");
    expect(html).toContain("Speech order");
  });
});

describe("PracticeRoundPanel", () => {
  it("renders the setup briefing and post-round feedback", () => {
    const html = renderToStaticMarkup(
      <PracticeRoundPanel roundId="7" flow={flow} feedbackSideKey="A" />,
    );
    expect(html).toContain("Practice Round Simulator");
    expect(html).toContain("Setup briefing");
    expect(html).toContain("Post-round feedback");
  });

  it("says feedback is unavailable without a flow", () => {
    const html = renderToStaticMarkup(<PracticeRoundPanel roundId="7" />);
    expect(html).toContain("No feedback yet");
  });
});

describe("WordCountRoundPanel", () => {
  it("shows the next speech and its word budget", () => {
    const html = renderToStaticMarkup(<WordCountRoundPanel roundId="7" />);
    expect(html).toContain("Word-Count Round");
    expect(html).toContain("AC");
    expect(html).toContain("words");
  });
});

describe("JudgeParadigmPanel", () => {
  it("lists the built-in paradigms", () => {
    const html = renderToStaticMarkup(<JudgeParadigmPanel roundId="7" />);
    expect(html).toContain("Judge Paradigm");
    expect(html).toContain("Flow / Tech Judge");
    expect(html).toContain("Lay / Community Judge");
  });
});

describe("OpponentPersonaPanel", () => {
  it("lists the built-in personas", () => {
    const html = renderToStaticMarkup(<OpponentPersonaPanel sessionId="7" />);
    expect(html).toContain("Practice Opponent");
    expect(html).toContain("Personas");
  });
});

describe("JudgeProfilePanel", () => {
  const records: JudgeRoundRecord[] = [
    {
      judgeId: "judge-1",
      tournamentName: "Glenbrooks",
      date: "2026-01-02",
      division: "Open",
      winningSide: "aff",
      affSpeakerPoints: 29,
      negSpeakerPoints: 28,
      paceWpm: 250,
      theoryArgumentRaised: true,
      theoryArgumentWon: false,
    },
    {
      judgeId: "judge-1",
      tournamentName: "Glenbrooks",
      date: "2026-01-03",
      division: "Open",
      winningSide: "aff",
      affSpeakerPoints: 29.5,
      negSpeakerPoints: 28.5,
      paceWpm: 260,
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
    },
  ];

  it("builds profiles from round records", () => {
    const html = renderToStaticMarkup(<JudgeProfilePanel records={records} />);
    expect(html).toContain("Judge Profiles");
    expect(html).toContain("judge-1");
    expect(html).toContain("2 rounds");
  });
});

describe("OpponentScoutingPanel", () => {
  const records: OpponentRoundRecord[] = [
    {
      teamId: "Lynbrook BZ",
      tournamentName: "Glenbrooks",
      date: "2026-01-02",
      division: "Open",
      side: "aff",
      won: true,
      argumentTags: ["Cap K"],
      caseName: "Warming Aff",
    },
  ];

  it("builds scouting profiles from round records", () => {
    const html = renderToStaticMarkup(<OpponentScoutingPanel records={records} />);
    expect(html).toContain("Opponent Scouting");
    expect(html).toContain("Lynbrook BZ");
    expect(html).toContain("Cap K");
  });
});

describe("PreRoundBriefingPanel", () => {
  const event: RoundEventInfo = {
    tournamentName: "Glenbrooks",
    division: "Open",
    roundLabel: "Octas",
    side: "aff",
    room: "203",
  };

  it("renders the event line and prior-meeting counts", () => {
    const html = renderToStaticMarkup(<PreRoundBriefingPanel event={event} roundId="7" />);
    expect(html).toContain("Pre-Round Briefing");
    expect(html).toContain("Glenbrooks");
    expect(html).toContain("Prior meetings");
    expect(html).toContain("203");
  });
});

describe("ScoutToStrategyPanel", () => {
  const caseOptions: CaseOption[] = [
    { name: "Warming Aff", argumentTags: ["warming", "extinction"] },
    { name: "Federalism Aff", argumentTags: ["states"] },
  ];

  it("ranks the case options and shows the matchup risk", () => {
    const html = renderToStaticMarkup(<ScoutToStrategyPanel caseOptions={caseOptions} />);
    expect(html).toContain("Scout to Strategy");
    expect(html).toContain("Warming Aff");
    expect(html).toContain("risk");
  });
});

describe("CoachMaterialsPanel", () => {
  const materials: CoachMaterial[] = [
    {
      id: "m1",
      kind: "lecture_transcript",
      title: "Collapsing in the 2NR",
      topic: "Rebuttals",
      tags: ["2nr"],
      text: "Pick one argument and go all in on it.",
    },
  ];

  it("groups the library by material kind", () => {
    const html = renderToStaticMarkup(<CoachMaterialsPanel materials={materials} />);
    expect(html).toContain("Coach Materials");
    expect(html).toContain("Lecture");
    expect(html).toContain("Collapsing in the 2NR");
  });
});

describe("NdcaStandingsPanel", () => {
  const results: TournamentResult[] = [
    {
      teamId: "Lynbrook BZ",
      tournamentName: "Glenbrooks",
      date: "2026-01-02",
      division: "Open",
      bidLevel: 2,
      finish: "semifinalist",
      prelimWins: 5,
      prelimLosses: 1,
    },
  ];

  it("ranks teams by qualification points", () => {
    const html = renderToStaticMarkup(<NdcaStandingsPanel results={results} />);
    expect(html).toContain("NDCA Standings");
    expect(html).toContain("Lynbrook BZ");
    expect(html).toContain("semifinalist");
  });

  it("renders an empty state with no results", () => {
    const html = renderToStaticMarkup(<NdcaStandingsPanel results={[]} />);
    expect(html).toContain("No results");
  });
});

describe("CoachingProgramPanel", () => {
  it("renders the program board for a supplied program", () => {
    const html = renderToStaticMarkup(
      <CoachingProgramPanel
        program={{ id: "p1", name: "Varsity", memberIds: ["alice"] }}
        topicSprint={{
          topic: "Climate",
          quests: [],
          contributions: [],
          now: Date.UTC(2026, 0, 15),
          coverageReport: { tracked: [], untracked: [] },
          contributors: [],
          assignments: [],
          notes: [],
        }}
        challenges={[]}
        memberFlows={[]}
      />,
    );
    expect(html).toContain("Coaching Program");
    expect(html).toContain("alice");
    expect(html).toContain("Member drills");
  });
});

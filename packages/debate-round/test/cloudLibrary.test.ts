import { describe, expect, it } from "vitest";
import {
  CLOUD_LIBRARY_KIND_LABELS,
  buildRecentCloudItems,
  countCloudItemsByKind,
  filterCloudItemsByKind,
  formatRelativeCloudTime,
  getSampleCloudLibraryItems,
  parseCloudTimestamp,
  type CloudCoachMaterialSummary,
  type CloudCounselPanelAssessmentSummary,
  type CloudCustomOpponentPersonaSummary,
  type CloudDebateSummary,
  type CloudDocumentSummary,
  type CloudDrillSetSummary,
  type CloudEvidenceLibraryEntrySummary,
  type CloudFlowAnnotationSummary,
  type CloudJudgeDecisionSummary,
  type CloudLibraryItem,
  type CloudLibraryItemKind,
  type CloudLearnDeckSummary,
  type CloudPracticeRoundSummary,
  type CloudPrepNoteSummary,
  type CloudQuickCardSummary,
  type CloudRoundPairingSummary,
  type CloudSpeechOutcomeSummary,
  type CloudSpeechSendLogSummary,
  type CloudSprintSessionSummary,
  type CloudStrategyRecommendationSummary,
  type CloudWordCountRoundSummary,
} from "../src/state/cloudLibrary";
import type { SavedFlowSummary } from "../src/state/savedFlows";
import type { SavedRoundSummary } from "../src/state/savedRounds";

describe("parseCloudTimestamp", () => {
  it("parses an ISO date string", () => {
    expect(parseCloudTimestamp("2026-08-30T12:00:00.000Z")).toBe(Date.parse("2026-08-30T12:00:00.000Z"));
  });

  it("treats a small number as unix seconds", () => {
    expect(parseCloudTimestamp(1_772_193_600)).toBe(1_772_193_600_000);
  });

  it("treats a large number as milliseconds already", () => {
    expect(parseCloudTimestamp(1_772_193_600_000)).toBe(1_772_193_600_000);
  });

  it("returns 0 for a non-finite number", () => {
    expect(parseCloudTimestamp(Number.NaN)).toBe(0);
    expect(parseCloudTimestamp(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("returns 0 for an unparseable string", () => {
    expect(parseCloudTimestamp("not a date")).toBe(0);
  });
});

describe("buildRecentCloudItems", () => {
  const documents: CloudDocumentSummary[] = [
    { id: 1, title: "Case Neg", updatedAt: "2026-08-28T00:00:00.000Z" },
  ];
  const flows: SavedFlowSummary[] = [
    { clientId: 2, label: "1AC vs Policy K", updatedAt: "2026-08-30T00:00:00.000Z" },
  ];
  const rounds: SavedRoundSummary[] = [
    { clientId: 3, label: "State Quals - Round 4", updatedAt: "2026-08-29T00:00:00.000Z" },
  ];
  const wordCountRounds: CloudWordCountRoundSummary[] = [
    { roundId: "round-9", updatedAt: Date.parse("2026-08-31T00:00:00.000Z") },
  ];
  const debates: CloudDebateSummary[] = [
    { id: "debate-4", topic: "Resolved: AI regulation", createdAt: Date.parse("2026-08-27T00:00:00.000Z") / 1000 },
  ];
  const speechOutcomes: CloudSpeechOutcomeSummary[] = [
    { id: "video-1::1AR::flow", speechKey: "1AR", savedAt: Date.parse("2026-09-01T00:00:00.000Z") },
  ];
  const drillSets: CloudDrillSetSummary[] = [
    { roundId: "round-9-drills", updatedAt: Date.parse("2026-08-25T00:00:00.000Z") },
  ];
  const judgeDecisions: CloudJudgeDecisionSummary[] = [
    { id: "decision-1", paradigmName: "Flow", generatedAt: Date.parse("2026-09-02T00:00:00.000Z") },
  ];
  const counselPanelAssessments: CloudCounselPanelAssessmentSummary[] = [
    { id: "assessment-1", roundId: "round-9", generatedAt: Date.parse("2026-09-03T00:00:00.000Z") },
  ];
  const roundPairings: CloudRoundPairingSummary[] = [
    {
      roundId: "round-9",
      tournamentName: "State Quals",
      roundLabel: "Round 4",
      updatedAt: Date.parse("2026-08-26T00:00:00.000Z"),
    },
  ];
  const strategyRecommendations: CloudStrategyRecommendationSummary[] = [
    { id: "strategy-1", matchupId: "matchup-9", generatedAt: Date.parse("2026-09-04T00:00:00.000Z") },
  ];
  const sprintSessions: CloudSprintSessionSummary[] = [
    { id: "session-1", topic: "AI regulation", title: "Saturday research push", createdAt: Date.parse("2026-09-05T00:00:00.000Z") },
  ];
  const speechSendLogEntries: CloudSpeechSendLogSummary[] = [
    { id: "send-1", preview: "The plan reduces emissions by...", sentAt: Date.parse("2026-09-06T00:00:00.000Z") },
  ];
  const learnDecks: CloudLearnDeckSummary[] = [
    { deckId: "deck-1", name: "K Cards", createdAt: "2026-09-07T00:00:00.000Z" },
  ];
  const customOpponentPersonas: CloudCustomOpponentPersonaSummary[] = [
    { id: "persona-1", name: "Coach Amy's K bot", updatedAt: Date.parse("2026-09-08T00:00:00.000Z") },
  ];
  const flowAnnotations: CloudFlowAnnotationSummary[] = [
    { id: "annotation-1", note: "Drop the theory shell here", tag: "theory", createdAt: Date.parse("2026-09-09T00:00:00.000Z") },
  ];
  const quickCards: CloudQuickCardSummary[] = [
    { id: "card-1", name: "Uniqueness overview", updatedAt: Date.parse("2026-09-10T00:00:00.000Z") },
  ];
  const prepNotes: CloudPrepNoteSummary[] = [
    { id: "note-1", text: "Drop the counterplan net benefit", updatedAt: Date.parse("2026-09-11T00:00:00.000Z") },
  ];
  const evidenceLibraryEntries: CloudEvidenceLibraryEntrySummary[] = [
    { id: "entry-1", cite: "Smith 24", argBlock: "Warming DA", createdAt: Date.parse("2026-09-12T00:00:00.000Z") },
  ];
  const practiceRounds: CloudPracticeRoundSummary[] = [
    { roundId: "round-13", createdAt: Date.parse("2026-09-13T00:00:00.000Z") },
  ];
  const coachMaterials: CloudCoachMaterialSummary[] = [
    { id: "material-1", title: "Camp Aff Lecture", updatedAt: "2026-09-14T00:00:00.000Z" },
  ];

  it("merges all twenty-one kinds and sorts newest first", () => {
    const items = buildRecentCloudItems(
      {
        documents,
        flows,
        rounds,
        wordCountRounds,
        debates,
        speechOutcomes,
        drillSets,
        judgeDecisions,
        counselPanelAssessments,
        roundPairings,
        strategyRecommendations,
        sprintSessions,
        speechSendLogEntries,
        learnDecks,
        customOpponentPersonas,
        flowAnnotations,
        quickCards,
        prepNotes,
        evidenceLibraryEntries,
        practiceRounds,
        coachMaterials,
      },
      { limit: 21 },
    );
    expect(items.map((i) => i.kind)).toEqual([
      "coachMaterial",
      "practiceRound",
      "evidenceLibraryEntry",
      "prepNote",
      "quickCard",
      "flowAnnotation",
      "customOpponentPersona",
      "learnDeck",
      "speechSendLogEntry",
      "sprintSession",
      "strategyRecommendation",
      "counselPanelAssessment",
      "judgeDecision",
      "speechOutcome",
      "wordCountRound",
      "flow",
      "round",
      "document",
      "debate",
      "roundPairing",
      "drillSet",
    ]);
  });

  it("includes debates, keyed by id and labeled by topic", () => {
    const items = buildRecentCloudItems({ debates });
    expect(items).toEqual([
      expect.objectContaining({ kind: "debate", key: "debate-debate-4", label: "Resolved: AI regulation" }),
    ]);
  });

  it("parses a debate's unix-seconds createdAt into milliseconds", () => {
    const items = buildRecentCloudItems({ debates });
    expect(items[0]?.updatedAtMs).toBe(Date.parse("2026-08-27T00:00:00.000Z"));
  });

  it("includes word-count rounds, keyed and labeled by roundId", () => {
    const items = buildRecentCloudItems({ wordCountRounds });
    expect(items).toEqual([
      expect.objectContaining({ kind: "wordCountRound", key: "wordCountRound-round-9", label: "round-9" }),
    ]);
  });

  it("falls back to createdAt for a word-count round with no updatedAt", () => {
    const items = buildRecentCloudItems({
      wordCountRounds: [{ roundId: "round-1", createdAt: Date.parse("2026-08-20T00:00:00.000Z") }],
    });
    expect(items[0]?.updatedAtMs).toBe(Date.parse("2026-08-20T00:00:00.000Z"));
  });

  it("includes speech outcome runs, keyed by id and labeled by speech key", () => {
    const items = buildRecentCloudItems({ speechOutcomes });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "speechOutcome",
        key: "speechOutcome-video-1::1AR::flow",
        label: "1AR Outcome",
        updatedAtMs: Date.parse("2026-09-01T00:00:00.000Z"),
      }),
    ]);
  });

  it("includes drill sets, keyed and labeled by roundId", () => {
    const items = buildRecentCloudItems({ drillSets });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "drillSet",
        key: "drillSet-round-9-drills",
        label: "round-9-drills",
        updatedAtMs: Date.parse("2026-08-25T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a drill set with no updatedAt as timestamp 0 rather than throwing", () => {
    const items = buildRecentCloudItems({ drillSets: [{ roundId: "round-1" }] });
    expect(items[0]?.updatedAtMs).toBe(0);
  });

  it("includes judge decisions, keyed by id and labeled by paradigm name", () => {
    const items = buildRecentCloudItems({ judgeDecisions });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "judgeDecision",
        key: "judgeDecision-decision-1",
        label: "Flow Decision",
        updatedAtMs: Date.parse("2026-09-02T00:00:00.000Z"),
      }),
    ]);
  });

  it("includes counsel-panel assessments, keyed by id and labeled by roundId", () => {
    const items = buildRecentCloudItems({ counselPanelAssessments });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "counselPanelAssessment",
        key: "counselPanelAssessment-assessment-1",
        label: "round-9",
        updatedAtMs: Date.parse("2026-09-03T00:00:00.000Z"),
      }),
    ]);
  });

  it("includes round pairings, keyed by roundId and labeled by tournament and round label", () => {
    const items = buildRecentCloudItems({ roundPairings });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "roundPairing",
        key: "roundPairing-round-9",
        label: "State Quals — Round 4",
        updatedAtMs: Date.parse("2026-08-26T00:00:00.000Z"),
      }),
    ]);
  });

  it("labels a round pairing by whichever of tournament/round label is present when the other is blank", () => {
    const items = buildRecentCloudItems({
      roundPairings: [
        { roundId: "r1", tournamentName: "  ", roundLabel: "Round 2" },
        { roundId: "r2", tournamentName: "Districts", roundLabel: "  " },
      ],
    });
    expect(items.map((i) => i.label)).toEqual(["Round 2", "Districts"]);
  });

  it("treats a round pairing with no updatedAt as timestamp 0 rather than throwing", () => {
    const items = buildRecentCloudItems({
      roundPairings: [{ roundId: "r1", tournamentName: "Districts", roundLabel: "Round 1" }],
    });
    expect(items[0]?.updatedAtMs).toBe(0);
  });

  it("includes strategy recommendations, keyed by id and labeled by matchupId", () => {
    const items = buildRecentCloudItems({ strategyRecommendations });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "strategyRecommendation",
        key: "strategyRecommendation-strategy-1",
        label: "matchup-9",
        updatedAtMs: Date.parse("2026-09-04T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a strategy recommendation with a blank matchupId as untitled", () => {
    const items = buildRecentCloudItems({
      strategyRecommendations: [{ id: "strategy-2", matchupId: "   ", generatedAt: Date.now() }],
    });
    expect(items[0]?.label).toBe("Untitled strategy recommendation");
  });

  it("includes sprint sessions, keyed by id and labeled by title", () => {
    const items = buildRecentCloudItems({ sprintSessions });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "sprintSession",
        key: "sprintSession-session-1",
        label: "Saturday research push",
        updatedAtMs: Date.parse("2026-09-05T00:00:00.000Z"),
      }),
    ]);
  });

  it("labels a sprint session by topic when its title is blank, and untitled when both are", () => {
    const items = buildRecentCloudItems({
      sprintSessions: [
        { id: "s1", topic: "AI regulation", title: "  ", createdAt: Date.now() },
        { id: "s2", topic: "  ", title: "  ", createdAt: Date.now() },
      ],
    });
    expect(items.map((i) => i.label)).toEqual(["AI regulation", "Untitled sprint session"]);
  });

  it("includes speech send-log entries, keyed by id and labeled by preview", () => {
    const items = buildRecentCloudItems({ speechSendLogEntries });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "speechSendLogEntry",
        key: "speechSendLogEntry-send-1",
        label: "The plan reduces emissions by...",
        updatedAtMs: Date.parse("2026-09-06T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a speech send-log entry with a blank preview as untitled", () => {
    const items = buildRecentCloudItems({
      speechSendLogEntries: [{ id: "send-2", preview: "   ", sentAt: Date.now() }],
    });
    expect(items[0]?.label).toBe("Untitled speech send");
  });

  it("includes learn decks, keyed by deckId and labeled by name", () => {
    const items = buildRecentCloudItems({ learnDecks });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "learnDeck",
        key: "learnDeck-deck-1",
        label: "K Cards",
        updatedAtMs: Date.parse("2026-09-07T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a learn deck with a blank name as untitled", () => {
    const items = buildRecentCloudItems({
      learnDecks: [{ deckId: "deck-2", name: "   ", createdAt: "2026-09-07T00:00:00.000Z" }],
    });
    expect(items[0]?.label).toBe("Untitled deck");
  });

  it("includes custom opponent personas, keyed by id and labeled by name", () => {
    const items = buildRecentCloudItems({ customOpponentPersonas });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "customOpponentPersona",
        key: "customOpponentPersona-persona-1",
        label: "Coach Amy's K bot",
        updatedAtMs: Date.parse("2026-09-08T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a custom opponent persona with a blank name as untitled", () => {
    const items = buildRecentCloudItems({
      customOpponentPersonas: [{ id: "persona-2", name: "   ", updatedAt: Date.now() }],
    });
    expect(items[0]?.label).toBe("Untitled persona");
  });

  it("includes flow annotations, keyed by id and labeled by note", () => {
    const items = buildRecentCloudItems({ flowAnnotations });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "flowAnnotation",
        key: "flowAnnotation-annotation-1",
        label: "Drop the theory shell here",
        updatedAtMs: Date.parse("2026-09-09T00:00:00.000Z"),
      }),
    ]);
  });

  it("labels a flow annotation by tag when its note is blank, and untitled when both are", () => {
    const items = buildRecentCloudItems({
      flowAnnotations: [
        { id: "a1", note: "  ", tag: "turn", createdAt: Date.now() },
        { id: "a2", note: "  ", tag: undefined, createdAt: Date.now() },
      ],
    });
    expect(items.map((i) => i.label)).toEqual(["turn", "Untitled annotation"]);
  });

  it("includes quick cards, keyed by id and labeled by name", () => {
    const items = buildRecentCloudItems({ quickCards });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "quickCard",
        key: "quickCard-card-1",
        label: "Uniqueness overview",
        updatedAtMs: Date.parse("2026-09-10T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a quick card with a blank name as untitled", () => {
    const items = buildRecentCloudItems({
      quickCards: [{ id: "card-2", name: "   ", updatedAt: Date.now() }],
    });
    expect(items[0]?.label).toBe("Untitled quick card");
  });

  it("includes prep notes, keyed by id and labeled by text", () => {
    const items = buildRecentCloudItems({ prepNotes });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "prepNote",
        key: "prepNote-note-1",
        label: "Drop the counterplan net benefit",
        updatedAtMs: Date.parse("2026-09-11T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a prep note with blank text as untitled", () => {
    const items = buildRecentCloudItems({
      prepNotes: [{ id: "note-2", text: "   ", updatedAt: Date.now() }],
    });
    expect(items[0]?.label).toBe("Untitled prep note");
  });

  it("includes evidence library entries, keyed by id and labeled by cite", () => {
    const items = buildRecentCloudItems({ evidenceLibraryEntries });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "evidenceLibraryEntry",
        key: "evidenceLibraryEntry-entry-1",
        label: "Smith 24",
        updatedAtMs: Date.parse("2026-09-12T00:00:00.000Z"),
      }),
    ]);
  });

  it("labels an evidence library entry by argBlock when cite is blank, and untitled when both are", () => {
    const items = buildRecentCloudItems({
      evidenceLibraryEntries: [
        { id: "entry-2", cite: "  ", argBlock: "Warming DA", createdAt: Date.now() },
        { id: "entry-3", cite: "  ", argBlock: "  ", createdAt: Date.now() },
      ],
    });
    expect(items.map((i) => i.label)).toEqual(["Warming DA", "Untitled evidence entry"]);
  });

  it("treats an evidence library entry with no createdAt as timestamp 0 rather than throwing", () => {
    const items = buildRecentCloudItems({
      evidenceLibraryEntries: [{ id: "entry-4", cite: "Smith 24", argBlock: "Warming DA" }],
    });
    expect(items[0]?.updatedAtMs).toBe(0);
  });

  it("includes practice rounds, keyed and labeled by roundId", () => {
    const items = buildRecentCloudItems({ practiceRounds });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "practiceRound",
        key: "practiceRound-round-13",
        label: "round-13",
        updatedAtMs: Date.parse("2026-09-13T00:00:00.000Z"),
      }),
    ]);
  });

  it("treats a practice round with no createdAt as timestamp 0 rather than throwing", () => {
    const items = buildRecentCloudItems({ practiceRounds: [{ roundId: "round-1" }] });
    expect(items[0]?.updatedAtMs).toBe(0);
  });

  it("includes coach materials, keyed by id and labeled by title", () => {
    const items = buildRecentCloudItems({ coachMaterials });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "coachMaterial",
        key: "coachMaterial-material-1",
        label: "Camp Aff Lecture",
        updatedAtMs: Date.parse("2026-09-14T00:00:00.000Z"),
      }),
    ]);
  });

  it("includes flows — the gap this module closes: the widget previously omitted them entirely", () => {
    const items = buildRecentCloudItems({ documents: [], flows, rounds: [] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "flow", key: "flow-2", label: "1AC vs Policy K" });
  });

  it("defaults hrefs per kind and lets a caller override them", () => {
    const items = buildRecentCloudItems(
      {
        documents,
        flows,
        rounds,
        wordCountRounds,
        debates,
        speechOutcomes,
        drillSets,
        judgeDecisions,
        counselPanelAssessments,
        roundPairings,
        strategyRecommendations,
        sprintSessions,
        speechSendLogEntries,
        learnDecks,
        customOpponentPersonas,
        flowAnnotations,
        quickCards,
        prepNotes,
        evidenceLibraryEntries,
        practiceRounds,
        coachMaterials,
      },
      { limit: 21 },
    );
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i.href]));
    expect(byKind.document).toBe("/reason-editor");
    expect(byKind.flow).toBe("/debate");
    expect(byKind.round).toBe("/debate");
    expect(byKind.wordCountRound).toBe("/word-count");
    expect(byKind.debate).toBe("/practice/versus-ai");
    expect(byKind.speechOutcome).toBe("/videos");
    expect(byKind.drillSet).toBe("/practice/drills");
    expect(byKind.judgeDecision).toBe("/practice/judge-decision");
    expect(byKind.counselPanelAssessment).toBe("/coaching/outcomes");
    expect(byKind.roundPairing).toBe("/practice/briefings");
    expect(byKind.strategyRecommendation).toBe("/practice/strategy");
    expect(byKind.sprintSession).toBe("/research");
    expect(byKind.speechSendLogEntry).toBe("/speech-documents");
    expect(byKind.learnDeck).toBe("/reason-editor");
    expect(byKind.customOpponentPersona).toBe("/practice");
    expect(byKind.flowAnnotation).toBe("/annotations");
    expect(byKind.quickCard).toBe("/reason-editor");
    expect(byKind.prepNote).toBe("/practice/prep-notes");
    expect(byKind.evidenceLibraryEntry).toBe("/research/cards/library");
    expect(byKind.practiceRound).toBe("/practice");
    expect(byKind.coachMaterial).toBe("/coaching/materials");

    const overridden = buildRecentCloudItems({ flows }, { flowHref: "/custom-flow-route" });
    expect(overridden[0]?.href).toBe("/custom-flow-route");

    const overriddenWordCount = buildRecentCloudItems({ wordCountRounds }, { wordCountRoundHref: "/custom-wc-route" });
    expect(overriddenWordCount[0]?.href).toBe("/custom-wc-route");

    const overriddenDebate = buildRecentCloudItems({ debates }, { debateHref: "/custom-debate-route" });
    expect(overriddenDebate[0]?.href).toBe("/custom-debate-route");

    const overriddenSpeechOutcome = buildRecentCloudItems(
      { speechOutcomes },
      { speechOutcomeHref: "/custom-outcome-route" },
    );
    expect(overriddenSpeechOutcome[0]?.href).toBe("/custom-outcome-route");

    const overriddenDrillSet = buildRecentCloudItems({ drillSets }, { drillSetHref: "/custom-drills-route" });
    expect(overriddenDrillSet[0]?.href).toBe("/custom-drills-route");

    const overriddenJudgeDecision = buildRecentCloudItems(
      { judgeDecisions },
      { judgeDecisionHref: "/custom-judge-decision-route" },
    );
    expect(overriddenJudgeDecision[0]?.href).toBe("/custom-judge-decision-route");

    const overriddenCounselPanelAssessment = buildRecentCloudItems(
      { counselPanelAssessments },
      { counselPanelAssessmentHref: "/custom-outcomes-route" },
    );
    expect(overriddenCounselPanelAssessment[0]?.href).toBe("/custom-outcomes-route");

    const overriddenRoundPairing = buildRecentCloudItems(
      { roundPairings },
      { roundPairingHref: "/custom-briefings-route" },
    );
    expect(overriddenRoundPairing[0]?.href).toBe("/custom-briefings-route");

    const overriddenStrategyRecommendation = buildRecentCloudItems(
      { strategyRecommendations },
      { strategyRecommendationHref: "/custom-strategy-route" },
    );
    expect(overriddenStrategyRecommendation[0]?.href).toBe("/custom-strategy-route");

    const overriddenSprintSession = buildRecentCloudItems(
      { sprintSessions },
      { sprintSessionHref: "/custom-research-route" },
    );
    expect(overriddenSprintSession[0]?.href).toBe("/custom-research-route");

    const overriddenSpeechSendLogEntry = buildRecentCloudItems(
      { speechSendLogEntries },
      { speechSendLogEntryHref: "/custom-speech-documents-route" },
    );
    expect(overriddenSpeechSendLogEntry[0]?.href).toBe("/custom-speech-documents-route");

    const overriddenLearnDeck = buildRecentCloudItems({ learnDecks }, { learnDeckHref: "/custom-reason-editor-route" });
    expect(overriddenLearnDeck[0]?.href).toBe("/custom-reason-editor-route");

    const overriddenCustomOpponentPersona = buildRecentCloudItems(
      { customOpponentPersonas },
      { customOpponentPersonaHref: "/custom-practice-round-route" },
    );
    expect(overriddenCustomOpponentPersona[0]?.href).toBe("/custom-practice-round-route");

    const overriddenFlowAnnotation = buildRecentCloudItems(
      { flowAnnotations },
      { flowAnnotationHref: "/custom-annotations-route" },
    );
    expect(overriddenFlowAnnotation[0]?.href).toBe("/custom-annotations-route");

    const overriddenQuickCard = buildRecentCloudItems({ quickCards }, { quickCardHref: "/custom-reason-editor-route" });
    expect(overriddenQuickCard[0]?.href).toBe("/custom-reason-editor-route");

    const overriddenPrepNote = buildRecentCloudItems({ prepNotes }, { prepNoteHref: "/custom-prep-notes-route" });
    expect(overriddenPrepNote[0]?.href).toBe("/custom-prep-notes-route");

    const overriddenEvidenceLibraryEntry = buildRecentCloudItems(
      { evidenceLibraryEntries },
      { evidenceLibraryEntryHref: "/custom-cards-library-route" },
    );
    expect(overriddenEvidenceLibraryEntry[0]?.href).toBe("/custom-cards-library-route");

    const overriddenPracticeRound = buildRecentCloudItems(
      { practiceRounds },
      { practiceRoundHref: "/custom-practice-round-route-2" },
    );
    expect(overriddenPracticeRound[0]?.href).toBe("/custom-practice-round-route-2");

    const overriddenCoachMaterial = buildRecentCloudItems(
      { coachMaterials },
      { coachMaterialHref: "/custom-coach-materials-route" },
    );
    expect(overriddenCoachMaterial[0]?.href).toBe("/custom-coach-materials-route");
  });

  it("falls back to an untitled label per kind when the title/label/roundId/topic/speechKey is blank", () => {
    const items = buildRecentCloudItems(
      {
        documents: [{ id: 1, title: "   ", updatedAt: "2026-08-30T00:00:00.000Z" }],
        flows: [{ clientId: 2, label: "", updatedAt: "2026-08-30T00:00:00.000Z" }],
        rounds: [{ clientId: 3, label: "", updatedAt: "2026-08-30T00:00:00.000Z" }],
        wordCountRounds: [{ roundId: "   ", updatedAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        debates: [{ id: "debate-1", topic: "  ", createdAt: Date.parse("2026-08-30T00:00:00.000Z") / 1000 }],
        speechOutcomes: [{ id: "outcome-1", speechKey: "  ", savedAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        drillSets: [{ roundId: "   ", updatedAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        judgeDecisions: [{ id: "decision-1", paradigmName: "  ", generatedAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        counselPanelAssessments: [
          { id: "assessment-1", roundId: "   ", generatedAt: Date.parse("2026-08-30T00:00:00.000Z") },
        ],
        roundPairings: [
          { roundId: "r1", tournamentName: "  ", roundLabel: "  ", updatedAt: Date.parse("2026-08-30T00:00:00.000Z") },
        ],
        strategyRecommendations: [
          { id: "strategy-1", matchupId: "   ", generatedAt: Date.parse("2026-08-30T00:00:00.000Z") },
        ],
        sprintSessions: [
          { id: "session-1", topic: "  ", title: "  ", createdAt: Date.parse("2026-08-30T00:00:00.000Z") },
        ],
        speechSendLogEntries: [
          { id: "send-1", preview: "   ", sentAt: Date.parse("2026-08-30T00:00:00.000Z") },
        ],
        learnDecks: [
          { deckId: "deck-1", name: "   ", createdAt: "2026-08-30T00:00:00.000Z" },
        ],
        customOpponentPersonas: [{ id: "persona-1", name: "   ", updatedAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        flowAnnotations: [
          { id: "annotation-1", note: "   ", tag: undefined, createdAt: Date.parse("2026-08-30T00:00:00.000Z") },
        ],
        quickCards: [{ id: "card-1", name: "   ", updatedAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        prepNotes: [{ id: "note-1", text: "   ", updatedAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        evidenceLibraryEntries: [
          { id: "entry-1", cite: "   ", argBlock: "   ", createdAt: Date.parse("2026-08-30T00:00:00.000Z") },
        ],
        practiceRounds: [{ roundId: "   ", createdAt: Date.parse("2026-08-30T00:00:00.000Z") }],
        coachMaterials: [{ id: "material-1", title: "   ", updatedAt: "2026-08-30T00:00:00.000Z" }],
      },
      { limit: 21 },
    );
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i.label]));
    expect(byKind.document).toBe("Untitled");
    expect(byKind.flow).toBe("Untitled flow");
    expect(byKind.round).toBe("Untitled round");
    expect(byKind.wordCountRound).toBe("Untitled round");
    expect(byKind.debate).toBe("Untitled debate");
    expect(byKind.speechOutcome).toBe("Untitled speech outcome");
    expect(byKind.drillSet).toBe("Untitled drill set");
    expect(byKind.judgeDecision).toBe("Untitled judge decision");
    expect(byKind.counselPanelAssessment).toBe("Untitled response-outcome chart");
    expect(byKind.roundPairing).toBe("Untitled pairing");
    expect(byKind.strategyRecommendation).toBe("Untitled strategy recommendation");
    expect(byKind.sprintSession).toBe("Untitled sprint session");
    expect(byKind.speechSendLogEntry).toBe("Untitled speech send");
    expect(byKind.learnDeck).toBe("Untitled deck");
    expect(byKind.customOpponentPersona).toBe("Untitled persona");
    expect(byKind.flowAnnotation).toBe("Untitled annotation");
    expect(byKind.quickCard).toBe("Untitled quick card");
    expect(byKind.prepNote).toBe("Untitled prep note");
    expect(byKind.evidenceLibraryEntry).toBe("Untitled evidence entry");
    expect(byKind.practiceRound).toBe("Untitled practice round");
    expect(byKind.coachMaterial).toBe("Untitled coach material");
  });

  it("caps each kind to perKindLimit before merging", () => {
    const manyFlows: SavedFlowSummary[] = Array.from({ length: 10 }, (_, i) => ({
      clientId: i,
      label: `Flow ${i}`,
      updatedAt: new Date(Date.UTC(2026, 7, 30 - i)).toISOString(),
    }));
    const items = buildRecentCloudItems({ flows: manyFlows }, { perKindLimit: 3, limit: 20 });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.label)).toEqual(["Flow 0", "Flow 1", "Flow 2"]);
  });

  it("caps the merged result to limit", () => {
    const items = buildRecentCloudItems({ documents, flows, rounds }, { limit: 2 });
    expect(items).toHaveLength(2);
  });

  it("returns an empty list for empty/omitted input", () => {
    expect(buildRecentCloudItems({})).toEqual([]);
    expect(
      buildRecentCloudItems({
        documents: [],
        flows: [],
        rounds: [],
        wordCountRounds: [],
        debates: [],
        speechOutcomes: [],
        drillSets: [],
        judgeDecisions: [],
        counselPanelAssessments: [],
        roundPairings: [],
        strategyRecommendations: [],
        sprintSessions: [],
        speechSendLogEntries: [],
        learnDecks: [],
        customOpponentPersonas: [],
        flowAnnotations: [],
        quickCards: [],
        prepNotes: [],
        evidenceLibraryEntries: [],
        practiceRounds: [],
        coachMaterials: [],
      }),
    ).toEqual([]);
  });
});

describe("getSampleCloudLibraryItems", () => {
  it("returns a non-empty, fixed list every time it's called", () => {
    const items = getSampleCloudLibraryItems();
    expect(items.length).toBeGreaterThan(0);
    expect(getSampleCloudLibraryItems()).toEqual(items);
  });

  it("marks every item as a sample with a zeroed timestamp", () => {
    for (const item of getSampleCloudLibraryItems()) {
      expect(item.isSample).toBe(true);
      expect(item.updatedAtMs).toBe(0);
    }
  });

  it("gives every item a distinct key and a non-empty label", () => {
    const items = getSampleCloudLibraryItems();
    const keys = new Set(items.map((item) => item.key));
    expect(keys.size).toBe(items.length);
    for (const item of items) {
      expect(item.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("points each sample at the same href a real item of that kind would use", () => {
    const items = getSampleCloudLibraryItems({
      documentHref: "/custom-doc",
      flowHref: "/custom-flow",
    });
    const byKind = new Map(items.map((item) => [item.kind, item]));
    expect(byKind.get("document")?.href).toBe("/custom-doc");
    expect(byKind.get("flow")?.href).toBe("/custom-flow");
  });

  it("never produces an item flagged as a sample from buildRecentCloudItems", () => {
    const built = buildRecentCloudItems({
      documents: [{ id: 1, title: "Real doc", updatedAt: "2026-08-30T12:00:00.000Z" }],
    });
    expect(built.every((item) => !item.isSample)).toBe(true);
  });
});

describe("formatRelativeCloudTime", () => {
  const now = Date.parse("2026-08-30T12:00:00.000Z");

  it("returns Today for a timestamp within the last 24 hours", () => {
    expect(formatRelativeCloudTime(now - 1000, now)).toBe("Today");
    expect(formatRelativeCloudTime(now, now)).toBe("Today");
  });

  it("returns Today for a timestamp in the future (clock skew tolerance)", () => {
    expect(formatRelativeCloudTime(now + 60_000, now)).toBe("Today");
  });

  it("returns Yesterday for a timestamp 1-2 days ago", () => {
    expect(formatRelativeCloudTime(now - 25 * 3_600_000, now)).toBe("Yesterday");
  });

  it("returns 'Nd ago' for older timestamps", () => {
    expect(formatRelativeCloudTime(now - 5 * 86_400_000, now)).toBe("5d ago");
  });

  it("returns an empty string for a non-finite timestamp", () => {
    expect(formatRelativeCloudTime(Number.NaN, now)).toBe("");
  });
});

describe("buildRecentCloudItems deletePath", () => {
  it("sets a delete path for flows and rounds only", () => {
    const items = buildRecentCloudItems({
      documents: [{ id: 1, title: "Doc", updatedAt: "2026-08-28T00:00:00.000Z" }],
      flows: [{ clientId: 2, label: "Flow", updatedAt: "2026-08-30T00:00:00.000Z" }],
      rounds: [{ clientId: 3, label: "Round", updatedAt: "2026-08-29T00:00:00.000Z" }],
    });
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i.deletePath]));
    expect(byKind).toEqual({ document: undefined, flow: "/api/flows/2", round: "/api/rounds/3" });
  });
});

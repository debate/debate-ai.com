/**
 * Opponent team scouting profiles.
 *
 * Turns an opposing team's caller-supplied round history into an aggregate
 * scouting profile — overall and per-side win/loss record, a rough side
 * preference signal, and their most commonly run argument tags and cases —
 * the computation layer behind a future opponent-scouting card (idea:
 * "Opponent Team Profiles" in TODO.md's Research Crowdsourcing Organizer
 * Features list). This does not scrape or reconstruct real round history
 * from Tabroom/tab-service data; callers supply their own
 * `OpponentRoundRecord`s (e.g. logged from their own past pairings, or
 * reconstructed from public ballots).
 */

export type DebateSide = "aff" | "neg";

/** A single round an opposing team competed in, as reconstructed by the caller. */
export interface OpponentRoundRecord {
  teamId: string;
  tournamentName: string;
  date: string;
  division: string;
  side: DebateSide;
  won: boolean;
  /** Argument/case-type tags the team ran this round, e.g. ["kritik", "topicality"]. */
  argumentTags?: string[];
  /** Free-text case/plan name run this round, if tracked. */
  caseName?: string;
  /** The opposing team's id for this round, if tracked — enables head-to-head lookups. */
  opponentTeamId?: string;
}

/** Minimum rounds recorded before `hasNotableSidePreference` can be flagged. */
const MIN_ROUNDS_FOR_SIDE_PREFERENCE = 5;
/** Minimum |affWinRate - negWinRate| to flag a notable side preference. */
const SIDE_PREFERENCE_THRESHOLD = 0.15;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface SideSplit {
  rounds: number;
  wins: number;
  winRate: number;
}

function buildSideSplit(records: OpponentRoundRecord[], side: DebateSide): SideSplit {
  const sideRecords = records.filter((r) => r.side === side);
  const wins = sideRecords.filter((r) => r.won).length;
  return {
    rounds: sideRecords.length,
    wins,
    winRate: sideRecords.length > 0 ? round2(wins / sideRecords.length) : 0,
  };
}

/** A tag/case name paired with how many recorded rounds it appeared in. */
export interface FrequencyCount {
  value: string;
  count: number;
}

/**
 * Counts occurrences of `select`'s return values across `records` (skipping
 * empty/undefined), sorted most-frequent first and tie-broken alphabetically
 * for a stable, deterministic order.
 */
function rankFrequencies(
  records: OpponentRoundRecord[],
  select: (record: OpponentRoundRecord) => string[] | string | undefined,
): FrequencyCount[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    const raw = select(record);
    const values = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
    for (const value of values) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .map(([value, count]) => ({ value, count }));
}

export interface OpponentTeamProfile {
  teamId: string;
  roundsRecorded: number;
  tournamentsAttended: number;
  record: { wins: number; losses: number; winRate: number };
  sideRecord: {
    aff: SideSplit;
    neg: SideSplit;
    /** True when the team performs notably better on one side across enough rounds. */
    hasNotableSidePreference: boolean;
    /** The side the team performs better on, when `hasNotableSidePreference` is true. */
    strongerSide: DebateSide | null;
  };
  /** Argument/case-type tags run, most frequent first. */
  topArgumentTags: FrequencyCount[];
  /** Case/plan names run, most frequent first. */
  topCases: FrequencyCount[];
}

/**
 * Aggregates an opposing team's round history into an `OpponentTeamProfile`:
 * overall win/loss record, a per-side split with a rough "which side do they
 * perform better on" signal, and their most commonly run argument tags and
 * case names — useful scouting habit notes ahead of a pairing against them.
 */
export function buildOpponentTeamProfile(
  teamId: string,
  records: OpponentRoundRecord[],
): OpponentTeamProfile {
  const roundsRecorded = records.length;
  const tournamentsAttended = new Set(records.map((r) => r.tournamentName)).size;

  const wins = records.filter((r) => r.won).length;
  const losses = roundsRecorded - wins;
  const winRate = roundsRecorded > 0 ? round2(wins / roundsRecorded) : 0;

  const aff = buildSideSplit(records, "aff");
  const neg = buildSideSplit(records, "neg");
  const hasNotableSidePreference =
    roundsRecorded >= MIN_ROUNDS_FOR_SIDE_PREFERENCE &&
    aff.rounds > 0 &&
    neg.rounds > 0 &&
    Math.abs(aff.winRate - neg.winRate) >= SIDE_PREFERENCE_THRESHOLD;
  const strongerSide = hasNotableSidePreference
    ? aff.winRate > neg.winRate
      ? "aff"
      : "neg"
    : null;

  return {
    teamId,
    roundsRecorded,
    tournamentsAttended,
    record: { wins, losses, winRate },
    sideRecord: { aff, neg, hasNotableSidePreference, strongerSide },
    topArgumentTags: rankFrequencies(records, (r) => r.argumentTags),
    topCases: rankFrequencies(records, (r) => r.caseName),
  };
}

/** Groups a flat list of round records by `teamId`, for building many profiles at once. */
export function groupRecordsByTeam(
  records: OpponentRoundRecord[],
): Record<string, OpponentRoundRecord[]> {
  const grouped: Record<string, OpponentRoundRecord[]> = {};
  for (const record of records) {
    (grouped[record.teamId] ??= []).push(record);
  }
  return grouped;
}

/** Builds an `OpponentTeamProfile` for every team keyed in `recordsByTeam`. */
export function buildOpponentTeamProfiles(
  recordsByTeam: Record<string, OpponentRoundRecord[]>,
): OpponentTeamProfile[] {
  return Object.entries(recordsByTeam).map(([teamId, records]) =>
    buildOpponentTeamProfile(teamId, records),
  );
}

/**
 * Filters a flat round-record list down to rounds recorded specifically
 * against `opponentTeamId` — the head-to-head history between two teams.
 * Rounds that never tracked an opponent id are excluded.
 */
export function getHeadToHeadRecords(
  records: OpponentRoundRecord[],
  opponentTeamId: string,
): OpponentRoundRecord[] {
  return records.filter((r) => r.opponentTeamId === opponentTeamId);
}

/**
 * Renders an `OpponentTeamProfile` as short, human-readable bullet lines
 * suitable for a pre-round scouting card or briefing.
 */
export function buildOpponentScoutingSummary(profile: OpponentTeamProfile): string {
  if (profile.roundsRecorded === 0) {
    return `${profile.teamId}: no recorded rounds on file.`;
  }

  const lines = [
    `${profile.teamId}: ${profile.roundsRecorded} round(s) recorded across ${profile.tournamentsAttended} tournament(s).`,
    `Record: ${profile.record.wins}-${profile.record.losses} (${Math.round(
      profile.record.winRate * 100,
    )}% win rate)`,
    `Side record: Aff ${profile.sideRecord.aff.wins}-${
      profile.sideRecord.aff.rounds - profile.sideRecord.aff.wins
    }, Neg ${profile.sideRecord.neg.wins}-${
      profile.sideRecord.neg.rounds - profile.sideRecord.neg.wins
    }` +
      (profile.sideRecord.hasNotableSidePreference
        ? ` (notably stronger on ${profile.sideRecord.strongerSide})`
        : ""),
  ];

  lines.push(
    profile.topArgumentTags.length > 0
      ? `Common arguments: ${profile.topArgumentTags
          .slice(0, 5)
          .map((t) => `${t.value} (${t.count})`)
          .join(", ")}`
      : "Common arguments: unknown (no tags recorded)",
  );

  lines.push(
    profile.topCases.length > 0
      ? `Common cases: ${profile.topCases
          .slice(0, 5)
          .map((c) => `${c.value} (${c.count})`)
          .join(", ")}`
      : "Common cases: unknown (no case names recorded)",
  );

  return lines.join("\n");
}

/**
 * Renders a whole scouting roster as a plain-text, printable/exportable
 * report — one `buildOpponentScoutingSummary` block per team, in the order
 * given (the caller supplies an already-ordered roster, e.g.
 * `buildOpponentTeamProfilesRoster`'s rounds-recorded-descending order) —
 * the "printable/exportable scouting report" follow-up named under the
 * "🕵️ Opponent Team Profiles" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list. Mirrors `debate-card-search`'s
 * `research-progress.ts#buildResearchProgressReportText` shape: a fixed
 * title, then one blank-line-separated block per roster entry, since a
 * scouting report (like a research-progress report) covers the whole
 * roster rather than a single team.
 */
export function buildOpponentScoutingReportText(roster: OpponentTeamProfile[]): string {
  if (roster.length === 0) {
    return "Opponent Scouting Report\n\nNo opponent team profiles are on file yet.";
  }

  const body = roster.map((profile) => buildOpponentScoutingSummary(profile)).join("\n\n");
  return `Opponent Scouting Report\n\n${body}`;
}

/** A fixed filename for a scouting-report download — the report covers the whole roster, not a single team, so there's no id to key it on. */
export function opponentScoutingReportFilename(): string {
  return "opponent-scouting-report.txt";
}

/**
 * A side-by-side comparison of two `OpponentTeamProfile`s — the "a
 * side-by-side us-vs-opponent comparison view" follow-up named under the
 * "🕵️ Opponent Team Profiles" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list. `a`/`b` are kept generic (not literally
 * "us"/"opponent") since the comparison math is symmetric; a caller building
 * an actual us-vs-opponent view supplies its own team's profile (e.g.
 * `buildOpponentTeamProfile("self", ownRecords)`) as one side.
 */
export interface OpponentTeamComparison {
  a: OpponentTeamProfile;
  b: OpponentTeamProfile;
  /** Argument tags recorded for both teams, ranked by combined frequency. */
  sharedArgumentTags: FrequencyCount[];
  /** Argument tags recorded for `a` but never recorded for `b`. */
  aOnlyArgumentTags: FrequencyCount[];
  /** Argument tags recorded for `b` but never recorded for `a`. */
  bOnlyArgumentTags: FrequencyCount[];
}

function sortFrequenciesDesc(entries: FrequencyCount[]): FrequencyCount[] {
  return [...entries].sort((x, y) =>
    y.count !== x.count ? y.count - x.count : x.value.localeCompare(y.value),
  );
}

/**
 * Builds a side-by-side comparison of two `OpponentTeamProfile`s: their
 * argument tags are split into shared ground (ranked by combined frequency
 * across both teams) and each team's own distinct tags — the scouting-useful
 * signal of what a team runs that the other doesn't.
 */
export function buildOpponentTeamComparison(
  a: OpponentTeamProfile,
  b: OpponentTeamProfile,
): OpponentTeamComparison {
  const aCounts = new Map(a.topArgumentTags.map((tag) => [tag.value, tag.count]));
  const bCounts = new Map(b.topArgumentTags.map((tag) => [tag.value, tag.count]));

  const shared: FrequencyCount[] = [];
  const aOnly: FrequencyCount[] = [];
  for (const [value, count] of aCounts) {
    const bCount = bCounts.get(value);
    if (bCount === undefined) {
      aOnly.push({ value, count });
    } else {
      shared.push({ value, count: count + bCount });
    }
  }
  const bOnly: FrequencyCount[] = [...bCounts.entries()]
    .filter(([value]) => !aCounts.has(value))
    .map(([value, count]) => ({ value, count }));

  return {
    a,
    b,
    sharedArgumentTags: sortFrequenciesDesc(shared),
    aOnlyArgumentTags: sortFrequenciesDesc(aOnly),
    bOnlyArgumentTags: sortFrequenciesDesc(bOnly),
  };
}

function formatComparisonRecord(profile: OpponentTeamProfile): string {
  return profile.roundsRecorded > 0
    ? `${profile.record.wins}-${profile.record.losses} (${Math.round(profile.record.winRate * 100)}%)`
    : "no recorded rounds";
}

function formatComparisonSideRecord(profile: OpponentTeamProfile, side: DebateSide): string {
  const split = profile.sideRecord[side];
  return split.rounds > 0
    ? `${split.wins}-${split.rounds - split.wins} (${Math.round(split.winRate * 100)}%)`
    : "—";
}

function formatComparisonTags(tags: FrequencyCount[]): string {
  return tags.length > 0 ? tags.map((tag) => `${tag.value} (${tag.count})`).join(", ") : "none";
}

/** Renders an `OpponentTeamComparison` as a downloadable plain-text document. */
export function buildOpponentTeamComparisonText(comparison: OpponentTeamComparison): string {
  const { a, b } = comparison;
  const lines = [
    `Opponent Comparison — ${a.teamId} vs. ${b.teamId}`,
    "",
    `Rounds recorded: ${a.teamId} ${a.roundsRecorded}, ${b.teamId} ${b.roundsRecorded}`,
    `Record: ${a.teamId} ${formatComparisonRecord(a)}, ${b.teamId} ${formatComparisonRecord(b)}`,
    `Aff record: ${a.teamId} ${formatComparisonSideRecord(a, "aff")}, ${b.teamId} ${formatComparisonSideRecord(b, "aff")}`,
    `Neg record: ${a.teamId} ${formatComparisonSideRecord(a, "neg")}, ${b.teamId} ${formatComparisonSideRecord(b, "neg")}`,
    `Shared arguments: ${formatComparisonTags(comparison.sharedArgumentTags)}`,
    `${a.teamId}-only arguments: ${formatComparisonTags(comparison.aOnlyArgumentTags)}`,
    `${b.teamId}-only arguments: ${formatComparisonTags(comparison.bOnlyArgumentTags)}`,
  ];
  return lines.join("\n");
}

/** A filesystem-safe filename for a comparison download, e.g. `opponent-comparison-us-vs-westlake-ab.txt`. */
export function opponentTeamComparisonFilename(
  a: OpponentTeamProfile,
  b: OpponentTeamProfile,
): string {
  const safeId = `${a.teamId}-vs-${b.teamId}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `opponent-comparison-${safeId || "teams"}.txt`;
}

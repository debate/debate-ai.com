import { teamCode } from "../model/teamCode";
import type { Decision, Scouting } from "../model/types";
import { stem } from "../persistence/flowPaths";

/** Lightweight per-flow projection: identity, timestamps, and scouting only. */
export interface RoundSummary {
    id: string;
    createdAt: number;
    updatedAt: number;
    /** teamCode(affSchool, 1A, 2A); "" when unscouted. */
    affTeam: string;
    /** teamCode(negSchool, 1N, 2N); "" when unscouted. */
    negTeam: string;
    tournament?: string;
    round?: string;
    flight?: string;
    date?: string;
    judge?: string;
    decision?: Decision;
}

/** The summary only reads identity, timestamps, and scouting. */
export interface SummarySource {
    id: string;
    createdAt: number;
    updatedAt: number;
    scouting: Scouting;
}

/** Derive a RoundSummary from a full round. */
export function buildSummary(round: SummarySource): RoundSummary {
    const sc = round.scouting;
    return {
        id: round.id,
        createdAt: round.createdAt,
        updatedAt: round.updatedAt,
        affTeam: teamCode(sc.affSchool ?? "", sc.aff.first, sc.aff.second),
        negTeam: teamCode(sc.negSchool ?? "", sc.neg.first, sc.neg.second),
        tournament: sc.tournament,
        round: sc.round,
        flight: sc.flight,
        date: sc.date,
        judge: sc.judge,
        decision: sc.decision,
    };
}

/**
 * How a recent flow names itself on the start screen: the matchup when the
 * round has been scouted, and the filename when it has not. A summary is null
 * when the file could not be parsed, which still deserves a row - a corrupt
 * flow the user can see and try to open beats one that quietly disappeared.
 */
export function recentLabel(summary: RoundSummary | null, path: string): string {
    if (!summary) return stem(path);
    const { affTeam, negTeam } = summary;
    if (affTeam && negTeam) return `${affTeam} vs ${negTeam}`;
    return affTeam || negTeam || stem(path);
}

/** The dim second line: tournament and round, when the flow carries them. */
export function recentDetail(summary: RoundSummary | null): string {
    if (!summary) return "";
    return [summary.tournament, summary.round].filter(Boolean).join(" ");
}

/**
 * @fileoverview The fast, rule-based half of "Auto-fill with AI": reads the
 * parts of a round video that its title and description spell out in a fixed
 * shape — format, tournament, round, the two teams, the result, a speech-doc
 * link and labelled argument lines — with the same parsers the YouTube sync
 * files rounds with.
 *
 * Only confident readings are returned: a field the text doesn't state in a
 * shape the parsers know is left out, for the model to fill. When everything
 * a round needs is here, `needsModel` is false and auto-fill skips the model
 * call altogether (no waiting on a free model for a title that already says
 * it all).
 * @module lib/videos/video-title-fields
 */

import {
  parseJudgeDecision,
  parseWinner,
} from "@debate-ai/videos-admin/src/sync/youtube/parsers/round-parsers";
import { parseQueuedRoundArgs } from "@debate-ai/videos-admin/src/sync/youtube/parsers/round-arguments";
import { readEventPhrase, readRoundTitle } from "@debate-ai/videos-admin/src/sync/youtube/parsers/round-title";
import { isRound } from "@debate-ai/videos-admin/src/sync/youtube/parsers/video-classifier";

/** Suggested form values. Absent keys mean "no suggestion — leave the field". */
export interface AutofillFields {
  title?: string;
  channel?: string;
  publishedAt?: string;
  viewCount?: number;
  description?: string;
  style?: number | null;
  category?: string | null;
  tournament?: string | null;
  roundLevel?: string | null;
  affTeam?: string | null;
  negTeam?: string | null;
  affWin?: boolean | null;
  judgeDecision?: string | null;
  speechDocsUrl?: string | null;
  /** The affirmative's arguments: the plan or advocacy and its advantages (the 1AC). */
  arg1ac?: string | null;
  /** The negative's positions: off-case and on-case arguments, ideally what went for the 2NR. */
  arg2nr?: string | null;
}

export interface TitleFieldsResult {
  /** What the title/description state outright. Absent keys: not stated in a known shape. */
  fields: AutofillFields;
  /** Whether the text looks like a recorded round (teams plus a round or result). */
  isRound: boolean;
  /** Whether anything is left that only the model can read. */
  needsModel: boolean;
}

/**
 * The format, only when the title (or a format-specific channel) names it.
 * Unlike the sync's `parseDebateStyle`, there is no "default to Policy": an
 * unstated format is left for the model.
 */
export function explicitStyle(title: string): number | null {
  const t = title.toLowerCase();
  if (/\bdartmouth\s+(rr|round\s*robin)\b/.test(t)) return 4;
  if (/\bcongress\b/.test(t)) return 9;
  if (/\b(parli|parliamentary|npda|npte|apda|npdl|npdi)\b/.test(t)) return 8;
  if (/\b(ndt|ceda|college\s+policy)\b/.test(t)) return 4;
  if (/\b(j?v?ld|nld|lincoln.?douglas)\b/.test(t)) return 3;
  if (/\b(v?pfd?|public\s*forum)\b/.test(t)) return 2;
  if (/\b(wsd|world\s*schools?)\b/.test(t)) return 5;
  if (/\b(cx|policy|cross.?ex(amination)?)\b/.test(t)) return 1;
  return null;
}

/**
 * The format a channel is named for ("Peninsula LD Debate", "Marist Public
 * Forum", "PF Videos"), or `null`. Only the high-school formats: a college
 * channel's name says nothing a title wouldn't.
 */
export function channelStyle(channel: string | null | undefined): number | null {
  if (!channel) return null;
  const c = channel.toLowerCase();
  const ld = /\b(ld|lincoln.?douglas)\b|^ld|ld$/.test(c);
  const pf = /\b(pf|public\s*forum)\b|^pf/.test(c);
  if (ld && !pf) return 3;
  if (pf && !ld) return 2;
  return null;
}

/**
 * The format the description's resolution implies: Lincoln-Douglas
 * resolutions are value claims ("… ought to …"); Policy and Public Forum
 * resolutions say "should". Only the LD reading is certain enough to use.
 */
export function resolutionStyle(description: string): number | null {
  return /\bresolved\b:?[^\n]{0,300}?\bought\b/i.test(description) ? 3 : null;
}

/**
 * The tournament and round from a description's "Event: 2024 Glenbrooks
 * Round 3" or "Tournament: Harvard" line, for titles that leave them out.
 */
export function descriptionEvent(description: string): { tournament: string | null; roundLevel: string | null } {
  const line = description.match(/^\s*(?:event|tournament)\s*[:\-]\s*(.+)$/im)?.[1];
  return line ? readEventPhrase(line) : { tournament: null, roundLevel: null };
}

/** Title words that mean a lecture or a breakdown, even with a "vs" in it. */
const LECTURE_TITLE =
  /\b(lecture|webinar|tutorial|how to|lesson|workshop|seminar|analysis|breakdown|explained|explainer|review|tips?|guide|redo|rebuttal redo|drills?)\b/i;

/** Hosts a round's speech documents live on. */
const SPEECH_DOC_URL =
  /https?:\/\/(?:[\w-]+\.)*(?:opencaselist\.com|caselist\.org|docs\.google\.com|drive\.google\.com|dropbox\.com|speechdrop\.net)\/[^\s)<>"']+/i;

/** The first speech-doc link in the description, trailing punctuation trimmed. */
export function speechDocsLink(description: string): string | null {
  const match = description.match(SPEECH_DOC_URL);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : null;
}

/**
 * The vote as the description states it ("2-1 (Smith, Jones, *Lee)",
 * "Unanimous"). The sync parser's last resort matches any "N-N", which in a
 * description is as often a season ("2023-24") or a score; only a
 * single-digit ballot count is kept here.
 */
function judgeDecision(description: string): string | null {
  const decision = parseJudgeDecision(description);
  if (!decision) return null;
  return /^\d-\d\b/.test(decision) || /^unanimous/i.test(decision) ? decision : null;
}

/** A round level or format word — nothing a team name runs on past. */
const TITLE_PREFIX_WORD =
  /^.*\b(?:Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Octafinals?|Octas|Doubles?|Triples?|Runoffs?|R\d+|Round\s*\d+|LD|PF|CX|Policy|Public Forum)\b[\s:,-]*/i;

/**
 * A team name without the title text the sync's "School AB (Aff)" pattern
 * can sweep in ahead of it: "Apple Valley PF Quarterfinals Strake WH" →
 * "Strake WH". Also drops a trailing "(Aff)"/"(Neg)" and a "| channel" tail.
 */
export function cleanTeam(team: string | null): string | null {
  if (!team) return null;
  const cleaned = team
    .replace(TITLE_PREFIX_WORD, "")
    .replace(/\s*\((?:aff|neg)\)\s*$/i, "")
    .replace(/\s*[|｜].*$/, "")
    .trim();
  return cleaned || null;
}

/** Words that mean the description talks about the arguments or the result. */
const ARGUMENT_HINTS =
  /\b(1ac|1nc|2nr|2ar|plan|advantages?|counterplans?|cps?|kritiks?|disads?|disadvantages?|das?|topicality|t-\w+|framework|aff(irmative)? (ran|read)|neg(ative)? (ran|read|went for))\b/i;
/**
 * Words that mean the description states the result. Bare "aff"/"neg" are
 * not enough: "Aff 1AC args: K" names a side's arguments, not a winner.
 */
const RESULT_HINTS =
  /\b(won|wins?|winner|decision|ballots?|\d-\d\s+(?:for|to)\b|for the (?:aff|neg)|(?:aff|neg)(?:irmative|ative)? (?:won|wins|takes|picks up))\b/i;

/**
 * Reads what the title and description state outright.
 *
 * @param input - The video's title, channel and description.
 */
export function readTitleFields(input: {
  title: string;
  channel?: string;
  description: string;
}): TitleFieldsResult {
  const { title, description } = input;
  const fields: AutofillFields = {};

  const docs = speechDocsLink(description);
  if (docs) fields.speechDocsUrl = docs;

  const reading = title ? readRoundTitle(title) : null;
  const readTeams = !!(reading?.affTeam && reading.negTeam);
  const round = !!title && (isRound(title, description) || (readTeams && !LECTURE_TITLE.test(title)));
  if (!round || !reading) {
    // Lectures and unclear videos: the category and format need the model.
    return { fields, isRound: false, needsModel: true };
  }

  fields.category = null;
  const style = explicitStyle(title) ?? resolutionStyle(description) ?? channelStyle(input.channel);
  if (style !== null) fields.style = style;

  const event = descriptionEvent(description);
  const tournament = reading.tournament ?? event.tournament;
  if (tournament) fields.tournament = tournament;

  const roundLevel = reading.roundLevel ?? event.roundLevel;
  if (roundLevel) fields.roundLevel = roundLevel;

  const affTeam = cleanTeam(reading.affTeam);
  const negTeam = cleanTeam(reading.negTeam);
  if (affTeam && negTeam) {
    fields.affTeam = affTeam;
    fields.negTeam = negTeam;
  }

  const winner = parseWinner(description);
  if (winner !== null) fields.affWin = winner;

  const decision = judgeDecision(description);
  if (decision) fields.judgeDecision = decision;

  const { arg1ac, arg2nr } = parseQueuedRoundArgs(description);
  if (arg1ac) fields.arg1ac = arg1ac;
  if (arg2nr) fields.arg2nr = arg2nr;

  const missingCore =
    fields.style === undefined ||
    !fields.tournament ||
    !fields.roundLevel ||
    !fields.affTeam ||
    !fields.negTeam;
  const unreadArguments = (!fields.arg1ac || !fields.arg2nr) && ARGUMENT_HINTS.test(description);
  const unreadResult = fields.affWin === undefined && RESULT_HINTS.test(description);

  return { fields, isRound: true, needsModel: missingCore || unreadArguments || unreadResult };
}

/** The readings as a few lines the model is told to keep, unless plainly wrong. */
export function describeTitleFields(fields: AutofillFields): string {
  const label: Array<[keyof AutofillFields, string]> = [
    ["style", "style"],
    ["tournament", "tournament"],
    ["roundLevel", "roundLevel"],
    ["affTeam", "affTeam"],
    ["negTeam", "negTeam"],
    ["affWin", "winner"],
    ["judgeDecision", "judgeDecision"],
    ["speechDocsUrl", "speechDocsUrl"],
    ["arg1ac", "affArguments"],
    ["arg2nr", "negArguments"],
  ];
  const styleName: Record<number, string> = { 1: "policy", 2: "pf", 3: "ld", 4: "college", 5: "wsd", 6: "acc", 7: "misc", 8: "parli", 9: "congress" };
  const lines: string[] = [];
  for (const [key, name] of label) {
    const value = fields[key];
    if (value === undefined || value === null) continue;
    if (key === "style") lines.push(`${name}: ${styleName[value as number] ?? value}`);
    else if (key === "affWin") lines.push(`${name}: ${value ? "aff" : "neg"}`);
    else lines.push(`${name}: ${String(value)}`);
  }
  return lines.join("\n");
}

/**
 * The four formats the recent-results section shows — Public Forum, Lincoln
 * Douglas, Policy and College Policy — and how to tell an event of one of them
 * from its Tabroom name and abbreviation. Tabroom's `event.type` is only
 * `debate`, so the format has to be read off the text tournaments write.
 */

import type { ResultsIndexEvent } from "./client";

export type TopFormat = "pf" | "ld" | "policy" | "college-policy";

/** Display order and labels: PF, LD, Policy, then College Policy. */
export const TOP_FORMATS: ReadonlyArray<{ id: TopFormat; label: string }> = [
  { id: "pf", label: "PF" },
  { id: "ld", label: "LD" },
  { id: "policy", label: "Policy" },
  { id: "college-policy", label: "College Policy" },
];

export const topFormatLabel = (format: TopFormat): string => TOP_FORMATS.find((f) => f.id === format)!.label;

/** An abbreviation token with the division prefixes tournaments glue on (`OPLD`, `JVCX`, `VPF`). */
const token = (name: string) => new RegExp(`(?:^|[^a-z])(?:v|jv|n|o|op|nov|var|open|varsity|novice|d\\d)?${name}(?![a-z])`, "i");

const PF = token("pf");
const LD = token("ld");
const CX = token("cx");
const NDT = /(?:^|[^a-z])(?:ndt|ceda)(?![a-z])/i;

/**
 * Which of the four top formats an event is, or `null` for every other event
 * (Congress, Parli, speech, World Schools…). College Policy is an NDT/CEDA
 * event, or a "college"/"collegiate" Policy/CX one; a Policy event with no
 * college wording is high-school Policy.
 */
export function topFormatOf(event: { abbr?: string | null; name?: string | null }): TopFormat | null {
  const name = event.name ?? "";
  const abbr = event.abbr ?? "";
  const both = `${name} ${abbr}`;
  const policy = /policy/i.test(name) || CX.test(abbr) || CX.test(name);
  if (NDT.test(both) || (/college|collegiate/i.test(both) && policy)) return "college-policy";
  if (policy) return "policy";
  if (/public\s*forum/i.test(name) || PF.test(abbr) || PF.test(name)) return "pf";
  if (/lincoln[\s-]*douglas/i.test(name) || LD.test(abbr) || LD.test(name)) return "ld";
  return null;
}

/** One event of a top format with its published result sets, ready for the results list. */
export interface TopFormatEvent {
  format: TopFormat;
  event: ResultsIndexEvent;
}

/**
 * The events in a tournament's results index that are PF, LD, Policy or
 * College Policy and have at least one published result set, in format order
 * and then by name. Every other event is dropped.
 */
export function topFormatEvents(byEvent: Record<string, ResultsIndexEvent> | null | undefined): TopFormatEvent[] {
  const order = new Map(TOP_FORMATS.map((f, i) => [f.id, i]));
  const found: TopFormatEvent[] = [];
  for (const event of Object.values(byEvent ?? {})) {
    if (!event?.ResultSets?.length) continue;
    const format = topFormatOf(event);
    if (format) found.push({ format, event });
  }
  return found.sort((a, b) => order.get(a.format)! - order.get(b.format)! || a.event.name.localeCompare(b.event.name));
}

type SetRef = ResultsIndexEvent["ResultSets"][number];

const words = (set: SetRef) => `${set.tag ?? ""} ${set.label ?? ""}`;
const isSpeakers = (set: SetRef) => /speaker/i.test(words(set));
const isBracket = (set: SetRef) => (set.tag ?? "").toLowerCase() === "bracket" || /bracket/i.test(set.label ?? "");

/** The result sets of an event the results list reads: final places, the bracket set, and speaker awards. */
export interface EventResultSets {
  finals: SetRef | null;
  bracket: SetRef | null;
  speakers: SetRef | null;
}

/**
 * Picks an event's final-places, bracket and speaker-award sets from its
 * published sets. Final places is Tabroom's `final` set (labelled "Final
 * Places"); failing that, any set labelled with "final" or "place" that is not
 * the bracket or the speakers. The newest set wins when several match.
 */
export function pickResultSets(sets: readonly SetRef[]): EventResultSets {
  const newest = (matches: SetRef[]) =>
    [...matches].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id - a.id)[0] ?? null;
  const rest = sets.filter((s) => !isSpeakers(s) && !isBracket(s));
  const finals =
    newest(rest.filter((s) => (s.tag ?? "").toLowerCase() === "final" || /final\s*places?/i.test(s.label ?? ""))) ??
    newest(rest.filter((s) => /final|place/i.test(words(s)) && !/prelim|bid|seed/i.test(words(s))));
  return {
    finals,
    bracket: newest(sets.filter(isBracket)),
    speakers: newest(sets.filter(isSpeakers)),
  };
}
